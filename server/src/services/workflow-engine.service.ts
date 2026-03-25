import logger from '../utils/logger';
import gptService, { ChatMessage } from './ai/gpt.service';

// --- Types ---

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface WorkflowMessage {
  type: 'scripted' | 'ai' | 'system';
  text: string;
  nodeLabel?: string;
}

export interface WorkflowStepResult {
  messages: WorkflowMessage[];
  waitingForInput: boolean;
  isComplete: boolean;
  currentStage: string | null;
  transferTo?: string;
  transferType?: string;
}

/** A single entry in the running conversation log (persists across all nodes) */
interface ConversationEntry {
  role: 'agent' | 'user';
  text: string;
  nodeLabel?: string;
}

export interface WorkflowEngineState {
  currentNodeId: string | null;
  fields: Record<string, any>;
  dialogueHistory: ChatMessage[];
  agentSystemMessage: string;
  isComplete: boolean;
  isInDialogue: boolean;
  currentDialogueNodeId: string | null;
  dialogueTurnCount: number;
  /** Full conversation log across ALL nodes — so dialogue AI knows what happened before */
  conversationContext: ConversationEntry[];
  /** True when the agent has spoken (scripted/play_audio/fallback) and is waiting for the caller to respond before advancing */
  isWaitingAfterSpoken: boolean;
  /** IDs of dialogue nodes that have been completed (transitioned out of). Prevents re-entry loops. */
  completedDialogueNodeIds: string[];
  /** Agent-level AI model override (e.g. "gpt-4o"). Empty = server default. */
  agentAiModel?: string;
}

// --- Condition evaluator ---

function evaluateCondition(
  fieldValue: any,
  operator: string,
  compareValue: string
): boolean {
  switch (operator) {
    case '==':
      return String(fieldValue ?? '') === String(compareValue);
    case '!=':
      return String(fieldValue ?? '') !== String(compareValue);
    case '>':
      return Number(fieldValue) > Number(compareValue);
    case '<':
      return Number(fieldValue) < Number(compareValue);
    case '>=':
      return Number(fieldValue) >= Number(compareValue);
    case '<=':
      return Number(fieldValue) <= Number(compareValue);
    case 'is_null':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    case 'is_not_null':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    default:
      return false;
  }
}

// --- Enforce brevity: split AI responses into individual sentences ---

/**
 * Split an AI response into individual sentences.
 * Each sentence is delivered as a separate message so TTS plays them one at a time.
 * This ensures natural pacing — one thought per turn, like a real human caller.
 */
function splitIntoSentences(text: string): string[] {
  if (!text) return [text];
  const sentencePattern = /([^.!?]*[.!?])(?:\s+|$)/g;
  const sentences: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = sentencePattern.exec(text)) !== null) {
    const s = match[1].trim();
    if (s) sentences.push(s);
  }
  // If no sentence boundaries found, return original as single item
  if (sentences.length === 0) return [text];
  if (sentences.length > 1) {
    logger.info('WorkflowEngine: Split AI response into sentences', {
      original: text.substring(0, 200),
      sentenceCount: sentences.length,
    });
  }
  return sentences;
}

// --- Parse AI response for transition signals ---

interface ParsedAIResponse {
  text: string;
  transition?: string;
  wantsToComplete: boolean;
  wantsFallback: boolean;
}

/**
 * Parse the AI response, extracting any transition signal and cleaning the text.
 * `validTransitionNames` — if provided, only transitions matching one of these names
 * are accepted. Any unknown transition name is silently stripped (the AI hallucinated it).
 */
function parseAIResponse(response: string, validTransitionNames?: string[]): ParsedAIResponse {
  // Extract transition signal (e.g. [TRANSITION:Interested])
  const transitionMatch = response.match(/\[TRANSITION:([^\]]+)\]/);
  let transition = transitionMatch ? transitionMatch[1].trim() : undefined;

  // Validate transition name against available options
  if (transition && validTransitionNames && validTransitionNames.length > 0) {
    const isValid = validTransitionNames.some(
      (name) => name.toLowerCase() === transition!.toLowerCase()
    );
    if (!isValid) {
      logger.warn('WorkflowEngine: AI produced invalid transition name, ignoring', {
        aiTransition: transition,
        validOptions: validTransitionNames,
      });
      transition = undefined;
    }
  }

  // Also detect bare transition names as tags (e.g. [Confirmed], [No Need])
  // AI sometimes outputs these instead of [TRANSITION:xxx]
  if (!transition && validTransitionNames && validTransitionNames.length > 0) {
    for (const name of validTransitionNames) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const bareMatch = response.match(new RegExp(`\\[${escapedName}\\]`, 'i'));
      if (bareMatch) {
        transition = name;
        logger.info('WorkflowEngine: Detected bare transition tag in AI response', {
          tag: bareMatch[0],
          transition: name,
        });
        break;
      }
    }
  }

  const wantsToComplete =
    !!transition ||
    response.includes('[NEXT]') ||
    response.includes('[STAGE_COMPLETE]');

  const wantsFallback = response.includes('[FALLBACK]');

  // Strip all control tags from the spoken text
  let text = response
    .replace(/\[TRANSITION:[^\]]+\]/g, '')
    .replace(/\[NEXT\]/g, '')
    .replace(/\[STAGE_COMPLETE\]/g, '')
    .replace(/\[FALLBACK\]/g, '')
    .trim();

  // Strip bare transition name tags (e.g. [Confirmed], [No Need])
  if (validTransitionNames && validTransitionNames.length > 0) {
    for (const name of validTransitionNames) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`\\[${escapedName}\\]`, 'gi'), '').trim();
    }
  }

  return { text, transition, wantsToComplete, wantsFallback };
}

/**
 * WorkflowEngine - Unified workflow execution engine.
 * Used by both test calls (TestAgentModal via API) and production calls (Twilio).
 *
 * Design: The engine is a state machine that processes nodes step by step.
 * - Non-interactive nodes (scripted, field_setter, junction, switch, etc.) execute immediately.
 * - Interactive nodes (dialogue) pause and wait for user input.
 * - conversationContext persists across ALL nodes so the AI always knows what happened before.
 */
export interface EngineTiming {
  /** Offset (ms) from processMessage start when the prompt/history was assembled */
  promptReadyAt: number;
  /** Offset (ms) from processMessage start when the LLM API call was sent */
  llmRequestSentAt: number;
  /** Offset (ms) from processMessage start when the LLM API call returned */
  llmDoneAt: number;
  /** Duration (ms) of the proactive stage completion check (runs in parallel) */
  proactiveCheckMs: number;
}

export class WorkflowEngine {
  private nodes: WorkflowNode[];
  private edges: WorkflowEdge[];
  private state: WorkflowEngineState;
  private _processing = false;
  /** Reference timestamp for per-turn timing measurements */
  private _processStartMs = 0;
  /** Timing data from the last processMessage call */
  public lastTiming: EngineTiming = { promptReadyAt: 0, llmRequestSentAt: 0, llmDoneAt: 0, proactiveCheckMs: 0 };
  /**
   * Optional callback to fetch full call message history from the database.
   * Set by VoiceConversationService to ensure end_call analysis gets ALL messages.
   */
  public fetchFullHistory?: () => Promise<Array<{ role: string; content: string }>>;

  /**
   * Optional callback to persist state to disk.
   * Called frequently during processMessage to ensure server restarts
   * don't revert to stale dialogue state.
   */
  public onStateChange?: () => void;

  /** Persist current state to disk (if callback is set). */
  private persistState(): void {
    if (this.onStateChange) {
      try { this.onStateChange(); } catch {}
    }
  }

  constructor(nodes: WorkflowNode[], edges: WorkflowEdge[], agentSystemMessage?: string, agentAiModel?: string) {
    this.nodes = nodes;
    this.edges = edges;
    this.state = {
      currentNodeId: null,
      fields: {},
      dialogueHistory: [],
      agentSystemMessage: agentSystemMessage || '',
      isComplete: false,
      isInDialogue: false,
      currentDialogueNodeId: null,
      dialogueTurnCount: 0,
      conversationContext: [],
      isWaitingAfterSpoken: false,
      completedDialogueNodeIds: [],
      agentAiModel: agentAiModel || '',
    };
  }

  // --- State management ---

  getState(): WorkflowEngineState {
    // Deep copy to prevent shared-reference issues during serialization
    return JSON.parse(JSON.stringify(this.state));
  }

  getFields(): Record<string, any> {
    return { ...this.state.fields };
  }

  isWaitingForInput(): boolean {
    return (this.state.isInDialogue || this.state.isWaitingAfterSpoken) && !this.state.isComplete;
  }

  isWorkflowComplete(): boolean {
    return this.state.isComplete;
  }

  /**
   * Add an entry to conversationContext from outside the engine.
   * Used to ensure messages handled by direct GPT path are still
   * available for end_call summary/analysis.
   */
  addToConversationContext(role: 'agent' | 'user', text: string, nodeLabel?: string): void {
    this.state.conversationContext.push({ role, text, nodeLabel });
  }

  /**
   * Get the full conversation context (read-only copy).
   */
  getConversationContext(): ConversationEntry[] {
    return [...this.state.conversationContext];
  }

  /** Restore engine from serialized state (for persisting across HTTP requests) */
  restoreState(savedState: WorkflowEngineState): void {
    this.state = {
      ...savedState,
      completedDialogueNodeIds: savedState.completedDialogueNodeIds || [],
    };
  }

  // --- Edge traversal ---

  private getNextNodeId(currentNodeId: string): string | null {
    const outEdges = this.edges.filter((e) => e.source === currentNodeId);
    if (outEdges.length === 0) return null;

    // Prefer the "default" handle edge (the standard "Next" output)
    const defaultEdge = outEdges.find((e) => e.sourceHandle === 'default' || !e.sourceHandle);
    if (defaultEdge) return defaultEdge.target;

    // Fallback: pick the edge whose target node has the lowest Y position (visually "next")
    if (outEdges.length > 1) {
      const sorted = outEdges
        .map((e) => ({
          edge: e,
          targetNode: this.nodes.find((n) => n.id === e.target),
        }))
        .filter((item) => item.targetNode)
        .sort((a, b) => (a.targetNode!.position.y - b.targetNode!.position.y));
      if (sorted.length > 0) return sorted[0].edge.target;
    }

    return outEdges[0].target;
  }

