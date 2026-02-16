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

function parseAIResponse(response: string): {
  text: string;
  isComplete: boolean;
  transition?: string;
} {
  const transitionMatch = response.match(/\[TRANSITION:([^\]]+)\]/);
  const transition = transitionMatch ? transitionMatch[1].trim() : undefined;

  const isComplete =
    !!transition ||
    response.includes('[NEXT]') ||
    response.includes('[STAGE_COMPLETE]');

  const text = response
    .replace(/\[TRANSITION:[^\]]+\]/g, '')
    .replace(/\[NEXT\]/g, '')
    .replace(/\[STAGE_COMPLETE\]/g, '')
    .trim();

  return { text, isComplete, transition };
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
        return matchEdge?.target || outEdges[0]?.target || null;
      }
    }

    return this.getNextNodeId(node.id);
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
This stage has the following named transitions:
${transitions.map((t: any) => `- "${t.name}"`).join('\n')}

When the conversation reaches a point where it should move to a specific transition, append [TRANSITION:transition_name] at the very end of your response.
For example: [TRANSITION:${transitions[0].name}]

### Important Rules:
- Follow the stage instructions precisely
- Keep responses concise and natural for voice conversation
- Be friendly and professional
- Choose the most appropriate transition based on the conversation outcome
- Only include [TRANSITION:name] when the stage objectives are fulfilled
- Do NOT say the transition signal aloud - it is an invisible system signal
- If the conversation needs to continue, do NOT include any transition signal`;
    } else {
      prompt += `\n\n### Important Rules:
- Follow the stage instructions precisely
- Keep responses concise and natural for voice conversation
- Be friendly and professional
- When you have completed the objectives of this conversation stage, append [NEXT] at the very end of your response
- Only include [NEXT] when the stage objectives are truly fulfilled
- Do NOT say "[NEXT]" aloud - it is an invisible system signal
- If the conversation needs to continue, do NOT include [NEXT]`;
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

    logger.info('WorkflowEngine: Processing dialogue message', {
      userMessage: userMessage.substring(0, 100),
      nodeLabel: dialogueNode.data?.label,
      turnCount: this.state.dialogueTurnCount,
      historyLength: this.state.dialogueHistory.length,
    });

    // Add user message to dialogue history and conversation context
    this.state.dialogueHistory.push({ role: 'user', content: userMessage });
    this.state.conversationContext.push({ role: 'user', text: userMessage });
    this.state.dialogueTurnCount++;

    // Generate AI response using full conversation history
    const aiResponse = await this.generateAIResponse();

    if (!aiResponse) {
      messages.push({ type: 'system', text: 'AI response unavailable. Advancing workflow.' });
      this.state.isInDialogue = false;
      this.state.currentNodeId = this.getDialogueNextNodeId(dialogueNode);
      return this.executeFromCurrent(messages);
    }

    const { text, isComplete, transition } = parseAIResponse(aiResponse);

    logger.info('WorkflowEngine: Dialogue AI response', {
      responsePreview: text.substring(0, 100),
      isComplete,
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

    const maxTurns = parseInt(dialogueNode.data?.maxTurns) || 0;
    const shouldAdvance = isComplete || (maxTurns > 0 && this.state.dialogueTurnCount >= maxTurns);

    if (shouldAdvance) {
      if (maxTurns > 0 && this.state.dialogueTurnCount >= maxTurns && !isComplete) {
        messages.push({ type: 'system', text: `Max turns (${maxTurns}) reached.` });
      }
      if (transition) {
        messages.push({ type: 'system', text: `Transition: ${transition}` });
      }

      // Exit dialogue and continue workflow
      this.state.isInDialogue = false;
      this.state.currentDialogueNodeId = null;
      this.state.currentNodeId = this.getDialogueNextNodeId(dialogueNode, transition);

      // Continue executing non-interactive nodes
      return this.executeFromCurrent(messages);
    }

    // Dialogue continues - wait for more input
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
          // Enter dialogue mode
          this.state.isInDialogue = true;
          this.state.currentDialogueNodeId = node.id;
          this.state.dialogueTurnCount = 0;

          logger.info('WorkflowEngine: Entering dialogue node', {
            nodeId: node.id,
            nodeLabel: node.data?.label,
            contextLength: this.state.conversationContext.length,
          });

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
              const { text, isComplete, transition } = parseAIResponse(aiResponse);

              logger.info('WorkflowEngine: Dialogue initial AI response', {
                responsePreview: text.substring(0, 100),
                isComplete,
                transition,
              });

              messages.push({ type: 'ai', text, nodeLabel: node.data?.label });
              this.state.dialogueHistory.push({ role: 'assistant', content: text });
              this.state.conversationContext.push({ role: 'agent', text, nodeLabel: node.data?.label });

              if (isComplete) {
                logger.info('WorkflowEngine: Dialogue completed on first response', { transition });
                this.state.isInDialogue = false;
                this.state.currentDialogueNodeId = null;
                if (transition) messages.push({ type: 'system', text: `Transition: ${transition}` });
                this.state.currentNodeId = this.getDialogueNextNodeId(node, transition);
                break;
              }
            } else {
              logger.warn('WorkflowEngine: AI response unavailable in callerAlreadyResponded path');
              messages.push({ type: 'system', text: 'AI response unavailable. Advancing workflow.' });
              this.state.isInDialogue = false;
              this.state.currentDialogueNodeId = null;
              this.state.currentNodeId = this.getDialogueNextNodeId(node);
              break;
            }

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
            const { text, isComplete, transition } = parseAIResponse(openingResponse);
            messages.push({ type: 'ai', text, nodeLabel: node.data?.label });
            this.state.dialogueHistory.push({ role: 'assistant', content: text });
            this.state.conversationContext.push({ role: 'agent', text, nodeLabel: node.data?.label });

            if (isComplete) {
              this.state.isInDialogue = false;
              this.state.currentDialogueNodeId = null;
              if (transition) messages.push({ type: 'system', text: `Transition: ${transition}` });
              this.state.currentNodeId = this.getDialogueNextNodeId(node, transition);
              break;
            }
          } else {
            messages.push({ type: 'system', text: 'AI response unavailable. Advancing workflow.' });
            this.state.isInDialogue = false;
            this.state.currentDialogueNodeId = null;
            this.state.currentNodeId = this.getDialogueNextNodeId(node);
            break;
          }

          // Dialogue is waiting for user input
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
