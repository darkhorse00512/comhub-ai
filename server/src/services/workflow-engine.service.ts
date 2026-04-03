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
  /** When true, a transition is pending — call executePendingTransition() to continue */
  transitionPending?: boolean;
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
/**
 * Detailed pipeline timing — each field is offset (ms) from processMessage start.
 * Maps to the 9-step voice call pipeline:
 *   1. user_speech_end_detected  — client-side (not in this struct)
 *   2. stt_final_received        — client-side (not in this struct)
 *   3. llm_request_sent          — when the LLM API call was dispatched
 *   4. llm_first_token_received  — when the first token arrived (streaming) or response completed (non-streaming)
 *   5. llm_full_response_received — when the full LLM response was available
 *   6. tts_request_sent          — controller-side (not in this struct)
 *   7. tts_first_audio_byte_received — controller-side (not in this struct)
 *   8. audio_playback_started    — client-side (not in this struct)
 *   9. audio_playback_finished   — client-side (not in this struct)
 */
export interface EngineTiming {
  /** Step 3: offset (ms) when LLM API call was sent */
  llmRequestSentAt: number;
  /** Step 4: offset (ms) when first LLM token arrived */
  llmFirstTokenAt: number;
  /** Step 5: offset (ms) when full LLM response was available */
  llmFullResponseAt: number;
  /** Transition analysis: offset (ms) when analyzeTransition LLM call started */
  transitionAnalysisStartAt: number;
  /** Transition analysis: offset (ms) when analyzeTransition completed */
  transitionAnalysisDoneAt: number;
  /** Legacy compat */
  promptReadyAt: number;
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
  public lastTiming: EngineTiming = { llmRequestSentAt: 0, llmFirstTokenAt: 0, llmFullResponseAt: 0, transitionAnalysisStartAt: 0, transitionAnalysisDoneAt: 0, promptReadyAt: 0, proactiveCheckMs: 0 };
  /**
   * Optional callback to fetch full call message history from the database.
   * Set by VoiceConversationService to ensure end_call analysis gets ALL messages.
   */
  public fetchFullHistory?: () => Promise<Array<{ role: string; content: string }>>;

  /**
   * Optional callback fired when the AI dialogue response is ready but BEFORE
   * transition analysis runs. Allows the controller to start TTS on the dialogue
   * response in parallel with transition analysis — saving ~400-600ms.
   * The callback receives the speakable messages generated so far.
   */
  public onDialogueResponseReady?: (messages: WorkflowMessage[]) => void;

  /**
   * Pending transition state — set when processMessage detects [NEXT] but
   * returns the dialogue response immediately instead of blocking on transition.
   * Call executePendingTransition() to continue.
   */
  private _pendingTransition: {
    dialogueNode: WorkflowNode;
    transition: string | null;
    nodeLabel: string;
  } | null = null;

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

    // If transitions ARE defined but no specific one was requested, we cannot
    // pick a random edge — that would bypass the intended transition routing.
    // Return null so the caller stays in dialogue.
    if (transitions.length > 0) {
      logger.warn('WorkflowEngine: Dialogue has transitions defined but none specified — cannot route', {
        nodeLabel: node.data?.label,
        transitionCount: transitions.length,
      });
      return null;
    }

    // No transitions defined at all — use default handle (simple "Next" output)
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