  private evaluateJunction(node: WorkflowNode): string | null {
    const fieldName = node.data?.left?.field_name || node.data?.conditionField;
    const operator = node.data?.operator || '==';
    const compareValue = node.data?.right?.literal || '';
    const fieldValue = this.state.fields[fieldName];

    const result = evaluateCondition(fieldValue, operator, compareValue);
    const outEdges = this.edges.filter((e) => e.source === node.id);

    const trueEdge = outEdges.find((e) => e.sourceHandle === 'true');
    const falseEdge = outEdges.find((e) => e.sourceHandle === 'false');

    if (result) {
      return trueEdge?.target || outEdges[0]?.target || null;
    } else {
      return falseEdge?.target || outEdges[1]?.target || outEdges[0]?.target || null;
    }
  }

  private evaluateSwitch(node: WorkflowNode): string | null {
    const switchField = node.data?.switchField;
    const fieldValue = this.state.fields[switchField];
    const cases = node.data?.cases || [];
    const outEdges = this.edges.filter((e) => e.source === node.id);

    const matchIndex = cases.findIndex(
      (c: any) => String(c.value) === String(fieldValue)
    );

    if (matchIndex >= 0) {
      const caseEdge = outEdges.find((e) => e.sourceHandle === `case-${matchIndex}`);
      return caseEdge?.target || outEdges[matchIndex]?.target || outEdges[0]?.target || null;
    }

    return outEdges[0]?.target || null;
  }

  private getDialogueNextNodeId(node: WorkflowNode, transitionName?: string): string | null {
    const transitions: Array<{ id: string; name: string }> = node.data?.transitions || [];
    const outEdges = this.edges.filter((e) => e.source === node.id);

    if (transitionName && transitions.length > 0) {
      const matched = transitions.find(
        (t) => t.name.toLowerCase() === transitionName.toLowerCase()
      );
      if (matched) {
        const handleId = matched.id || `t-${matched.name}`;
        const matchEdge = outEdges.find((e) => e.sourceHandle === handleId);
        if (matchEdge) {
          logger.info('WorkflowEngine: Transition edge matched', {
            transition: transitionName,
            handleId,
            targetNodeId: matchEdge.target,
          });
          return matchEdge.target;
        }
        // Edge not found for this transition handle — log and return null (do NOT fall through)
        logger.error('WorkflowEngine: Transition matched but no edge found for handle', {
          transition: transitionName,
          handleId,
          availableHandles: outEdges.map(e => e.sourceHandle),
        });
        return null;
      }
      // Transition name provided but doesn't match any defined transition — return null (do NOT fall through)
      logger.error('WorkflowEngine: Transition name not found in node transitions', {
        transition: transitionName,
        availableTransitions: transitions.map(t => t.name),
      });
      return null;
    }

    // No specific transition — use default handle or positional fallback
    return this.getNextNodeId(node.id);
  }

  private getDialogueFallbackNodeId(node: WorkflowNode): string | null {
    const outEdges = this.edges.filter((e) => e.source === node.id);
    const fallbackEdge = outEdges.find((e) => e.sourceHandle === 'fallback');
    return fallbackEdge?.target || null;
  }

  // --- Language-aware fallback messages ---

