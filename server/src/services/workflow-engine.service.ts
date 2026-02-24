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

  const wantsToComplete =
    !!transition ||
    response.includes('[NEXT]') ||
    response.includes('[STAGE_COMPLETE]');

  const wantsFallback = response.includes('[FALLBACK]');

  const text = response
    .replace(/\[TRANSITION:[^\]]+\]/g, '')
    .replace(/\[NEXT\]/g, '')
    .replace(/\[STAGE_COMPLETE\]/g, '')
    .replace(/\[FALLBACK\]/g, '')
    .trim();

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
export class WorkflowEngine {
  private nodes: WorkflowNode[];
  private edges: WorkflowEdge[];
  private state: WorkflowEngineState;
  private _processing = false;

  constructor(nodes: WorkflowNode[], edges: WorkflowEdge[], agentSystemMessage?: string) {
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
    };
  }

  // --- State management ---

  getState(): WorkflowEngineState {
    return { ...this.state };
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

  /** Restore engine from serialized state (for persisting across HTTP requests) */
  restoreState(savedState: WorkflowEngineState): void {
    this.state = { ...savedState };
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
        if (matchEdge) return matchEdge.target;
        // If no edge matches the handle, try default/non-handle edge
        const defaultEdge = outEdges.find((e) => e.sourceHandle === 'default' || !e.sourceHandle);
        return defaultEdge?.target || null;
      }
    }

    // No specific transition — use default handle or positional fallback
    return this.getNextNodeId(node.id);
  }

  private getDialogueFallbackNodeId(node: WorkflowNode): string | null {
    const outEdges = this.edges.filter((e) => e.source === node.id);
    const fallbackEdge = outEdges.find((e) => e.sourceHandle === 'fallback');
    return fallbackEdge?.target || null;
  }

  // --- System prompt builder for dialogue stages ---

  private buildDialogueSystemPrompt(node: WorkflowNode): string {
    let prompt = this.state.agentSystemMessage || 'You are a helpful AI phone assistant.';

    prompt += `\n\n---\n\n## Current Conversation Stage: "${node.data?.label || 'Dialogue'}"`;
    prompt += `\n\n### Stage Instructions:\n${node.data?.stageMessage || 'Engage in natural conversation with the caller.'}`;

    const extraInstructions: string[] = (node.data?.extraInstructions || []).filter((i: string) => i.trim());
    if (extraInstructions.length > 0) {
      prompt += `\n\n### Additional Instructions:`;
      extraInstructions.forEach((inst: string, idx: number) => {
        prompt += `\n${idx + 1}. ${inst}`;
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

    // Current field values available to the AI
    const fieldEntries = Object.entries(this.state.fields);
    if (fieldEntries.length > 0) {
      prompt += `\n\n### Known Information:`;
      fieldEntries.forEach(([key, value]) => {
        prompt += `\n- ${key}: ${JSON.stringify(value)}`;
      });
    }

    // --- CONVERSATION CONTEXT: what happened before this stage ---
    if (this.state.conversationContext.length > 0) {
      prompt += `\n\n### Previous Conversation in This Call:`;
      prompt += `\nThe following has already been said in this call before reaching this stage:`;
      for (const entry of this.state.conversationContext) {
        if (entry.role === 'agent') {
          prompt += `\n- Agent${entry.nodeLabel ? ` (${entry.nodeLabel})` : ''}: "${entry.text}"`;
        } else {
          prompt += `\n- Caller: "${entry.text}"`;
        }
      }
      prompt += `\n\nIMPORTANT: Do NOT repeat greetings, introductions, or information that was already said above. Continue the conversation naturally from where it left off.`;
    }

    const maxTurns = parseInt(node.data?.maxTurns);
    if (maxTurns > 0) {
      prompt += `\n\nYou have a maximum of ${maxTurns} conversation turns in this stage.`;
    }

    const transitions: Array<{ id: string; name: string }> = node.data?.transitions || [];

    if (transitions.length > 0) {
      prompt += `\n\n### Transitions:
This stage can end by moving to one of these named transitions:
${transitions.map((t: any) => `- "${t.name}"`).join('\n')}

### How Transitions Work:
When — and ONLY when — you are confident that the conversation has reached a clear outcome that matches one of the transitions above, append the transition signal at the very end of your response using this exact format:
[TRANSITION:transition_name]

Example: "Thank you for your interest! Let me transfer you now. [TRANSITION:${transitions[0].name}]"

### CRITICAL RULES — read these carefully:
1. Your PRIMARY job is to have a natural, helpful conversation. Keep talking to the caller, ask questions, provide information.
2. Do NOT rush to transition. The caller called for a reason — help them thoroughly.
3. NEVER include a transition signal in your very first response. You need at least a few exchanges to understand the caller's needs.
4. Only include [TRANSITION:name] when you are CERTAIN the caller's intent clearly matches one of the named transitions.
5. If you are unsure which transition applies, keep the conversation going — ask a clarifying question.
6. The transition signal is invisible to the caller. Do NOT say it aloud, mention it, or reference it.
7. The transition name must EXACTLY match one of the options listed above. Do not invent new names.
8. Keep responses concise and natural for voice conversation (1-3 sentences).
9. Be friendly and professional.
10. If the caller's message is completely unintelligible, irrelevant, or you absolutely cannot understand their intent after multiple attempts, append [FALLBACK] at the end of your response. This will route the call to a fallback handler. Only use this as a last resort.`;
    } else {
      prompt += `\n\n### CRITICAL RULES — read these carefully:
1. Your PRIMARY job is to have a natural, helpful conversation. Keep talking to the caller, ask questions, provide information.
2. Follow the stage instructions precisely.
3. Keep responses concise and natural for voice conversation (1-3 sentences).
4. Be friendly and professional.
5. When — and ONLY when — you have fully completed ALL objectives of this conversation stage, append [NEXT] at the very end of your response.
6. NEVER include [NEXT] in your first response. You must have a real conversation first.
7. Do NOT say "[NEXT]" aloud — it is an invisible system signal.
8. If there is more to discuss, do NOT include [NEXT]. Keep the conversation going.
9. If the caller's message is completely unintelligible, irrelevant, or you absolutely cannot understand their intent after multiple attempts, append [FALLBACK] at the end of your response. This will route the call to a fallback handler. Only use this as a last resort.`;
    }

    return prompt;
  }

  // --- AI response generation ---

  /**
   * Generate AI response using the full dialogue history.
   * History is sent as-is — caller is responsible for adding user messages to dialogueHistory first.
   */
  private async generateAIResponse(): Promise<string | null> {
    try {
      const messages: ChatMessage[] = [...this.state.dialogueHistory];

      const aiResponse = await gptService.generateWithHistory(
        messages,
        { maxTokens: 500, temperature: 0.7 }
      );

      return aiResponse.text || null;
    } catch (error) {
      logger.error('WorkflowEngine: Failed to generate AI response', { error });
      return null;
    }
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
        messages: [{ type: 'system', text: `No ${direction} call direction node found.` }],
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
        messages: [{ type: 'system', text: 'Still processing previous message. Please wait.' }],
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
        messages: [{ type: 'system', text: 'An error occurred processing your message. Please try again.' }],
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

    if (this.state.isComplete) {
      return {
        messages: [{ type: 'system', text: 'Workflow already completed.' }],
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
        messages: [{ type: 'system', text: 'Not waiting for input.' }],
        waitingForInput: false,
        isComplete: this.state.isComplete,
        currentStage: null,
      };
    }

    const dialogueNode = this.nodes.find((n) => n.id === this.state.currentDialogueNodeId);
    if (!dialogueNode) {
      this.state.isInDialogue = false;
      this.state.isComplete = true;
      return {
        messages: [{ type: 'system', text: 'Dialogue node not found.' }],
        waitingForInput: false,
        isComplete: true,
        currentStage: null,
      };
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

      // No fallback connected — ask user to repeat and stay in dialogue
      const retryMsg = "I'm sorry, I didn't catch that. Could you please repeat?";
      messages.push({ type: 'ai', text: retryMsg, nodeLabel: dialogueNode.data?.label });
      this.state.dialogueHistory.push({ role: 'assistant', content: retryMsg });
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
    this.state.dialogueHistory.push({ role: 'user', content: userMessage });
    this.state.conversationContext.push({ role: 'user', text: userMessage });
    this.state.dialogueTurnCount++;

    // Generate AI response using full conversation history
    const aiResponse = await this.generateAIResponse();

    if (!aiResponse) {
      // AI failed — keep dialogue open, ask user to repeat
      const fallback = 'I apologize, I had trouble processing that. Could you say that again?';
      messages.push({ type: 'ai', text: fallback, nodeLabel: dialogueNode.data?.label });
      this.state.dialogueHistory.push({ role: 'assistant', content: fallback });
      this.state.conversationContext.push({ role: 'agent', text: fallback, nodeLabel: dialogueNode.data?.label });

      // Stay in dialogue — don't exit just because of a temporary AI error
      return {
        messages,
        waitingForInput: true,
        isComplete: false,
        currentStage: dialogueNode.data?.label || 'AI Dialogue',
      };
    }

    // Parse the AI response, validating transitions against the actual available names
    const { text, transition, wantsToComplete, wantsFallback } = parseAIResponse(aiResponse, validTransitionNames);

    logger.info('WorkflowEngine: Dialogue AI response', {
      responsePreview: text.substring(0, 100),
      wantsToComplete,
      wantsFallback,
      transition,
      turnCount: this.state.dialogueTurnCount,
    });

    messages.push({
      type: 'ai',
      text,
      nodeLabel: dialogueNode.data?.label,
    });

    // Track in both dialogue history and conversation context
    this.state.dialogueHistory.push({ role: 'assistant', content: text });
    this.state.conversationContext.push({ role: 'agent', text, nodeLabel: dialogueNode.data?.label });

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
      // No fallback node connected — stay in dialogue
      logger.warn('WorkflowEngine: AI triggered [FALLBACK] but no fallback node connected');
    }

    // --- Decide whether to advance ---
    // A dialogue advances when:
    //   (a) AI included a VALID transition signal  OR
    //   (b) AI included [NEXT] and there are NO named transitions  OR
    //   (c) Max turns reached
    const maxTurns = parseInt(dialogueNode.data?.maxTurns) || 0;
    const maxTurnsReached = maxTurns > 0 && this.state.dialogueTurnCount >= maxTurns;

    // If the node HAS named transitions, only advance on a valid transition match
    // (ignore [NEXT] — the AI should use a named transition)
    let shouldAdvance = false;
    if (transition) {
      // Valid named transition matched
      shouldAdvance = true;
    } else if (validTransitionNames.length === 0 && wantsToComplete) {
      // No named transitions — [NEXT] is the only way to advance
      shouldAdvance = true;
    } else if (maxTurnsReached) {
      shouldAdvance = true;
    }

    if (shouldAdvance) {
      if (maxTurnsReached && !transition && !(validTransitionNames.length === 0 && wantsToComplete)) {
        messages.push({ type: 'system', text: `Max turns (${maxTurns}) reached.` });
      }
      if (transition) {
        logger.info('WorkflowEngine: Dialogue transitioning', { transition });
      }

      // Exit dialogue and continue workflow
      this.state.isInDialogue = false;
      this.state.currentDialogueNodeId = null;
      this.state.currentNodeId = this.getDialogueNextNodeId(dialogueNode, transition);

      // Continue executing non-interactive nodes
      return this.executeFromCurrent(messages);
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
      // Return a graceful error
      this.state.isComplete = true;
      messages.push({ type: 'system', text: 'An internal error occurred. Workflow stopped.' });
      return {
        messages,
        waitingForInput: false,
        isComplete: true,
        currentStage: 'Error',
      };
    }
  }

  private async _executeFromCurrentInternal(messages: WorkflowMessage[]): Promise<WorkflowStepResult> {
    while (this.state.currentNodeId) {
      const node = this.nodes.find((n) => n.id === this.state.currentNodeId);
      if (!node) break;

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
          const script = node.data?.script || 'No script configured.';
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
          // (like a real phone call — agent says something, caller responds)
          if (this.state.currentNodeId) {
            this.state.isWaitingAfterSpoken = true;
            return {
              messages,
              waitingForInput: true,
              isComplete: false,
              currentStage: node.data?.label || 'Scripted',
            };
          }
          break;
        }

        case 'dialogue': {
          // Enter dialogue mode — user STAYS here until a valid transition is triggered
          this.state.isInDialogue = true;
          this.state.currentDialogueNodeId = node.id;
          this.state.dialogueTurnCount = 0;

          logger.info('WorkflowEngine: Entering dialogue node', {
            nodeId: node.id,
            nodeLabel: node.data?.label,
            transitions: (node.data?.transitions || []).map((t: any) => t.name),
            contextLength: this.state.conversationContext.length,
          });

          // Validate: warn if no fallback node is connected
          const fallbackTarget = this.getDialogueFallbackNodeId(node);
          if (!fallbackTarget) {
            const label = node.data?.label || node.id;
            logger.warn('WorkflowEngine: Dialogue node has no fallback connection', { nodeId: node.id, label });
            messages.push({
              type: 'system',
              text: `Warning: Dialogue node "${label}" has no fallback connection. Connect a Fallback node to handle unrecognized input.`,
            });
          }

          // Build system prompt (includes conversationContext for full awareness)
          const stagePrompt = this.buildDialogueSystemPrompt(node);

          // Check if the caller already said something (e.g., responded to a scripted message)
          const lastCtx = this.state.conversationContext[this.state.conversationContext.length - 1];
          const callerAlreadyResponded = lastCtx?.role === 'user';

          if (callerAlreadyResponded) {
            // The caller has already responded (e.g., to a scripted question before this node).
            // Use their response as the first dialogue turn — no need to generate a separate opening.
            logger.info('WorkflowEngine: Caller already responded, using as first turn', {
              callerText: lastCtx.text.substring(0, 100),
            });

            this.state.dialogueHistory = [
              { role: 'system', content: stagePrompt },
              { role: 'user', content: lastCtx.text },
            ];
            this.state.dialogueTurnCount++;

            // Generate AI response to the caller's actual message
            const aiResponse = await this.generateAIResponse();

            if (aiResponse) {
              // IMPORTANT: Opening response NEVER triggers transition.
              // The user just said "Good" or "Ok" to a welcome — that's not a real dialogue answer.
              // Strip any transition signals the AI may have hallucinated.
              const { text } = parseAIResponse(aiResponse);

              logger.info('WorkflowEngine: Dialogue opening response (transition signals ignored)', {
                responsePreview: text.substring(0, 100),
              });

              messages.push({ type: 'ai', text, nodeLabel: node.data?.label });
              this.state.dialogueHistory.push({ role: 'assistant', content: text });
              this.state.conversationContext.push({ role: 'agent', text, nodeLabel: node.data?.label });
            } else {
              // AI failed — send a fallback and keep dialogue open for retry
              logger.warn('WorkflowEngine: AI response unavailable in callerAlreadyResponded path');
              const fallback = 'I apologize, could you please repeat that?';
              messages.push({ type: 'ai', text: fallback, nodeLabel: node.data?.label });
              this.state.dialogueHistory.push({ role: 'assistant', content: fallback });
              this.state.conversationContext.push({ role: 'agent', text: fallback, nodeLabel: node.data?.label });
            }

            // Always stay in dialogue — wait for user's next message
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
            ? 'The caller is now on the line. Previous messages have already been delivered (see conversation context above). Continue the conversation naturally — do NOT repeat any greetings or introductions. Respond according to your stage instructions.'
            : 'The caller just connected. Begin the conversation for this stage. Greet or address the caller following your stage instructions.';

          this.state.dialogueHistory = [
            { role: 'system', content: stagePrompt },
            { role: 'user', content: trigger },
          ];

          const openingResponse = await this.generateAIResponse();

          if (openingResponse) {
            // Opening response NEVER triggers transition — conversation hasn't started yet
            const { text } = parseAIResponse(openingResponse);
            messages.push({ type: 'ai', text, nodeLabel: node.data?.label });
            this.state.dialogueHistory.push({ role: 'assistant', content: text });
            this.state.conversationContext.push({ role: 'agent', text, nodeLabel: node.data?.label });
          } else {
            // AI failed — send a generic opening and keep dialogue open
            const fallback = 'Hello! How can I help you today?';
            messages.push({ type: 'ai', text: fallback, nodeLabel: node.data?.label });
            this.state.dialogueHistory.push({ role: 'assistant', content: fallback });
            this.state.conversationContext.push({ role: 'agent', text: fallback, nodeLabel: node.data?.label });
          }

          // Always stay in dialogue — wait for user's first real message
          return {
            messages,
            waitingForInput: true,
            isComplete: false,
            currentStage: node.data?.label || 'AI Dialogue',
          };
        }

        case 'field_setter': {
          const fieldName = node.data?.fieldName;
          const value = node.data?.value;
          const valueType = node.data?.valueType || 'text';

          if (fieldName) {
            let parsedValue: any = value;
            if (valueType === 'number') parsedValue = Number(value);
            if (valueType === 'boolean') parsedValue = value === 'true' || value === true;

            this.state.fields[fieldName] = parsedValue;
            messages.push({
              type: 'system',
              text: `Field "${fieldName}" set to ${JSON.stringify(parsedValue)}`,
            });
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
            text: `Condition: ${fieldName} ${operator} "${compareVal}" → ${result ? 'True' : 'False'}`,
          });

          this.state.currentNodeId = this.evaluateJunction(node);
          break;
        }

        case 'switch': {
          const switchField = node.data?.switchField || '';
          const switchVal = this.state.fields[switchField];
          messages.push({
            type: 'system',
            text: `Switch: ${switchField} = "${switchVal ?? 'undefined'}"`,
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
            text: `Call transferred to ${node.data?.transferTo || 'agent'} (${node.data?.transferType || 'cold'} transfer)`,
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
          messages.push({ type: 'system', text: 'Voicemail recording started.' });

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
            messages.push({ type: 'system', text: `Time limit set: ${maxDuration}s` });
          }
          this.state.currentNodeId = this.getNextNodeId(this.state.currentNodeId);
          break;
        }

        case 'reconfigure': {
          messages.push({
            type: 'system',
            text: `Agent reconfigured: ${node.data?.setting || 'setting'} → ${node.data?.newValue || 'value'}`,
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
          // Generate summary if summaryPrompt is configured
          const summaryPrompt = node.data?.summaryPrompt;
          if (summaryPrompt) {
            try {
              const conversationText = this.state.conversationContext
                .map((e) => `${e.role}: ${e.text}`)
                .join('\n');
              const summaryResult = await gptService.generateWithCustomPrompt(
                `Here is the conversation:\n${conversationText}\n\nPlease provide the summary.`,
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

          // Extract results based on configured result definitions
          const resultDefs: Array<{ name: string; type: string; description?: string; enumValues?: string }> = node.data?.results || [];
          if (resultDefs.length > 0) {
            const extracted: Record<string, any> = {};
            for (const def of resultDefs) {
              if (!def.name) continue;
              let value = this.state.fields[def.name] ?? null;
              // Type coercion
              if (value !== null && def.type) {
                switch (def.type) {
                  case 'integer':
                    value = parseInt(String(value), 10) || 0;
                    break;
                  case 'real':
                    value = parseFloat(String(value)) || 0;
                    break;
                  case 'boolean':
                    value = value === true || value === 'true' || value === '1';
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
            }
            logger.info('WorkflowEngine: End node extracting results', { extracted });
            messages.push({
              type: 'system',
              text: `Extracted results: ${JSON.stringify(extracted)}`,
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
            text: `Function "${node.data?.functionName || 'unknown'}" executed (simulated)`,
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
    messages.push({ type: 'system', text: 'Call workflow completed.' });
    return {
      messages,
      waitingForInput: false,
      isComplete: true,
      currentStage: 'Workflow completed',
    };
  }
}

export default WorkflowEngine;