  /** Replace {{fieldName}} placeholders with actual field values from state.
   *  If a field has no value, the placeholder is removed entirely. */
  private substituteFieldVariables(text: string): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_match, fieldName) => {
      const value = this.state.fields[fieldName];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
      return ''; // Remove placeholder if field not set
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

  private buildDialogueSystemPrompt(node: WorkflowNode): string {
    const agentSetup = this.substituteFieldVariables(this.state.agentSystemMessage || 'You are a helpful AI phone assistant.');
    const stageMessage = node.data?.stageMessage || 'Have a natural conversation.';
    const substituted = this.substituteFieldVariables(stageMessage);
    const label = node.data?.label || 'Dialogue';

    // Only get transitions that have connected edges
    const transitions: Array<{ id: string; name: string }> = node.data?.transitions || [];
    const outEdges = this.edges.filter(e => e.source === node.id);
    const connectedTransitions = transitions.filter(t => {
      const handleId = t.id || `t-${t.name}`;
      return outEdges.some(e => e.sourceHandle === handleId);
    });

    // Only this stage's conversation
    const stageContext = this.state.conversationContext
      .filter(e => e.nodeLabel === label);

    let prompt = `${agentSetup}

---

## YOUR TASK: "${label}"

${substituted}`;

    // Extra instructions
    const extras: string[] = (node.data?.extraInstructions || []).filter((i: string) => i.trim());
    if (extras.length > 0) {
      prompt += `\n\n## Additional Instructions:`;
      extras.forEach((inst, i) => { prompt += `\n${i + 1}. ${this.substituteFieldVariables(inst)}`; });
    }

    // Conversation so far (this stage only)
    if (stageContext.length > 0) {
      prompt += `\n\n## Conversation in this stage:`;
      for (const e of stageContext) {
        prompt += `\n${e.role === 'agent' ? 'You' : 'Caller'}: "${e.text}"`;
      }
    }

    // Transitions
    if (connectedTransitions.length > 0) {
      prompt += `\n\n## When this stage is COMPLETE:`;
      prompt += `\nAppend [NEXT] to your response. The system will route to the correct exit.`;
      prompt += `\nAvailable exits: ${connectedTransitions.map(t => `"${t.name}"`).join(', ')}`;
    } else {
      prompt += `\n\nWhen done, append [NEXT].`;
    }

    // Rules — keep SHORT
    prompt += `\n\n## Rules:
- Real-time voice call. Keep responses to 1 short sentence.
- Follow ONLY the task above. Do NOT ask questions not in the task.
- Do NOT repeat questions already asked above.
- [NEXT] means this stage is complete. Only append it when ALL tasks are done.
- NEVER append [NEXT] if you just asked a question — wait for the answer.
- If caller is unintelligible, append [FALLBACK].`;

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
    const stagePrompt = this.buildDialogueSystemPrompt(node);

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

      // Inject ALREADY ANSWERED as a separate system message RIGHT BEFORE the user's message.
      // This ensures the AI sees it LAST (highest priority in chat context) and doesn't re-ask.
      const answeredSummary = this.buildAnsweredSummary();
      if (answeredSummary && messages.length > 1) {
        const insertIdx = messages.length - 1;
        const qaCount = answeredSummary.split('\n').length;
        messages.splice(insertIdx, 0, {
          role: 'system',
          content: `STOP — READ THIS BEFORE RESPONDING.

${qaCount} questions have ALREADY been asked and answered:
${answeredSummary}

RULES:
- Do NOT re-ask ANY question listed above. The caller already answered them.
- Check the Stage Instructions: if there are MORE unanswered steps, ask the NEXT one.
- If ALL steps in the Stage Instructions are now complete, respond with ONLY a brief "Thank you." and append [NEXT].
- NEVER start over. NEVER repeat step 1. Continue from where you left off.`,
        });
      }

      // Resolve model: per-node override > agent-level > server default
      const model = this.resolveDialogueModel();

      // Step 3: llm_request_sent
      this.lastTiming.promptReadyAt = Date.now() - this._processStartMs;
      this.lastTiming.llmRequestSentAt = Date.now() - this._processStartMs;

      const aiResponse = await gptService.generateWithHistory(
        messages,
        { maxTokens: 150, temperature: 0.2, model }
      );

      // Steps 4+5: non-streaming — first token = full response
      const llmDoneOffset = Date.now() - this._processStartMs;
      this.lastTiming.llmFirstTokenAt = llmDoneOffset;
      this.lastTiming.llmFullResponseAt = llmDoneOffset;

      return aiResponse.text || null;
    } catch (error) {
      logger.error('WorkflowEngine: Failed to generate AI response', { error });
      return null;
    }
  }

  /**
   * Generate AI response with STREAMING — calls onSentence for each sentence
   * as it's generated by the LLM. This enables LLM→TTS pipelining.
   * Returns the full aggregated response text.
   */
  async generateAIResponseStreaming(onSentence: (sentence: string) => void): Promise<string | null> {
    try {
      const messages: ChatMessage[] = [...this.state.dialogueHistory];

      const answeredSummary = this.buildAnsweredSummary();
      if (answeredSummary && messages.length > 1) {
        const insertIdx = messages.length - 1;
        messages.splice(insertIdx, 0, {
          role: 'system',
          content: `CRITICAL — These questions were ALREADY asked and answered. Do NOT re-ask ANY of them:\n${answeredSummary}\n\nYour next response must continue with the NEXT UNANSWERED step. If ALL steps are answered, say a brief acknowledgment and append [NEXT].`,
        });
      }

      const model = this.resolveDialogueModel();

      // Step 3: llm_request_sent
      this.lastTiming.promptReadyAt = Date.now() - this._processStartMs;
      this.lastTiming.llmRequestSentAt = Date.now() - this._processStartMs;

      let firstTokenTracked = false;
      const aiResponse = await gptService.streamWithHistory(
        messages,
        (sentence) => {
          // Step 4: llm_first_token_received (on first sentence callback)
          if (!firstTokenTracked) {
            firstTokenTracked = true;
            this.lastTiming.llmFirstTokenAt = Date.now() - this._processStartMs;
          }
          onSentence(sentence);
        },
        { maxTokens: 150, temperature: 0.2, model }
      );

      // Step 5: llm_full_response_received
      this.lastTiming.llmFullResponseAt = Date.now() - this._processStartMs;

      return aiResponse.text || null;
    } catch (error) {
      logger.error('WorkflowEngine: Failed to generate streaming AI response', { error });
      return null;
    }
  }

  /**
   * Separate AI call to analyze whether a transition should fire.
   * This decouples routing decisions from response generation,
   * preventing the AI from prematurely firing transitions.
   */
  /**
   * Separate AI call to analyze which transition should fire.
   * Only considers transitions that have connected edges — unconnected
   * transitions are invisible to the LLM to prevent routing to dead ends.
   */
  private async analyzeTransition(
    node: WorkflowNode,
    aiResponseText: string,
    userMessage: string,
    connectedTransitionNames: string[],
  ): Promise<string | null> {
    if (connectedTransitionNames.length === 0) return null;

    // Only 1 connected transition — no need for an LLM call, just take it
    if (connectedTransitionNames.length === 1) {
      logger.info('WorkflowEngine: Single transition — skipping LLM analysis', {
        nodeLabel: node.data?.label,
        transition: connectedTransitionNames[0],
      });
      return connectedTransitionNames[0];
    }

    const stageMessage = this.substituteFieldVariables(node.data?.stageMessage || '');
    const transitionList = connectedTransitionNames.join(', ');

    // Only this stage's conversation — strict filter, no cross-stage
    const currentStageContext = this.state.conversationContext
      .filter(e => e.nodeLabel === node.data?.label)
      .slice(-10);

    const analysisPrompt = `You are a routing analyzer. The agent has signaled that this stage is complete. Your job is to decide WHICH exit to take.

STAGE: "${node.data?.label}"
STAGE INSTRUCTIONS:
${stageMessage}

AVAILABLE TRANSITIONS: ${transitionList}
- "${connectedTransitionNames[0]}" = the caller completed the stage successfully (default/happy path).
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
        validTransitions: connectedTransitionNames,
      });

      if (!answer || answer.toUpperCase() === 'NONE') return null;

      // Validate the answer against CONNECTED transitions only
      const matched = connectedTransitionNames.find(
        name => name.toLowerCase() === answer.toLowerCase()
      );
      return matched || null;
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
    connectedTransitionNames?: string[],
  ): Promise<string | null> {
    // Use only connected transitions when provided, otherwise compute them
    const allTransitions: Array<{ id: string; name: string }> = node.data?.transitions || [];
    if (allTransitions.length === 0) return null;

    let transitionNames: string[];
    if (connectedTransitionNames && connectedTransitionNames.length > 0) {
      transitionNames = connectedTransitionNames;
    } else {
      const outEdges = this.edges.filter(e => e.source === node.id);
      transitionNames = allTransitions
        .filter(t => {
          const handleId = t.id || `t-${t.name}`;
          return outEdges.some(e => e.sourceHandle === handleId);
        })
        .map(t => t.name);
      if (transitionNames.length === 0) return null;
    }

    const stageMessage = this.substituteFieldVariables(node.data?.stageMessage || '');

    // Only include messages from THIS stage to avoid cross-stage confusion
    const stageContext = this.state.conversationContext
      .filter(e => e.nodeLabel === node.data?.label)
      .slice(-12);

    // Build a Q&A summary for clarity
    const qaSummary: string[] = [];
    for (let i = 0; i < stageContext.length; i++) {
      if (stageContext[i].role === 'agent' && stageContext[i].text.trim().endsWith('?')) {
        const answer = stageContext[i + 1]?.role === 'user' ? stageContext[i + 1].text : '(no answer yet)';
        qaSummary.push(`Q: "${stageContext[i].text.substring(0, 80)}" → A: "${answer}"`);
      }
    }

    const prompt = `Given this call stage, which transition should fire?

STAGE: "${node.data?.label}"

TRANSITION CONDITIONS (from stage instructions):
${stageMessage}

AVAILABLE TRANSITIONS: ${transitionNames.map(n => `"${n}"`).join(', ')}

QUESTIONS ASKED AND ANSWERED IN THIS STAGE:
${qaSummary.length > 0 ? qaSummary.join('\n') : '(none yet)'}

CALLER'S LATEST MESSAGE: "${userMessage}"

Which transition condition is met? Output ONLY the transition name, or NONE if no condition is met yet.`;

    try {
      const checkStartMs = Date.now();

      logger.info('WorkflowEngine: Proactive check input', {
        nodeLabel: node.data?.label,
        transitions: transitionNames,
        contextEntries: stageContext.length,
        lastEntry: stageContext[stageContext.length - 1]?.text?.substring(0, 60),
        lastEntryRole: stageContext[stageContext.length - 1]?.role,
      });

      const result = await gptService.generateWithCustomPrompt(
        prompt,
        'Output only NONE or a transition name. Nothing else.',
        { maxTokens: 20, temperature: 0.1, model: 'gpt-4o-mini' }
      );

      this.lastTiming.proactiveCheckMs = Date.now() - checkStartMs;
      const answer = (result.text || '').trim().replace(/['"]/g, '');

      logger.info('WorkflowEngine: Proactive check result', {
        nodeLabel: node.data?.label,
        answer,
        qaCount: qaSummary.length,
        checkMs: this.lastTiming.proactiveCheckMs,
      });

      if (!answer || answer.toUpperCase() === 'NONE') return null;

      // Validate against connected transition names only
      const matched = transitionNames.find(
        name => name.toLowerCase() === answer.toLowerCase()
      );

      // SAFEGUARD: If the proactive check wants the FIRST transition (happy path / completion),
      // verify it's reasonable. The first transition means ALL steps are done.
      // If only a few Q&A pairs exist, the stage is likely NOT complete — block it.
      if (matched && matched === transitionNames[0]) {
        // Count how many questions are in the stage instructions (rough estimate)
        const instructionQuestionCount = (stageMessage.match(/\?/g) || []).length;
        // If the instructions have many questions but only a few were asked, block the happy path
        if (instructionQuestionCount > 3 && qaSummary.length < instructionQuestionCount - 2) {
          logger.warn('WorkflowEngine: Proactive check blocked — not enough Q&A for happy path', {
            nodeLabel: node.data?.label,
            transition: matched,
            qaCount: qaSummary.length,
            instructionQuestionCount,
          });
          return null;
        }
      }

      if (matched) {
        logger.info('WorkflowEngine: Proactive check result — stage complete', {
          nodeLabel: node.data?.label,
          transition: matched,
          contextEntries: stageContext.length,
          userMessage: userMessage.substring(0, 50),
          checkMs: this.lastTiming.proactiveCheckMs,
        });
      } else {
        logger.info('WorkflowEngine: Proactive check result — invalid transition ignored', {
          nodeLabel: node.data?.label,
          rawAnswer: answer,
          validTransitions: transitionNames,
        });
      }

      return matched || null;
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
    this.lastTiming = { llmRequestSentAt: 0, llmFirstTokenAt: 0, llmFullResponseAt: 0, transitionAnalysisStartAt: 0, transitionAnalysisDoneAt: 0, promptReadyAt: 0, proactiveCheckMs: 0 };

    // Comprehensive state log at entry — helps diagnose routing issues
    const currentNode = this.state.currentNodeId ? this.nodes.find(n => n.id === this.state.currentNodeId) : null;
    const dialogueNode2 = this.state.currentDialogueNodeId ? this.nodes.find(n => n.id === this.state.currentDialogueNodeId) : null;
    logger.info('WorkflowEngine: processMessage entry state', {
      userMessage: userMessage.substring(0, 80),
      isInDialogue: this.state.isInDialogue,
      isWaitingAfterSpoken: this.state.isWaitingAfterSpoken,
      currentNodeId: this.state.currentNodeId,
      currentNodeLabel: currentNode?.data?.label,
      currentNodeType: currentNode?.data?.type || currentNode?.type,
      currentDialogueNodeId: this.state.currentDialogueNodeId,
      currentDialogueLabel: dialogueNode2?.data?.label,
      dialogueTurnCount: this.state.dialogueTurnCount,
      completedDialogueNodeIds: this.state.completedDialogueNodeIds,
      contextLength: this.state.conversationContext.length,
    });

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
      return {
        messages: [{ type: 'system', text: 'Not waiting for input' }],
        waitingForInput: true,
        isComplete: false,
        currentStage: null,
      };
    }

    const dialogueNode = this.nodes.find((n) => n.id === this.state.currentDialogueNodeId);
    if (!dialogueNode) {
      return {
        messages: [{ type: 'system', text: 'Dialogue node not found' }],
        waitingForInput: true,
        isComplete: false,
        currentStage: null,
      };
    }

    const nodeLabel = dialogueNode.data?.label || 'Dialogue';

    // Get ONLY transitions that have connected edges
    const transitions: Array<{ id: string; name: string }> = dialogueNode.data?.transitions || [];
    const outEdges = this.edges.filter(e => e.source === dialogueNode.id);
    const connectedTransitions = transitions.filter(t => {
      const handleId = t.id || `t-${t.name}`;
      return outEdges.some(e => e.sourceHandle === handleId);
    });
    const connectedTransitionNames = connectedTransitions.map(t => t.name);

    // --- Handle unrecognized speech ---
    if (userMessage === '[SPEECH_NOT_RECOGNIZED]') {
      const fallbackNodeId = this.getDialogueFallbackNodeId(dialogueNode);
      if (fallbackNodeId) {
        this.state.isInDialogue = false;
        this.state.currentDialogueNodeId = null;
        this.state.currentNodeId = fallbackNodeId;
        return this.executeFromCurrent(messages);
      }
      const retryMsg = this.getLanguageAwareFallback('retry');
      this.state.dialogueHistory.push({ role: 'assistant', content: retryMsg });
      messages.push({ type: 'ai', text: retryMsg, nodeLabel });
      this.state.conversationContext.push({ role: 'agent', text: retryMsg, nodeLabel });
      return { messages, waitingForInput: true, isComplete: false, currentStage: nodeLabel };
    }

    // Add user message
    this.state.dialogueHistory.push({ role: 'user', content: userMessage });
    this.state.conversationContext.push({ role: 'user', text: userMessage, nodeLabel });
    this.state.dialogueTurnCount++;
    this.persistState();

    logger.info('WorkflowEngine: Processing dialogue', {
      nodeLabel,
      userMessage: userMessage.substring(0, 80),
      turn: this.state.dialogueTurnCount,
      connectedTransitions: connectedTransitionNames,
    });

    // --- Generate AI response (STREAMING) ---
    // Stream LLM tokens and fire onDialogueResponseReady on the FIRST sentence
    // so the controller can start TTS immediately — don't wait for full response.
    let firstSentenceFired = false;
    const aiResponse = await this.generateAIResponseStreaming((sentence) => {
      // Fire TTS callback on first sentence — controller starts TTS in parallel
      if (!firstSentenceFired && this.onDialogueResponseReady && sentence.trim()) {
        firstSentenceFired = true;
        this.onDialogueResponseReady([{ type: 'ai', text: sentence, nodeLabel }]);
      }
    });

    if (!aiResponse) {
      const fallback = this.getLanguageAwareFallback('error');
      messages.push({ type: 'ai', text: fallback, nodeLabel });
      this.state.dialogueHistory.push({ role: 'assistant', content: fallback });
      this.state.conversationContext.push({ role: 'agent', text: fallback, nodeLabel });
      return { messages, waitingForInput: true, isComplete: false, currentStage: nodeLabel };
    }

    // --- Parse AI response ---
    const parsed = parseAIResponse(aiResponse, connectedTransitionNames);
    const sentences = splitIntoSentences(parsed.text);
    const text = parsed.text;
    const wantsToComplete = aiResponse.includes('[NEXT]') || aiResponse.includes('[STAGE_COMPLETE]');
    const aiEndsWithQuestion = text.trim().endsWith('?');
    const effectiveComplete = wantsToComplete && !aiEndsWithQuestion;

    logger.info('WorkflowEngine: AI response parsed', {
      nodeLabel,
      rawResponse: aiResponse.substring(0, 200),
      parsedText: text.substring(0, 100),
      wantsToComplete,
      aiEndsWithQuestion,
      effectiveComplete,
      wantsFallback: parsed.wantsFallback,
      parsedTransition: parsed.transition,
      sentenceCount: sentences.length,
    });

    // Deliver sentences
    for (const sentence of sentences) {
      if (sentence) {
        messages.push({ type: 'ai', text: sentence, nodeLabel });
        this.state.conversationContext.push({ role: 'agent', text: sentence, nodeLabel });
      }
    }
    if (text) {
      this.state.dialogueHistory.push({ role: 'assistant', content: text });
    }
    this.persistState();

    // --- Handle fallback ---
    if (parsed.wantsFallback) {
      const fallbackNodeId = this.getDialogueFallbackNodeId(dialogueNode);
      if (fallbackNodeId) {
        this.state.isInDialogue = false;
        this.state.currentDialogueNodeId = null;
        this.state.currentNodeId = fallbackNodeId;
        return this.executeFromCurrent(messages);
      }
      messages.push({ type: 'system', text: `⚠️ No fallback connected to "${nodeLabel}"` });
      return { messages, waitingForInput: true, isComplete: false, currentStage: nodeLabel };
    }

    // --- Transition logic: AI is the SOLE authority via [NEXT] ---
    let shouldAdvance = false;
    let transition: string | null = null;

    const maxTurns = parseInt(dialogueNode.data?.maxTurns) || 0;
    const maxTurnsReached = maxTurns > 0 && this.state.dialogueTurnCount >= maxTurns;

    // Whether the node has ANY transitions defined (connected or not)
    const hasTransitionsDefined = (dialogueNode.data?.transitions || []).length > 0;

    // Debug: show transition decision context
    messages.push({ type: 'system', text: `[ROUTE] effective=${effectiveComplete}, transitions=${(dialogueNode.data?.transitions || []).length}, connected=${connectedTransitionNames.length}, fallback=${parsed.wantsFallback}` });

    // Fire callback for remaining sentences if first was already fired during streaming.
    // If first sentence wasn't fired (e.g., AI response was very short), fire all now.
    if (this.onDialogueResponseReady && !firstSentenceFired) {
      const speakableSoFar = messages.filter(m => m.type === 'ai' || m.type === 'scripted');
      if (speakableSoFar.length > 0) {
        this.onDialogueResponseReady(speakableSoFar);
      }
    }

    if (effectiveComplete && connectedTransitionNames.length > 0) {
      // AI signaled [NEXT] — return immediately, transition runs in background
      shouldAdvance = true;
      // Single transition: pre-select it (no LLM needed)
      if (connectedTransitionNames.length === 1) {
        transition = connectedTransitionNames[0];
      }
      // Multiple transitions: analyzeTransition runs in executePendingTransition()

    } else if (effectiveComplete && !hasTransitionsDefined) {
      // [NEXT] and NO transitions defined at all — advance via default "Next" output
      shouldAdvance = true;
      logger.info('WorkflowEngine: [NEXT] → no transitions defined, advancing to default output', { nodeLabel });

    } else if (effectiveComplete && hasTransitionsDefined && connectedTransitionNames.length === 0) {
      // [NEXT] but transitions exist with NO edges connected — cannot route, stay in dialogue
      logger.warn('WorkflowEngine: [NEXT] but all transitions are unconnected — staying', {
        nodeLabel,
        transitionCount: (dialogueNode.data?.transitions || []).length,
      });
      messages.push({ type: 'system', text: `⚠️ No transitions connected in "${nodeLabel}" — staying` });

    } else if (maxTurnsReached) {
      if (connectedTransitionNames.length > 0) {
        shouldAdvance = true;
        transition = await this.analyzeTransition(dialogueNode, text, userMessage, connectedTransitionNames);
        if (!transition) transition = connectedTransitionNames[0];
      } else if (!hasTransitionsDefined) {
        shouldAdvance = true;
      } else {
        // Max turns reached but transitions defined with none connected — stay
        logger.warn('WorkflowEngine: Max turns reached but no transitions connected — staying', { nodeLabel });
      }
      messages.push({ type: 'system', text: `Max turns (${maxTurns}) reached` });
    }

    if (shouldAdvance) {
      // If transition is already known (single transition), validate it now
      if (transition) {
        const nextNodeId = this.getDialogueNextNodeId(dialogueNode, transition);
        if (!nextNodeId) {
          logger.warn('WorkflowEngine: Transition not connected', { transition, nodeLabel });
          messages.push({ type: 'system', text: `⚠️ "${transition}" not connected — staying` });
          return { messages, waitingForInput: true, isComplete: false, currentStage: nodeLabel };
        }
      }
      // If transition is null (multiple transitions), analyzeTransition runs in phase 2

      // Save transition intent — return dialogue response immediately.
      // The controller will call executePendingTransition() in the background
      // while the client plays the dialogue response audio.
      this._pendingTransition = { dialogueNode, transition, nodeLabel };
      logger.info('WorkflowEngine: [NEXT] detected — returning dialogue response, transition pending', {
        nodeLabel, transition,
      });
      return { messages, waitingForInput: false, isComplete: false, currentStage: nodeLabel, transitionPending: true };
    }

    // --- Stay in dialogue ---
    return { messages, waitingForInput: true, isComplete: false, currentStage: nodeLabel };
  }

  /**
   * Execute a pending transition (phase 2).
   * Called by the controller AFTER sending the dialogue response to the client.
   * Runs analyzeTransition + executeFromCurrent to produce transition messages.
   */
  async executePendingTransition(): Promise<WorkflowStepResult | null> {
    if (!this._pendingTransition) return null;

    const { dialogueNode, transition: preSelectedTransition, nodeLabel } = this._pendingTransition;
    this._pendingTransition = null;

    // Reset timing for this phase
    this._processStartMs = Date.now();
    this.lastTiming = { llmRequestSentAt: 0, llmFirstTokenAt: 0, llmFullResponseAt: 0, transitionAnalysisStartAt: 0, transitionAnalysisDoneAt: 0, promptReadyAt: 0, proactiveCheckMs: 0 };

    const messages: WorkflowMessage[] = [];
    const transitions: Array<{ id: string; name: string }> = dialogueNode.data?.transitions || [];
    const outEdges = this.edges.filter(e => e.source === dialogueNode.id);
    const connectedTransitions = transitions.filter(t => {
      const handleId = t.id || `t-${t.name}`;
      return outEdges.some(e => e.sourceHandle === handleId);
    });
    const connectedTransitionNames = connectedTransitions.map(t => t.name);

    // Determine transition
    let transition = preSelectedTransition;
    if (!transition && connectedTransitionNames.length > 0) {
      this.lastTiming.transitionAnalysisStartAt = Date.now() - this._processStartMs;
      const lastUserMsg = this.state.conversationContext.filter(e => e.role === 'user').pop()?.text || '';
      const lastAgentMsg = this.state.conversationContext.filter(e => e.role === 'agent').pop()?.text || '';
      transition = await this.analyzeTransition(dialogueNode, lastAgentMsg, lastUserMsg, connectedTransitionNames);
      this.lastTiming.transitionAnalysisDoneAt = Date.now() - this._processStartMs;
      if (!transition) transition = connectedTransitionNames[0];
    }

    const nextNodeId = this.getDialogueNextNodeId(dialogueNode, transition || undefined);
    if (!nextNodeId) {
      logger.warn('WorkflowEngine: Transition not connected in phase 2', { transition, nodeLabel });
      messages.push({ type: 'system', text: `⚠️ "${transition}" not connected` });
      // Re-enter dialogue since transition failed
      this.state.isInDialogue = true;
      this.state.currentDialogueNodeId = dialogueNode.id;
      return { messages, waitingForInput: true, isComplete: false, currentStage: nodeLabel };
    }

    const targetLabel = this.nodes.find(n => n.id === nextNodeId)?.data?.label;
    messages.push({ type: 'system', text: `${nodeLabel} → [${transition}] → ${targetLabel || 'next'}` });

    // Exit dialogue and advance
    if (!this.state.completedDialogueNodeIds) this.state.completedDialogueNodeIds = [];
    if (!this.state.completedDialogueNodeIds.includes(dialogueNode.id)) {
      this.state.completedDialogueNodeIds.push(dialogueNode.id);
    }
    this.state.isInDialogue = false;
    this.state.currentDialogueNodeId = null;
    this.state.currentNodeId = nextNodeId;
    this.persistState();

    return this.executeFromCurrent(messages);
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
          if (!this.state.completedDialogueNodeIds) this.state.completedDialogueNodeIds = [];
          if (!this.state.completedDialogueNodeIds.includes(node.id)) {
            this.state.completedDialogueNodeIds.push(node.id);
          }

          // PERSIST IMMEDIATELY — if the server restarts during the opening message
          // generation, the disk state will have the correct currentDialogueNodeId.
          // Without this, a restart loads stale state from before the transition.
          this.persistState();

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

            const aiResponse = await this.generateAIResponseStreaming(() => {});

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

          const openingResponse = await this.generateAIResponseStreaming(() => {});

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
          const transferMsg = this.substituteFieldVariables(
            node.data?.transferMessage ||
            `Transferring your call to ${node.data?.transferTo || 'an agent'}.`
          );
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
          const greeting = this.substituteFieldVariables(
            node.data?.greetingMessage || 'Please leave a message after the beep.'
          );
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
          const fallbackText = this.substituteFieldVariables(node.data?.fallbackText || 'Playing audio...');
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
          const fallbackMsg = this.substituteFieldVariables(
            node.data?.fallbackMessage || "I'm sorry, I didn't understand that."
          );
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
          const summaryPrompt = node.data?.summaryPrompt ? this.substituteFieldVariables(node.data.summaryPrompt) : null;
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