  private detectLanguage(): string {
    // Detect language from conversation context or system message
    const text = (this.state.agentSystemMessage + ' ' +
      this.state.conversationContext.map(e => e.text).join(' ')).toLowerCase();
    if (/\b(spreche|bitte|danke|guten|hallo|wiederhören|ja|nein)\b/.test(text)) return 'de';
    if (/\b(hola|gracias|buenos|por favor|sí)\b/.test(text)) return 'es';
    if (/\b(bonjour|merci|s'il vous|oui|non)\b/.test(text)) return 'fr';
    if (/\b(ciao|grazie|buongiorno|prego)\b/.test(text)) return 'it';
    return 'en';
  }

  /** Replace {{fieldName}} placeholders with actual field values from state */
  private substituteFieldVariables(text: string): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
      const value = this.state.fields[fieldName];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
      return match; // Keep placeholder if field not set
    });
  }

  private getLanguageAwareFallback(type: 'retry' | 'error' | 'greeting'): string {
    const lang = this.detectLanguage();
    const fallbacks: Record<string, Record<string, string>> = {
      en: {
        retry: "Could you repeat that?",
        error: "Sorry, could you say that again?",
        greeting: "Hello, how can I help you?",
      },
      de: {
        retry: "Könnten Sie das bitte wiederholen?",
        error: "Entschuldigung, könnten Sie das nochmal sagen?",
        greeting: "Hallo, wie kann ich Ihnen helfen?",
      },
      es: {
        retry: "¿Podría repetir eso?",
        error: "Disculpe, ¿podría decirlo de nuevo?",
        greeting: "Hola, ¿en qué puedo ayudarle?",
      },
      fr: {
        retry: "Pourriez-vous répéter?",
        error: "Excusez-moi, pourriez-vous répéter?",
        greeting: "Bonjour, comment puis-je vous aider?",
      },
      it: {
        retry: "Potrebbe ripetere?",
        error: "Mi scusi, potrebbe ripetere?",
        greeting: "Buongiorno, come posso aiutarla?",
      },
    };
    return fallbacks[lang]?.[type] || fallbacks.en[type];
  }

  // --- System prompt builder for dialogue stages ---

  /**
   * Extract {{variable}} names used in a text string.
   */
  private extractUsedVariables(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  }

  private buildDialogueSystemPrompt(node: WorkflowNode, includeTranscript = true): string {
    let prompt = this.state.agentSystemMessage || 'You are a helpful AI phone assistant.';

    const stageMessage = node.data?.stageMessage || 'Engage in natural conversation with the caller.';
    const substitutedStageMessage = this.substituteFieldVariables(stageMessage);

    // Only include field values that are actually used as {{variables}} in this stage's instructions.
    // This prevents the AI from acting on data it shouldn't know about (e.g., address in Introduction).
    const usedVars = this.extractUsedVariables(stageMessage);
    if (usedVars.length > 0) {
      const relevantFields: string[] = [];
      for (const varName of usedVars) {
        const val = this.state.fields[varName];
        if (val !== undefined && val !== null && val !== '') {
          relevantFields.push(`${varName} = ${JSON.stringify(val)}`);
        }
      }
      if (relevantFields.length > 0) {
        prompt += `\n\nVariable values for this stage: ${relevantFields.join(', ')}`;
      }
    }

    prompt += `\n\n## ABSOLUTE RULES — FOLLOW WITHOUT EXCEPTION:
1. You are in a REAL-TIME VOICE CALL. Be extremely concise — max 1 short sentence per response.
2. You must ONLY do what the Stage Instructions below tell you to do. NOTHING ELSE.
3. Do NOT ask questions, verify data, or discuss topics that are NOT explicitly mentioned in the Stage Instructions.
4. Do NOT improvise, add pleasantries, or go beyond the scope of the Stage Instructions.
5. When the Stage Instructions say to "execute transition" or "move to next" → append [NEXT] to your response.
6. When ALL tasks in the Stage Instructions are complete → append [NEXT].
7. [NEXT] is invisible to the caller — never say it aloud.
8. Do NOT repeat questions already asked. Do NOT re-introduce yourself.
9. One thought per response. If Stage Instructions have a long paragraph, break it into the shortest single statement.`;

    prompt += `\n\n---\n\n## Current Stage: "${node.data?.label || 'Dialogue'}"`;
    prompt += `\n\n### Stage Instructions (follow EXACTLY — do NOTHING beyond this):\n${substitutedStageMessage}`;

    const extraInstructions: string[] = (node.data?.extraInstructions || []).filter((i: string) => i.trim());
    if (extraInstructions.length > 0) {
      prompt += `\n\n### Additional Instructions:`;
      extraInstructions.forEach((inst: string, idx: number) => {
        prompt += `\n${idx + 1}. ${this.substituteFieldVariables(inst)}`;
      });
    }

    const overrides: Array<{ key: string; value: string }> = (node.data?.stageOverrides || []).filter((o: any) => o.key.trim());
    if (overrides.length > 0) {
      prompt += `\n\n### Stage Settings Overrides:`;
      overrides.forEach((o: any) => {
        prompt += `\n- ${o.key}: ${o.value}`;
      });
    }

    const enabledFunctions: Array<{ name: string; enabled: boolean }> = (node.data?.functions || []).filter((f: any) => f.enabled);
    if (enabledFunctions.length > 0) {
      prompt += `\n\n### Available Functions:`;
      prompt += `\nYou have access to these functions: ${enabledFunctions.map((f: any) => f.name).join(', ')}`;
    }

    const enabledKBs: Array<{ name: string; enabled: boolean }> = (node.data?.knowledgeBases || []).filter((kb: any) => kb.enabled);
    if (enabledKBs.length > 0) {
      prompt += `\n\n### Knowledge Bases:`;
      prompt += `\nYou have access to: ${enabledKBs.map((kb: any) => kb.name).join(', ')}`;
    }

    // NOTE: Field values are NOT shown to the AI. They are only used for
    // {{variable}} substitution in stage instructions. Showing raw field data
    // causes the AI to act on it (e.g., verifying addresses) even when the
    // stage instructions don't mention it.

    // --- CONVERSATION CONTEXT: only THIS stage's conversation ---
    // CRITICAL: Only include messages from the CURRENT dialogue node.
    // Including messages from other stages (Survey, Qualification, etc.) causes the AI
    // to get confused about its role and ask questions from other stages.
    const currentStageLabel = node.data?.label;
    if (includeTranscript && this.state.conversationContext.length > 0) {
      // Filter to ONLY messages from this stage
      const stageContext = this.state.conversationContext.filter(
        e => e.nodeLabel === currentStageLabel
      );

      if (stageContext.length > 0) {
        prompt += `\n\n### THIS STAGE'S CONVERSATION SO FAR:`;
        for (const entry of stageContext) {
          if (entry.role === 'agent') {
            prompt += `\nYou: "${entry.text}"`;
          } else {
            prompt += `\nCaller: "${entry.text}"`;
          }
        }
      }

      prompt += `\n\n⚠️ STRICT RULES:
- Do NOT repeat anything from the conversation above.
- The caller's previous answers are final — do NOT re-ask.
- Continue from exactly where this stage left off.
- ONLY follow YOUR Stage Instructions. Do NOT ask questions from other topics.`;
    } else if (!includeTranscript) {
      prompt += `\n\n⚠️ STRICT RULES:
- The call history is provided as chat messages above.
- Do NOT repeat anything you already said.
- The caller's previous answers are final — do NOT re-ask.
- Continue from exactly where this stage left off.
- ONLY follow YOUR Stage Instructions. Do NOT ask questions from other topics.`;
    }

    const maxTurns = parseInt(node.data?.maxTurns);
    if (maxTurns > 0) {
      prompt += `\n\nYou have a maximum of ${maxTurns} conversation turns in this stage.`;
    }

    const transitions: Array<{ id: string; name: string }> = node.data?.transitions || [];

    if (transitions.length > 0) {
      prompt += `\n\n### Stage Exits: ${transitions.map((t: any) => `"${t.name}"`).join(', ')}`;
      prompt += `\nThe system routes to the correct exit automatically. When the Stage Instructions say to "execute transition" or all tasks are done, append [NEXT].`;
    } else {
      prompt += `\n\nWhen all tasks in the Stage Instructions are complete, append [NEXT].`;
    }
    prompt += `\n[NEXT] is invisible to the caller. Never include [NEXT] if you just asked a question — wait for the answer first.`;
    prompt += `\nIf the caller is unintelligible after multiple attempts, append [FALLBACK].`;

    return prompt;
  }

  // --- AI response generation ---

  /**
   * Build initial dialogueHistory for a dialogue node.
   * When fetchFullHistory is available, fetches ALL call messages from the DB
   * and includes them as proper user/assistant chat messages so the AI
   * has full structured context (not just a text dump in the system prompt).
   */
  private async buildInitialDialogueHistory(
    node: WorkflowNode,
    firstUserMessage?: string
  ): Promise<ChatMessage[]> {
    let fullHistoryMessages: ChatMessage[] | null = null;

    if (this.fetchFullHistory) {
      try {
        const dbMessages = await this.fetchFullHistory();
        if (dbMessages.length > 0) {
          fullHistoryMessages = dbMessages.map((m) => ({
            role: (m.role === 'agent' || m.role === 'ai') ? 'assistant' : 'user',
            content: m.content,
          } as ChatMessage));
        }
      } catch (err) {
        logger.warn('WorkflowEngine: Failed to fetch full history for dialogue, using conversationContext', { error: err });
      }
    }

    // NOTE: We intentionally do NOT include full DB history as chat messages.
    // Full history from ALL stages confuses the AI about its current role.
    // Instead, buildDialogueSystemPrompt includes only THIS stage's conversation
    // from conversationContext, which is sufficient and stage-scoped.
    const stagePrompt = this.buildDialogueSystemPrompt(node, true);

    const history: ChatMessage[] = [{ role: 'system', content: stagePrompt }];

    if (firstUserMessage) {
      history.push({ role: 'user', content: firstUserMessage });
    }

    return history;
  }

  /**
   * Build a summary of agent questions and caller answers to prevent repetition.
   * Scans BOTH dialogueHistory (current conversation) AND conversationContext
   * (full call history) for the current stage.
   */
  private buildAnsweredSummary(): string | null {
    const qaPairs: string[] = [];
    const seen = new Set<string>(); // deduplicate

    // 1. Scan dialogueHistory for assistant→user pairs
    const allMessages = this.state.dialogueHistory;
    for (let i = 0; i < allMessages.length - 1; i++) {
      if (allMessages[i].role === 'assistant' && allMessages[i + 1]?.role === 'user') {
        const agentText = allMessages[i].content;
        const userText = allMessages[i + 1].content.trim();
        if (!userText || userText === '[SPEECH_NOT_RECOGNIZED]') continue;
        if (userText.startsWith('Continue from where')) continue;

        const key = agentText.substring(0, 60);
        if (!seen.has(key)) {
          seen.add(key);
          qaPairs.push(`  - You asked: "${agentText.substring(0, 120)}" → Caller said: "${userText}"`);
        }
      }
    }

    // 2. Also scan conversationContext for the current stage label
    //    This catches Q&A from earlier dialogue entries (e.g. after server restart rebuilds history)
    const currentLabel = this.state.currentDialogueNodeId
      ? this.nodes.find(n => n.id === this.state.currentDialogueNodeId)?.data?.label
      : null;
    if (currentLabel) {
      const ctx = this.state.conversationContext;
      for (let i = 0; i < ctx.length - 1; i++) {
        if (ctx[i].role === 'agent' && ctx[i].nodeLabel === currentLabel &&
            ctx[i + 1]?.role === 'user') {
          const agentText = ctx[i].text;
          const userText = ctx[i + 1].text?.trim();
          if (!userText || userText === '[SPEECH_NOT_RECOGNIZED]') continue;

          const key = agentText.substring(0, 60);
          if (!seen.has(key)) {
            seen.add(key);
            qaPairs.push(`  - You asked: "${agentText.substring(0, 120)}" → Caller said: "${userText}"`);
          }
        }
      }
    }

    if (qaPairs.length === 0) return null;

    return qaPairs.join('\n');
  }

  /**
   * Resolve which AI model to use for the current dialogue node.
   * Priority: per-node model > agent-level model > server default (from env/config).
   * Returns undefined to let gptService use its default.
   */
  private resolveDialogueModel(): string | undefined {
    // 1. Check per-node model override
    if (this.state.currentDialogueNodeId) {
      const node = this.nodes.find(n => n.id === this.state.currentDialogueNodeId);
      const nodeModel = node?.data?.model;
      if (nodeModel && nodeModel.trim()) {
        return nodeModel;
      }
    }
    // 2. Check agent-level model
    if (this.state.agentAiModel && this.state.agentAiModel.trim()) {
      return this.state.agentAiModel;
    }
    // 3. Fall through to server default (undefined = gptService uses config.openai.model)
    return undefined;
  }

  /**
   * Generate AI response using the full dialogue history.
   * Updates the system prompt with a fresh "already answered" list before each call.
   */
  private async generateAIResponse(): Promise<string | null> {
    try {
      const messages: ChatMessage[] = [...this.state.dialogueHistory];

      // Update the system prompt (first message) with fresh answered Q&A.
      const answeredSummary = this.buildAnsweredSummary();
      if (answeredSummary && messages.length > 0 && messages[0].role === 'system') {
        let sysContent = messages[0].content;
        const markerIdx = sysContent.indexOf('\n\n### ALREADY ANSWERED');
        if (markerIdx >= 0) sysContent = sysContent.substring(0, markerIdx);
        sysContent += `\n\n### ALREADY ANSWERED — DO NOT re-ask these:\n${answeredSummary}\n\nYou MUST ask the NEXT unanswered question from the Stage Instructions. If you repeat a question listed above, the call will fail.`;
        messages[0] = { role: 'system', content: sysContent };
      }

      // Resolve model: per-node override > agent-level > server default
      const model = this.resolveDialogueModel();

      // Track timing: prompt is ready, LLM call about to start
      this.lastTiming.promptReadyAt = Date.now() - this._processStartMs;
      this.lastTiming.llmRequestSentAt = Date.now() - this._processStartMs;

      const aiResponse = await gptService.generateWithHistory(
        messages,
        { maxTokens: 150, temperature: 0.2, model }
      );

      // Track timing: LLM call done (non-streaming, so first_token = done)
      this.lastTiming.llmDoneAt = Date.now() - this._processStartMs;

      return aiResponse.text || null;
    } catch (error) {
      logger.error('WorkflowEngine: Failed to generate AI response', { error });
      return null;
    }
  }

  /**
   * Separate AI call to analyze whether a transition should fire.
   * This decouples routing decisions from response generation,
   * preventing the AI from prematurely firing transitions.
   */
  private async analyzeTransition(
    node: WorkflowNode,
    aiResponseText: string,
    userMessage: string,
  ): Promise<string | null> {
    const transitions: Array<{ id: string; name: string }> = node.data?.transitions || [];
    if (transitions.length === 0) return null;

    const stageMessage = this.substituteFieldVariables(node.data?.stageMessage || '');
    const transitionList = transitions.map(t => t.name).join(', ');

    // Build a focused prompt for transition analysis.
    // Only include conversation from THIS stage (filtered by nodeLabel) to prevent
    // earlier stages' content from confusing the routing decision.
    // Note: the current user message and AI response are already in conversationContext
    // (pushed at lines above), so we just use the filtered context — no need to add them again.
    const currentStageContext = this.state.conversationContext
      .filter(e => e.nodeLabel === node.data?.label || !e.nodeLabel)
      .slice(-10);

    const analysisPrompt = `You are a routing analyzer. The agent has signaled that this stage is complete. Your job is to decide WHICH exit to take.

STAGE: "${node.data?.label}"
STAGE INSTRUCTIONS:
${stageMessage}

AVAILABLE TRANSITIONS: ${transitionList}
- "${transitions[0]?.name}" = the caller completed the stage successfully (default/happy path).
- Other transitions = the caller indicated a specific exit condition (e.g. refused, not qualified, wants to end).

CONVERSATION IN THIS STAGE:
${currentStageContext.map(e => `${e.role === 'agent' ? 'Agent' : 'Caller'}: "${e.text}"`).join('\n')}

Based on the conversation outcome, which transition best matches? Output ONLY the transition name.`;

    try {
      const result = await gptService.generateWithCustomPrompt(
        analysisPrompt,
        'You are a routing decision engine. Output only the transition name or NONE.',
        { maxTokens: 20, temperature: 0.1, model: 'gpt-4o-mini' }
      );

      const answer = (result.text || '').trim();
      logger.info('WorkflowEngine: Transition analysis result', {
        nodeLabel: node.data?.label,
        userMessage: userMessage.substring(0, 50),
        aiResponse: aiResponseText.substring(0, 50),
        analysisResult: answer,
        validTransitions: transitions.map(t => t.name),
      });

      if (!answer || answer.toUpperCase() === 'NONE') return null;

      // Validate the answer against available transitions
      const matched = transitions.find(
        t => t.name.toLowerCase() === answer.toLowerCase()
      );
      return matched ? matched.name : null;
    } catch (error) {
      logger.error('WorkflowEngine: Transition analysis failed', { error });
      return null;
    }
  }

  /**
   * Proactive stage completion check — runs IN PARALLEL with AI response generation.
   * Determines if the user's latest message completes the current stage objective,
   * even when the Response AI forgets to signal [NEXT].
   * Uses gpt-4o-mini (~200-300ms) so it finishes before the main AI call (~2-4s).
   */
  private async checkStageCompletion(
    node: WorkflowNode,
    userMessage: string,
  ): Promise<string | null> {
    const transitions: Array<{ id: string; name: string }> = node.data?.transitions || [];
    if (transitions.length === 0) return null;

    const stageMessage = this.substituteFieldVariables(node.data?.stageMessage || '');
    const transitionNames = transitions.map(t => t.name);

    // Only include messages from THIS stage to avoid cross-stage confusion
    const stageContext = this.state.conversationContext
      .filter(e => e.nodeLabel === node.data?.label)
      .slice(-12);

    const prompt = `Analyze if this call stage has FULLY completed its objective. Be CONSERVATIVE — only advance when ALL steps are clearly done.

STAGE: "${node.data?.label}"
STAGE INSTRUCTIONS:
${stageMessage}

TRANSITIONS: ${transitionNames.map(n => `"${n}"`).join(', ')}

CONVERSATION SO FAR:
${stageContext.map(e => `${e.role === 'agent' ? 'Agent' : 'Caller'}: "${e.text}"`).join('\n')}

RULES (follow strictly):
1. Read the Stage Instructions carefully. Count ALL the steps/questions listed.
2. Check the conversation: has the Agent asked EVERY step/question? Has the Caller answered EVERY one?
3. If even ONE step/question from the instructions has NOT been asked yet, output NONE.
4. If the Agent asked a question but the Caller has NOT answered it yet, output NONE.
5. Only output a transition name if ALL steps are done OR a specific early-exit condition was clearly triggered (e.g., caller explicitly refused).
6. When in doubt, output NONE. It is MUCH better to stay than to advance too early.

Output ONLY the transition name or NONE.`;

    try {
      const checkStartMs = Date.now();
      const result = await gptService.generateWithCustomPrompt(
        prompt,
        'Output only NONE or a transition name. Nothing else.',
        { maxTokens: 20, temperature: 0.1, model: 'gpt-4o-mini' }
      );

      this.lastTiming.proactiveCheckMs = Date.now() - checkStartMs;
      const answer = (result.text || '').trim().replace(/['"]/g, '');

      if (!answer || answer.toUpperCase() === 'NONE') return null;

      const matched = transitions.find(
        t => t.name.toLowerCase() === answer.toLowerCase()
      );

      if (matched) {
        logger.info('WorkflowEngine: Proactive completion check detected stage is done', {
          nodeLabel: node.data?.label,
          transition: matched.name,
          userMessage: userMessage.substring(0, 50),
          checkMs: this.lastTiming.proactiveCheckMs,
        });
      }

      return matched ? matched.name : null;
    } catch (error) {
      this.lastTiming.proactiveCheckMs = Date.now() - (this._processStartMs || Date.now());
      logger.error('WorkflowEngine: Stage completion check failed', { error });
      return null;
    }
  }

  /** Brief acknowledgment for when the stage completes via proactive check */
  private getBriefAcknowledgment(): string {
    const lang = this.detectLanguage();
    const acks: Record<string, string> = {
      en: 'Thank you.',
      de: 'Danke.',
      es: 'Gracias.',
      fr: 'Merci.',
      it: 'Grazie.',
    };
    return acks[lang] || acks.en;
  }

  // --- Main execution ---

  /**
   * Start the workflow from a given call direction.
   * Processes all non-interactive nodes until it hits a dialogue node or the end.
   */
  async start(direction: 'inbound' | 'outbound'): Promise<WorkflowStepResult> {
    const messages: WorkflowMessage[] = [];

    logger.info('WorkflowEngine: Starting workflow', {
      direction,
      nodeCount: this.nodes.length,
      edgeCount: this.edges.length,
    });

    // Find and process the agentSetup node to extract system message
    const agentSetupNode = this.nodes.find(
      (n) => n.type === 'agentSetup' || n.data?.type === 'agentSetup'
    );
    if (agentSetupNode?.data?.systemMessage) {
      this.state.agentSystemMessage = agentSetupNode.data.systemMessage;
    }

    // Find the call direction start node
    const startNode = this.nodes.find(
      (n) => (n.type === 'callDirection' || n.data?.type === 'callDirection') && n.data?.direction === direction
    );

    if (!startNode) {
      this.state.isComplete = true;
      return {
        messages: [{ type: 'system', text: `No ${direction} start node found` }],
        waitingForInput: false,
        isComplete: true,
        currentStage: null,
      };
    }

    // Start from the callDirection node
    this.state.currentNodeId = startNode.id;

    // Execute the workflow
    return this.executeFromCurrent(messages);
  }

  /**
   * Process a user message during a dialogue stage.
   * If the dialogue completes, continues executing subsequent non-interactive nodes.
   */
  async processMessage(userMessage: string): Promise<WorkflowStepResult> {
    // Prevent concurrent calls — if a previous processMessage is still running,
    // return a busy result instead of corrupting state.
    if (this._processing) {
      logger.warn('WorkflowEngine: processMessage called while already processing — rejecting');
      return {
        messages: [{ type: 'system', text: 'Still processing, please wait' }],
        waitingForInput: true,
        isComplete: false,
        currentStage: 'Processing...',
      };
    }

    this._processing = true;

    try {
      return await this._processMessageInternal(userMessage);
    } catch (error) {
      logger.error('WorkflowEngine: Unhandled error in processMessage', {
        error,
        userMessage: userMessage?.substring(0, 100),
        state: {
          isInDialogue: this.state.isInDialogue,
          isWaitingAfterSpoken: this.state.isWaitingAfterSpoken,
          currentNodeId: this.state.currentNodeId,
          currentDialogueNodeId: this.state.currentDialogueNodeId,
          dialogueTurnCount: this.state.dialogueTurnCount,
          dialogueHistoryLength: this.state.dialogueHistory.length,
        },
      });

      // Return a graceful error instead of letting the exception propagate as a 500
      return {
        messages: [{ type: 'system', text: 'Something went wrong, please try again' }],
        waitingForInput: this.state.isInDialogue || this.state.isWaitingAfterSpoken,
        isComplete: false,
        currentStage: 'Error',
      };
    } finally {
      this._processing = false;
    }
  }

  private async _processMessageInternal(userMessage: string): Promise<WorkflowStepResult> {
    const messages: WorkflowMessage[] = [];
    // Reset timing for this turn
    this._processStartMs = Date.now();
    this.lastTiming = { promptReadyAt: 0, llmRequestSentAt: 0, llmDoneAt: 0, proactiveCheckMs: 0 };

    if (this.state.isComplete) {
      return {
        messages: [{ type: 'system', text: 'Workflow completed' }],
        waitingForInput: false,
        isComplete: true,
        currentStage: null,
      };
    }

    // --- Case 1: Waiting after a spoken (scripted) node ---
    // The agent spoke something and is waiting for the caller to respond.
    // Capture the response, then continue executing the workflow from the next node.
    if (this.state.isWaitingAfterSpoken) {
      logger.info('WorkflowEngine: Processing user response after spoken node', {
        userMessage: userMessage.substring(0, 100),
        nextNodeId: this.state.currentNodeId,
      });
      this.state.isWaitingAfterSpoken = false;
      this.state.conversationContext.push({ role: 'user', text: userMessage });
      return this.executeFromCurrent(messages);
    }

    // --- Case 2: In dialogue ---
    if (!this.state.isInDialogue || !this.state.currentDialogueNodeId) {
      logger.warn('WorkflowEngine: processMessage called but not in dialogue and not waiting', {
        isInDialogue: this.state.isInDialogue,
        currentDialogueNodeId: this.state.currentDialogueNodeId,
      });
      return {
        messages: [{ type: 'system', text: 'Not waiting for input' }],
        waitingForInput: false,
        isComplete: this.state.isComplete,
        currentStage: null,
      };
    }

    let dialogueNode = this.nodes.find((n) => n.id === this.state.currentDialogueNodeId);
    if (!dialogueNode) {
      // Node not found — try to find ANY dialogue node to recover
      const anyDialogue = this.nodes.find(n =>
        (n.type === 'dialogue' || n.data?.type === 'dialogue') &&
        !this.state.completedDialogueNodeIds?.includes(n.id)
      );
      if (anyDialogue) {
        logger.warn('WorkflowEngine: currentDialogueNodeId not found — recovering to first available dialogue', {
          missingId: this.state.currentDialogueNodeId,
          recoveredTo: anyDialogue.data?.label,
        });
        this.state.currentDialogueNodeId = anyDialogue.id;
        dialogueNode = anyDialogue;
      } else {
        this.state.isInDialogue = false;
        this.state.isComplete = true;
        return {
          messages: [{ type: 'system', text: 'Dialogue node not found' }],
          waitingForInput: false,
          isComplete: true,
          currentStage: null,
        };
      }
    }

    // GUARD: Self-healing auto-correction for stale currentDialogueNodeId.
    // After a server restart, the persisted state may point to an old dialogue node
    // (e.g. "Introduction") while the conversation has already moved on (e.g. "Survey").
    // Instead of crashing/ending the workflow, detect and auto-correct.
    let wasAutoCorrected = false;
    const currentLabel = dialogueNode.data?.label;

    // Check: does the recent conversation context show we should be in a DIFFERENT stage?
    const lastAgentEntry = [...this.state.conversationContext]
      .reverse()
      .find(e => e.role === 'agent' && e.nodeLabel);
    const mostRecentStageLabel = lastAgentEntry?.nodeLabel;

    // Only auto-correct if:
    // 1. The current stage HAS spoken before (not a fresh entry)
    // 2. The most recent agent message is from a DIFFERENT stage
    const currentStageHasSpoken = currentLabel && this.state.conversationContext.some(
      e => e.role === 'agent' && e.nodeLabel === currentLabel
    );

    if (currentStageHasSpoken && mostRecentStageLabel && mostRecentStageLabel !== currentLabel) {
      // Recent conversation is from a different stage — currentDialogueNodeId is stale.
      // Find the correct dialogue node and switch to it.
      const correctNode = this.nodes.find(
        n => (n.type === 'dialogue' || n.data?.type === 'dialogue') &&
             n.data?.label === mostRecentStageLabel
      );

      if (correctNode && correctNode.id !== dialogueNode.id) {
        logger.error('WorkflowEngine: STALE currentDialogueNodeId — auto-correcting', {
          staleLabel: currentLabel,
          staleNodeId: dialogueNode.id,
          correctLabel: mostRecentStageLabel,
          correctNodeId: correctNode.id,
        });
        messages.push({
          type: 'system',
          text: `Auto-corrected: ${currentLabel} → ${mostRecentStageLabel} (state recovered)`,
        });

        // Fix the state: switch to the correct dialogue node
        this.state.currentDialogueNodeId = correctNode.id;
        dialogueNode = correctNode;

        // Clean up completedDialogueNodeIds: only keep the corrected node
        // (and any nodes before it). Remove nodes that come AFTER so they
        // can be entered normally when the workflow advances.
        const correctNodeIdx = this.state.completedDialogueNodeIds.indexOf(correctNode.id);
        if (correctNodeIdx >= 0) {
          // Keep only up to and including the correct node
          this.state.completedDialogueNodeIds = this.state.completedDialogueNodeIds.slice(0, correctNodeIdx + 1);
        }

        // Rebuild dialogue history for the correct node WITH the user's message
        // (the old history was for the wrong node — useless)
        this.state.dialogueHistory = await this.buildInitialDialogueHistory(correctNode, userMessage);
        this.state.dialogueTurnCount = 1; // reset turn count for corrected node
        wasAutoCorrected = true; // user message already included in rebuilt history
        this.persistState();
      }
    }

    // Collect the valid transition names for this dialogue node
    const transitions: Array<{ id: string; name: string }> = dialogueNode.data?.transitions || [];
    const validTransitionNames = transitions.map((t) => t.name);

    // --- Handle unrecognized speech (voice mode) ---
    if (userMessage === '[SPEECH_NOT_RECOGNIZED]') {
      logger.info('WorkflowEngine: Speech not recognized, checking for fallback', {
        nodeLabel: dialogueNode.data?.label,
      });

      const fallbackNodeId = this.getDialogueFallbackNodeId(dialogueNode);
      if (fallbackNodeId) {
        // Follow fallback edge
        this.state.isInDialogue = false;
        this.state.currentDialogueNodeId = null;
        this.state.currentNodeId = fallbackNodeId;
        return this.executeFromCurrent(messages);
      }

      // No fallback connected — use language-aware fallback directly (more reliable than asking AI)
      const detectedLang = this.detectLanguage();
      const retryMsg = this.getLanguageAwareFallback('retry');
      // Also push to dialogue history so AI knows a retry happened
      this.state.dialogueHistory.push({
        role: 'user',
        content: `[Speech was unclear — agent asked caller to repeat in ${detectedLang}]`,
      });
      this.state.dialogueHistory.push({ role: 'assistant', content: retryMsg });

      messages.push({ type: 'ai', text: retryMsg, nodeLabel: dialogueNode.data?.label });
      this.state.conversationContext.push({ role: 'agent', text: retryMsg, nodeLabel: dialogueNode.data?.label });

      return {
        messages,
        waitingForInput: true,
        isComplete: false,
        currentStage: dialogueNode.data?.label || 'AI Dialogue',
      };
    }

    logger.info('WorkflowEngine: Processing dialogue message', {
      userMessage: userMessage.substring(0, 100),
      nodeLabel: dialogueNode.data?.label,
      turnCount: this.state.dialogueTurnCount,
      historyLength: this.state.dialogueHistory.length,
      availableTransitions: validTransitionNames,
    });

    // Add user message to dialogue history and conversation context
    // Skip if auto-corrected — the rebuilt history already includes the user message.
    if (!wasAutoCorrected) {
      this.state.dialogueHistory.push({ role: 'user', content: userMessage });
      this.state.conversationContext.push({ role: 'user', text: userMessage, nodeLabel: dialogueNode.data?.label });
      this.state.dialogueTurnCount++;
    }

    // Persist state BEFORE the AI call. This is critical because:
    // - The AI call takes seconds (GPT API)
    // - If the server restarts during the call, the disk state must reflect
    //   the current dialogue with the user's latest message
    // - Without this, a restart loads stale state from the previous turn
    this.persistState();

    // Generate AI response AND proactive stage completion check IN PARALLEL.
    // The completion check uses gpt-4o-mini (~200-300ms) — finishes well before
    // the main AI call (~2-4s), so this adds ZERO extra latency.
    const [aiResponse, proactiveTransition] = await Promise.all([
      this.generateAIResponse(),
      validTransitionNames.length > 0
        ? this.checkStageCompletion(dialogueNode, userMessage)
        : Promise.resolve(null),
    ]);

    if (!aiResponse) {
      // AI failed — if proactive check found a transition, use a brief ack and advance
      if (proactiveTransition) {
        const ack = this.getBriefAcknowledgment();
        messages.push({ type: 'ai', text: ack, nodeLabel: dialogueNode.data?.label });
        this.state.conversationContext.push({ role: 'agent', text: ack, nodeLabel: dialogueNode.data?.label });
        this.state.dialogueHistory.push({ role: 'assistant', content: ack });
        // Fall through to transition logic below with proactiveTransition set
      } else {
        // AI failed and no proactive transition — keep dialogue open
        const fallback = this.getLanguageAwareFallback('error');
        messages.push({ type: 'ai', text: fallback, nodeLabel: dialogueNode.data?.label });
        this.state.dialogueHistory.push({ role: 'assistant', content: fallback });
        this.state.conversationContext.push({ role: 'agent', text: fallback, nodeLabel: dialogueNode.data?.label });
        return {
          messages,
          waitingForInput: true,
          isComplete: false,
          currentStage: dialogueNode.data?.label || 'AI Dialogue',
        };
      }
    }

    // --- Parse AI response and determine what to output ---
    let text = '';
    let wantsFallback = false;
    let wantsToComplete = false;
    let effectiveComplete = false;
    let aiEndsWithQuestion = false;

    if (aiResponse) {
      const parsed = parseAIResponse(aiResponse, validTransitionNames);
      const allSentences = splitIntoSentences(parsed.text);
      text = parsed.text;
      wantsFallback = parsed.wantsFallback;

      // Check for [NEXT] / [STAGE_COMPLETE] signal from the response AI
      wantsToComplete = aiResponse.includes('[NEXT]') || aiResponse.includes('[STAGE_COMPLETE]');
      const cleanedTextTrimmed = text.trim();
      aiEndsWithQuestion = cleanedTextTrimmed.endsWith('?');
      effectiveComplete = wantsToComplete && !aiEndsWithQuestion;

      if (aiEndsWithQuestion && wantsToComplete) {
        logger.info('WorkflowEngine: AI included [NEXT] but response ends with "?" — suppressing', {
          nodeLabel: dialogueNode.data?.label,
          turnCount: this.state.dialogueTurnCount,
        });
      }

      // Determine which sentences to output:
      // The PROACTIVE CHECK is the authority on transitions. If it says the stage
      // is done, truncate the AI response to only acknowledgment sentences and advance.
      // The AI often goes off-topic (asks questions from other stages) — don't trust it.
      let outputSentences: string[];
      if (proactiveTransition && !effectiveComplete) {
        // Proactive check says stage is done. Keep only non-question acknowledgments.
        const ackOnly = allSentences.filter(s => !s.trim().endsWith('?'));
        if (ackOnly.length > 0) {
          outputSentences = ackOnly.slice(0, 1);
        } else {
          outputSentences = [this.getBriefAcknowledgment()];
        }
        logger.info('WorkflowEngine: Truncated AI response (proactive completion)', {
          nodeLabel: dialogueNode.data?.label,
          originalSentences: allSentences.length,
          droppedQuestions: allSentences.filter(s => s.trim().endsWith('?')).length,
        });
      } else {
        outputSentences = allSentences;
      }

      logger.info('WorkflowEngine: Dialogue AI response', {
        rawResponse: aiResponse.substring(0, 150),
        cleanedText: text.substring(0, 100),
        wantsFallback,
        effectiveComplete,
        proactiveTransition,
        sentenceCount: outputSentences.length,
        turnCount: this.state.dialogueTurnCount,
        nodeLabel: dialogueNode.data?.label,
      });

      // Deliver sentences as messages
      for (const sentence of outputSentences) {
        if (sentence) {
          messages.push({ type: 'ai', text: sentence, nodeLabel: dialogueNode.data?.label });
          this.state.conversationContext.push({ role: 'agent', text: sentence, nodeLabel: dialogueNode.data?.label });
        }
      }
      // Store in dialogue history (use what was actually output, not the full AI text)
      const outputText = outputSentences.filter(Boolean).join(' ');
      if (outputText) {
        this.state.dialogueHistory.push({ role: 'assistant', content: outputText });
      }
    }

    // Persist AFTER AI response — captures the response before transition logic.
    this.persistState();

    // --- Handle AI-triggered fallback ---
    if (wantsFallback) {
      const fallbackNodeId = this.getDialogueFallbackNodeId(dialogueNode);
      if (fallbackNodeId) {
        logger.info('WorkflowEngine: AI triggered fallback', { nodeLabel: dialogueNode.data?.label });
        this.state.isInDialogue = false;
        this.state.currentDialogueNodeId = null;
        this.state.currentNodeId = fallbackNodeId;
        return this.executeFromCurrent(messages);
      }
      // No fallback connected — STAY in the dialogue
      logger.warn('WorkflowEngine: AI triggered [FALLBACK] but no fallback node connected — staying in dialogue');
      const retryMsg = this.getLanguageAwareFallback('retry');
      messages.push({ type: 'ai', text: retryMsg, nodeLabel: dialogueNode.data?.label });
      messages.push({ type: 'system', text: `⚠️ No fallback connected to "${dialogueNode.data?.label}" — staying in current stage` });
      this.state.dialogueHistory.push({ role: 'assistant', content: retryMsg });
      this.state.conversationContext.push({ role: 'agent', text: retryMsg, nodeLabel: dialogueNode.data?.label });
      return {
        messages,
        waitingForInput: true,
        isComplete: false,
        currentStage: dialogueNode.data?.label || 'AI Dialogue',
      };
    }

    // --- Transition decision logic ---
    //
    // Two authorities can trigger advancement:
    //   1. RESPONSE AI signals [NEXT] — it explicitly says the stage is done.
    //   2. PROACTIVE CHECK — a parallel gpt-4o-mini call determined the stage
    //      objective was met, even though the Response AI forgot [NEXT].
    //      This prevents the AI from staying stuck or going off-topic.
    //   The TRANSITION ANALYZER decides WHERE to go (which named transition).
    //
    let transition: string | null = null;
    const maxTurns = parseInt(dialogueNode.data?.maxTurns) || 0;
    const maxTurnsReached = maxTurns > 0 && this.state.dialogueTurnCount >= maxTurns;
    let shouldAdvance = false;

    if (effectiveComplete) {
      // Response AI signaled [NEXT] and is NOT asking a question → stage is done.
      shouldAdvance = true;
      if (validTransitionNames.length > 0) {
        // Use proactiveTransition if available (already computed), else run analyzer
        if (proactiveTransition) {
          transition = proactiveTransition;
        } else {
          transition = await this.analyzeTransition(dialogueNode, text, userMessage);
        }
        if (!transition) {
          transition = validTransitionNames[0]; // default to first
        }
      }
      const advanceTargetId = this.getDialogueNextNodeId(dialogueNode, transition || undefined);
      const advanceTarget = advanceTargetId ? this.nodes.find(n => n.id === advanceTargetId) : null;
      logger.info('WorkflowEngine: AI signaled completion, advancing', {
        transition,
        nodeLabel: dialogueNode.data?.label,
        turnCount: this.state.dialogueTurnCount,
        targetLabel: advanceTarget?.data?.label,
      });
      messages.push({
        type: 'system',
        text: `${dialogueNode.data?.label} → [${transition}] → ${advanceTarget?.data?.label || advanceTargetId || 'unknown'}`,
      });
    } else if (proactiveTransition) {
      // Proactive check detected stage completion — advance regardless of AI's response.
      // The proactive check is the authority on transitions, not the AI.
      shouldAdvance = true;
      transition = proactiveTransition;
      const advanceTargetId = this.getDialogueNextNodeId(dialogueNode, transition);
      const advanceTarget = advanceTargetId ? this.nodes.find(n => n.id === advanceTargetId) : null;
      logger.info('WorkflowEngine: Proactive check triggered advancement (AI missed [NEXT])', {
        transition,
        nodeLabel: dialogueNode.data?.label,
        turnCount: this.state.dialogueTurnCount,
        targetLabel: advanceTarget?.data?.label,
      });
      messages.push({
        type: 'system',
        text: `${dialogueNode.data?.label} → [${transition}] → ${advanceTarget?.data?.label || advanceTargetId || 'unknown'}`,
      });
    } else if (maxTurnsReached) {
      // Safety net: max turns exceeded — force advance.
      shouldAdvance = true;
      if (validTransitionNames.length > 0) {
        transition = await this.analyzeTransition(dialogueNode, text, userMessage);
        if (!transition) {
          transition = validTransitionNames[0];
        }
      }
      messages.push({ type: 'system', text: `Max turns reached (${maxTurns}), advancing via "${transition}"` });
    }
    // else: stay in dialogue — neither AI nor proactive check signaled completion.

    if (shouldAdvance) {

      const nextNodeId = this.getDialogueNextNodeId(dialogueNode, transition || undefined);

      // If the transition edge isn't connected, stay in dialogue (don't end the call).
      if (!nextNodeId) {
        logger.warn('WorkflowEngine: Transition edge not connected — staying in dialogue', {
          transition,
          fromLabel: dialogueNode.data?.label,
        });
        messages.push({
          type: 'system',
          text: `⚠️ Transition "${transition}" from "${dialogueNode.data?.label}" is not connected — staying in current stage`,
        });
        // Fall through to "dialogue continues" return below
        shouldAdvance = false;
      }

      // Verify the target is NOT an already-visited dialogue — if it is,
      // the transition was wrong (proactive check misfired or stale state).
      // Cancel the transition and stay in the current dialogue.
      if (shouldAdvance && nextNodeId) {
        const targetNode = this.nodes.find(n => n.id === nextNodeId);
        const targetType = targetNode?.type || targetNode?.data?.type;
        const targetLabel = targetNode?.data?.label;

        if (targetType === 'dialogue') {
          const targetAlreadyVisited =
            this.state.completedDialogueNodeIds?.includes(nextNodeId) ||
            (targetLabel && this.state.conversationContext.some(
              e => e.role === 'agent' && e.nodeLabel === targetLabel
            ));

          if (targetAlreadyVisited) {
            logger.warn('WorkflowEngine: Transition target is already-visited dialogue — cancelling transition', {
              transition,
              fromLabel: dialogueNode.data?.label,
              targetLabel,
            });
            messages.push({
              type: 'system',
              text: `⚠️ Transition cancelled (target "${targetLabel}" already visited) — staying in current stage`,
            });
            shouldAdvance = false;
          }
        }
      }

      if (shouldAdvance && nextNodeId) {
        const targetLabel = this.nodes.find(n => n.id === nextNodeId)?.data?.label || nextNodeId;
        logger.info('WorkflowEngine: Dialogue advancing', {
          transition,
          fromLabel: dialogueNode.data?.label,
          toNodeId: nextNodeId,
          toLabel: targetLabel,
        });

        // Exit dialogue and continue workflow — mark as completed
        if (!this.state.completedDialogueNodeIds) this.state.completedDialogueNodeIds = [];
        if (!this.state.completedDialogueNodeIds.includes(dialogueNode.id)) {
          this.state.completedDialogueNodeIds.push(dialogueNode.id);
        }
        this.state.isInDialogue = false;
        this.state.currentDialogueNodeId = null;
        this.state.currentNodeId = nextNodeId;

        // Persist state NOW — before the async executeFromCurrent call.
        this.persistState();

        return this.executeFromCurrent(messages);
      }
    }

    // Dialogue continues — wait for the user's next message
    return {
      messages,
      waitingForInput: true,
      isComplete: false,
      currentStage: dialogueNode.data?.label || 'AI Dialogue',
    };
  }

  /**
   * Execute from the current node, processing all non-interactive nodes
   * until hitting a dialogue node, the end, or a terminal node (transfer, voicemail).
   */
  private async executeFromCurrent(messages: WorkflowMessage[]): Promise<WorkflowStepResult> {
    try {
      return await this._executeFromCurrentInternal(messages);
    } catch (error) {
      logger.error('WorkflowEngine: Unhandled error in executeFromCurrent', {
        error,
        currentNodeId: this.state.currentNodeId,
      });
      // Keep the call alive — don't set isComplete. The user can still respond.
      messages.push({ type: 'system', text: 'An error occurred, retrying on next message' });
      return {
        messages,
        waitingForInput: true,
        isComplete: false,
        currentStage: 'Error',
      };
    }
  }

  private async _executeFromCurrentInternal(messages: WorkflowMessage[]): Promise<WorkflowStepResult> {
    // Cycle detection: prevent infinite loops in ANY node chain (including dialogue skips)
    const MAX_STEPS = 50;
    let stepCount = 0;
    const visitedNodeIds = new Set<string>();

    while (this.state.currentNodeId) {
      const node = this.nodes.find((n) => n.id === this.state.currentNodeId);
      if (!node) break;

      // Prevent infinite loops — track ALL visited nodes in this execution chain
      stepCount++;
      if (stepCount > MAX_STEPS || visitedNodeIds.has(node.id)) {
        logger.warn('WorkflowEngine: Cycle detected or max steps — stopping chain but keeping call alive', {
          currentNodeId: this.state.currentNodeId,
          currentLabel: node.data?.label,
          stepCount,
        });
        // Don't kill the call — just stop this execution chain.
        // The user can still speak and trigger the next processMessage.
        messages.push({ type: 'system', text: '⚠️ Loop detected — waiting for input' });
        return { messages, waitingForInput: true, isComplete: false, currentStage: node.data?.label || 'Recovery' };
      }
      visitedNodeIds.add(node.id);

      const nodeType = node.data?.type || node.type;

      switch (nodeType) {
        case 'agentSetup': {
          this.state.agentSystemMessage = node.data?.systemMessage || '';
          this.state.currentNodeId = this.getNextNodeId(this.state.currentNodeId);
          break;
        }

        case 'callDirection': {
          this.state.currentNodeId = this.getNextNodeId(this.state.currentNodeId);
          break;
        }

        case 'scripted': {
          const script = this.substituteFieldVariables(node.data?.script || 'No script configured.');
          messages.push({
            type: 'scripted',
            text: script,
            nodeLabel: node.data?.label,
          });
          // Track in conversation context so dialogue AI knows what was said
          this.state.conversationContext.push({
            role: 'agent',
            text: script,
            nodeLabel: node.data?.label,
          });
          this.state.currentNodeId = this.getNextNodeId(this.state.currentNodeId);

          // After speaking, wait for caller response before advancing
          // UNLESS the next node is a terminal node (end_call, call_transfer, voicemail)
          // — in that case, just continue immediately (don't wait after "Goodbye").
          if (this.state.currentNodeId) {
            const nextNode = this.nodes.find((n) => n.id === this.state.currentNodeId);
            const nextType = nextNode?.type || nextNode?.data?.type;
            const isTerminalNext = nextType === 'end_call' || nextType === 'call_transfer' || nextType === 'voicemail';

            if (!isTerminalNext) {
              this.state.isWaitingAfterSpoken = true;
              return {
                messages,
                waitingForInput: true,
                isComplete: false,
                currentStage: node.data?.label || 'Scripted',
              };
            }
            // Terminal next node — fall through to continue execution immediately
          }
          break;
        }

        case 'dialogue': {
          // GUARD: If this dialogue was already visited, do NOT re-enter it.
          // Instead of killing the workflow or cascading skips, just stop the
          // execution chain here and wait for user input. The stale state
          // auto-correction in processMessage will handle recovery.
          const dialogueLabel = node.data?.label;
          const alreadyCompleted = this.state.completedDialogueNodeIds?.includes(node.id);
          const alreadyVisited = dialogueLabel && this.state.conversationContext.some(
            e => e.role === 'agent' && e.nodeLabel === dialogueLabel
          );

          if (alreadyCompleted || alreadyVisited) {
            logger.warn('WorkflowEngine: Reached already-visited dialogue — stopping execution chain', {
              nodeId: node.id,
              nodeLabel: dialogueLabel,
              alreadyCompleted,
              alreadyVisited,
            });
            // Enter the dialogue anyway so processMessage can handle the next user input.
            // The auto-correction guard in processMessage will detect and fix if needed.
            this.state.isInDialogue = true;
            this.state.currentDialogueNodeId = node.id;
            this.state.dialogueTurnCount = 0;
            messages.push({
              type: 'system',
              text: `⚠️ Re-entered "${dialogueLabel}" (state recovery)`,
            });
            return {
              messages,
              waitingForInput: true,
              isComplete: false,
              currentStage: dialogueLabel || 'AI Dialogue',
            };
          }

          // Enter dialogue mode — user STAYS here until a valid transition is triggered
          this.state.isInDialogue = true;
          this.state.currentDialogueNodeId = node.id;
          this.state.dialogueTurnCount = 0;

          // CRITICAL: Mark as completed IMMEDIATELY upon entry — not on exit.
          // This prevents re-entry bugs caused by unexpected routing, race conditions,
          // or transitions that loop back to this node.
          if (!this.state.completedDialogueNodeIds) this.state.completedDialogueNodeIds = [];
          if (!this.state.completedDialogueNodeIds.includes(node.id)) {
            this.state.completedDialogueNodeIds.push(node.id);
          }

          // Collect valid transition names for this dialogue node
          const dialogueTransitions: Array<{ id: string; name: string }> = node.data?.transitions || [];
          const validTransitionNames = dialogueTransitions.map((t) => t.name);

          logger.info('WorkflowEngine: Entering dialogue node', {
            nodeId: node.id,
            nodeLabel: node.data?.label,
            transitions: validTransitionNames,
            contextLength: this.state.conversationContext.length,
            completedDialogues: this.state.completedDialogueNodeIds,
          });

          // Validate: warn if no fallback node is connected
          const fallbackTarget = this.getDialogueFallbackNodeId(node);
          if (!fallbackTarget) {
            const label = node.data?.label || node.id;
            logger.warn('WorkflowEngine: Dialogue node has no fallback connection', { nodeId: node.id, label });
            messages.push({
              type: 'system',
              text: `No fallback connected to "${label}"`,
            });
          }

          // Check if the caller already said something (e.g., responded to a scripted message)
          const lastCtx = this.state.conversationContext[this.state.conversationContext.length - 1];
          const callerAlreadyResponded = lastCtx?.role === 'user';

          if (callerAlreadyResponded) {
            logger.info('WorkflowEngine: Caller already responded, using as first turn', {
              callerText: lastCtx.text.substring(0, 100),
            });

            // Build dialogue history with full call history as proper chat messages
            this.state.dialogueHistory = await this.buildInitialDialogueHistory(node, lastCtx.text);
            this.state.dialogueTurnCount++;

            const aiResponse = await this.generateAIResponse();

            if (aiResponse) {
              const entryParsed = parseAIResponse(aiResponse);
              const entrySentences = splitIntoSentences(entryParsed.text);
              const wantsFallback = entryParsed.wantsFallback;

              for (const sentence of entrySentences) {
                if (sentence) {
                  messages.push({ type: 'ai', text: sentence, nodeLabel: node.data?.label });
                  this.state.conversationContext.push({ role: 'agent', text: sentence, nodeLabel: node.data?.label });
                }
              }
              if (entryParsed.text) {
                this.state.dialogueHistory.push({ role: 'assistant', content: entryParsed.text });
              }

              // IMPORTANT: Do NOT run transition analysis on the first turn of entering
              // a dialogue node. The user's carried-over message was a response to the
              // PREVIOUS stage, not to this dialogue's questions. The AI just asked its
              // first question — we must wait for the user to respond to THIS dialogue
              // before evaluating transitions.
              logger.info('WorkflowEngine: Skipping transition analysis on dialogue entry (user has not responded to this stage yet)', {
                nodeLabel: node.data?.label,
              });

              if (wantsFallback) {
                const fallbackNodeId = this.getDialogueFallbackNodeId(node);
                if (fallbackNodeId) {
                  this.state.isInDialogue = false;
                  this.state.currentDialogueNodeId = null;
                  this.state.currentNodeId = fallbackNodeId;
                  return this.executeFromCurrent(messages);
                }
              }
            } else {
              const fallback = this.getLanguageAwareFallback('retry');
              messages.push({ type: 'ai', text: fallback, nodeLabel: node.data?.label });
              this.state.dialogueHistory.push({ role: 'assistant', content: fallback });
              this.state.conversationContext.push({ role: 'agent', text: fallback, nodeLabel: node.data?.label });
            }

            // Persist AFTER dialogue history + opening message are fully built.
            // This ensures a restart loads the correct dialogue with its history.
            this.persistState();

            return {
              messages,
              waitingForInput: true,
              isComplete: false,
              currentStage: node.data?.label || 'AI Dialogue',
            };
          }

          // No prior caller response — generate an opening AI message
          const hasContext = this.state.conversationContext.length > 0;
          const trigger = hasContext
            ? 'Continue from where the call left off. The caller is waiting. Do NOT greet again, do NOT introduce yourself again, do NOT repeat anything from the transcript above. Just continue with the next thing according to your stage instructions.'
            : 'The caller just connected. Follow your stage instructions to begin the conversation.';

          // Build dialogue history with full call history as proper chat messages
          this.state.dialogueHistory = await this.buildInitialDialogueHistory(node, trigger);

          const openingResponse = await this.generateAIResponse();

          if (openingResponse) {
            const openingParsed = parseAIResponse(openingResponse);
            const openingSentences = splitIntoSentences(openingParsed.text);
            const openingFallback = openingParsed.wantsFallback;
            for (const sentence of openingSentences) {
              if (sentence) {
                messages.push({ type: 'ai', text: sentence, nodeLabel: node.data?.label });
                this.state.conversationContext.push({ role: 'agent', text: sentence, nodeLabel: node.data?.label });
              }
            }
            if (openingParsed.text) {
              this.state.dialogueHistory.push({ role: 'assistant', content: openingParsed.text });
            }

            if (openingFallback) {
              const fallbackNodeId = this.getDialogueFallbackNodeId(node);
              if (fallbackNodeId) {
                this.state.isInDialogue = false;
                this.state.currentDialogueNodeId = null;
                this.state.currentNodeId = fallbackNodeId;
                return this.executeFromCurrent(messages);
              }
            }
          } else {
            const fallback = this.getLanguageAwareFallback('greeting');
            messages.push({ type: 'ai', text: fallback, nodeLabel: node.data?.label });
            this.state.dialogueHistory.push({ role: 'assistant', content: fallback });
            this.state.conversationContext.push({ role: 'agent', text: fallback, nodeLabel: node.data?.label });
          }

          // Persist AFTER dialogue history + opening message are fully built.
          this.persistState();

          // Stay in dialogue — wait for user's first real message
          return {
            messages,
            waitingForInput: true,
            isComplete: false,
            currentStage: node.data?.label || 'AI Dialogue',
          };
        }

        case 'field_setter': {
          // Support both new multi-field format (assignments[]) and legacy single-field format
          const assignments: Array<{ fieldName: string; value: any; valueType?: string }> =
            Array.isArray(node.data?.assignments) && node.data.assignments.length > 0
              ? node.data.assignments
              : node.data?.fieldName
                ? [{ fieldName: node.data.fieldName, value: node.data.value, valueType: node.data.valueType }]
                : [];

          for (const assignment of assignments) {
            const { fieldName, value, valueType = 'text' } = assignment;
            if (fieldName) {
              let parsedValue: any = value;
              if (valueType === 'number') parsedValue = Number(value);
              if (valueType === 'boolean') parsedValue = value === 'true' || value === true;

              this.state.fields[fieldName] = parsedValue;
              messages.push({
                type: 'system',
                text: `Set ${fieldName} = ${JSON.stringify(parsedValue)}`,
              });
            }
          }
          this.state.currentNodeId = this.getNextNodeId(this.state.currentNodeId);
          break;
        }

        case 'junction': {
          const fieldName = node.data?.left?.field_name || node.data?.conditionField || '';
          const operator = node.data?.operator || '==';
          const compareVal = node.data?.right?.literal || '';
          const fieldVal = this.state.fields[fieldName];
          const result = evaluateCondition(fieldVal, operator, compareVal);

          messages.push({
            type: 'system',
            text: `${fieldName} ${operator} "${compareVal}" → ${result ? 'true' : 'false'}`,
          });

          this.state.currentNodeId = this.evaluateJunction(node);
          break;
        }

        case 'switch': {
          const switchField = node.data?.switchField || '';
          const switchVal = this.state.fields[switchField];
          messages.push({
            type: 'system',
            text: `${switchField} = "${switchVal ?? 'not set'}"`,
          });
          this.state.currentNodeId = this.evaluateSwitch(node);
          break;
        }

        case 'call_transfer': {
          const transferMsg =
            node.data?.transferMessage ||
            `Transferring your call to ${node.data?.transferTo || 'an agent'}.`;
          messages.push({
            type: 'scripted',
            text: transferMsg,
            nodeLabel: node.data?.label,
          });
          this.state.conversationContext.push({
            role: 'agent',
            text: transferMsg,
            nodeLabel: node.data?.label,
          });
          messages.push({
            type: 'system',
            text: `Transferring to ${node.data?.transferTo || 'agent'}`,
          });

          this.state.isComplete = true;
          this.state.currentNodeId = null;
          return {
            messages,
            waitingForInput: false,
            isComplete: true,
            currentStage: 'Call Transfer',
            transferTo: node.data?.transferTo,
            transferType: node.data?.transferType || 'cold',
          };
        }

        case 'voicemail': {
          const greeting =
            node.data?.greetingMessage || 'Please leave a message after the beep.';
          messages.push({
            type: 'scripted',
            text: greeting,
            nodeLabel: node.data?.label,
          });
          this.state.conversationContext.push({
            role: 'agent',
            text: greeting,
            nodeLabel: node.data?.label,
          });
          messages.push({ type: 'system', text: 'Voicemail started' });

          this.state.isComplete = true;
          this.state.currentNodeId = null;
          return {
            messages,
            waitingForInput: false,
            isComplete: true,
            currentStage: 'Voicemail',
          };
        }

        case 'play_audio': {
          const fallbackText = node.data?.fallbackText || 'Playing audio...';
          messages.push({
            type: 'scripted',
            text: fallbackText,
            nodeLabel: node.data?.label,
          });
          this.state.conversationContext.push({
            role: 'agent',
            text: fallbackText,
            nodeLabel: node.data?.label,
          });
          this.state.currentNodeId = this.getNextNodeId(this.state.currentNodeId);
          break;
        }

        case 'time_limit': {
          const maxDuration = node.data?.maxDuration;
          if (maxDuration) {
            messages.push({ type: 'system', text: `Time limit: ${maxDuration}s` });
          }
          this.state.currentNodeId = this.getNextNodeId(this.state.currentNodeId);
          break;
        }

        case 'reconfigure': {
          messages.push({
            type: 'system',
            text: `Reconfigured ${node.data?.setting || 'setting'} to ${node.data?.newValue || 'value'}`,
          });
          this.state.currentNodeId = this.getNextNodeId(this.state.currentNodeId);
          break;
        }

        case 'fallback': {
          const fallbackMsg =
            node.data?.fallbackMessage || "I'm sorry, I didn't understand that.";
          messages.push({
            type: 'scripted',
            text: fallbackMsg,
            nodeLabel: node.data?.label,
          });
          this.state.conversationContext.push({
            role: 'agent',
            text: fallbackMsg,
            nodeLabel: node.data?.label,
          });
          this.state.currentNodeId = this.getNextNodeId(this.state.currentNodeId);
          break;
        }

        case 'end_call': {
          // --- Build full conversation transcript ---
          let conversationText: string;
          if (this.fetchFullHistory) {
            try {
              const fullHistory = await this.fetchFullHistory();
              conversationText = fullHistory
                .map((m) => `${m.role}: ${m.content}`)
                .join('\n');
              logger.info('WorkflowEngine: Using full DB history for end_call analysis', { messageCount: fullHistory.length });
            } catch (historyErr) {
              logger.warn('WorkflowEngine: Failed to fetch full history, falling back to conversationContext', { error: historyErr });
              conversationText = this.state.conversationContext
                .map((e) => `${e.role}: ${e.text}`)
                .join('\n');
            }
          } else {
            conversationText = this.state.conversationContext
              .map((e) => `${e.role}: ${e.text}`)
              .join('\n');
          }

          // --- Generate summary if summaryPrompt is configured ---
          const summaryPrompt = node.data?.summaryPrompt;
          if (summaryPrompt) {
            try {
              const summaryResult = await gptService.generateWithCustomPrompt(
                `Here is the full conversation:\n${conversationText}\n\nPlease provide the summary.`,
                summaryPrompt,
              );
              if (summaryResult.text) {
                this.state.fields['_summary'] = summaryResult.text;
                logger.info('WorkflowEngine: End node generated summary', { summary: summaryResult.text.substring(0, 200) });
              }
            } catch (err) {
              logger.error('WorkflowEngine: Failed to generate summary', { error: err });
            }
          }

          // --- AI-powered result extraction ---
          // Analyze the full conversation with AI to extract all required data fields.
          // This extracts data mentioned in conversation (e.g. customer name, property type,
          // roof area) even if it was never explicitly stored in workflow fields.
          const resultDefs: Array<{ name: string; type: string; description?: string; enumValues?: string }> = node.data?.results || [];
          if (resultDefs.length > 0) {
            // First, try AI extraction from the conversation
            let aiExtracted: Record<string, any> = {};
            try {
              const fieldDescriptions = resultDefs
                .filter(d => d.name)
                .map(def => {
                  let desc = `- "${def.name}" (type: ${def.type || 'text'})`;
                  if (def.description) desc += `: ${def.description}`;
                  if (def.type === 'enum' && def.enumValues) {
                    desc += ` [allowed values: ${def.enumValues}]`;
                  }
                  if (def.type === 'boolean') {
                    desc += ` [true or false]`;
                  }
                  return desc;
                })
                .join('\n');

              const extractionPrompt = `You are a data extraction engine. Analyze the conversation below and extract the requested fields.

CONVERSATION:
${conversationText}

FIELDS TO EXTRACT:
${fieldDescriptions}

RULES:
- Extract values ONLY from what was explicitly said in the conversation.
- If a field was not discussed or the caller did not provide the information, set it to null.
- For boolean fields: output true or false.
- For integer/real fields: output the number only (no units, no text).
- For enum fields: output one of the allowed values, or null if no match.
- For text fields: output the exact value mentioned by the caller.
- If the caller corrected a value, use the LATEST corrected value.
- Output ONLY valid JSON, no explanation.

Output a JSON object with the field names as keys. Example: {"field1": "value1", "field2": 42, "field3": null}`;

              const extractionResult = await gptService.generateWithCustomPrompt(
                extractionPrompt,
                'You are a precise data extraction engine. Output ONLY valid JSON, nothing else.',
                { maxTokens: 500, temperature: 0.1 }
              );

              if (extractionResult.text) {
                // Parse JSON — handle markdown code blocks if AI wraps output
                let jsonText = extractionResult.text.trim();
                const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (jsonMatch) jsonText = jsonMatch[1].trim();

                try {
                  aiExtracted = JSON.parse(jsonText);
                  logger.info('WorkflowEngine: AI extracted results from conversation', {
                    extracted: aiExtracted,
                  });
                } catch (parseErr) {
                  logger.error('WorkflowEngine: Failed to parse AI extraction JSON', {
                    rawText: extractionResult.text.substring(0, 300),
                    error: parseErr,
                  });
                }
              }
            } catch (err) {
              logger.error('WorkflowEngine: AI extraction failed', { error: err });
            }

            // Merge: AI-extracted values fill in gaps, workflow fields take precedence
            const extracted: Record<string, any> = {};
            for (const def of resultDefs) {
              if (!def.name) continue;
              // Workflow fields (set by field_setter nodes) take precedence
              // AI-extracted values fill in anything not already in fields
              let value = this.state.fields[def.name] ?? aiExtracted[def.name] ?? null;

              // Type coercion
              if (value !== null && value !== undefined && def.type) {
                switch (def.type) {
                  case 'integer':
                    value = parseInt(String(value), 10) || 0;
                    break;
                  case 'real':
                    value = parseFloat(String(value)) || 0;
                    break;
                  case 'boolean':
                    value = value === true || value === 'true' || value === '1' || value === 1;
                    break;
                  case 'enum': {
                    const allowed = (def.enumValues || '').split(',').map((v: string) => v.trim()).filter(Boolean);
                    if (allowed.length > 0 && !allowed.includes(String(value))) {
                      value = null;
                    }
                    break;
                  }
                }
              }
              extracted[def.name] = value;
              // Also store in fields so they're accessible via getFields()
              this.state.fields[def.name] = value;
            }

            logger.info('WorkflowEngine: End node final extracted results', { extracted });
            messages.push({
              type: 'system',
              text: `Results: ${Object.entries(extracted).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(', ')}`,
            });
          }

          // Mark workflow as complete — no further nodes to process
          this.state.isComplete = true;
          this.state.currentNodeId = null;
          return {
            messages,
            waitingForInput: false,
            isComplete: true,
            currentStage: node.data?.label || 'Call Ended',
          };
        }

        case 'function': {
          messages.push({
            type: 'system',
            text: `Ran ${node.data?.functionName || 'function'}`,
          });
          this.state.currentNodeId = this.getNextNodeId(this.state.currentNodeId);
          break;
        }

        default: {
          // Unknown node type - just advance
          this.state.currentNodeId = this.getNextNodeId(this.state.currentNodeId);
          break;
        }
      }
    }

    // Workflow completed (ran out of nodes)
    this.state.isComplete = true;
    messages.push({ type: 'system', text: 'Workflow completed' });
    return {
      messages,
      waitingForInput: false,
      isComplete: true,
      currentStage: 'Workflow completed',
    };
  }
}

export default WorkflowEngine;
