import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/auth.middleware';
import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';
import { gptService, ChatMessage } from '../services/ai/gpt.service';
import { WorkflowEngine, WorkflowEngineState } from '../services/workflow-engine.service';
import storageService from '../services/storage.service';
import agentVoiceService from '../services/agent-voice.service';

const supabase = getSupabaseClient();

/**
 * Get all agents for the authenticated user
 */
export const getAgents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    logger.info('Fetching agents for user', { userId });

    const { data, error } = await supabase
      .from('agents')
      .select(`
        *,
        groups:group_id (
          id,
          name
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching agents', { error: error.message, userId });
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    logger.info('Agents fetched successfully', { userId, count: data?.length || 0 });

    res.status(200).json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    logger.error('Unexpected error fetching agents', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get a single agent by ID
 */
export const getAgent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    logger.info('Fetching agent', { userId, agentId: id });

    const { data, error } = await supabase
      .from('agents')
      .select(`
        *,
        groups:group_id (
          id,
          name
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      logger.error('Error fetching agent', { error: error.message, userId, agentId: id });
      res.status(404).json({ success: false, error: 'Agent not found' });
      return;
    }

    logger.info('Agent fetched successfully', { userId, agentId: id });

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('Unexpected error fetching agent', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Create a new agent
 */
export const createAgent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { name, description, group_id, company, email, icon, config } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Validate required fields
    if (!name || name.trim() === '') {
      res.status(400).json({ success: false, error: 'Agent name is required' });
      return;
    }

    if (!group_id) {
      res.status(400).json({ success: false, error: 'Group is required' });
      return;
    }

    logger.info('Creating agent', { userId, name, group_id });

    const { data, error } = await supabase
      .from('agents')
      .insert({
        user_id: userId,
        name: name.trim(),
        description: description?.trim() || null,
        group_id,
        company: company?.trim() || null,
        email: email?.trim() || null,
        icon: icon?.trim() || null,
        config: config || {}
      })
      .select(`
        *,
        groups:group_id (
          id,
          name
        )
      `)
      .single();

    if (error) {
      logger.error('Error creating agent', { error: error.message, userId });
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    logger.info('Agent created successfully', { userId, agentId: data.id });

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('Unexpected error creating agent', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update an existing agent
 */
export const updateAgent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, description, group_id, company, email, icon, config } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    logger.info('Updating agent', { userId, agentId: id });

    // Build update object (only include fields that are provided)
    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (group_id !== undefined) updates.group_id = group_id;
    if (company !== undefined) updates.company = company?.trim() || null;
    if (email !== undefined) updates.email = email?.trim() || null;
    if (icon !== undefined) updates.icon = icon?.trim() || null;
    if (config !== undefined) updates.config = config;

    const { data, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        *,
        groups:group_id (
          id,
          name
        )
      `)
      .single();

    if (error) {
      logger.error('Error updating agent', { error: error.message, userId, agentId: id });
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ success: false, error: 'Agent not found' });
      return;
    }

    logger.info('Agent updated successfully', { userId, agentId: id });

    // Auto-create a version snapshot when config is updated (flow saved)
    if (config !== undefined) {
      try {
        const { data: lastVersion } = await supabase
          .from('agent_versions')
          .select('version_number')
          .eq('agent_id', id)
          .order('version_number', { ascending: false })
          .limit(1)
          .single();

        const nextVersion = (lastVersion?.version_number || 0) + 1;
        const nodeCount = config?.flow?.nodes?.length || 0;
        const edgeCount = config?.flow?.edges?.length || 0;

        await supabase
          .from('agent_versions')
          .insert({
            agent_id: id,
            user_id: userId,
            version_number: nextVersion,
            name: data.name || 'Untitled Agent',
            config: config,
            node_count: nodeCount,
            edge_count: edgeCount,
          });

        logger.info('Agent version snapshot created', { agentId: id, version: nextVersion });
      } catch (versionError) {
        logger.error('Failed to create agent version snapshot', { error: versionError });
      }
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('Unexpected error updating agent', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get version history for an agent
 */
export const getAgentVersions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabase
      .from('agent_versions')
      .select('id, agent_id, version_number, name, node_count, edge_count, created_at')
      .eq('agent_id', id)
      .eq('user_id', userId)
      .order('version_number', { ascending: false });

    if (error) {
      logger.error('Error fetching agent versions', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    logger.error('Unexpected error fetching agent versions', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Restore an agent to a specific version
 */
export const restoreAgentVersion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id, versionId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Fetch the version
    const { data: version, error: versionError } = await supabase
      .from('agent_versions')
      .select('*')
      .eq('id', versionId)
      .eq('agent_id', id)
      .eq('user_id', userId)
      .single();

    if (versionError || !version) {
      res.status(404).json({ success: false, error: 'Version not found' });
      return;
    }

    // Update the agent's config with the version's config
    const { data, error } = await supabase
      .from('agents')
      .update({ config: version.config })
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        *,
        groups:group_id (
          id,
          name
        )
      `)
      .single();

    if (error) {
      logger.error('Error restoring agent version', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    logger.info('Agent restored to version', { agentId: id, versionId, versionNumber: version.version_number });

    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('Unexpected error restoring agent version', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Delete an agent
 */
export const deleteAgent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    logger.info('Deleting agent', { userId, agentId: id });

    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error deleting agent', { error: error.message, userId, agentId: id });
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    logger.info('Agent deleted successfully', { userId, agentId: id });

    res.status(200).json({
      success: true,
      message: 'Agent deleted successfully'
    });
  } catch (error) {
    logger.error('Unexpected error deleting agent', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Clone an existing agent
 */
export const cloneAgent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    logger.info('Cloning agent', { userId, agentId: id });

    // Fetch the original agent
    const { data: original, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !original) {
      logger.error('Error fetching agent to clone', { error: fetchError?.message, userId, agentId: id });
      res.status(404).json({ success: false, error: 'Agent not found' });
      return;
    }

    // Create a clone with "(Copy)" suffix
    const { data: clone, error: cloneError } = await supabase
      .from('agents')
      .insert({
        user_id: userId,
        name: `${original.name} (Copy)`,
        description: original.description,
        group_id: original.group_id,
        company: original.company,
        email: original.email,
        icon: original.icon,
        config: original.config
      })
      .select(`
        *,
        groups:group_id (
          id,
          name
        )
      `)
      .single();

    if (cloneError) {
      logger.error('Error cloning agent', { error: cloneError.message, userId, agentId: id });
      res.status(500).json({ success: false, error: cloneError.message });
      return;
    }

    logger.info('Agent cloned successfully', { userId, originalId: id, cloneId: clone.id });

    res.status(201).json({
      success: true,
      data: clone
    });
  } catch (error) {
    logger.error('Unexpected error cloning agent', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Test chat with an agent - for testing agent workflows
 */
export const testChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { messages, direction } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ success: false, error: 'Messages array is required' });
      return;
    }

    logger.info('Test chat with agent', { userId, agentId: id, direction, messageCount: messages.length });

    // Fetch the agent to verify ownership
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !agent) {
      logger.error('Error fetching agent for test chat', { error: fetchError?.message, userId, agentId: id });
      res.status(404).json({ success: false, error: 'Agent not found' });
      return;
    }

    // Convert messages to ChatMessage format
    const chatMessages: ChatMessage[] = messages.map((msg: any) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));

    // Separate the system prompt (from the frontend's dialogue stage builder) from conversation messages
    const systemMessage = chatMessages.find(m => m.role === 'system');
    const conversationOnly = chatMessages.filter(m => m.role !== 'system');

    const lastUserMessage = conversationOnly.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      res.status(400).json({ success: false, error: 'No user message found' });
      return;
    }

    // Use generateWithCustomPrompt to avoid injecting the default system prompt
    // The client sends the stage-specific system prompt which includes transition signals
    const customSystemPrompt = systemMessage?.content || 'You are a helpful AI phone assistant.';
    const historyForContext = conversationOnly.slice(0, -1);

    // Build a single user prompt that includes conversation history context
    let userPrompt = '';
    if (historyForContext.length > 0) {
      userPrompt += 'Conversation so far:\n';
      historyForContext.forEach(msg => {
        userPrompt += `${msg.role === 'assistant' ? 'You' : 'User'}: ${msg.content}\n`;
      });
      userPrompt += `\nUser: ${lastUserMessage.content}\n\nRespond as the AI assistant:`;
    } else {
      userPrompt = lastUserMessage.content;
    }

    // Generate response using the stage-specific system prompt (not the default one)
    const aiResponse = await gptService.generateWithCustomPrompt(
      userPrompt,
      customSystemPrompt,
      { maxTokens: 500, temperature: 0.7 }
    );

    logger.info('Test chat response generated', {
      userId,
      agentId: id,
      responseLength: aiResponse.text.length
    });

    res.status(200).json({
      success: true,
      response: aiResponse.text,
      usage: aiResponse.usage
    });
  } catch (error) {
    logger.error('Unexpected error in test chat', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Generate a complete workflow using AI based on business information
 */
export const generateWorkflow = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { businessInfo, callFlowConfig } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!businessInfo || !callFlowConfig) {
      res.status(400).json({ success: false, error: 'Business info and call flow config are required' });
      return;
    }

    logger.info('Generating workflow for agent', { userId, agentId: id });

    // Fetch the agent to verify ownership
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !agent) {
      logger.error('Error fetching agent for workflow generation', { error: fetchError?.message, userId, agentId: id });
      res.status(404).json({ success: false, error: 'Agent not found' });
      return;
    }

    // Build the AI prompt for workflow generation
    const systemPrompt = `You are a world-class AI phone call workflow architect. You design production-ready, professional call flows.
Return ONLY valid JSON. No markdown, no code blocks, no explanations, no text outside the JSON object.

## OUTPUT FORMAT
{"nodes": [...], "edges": [...]}

## NODE TYPES (use these exact "type" values)

1. agentSetup (REQUIRED, exactly 1) - Defines agent personality
   {"id": "agent-setup", "type": "agentSetup", "position": {"x": 50, "y": 300}, "data": {"label": "Agent Setup", "systemMessage": "..."}}

2. callDirection - Entry point (inbound or outbound)
   {"id": "inbound", "type": "callDirection", "position": {"x": 300, "y": 150}, "data": {"label": "Inbound Calls", "direction": "inbound"}}

3. scripted - Exact word-for-word message (use "script" field)
   {"id": "greeting", "type": "scripted", "position": {"x": 650, "y": 150}, "data": {"label": "Welcome", "script": "Thank you for calling..."}}

4. dialogue - AI conversation stage with instructions
   {"id": "main-chat", "type": "dialogue", "position": {"x": 1000, "y": 150}, "data": {"label": "Main Conversation", "stageMessage": "Your goal is to understand the customer's needs. Ask clarifying questions. Be empathetic and professional. Collect their name and reason for calling.", "maxTurns": 15}}

5. field_setter - Store a data value
   {"id": "set-name", "type": "field_setter", "position": {"x": 650, "y": 100}, "data": {"label": "Store Name", "fieldName": "customer_name", "valueType": "text", "value": ""}}

6. junction - True/False branch (edges MUST use sourceHandle: "true" or "false")
   {"id": "check-resolved", "type": "junction", "position": {"x": 1350, "y": 150}, "data": {"label": "Issue Resolved?", "left": {"field_name": "issue_resolved"}, "operator": "==", "right": {"type": "text", "literal": "true"}}}

7. switch - Multi-way branch with cases
   {"id": "dept-menu", "type": "switch", "position": {"x": 650, "y": 150}, "data": {"label": "Department Menu", "switchField": "department_choice", "cases": [{"value": "1", "label": "Sales"}, {"value": "2", "label": "Support"}, {"value": "3", "label": "Billing"}]}}

8. call_transfer - Transfer to human
   {"id": "transfer-human", "type": "call_transfer", "position": {"x": 1700, "y": 300}, "data": {"label": "Transfer to Agent", "transferTo": "+15551234567", "transferMessage": "Let me connect you with a specialist who can help further.", "transferType": "warm"}}

9. voicemail - Record message
   {"id": "vm", "type": "voicemail", "position": {"x": 650, "y": 500}, "data": {"label": "Voicemail", "greetingMessage": "We're currently unavailable. Please leave your name, number, and a brief message after the tone.", "maxDuration": 120, "beepSound": true, "transcribe": true, "saveRecording": true}}

10. fallback - Error handling
    {"id": "fallback", "type": "fallback", "position": {"x": 50, "y": 600}, "data": {"label": "Error Handler", "fallbackMessage": "I'm sorry, I didn't quite catch that. Could you please repeat?", "retryCount": 3, "escalateTo": "+15551234567"}}

## EDGE RULES
- Basic: {"id": "e1", "source": "node-a", "target": "node-b", "animated": true}
- Junction True path: {"id": "e-true", "source": "check-1", "target": "success-node", "sourceHandle": "true", "animated": true}
- Junction False path: {"id": "e-false", "source": "check-1", "target": "fail-node", "sourceHandle": "false", "animated": true}
- Switch case path: {"id": "e-case-0", "source": "switch-1", "target": "sales-node", "sourceHandle": "case-0", "animated": true}
- CRITICAL: Junction edges MUST have sourceHandle "true" or "false"
- CRITICAL: Switch edges MUST have sourceHandle "case-0", "case-1", "case-2" etc matching case index

## LAYOUT (HORIZONTAL - LEFT TO RIGHT)
- Agent Setup: x=50, y=300
- Inbound CallDirection: x=300, y=150
- Outbound CallDirection: x=300, y=500
- Flow LEFT→RIGHT, x increases by 350px per step
- Inbound row: y around 100-250
- Outbound row: y around 450-600
- Junction branches: True path keeps same y, False path y+200
- Minimum 200px between any two nodes
- Agent-setup connects to ALL callDirection nodes

## PROFESSIONAL WORKFLOW PATTERNS

### Inbound Customer Service (8-12 nodes):
AgentSetup → CallDirection(inbound) → Scripted(greeting) → Dialogue(understand needs, 15 turns) → Junction(resolved?) → [True: Scripted(thank you + closing)] [False: CallTransfer(human agent)] + Fallback(error handler)

### Outbound Sales/Follow-up (6-10 nodes):
AgentSetup → CallDirection(outbound) → Scripted(introduction + permission) → Junction(interested?) → [True: Dialogue(pitch/discuss, 20 turns) → Scripted(closing + next steps)] [False: Scripted(polite goodbye)] + Fallback

### Key principles:
- Always start with a warm, professional scripted greeting that mentions the business name
- Dialogue nodes need DETAILED stageMessage instructions (3-5 sentences minimum) telling the AI exactly what to accomplish
- Include specific field_setter nodes for each piece of information to collect
- Always include a fallback node for error recovery
- Junction conditions should check meaningful business logic
- Closing scripts should thank the caller and summarize next steps
- SystemMessage in agentSetup should be 3-5 sentences defining the agent's role, tone, and boundaries`;

    // Build detailed user prompt
    // Map collectInfo IDs to labels and field names (client sends IDs like "name", "email")
    const collectIdMap: Record<string, { label: string; fieldName: string }> = {
      'name': { label: 'Customer Name', fieldName: 'customer_name' },
      'email': { label: 'Email Address', fieldName: 'email' },
      'phone': { label: 'Phone Number', fieldName: 'phone_number' },
      'company': { label: 'Company Name', fieldName: 'company_name' },
      'reason': { label: 'Reason for Call', fieldName: 'call_reason' },
      'appointment': { label: 'Appointment Scheduling', fieldName: 'appointment_date' },
      // Fallback for label-style values (backward compatibility)
      'Customer Name': { label: 'Customer Name', fieldName: 'customer_name' },
      'Email Address': { label: 'Email Address', fieldName: 'email' },
      'Phone Number': { label: 'Phone Number', fieldName: 'phone_number' },
      'Company Name': { label: 'Company Name', fieldName: 'company_name' },
      'Reason for Call': { label: 'Reason for Call', fieldName: 'call_reason' },
      'Appointment Scheduling': { label: 'Appointment Scheduling', fieldName: 'appointment_date' },
    };
    const collectItems = callFlowConfig.collectInfo || [];
    const fieldSetterInstructions = collectItems.length > 0
      ? `\n\nINFORMATION TO COLLECT (create a field_setter node for EACH):\n${collectItems.map((item: string) => {
          const mapped = collectIdMap[item];
          const label = mapped?.label || item;
          const fieldName = mapped?.fieldName || item.toLowerCase().replace(/\s+/g, '_');
          return `- ${label} → fieldName: "${fieldName}", valueType: "text"`;
        }).join('\n')}`
      : '';

    const userPrompt = `Design a complete, production-quality phone call workflow for:

BUSINESS: ${businessInfo.businessName}
INDUSTRY: ${businessInfo.industry || 'General'}
DESCRIPTION: ${businessInfo.description}
${businessInfo.targetAudience ? `TARGET AUDIENCE: ${businessInfo.targetAudience}` : ''}
${businessInfo.mainServices ? `SERVICES: ${businessInfo.mainServices}` : ''}

WORKFLOWS TO GENERATE:
${callFlowConfig.generateInbound ? `✅ INBOUND CALL FLOW
   Purpose: ${callFlowConfig.inboundPurpose || 'Handle incoming customer inquiries professionally'}
   Required nodes: greeting (scripted) → main conversation (dialogue) → resolution check (junction) → closing (scripted) or transfer (call_transfer)` : ''}
${callFlowConfig.generateOutbound ? `✅ OUTBOUND CALL FLOW
   Purpose: ${callFlowConfig.outboundPurpose || 'Proactive outreach, sales, or follow-up'}
   Required nodes: introduction (scripted) → interest check (junction) → conversation (dialogue) → closing (scripted)` : ''}
${callFlowConfig.transferToHuman ? '✅ Include CALL TRANSFER node for human agent escalation with a warm, professional transfer message' : ''}
${callFlowConfig.businessHours ? `✅ Business hours: ${callFlowConfig.businessHours} - add voicemail for after-hours` : ''}
${fieldSetterInstructions}

QUALITY REQUIREMENTS:
1. The systemMessage in agentSetup MUST mention "${businessInfo.businessName}" by name and describe the agent's role for ${businessInfo.industry}
2. All scripted messages must be warm, professional, and specific to ${businessInfo.industry} (not generic)
3. Dialogue stageMessage instructions must be DETAILED (what to ask, how to respond, what information to gather)
4. Generate 8-15 nodes total for a complete, realistic workflow
5. Every node must be connected - no orphan nodes
6. Include a fallback node for error handling
7. Junction edges MUST use sourceHandle "true" or "false"
8. Switch edges MUST use sourceHandle "case-0", "case-1", etc.

LAYOUT:
- HORIZONTAL flow: LEFT → RIGHT (x increases by 350px)
- Agent Setup at x=50, y=300
- Inbound row: y=150, Outbound row: y=500
- Junction True branch: keep same y, False branch: y+200

Return ONLY the JSON object.`;

    // Generate workflow using GPT with custom prompt and higher token limit
    // maxTokens 8000 to accommodate 8-15 nodes with detailed content
    // Low temperature (0.2) for consistent, deterministic JSON output
    const aiResponse = await gptService.generateWithCustomPrompt(
      userPrompt,
      systemPrompt,
      { maxTokens: 8000, temperature: 0.2 }
    );

    // Parse the AI response to extract JSON with multiple extraction strategies
    let workflow;
    const parseErrors: string[] = [];

    // Strategy 1: Direct parse (if AI returned clean JSON)
    try {
      workflow = JSON.parse(aiResponse.text);
      logger.info('Workflow parsed with direct parse strategy');
    } catch (e) {
      parseErrors.push(`Direct parse: ${e instanceof Error ? e.message : 'failed'}`);
    }

    // Strategy 2: Extract from markdown code block (use GREEDY match for nested JSON)
    if (!workflow) {
      try {
        const codeBlockMatch = aiResponse.text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (codeBlockMatch) {
          workflow = JSON.parse(codeBlockMatch[1]);
          logger.info('Workflow parsed from markdown code block');
        }
      } catch (e) {
        parseErrors.push(`Code block parse: ${e instanceof Error ? e.message : 'failed'}`);
      }
    }

    // Strategy 3: Find any JSON object in the response (greedy)
    if (!workflow) {
      try {
        const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          workflow = JSON.parse(jsonMatch[0]);
          logger.info('Workflow parsed from general JSON match');
        } else {
          parseErrors.push('No JSON object found in response');
        }
      } catch (e) {
        parseErrors.push(`General JSON parse: ${e instanceof Error ? e.message : 'failed'}`);
      }
    }

    if (!workflow) {
      logger.error('All JSON parsing strategies failed', {
        errors: parseErrors,
        responsePreview: aiResponse.text.substring(0, 500)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to parse generated workflow. AI did not return valid JSON.',
        details: parseErrors.join('; ')
      });
      return;
    }

    // Validate and sanitize the workflow (fix issues instead of rejecting)
    const sanitizeWorkflow = (wf: any): { workflow: any; warnings: string[] } => {
      const warnings: string[] = [];

      // Critical: must have nodes array
      if (!wf.nodes || !Array.isArray(wf.nodes)) {
        throw new Error('AI response missing nodes array');
      }
      // Ensure edges is an array (default to empty if missing)
      if (!wf.edges || !Array.isArray(wf.edges)) {
        wf.edges = [];
        warnings.push('No edges in response, defaulting to empty');
      }

      if (wf.nodes.length === 0) {
        throw new Error('AI generated zero nodes');
      }

      const nodeIds = new Set<string>();
      const validTypes = ['agentSetup', 'callDirection', 'scripted', 'dialogue', 'field_setter', 'junction', 'switch', 'call_transfer', 'voicemail', 'fallback', 'time_limit', 'reconfigure', 'function', 'play_audio'];

      // Sanitize nodes: fix IDs, ensure position/data exist, remove invalid types
      wf.nodes = wf.nodes.filter((node: any, idx: number) => {
        // Must have an id
        if (!node.id) {
          node.id = `node-${idx}-${Date.now()}`;
          warnings.push(`Node ${idx}: auto-assigned id ${node.id}`);
        }

        // Ensure unique IDs
        if (nodeIds.has(node.id)) {
          node.id = `${node.id}-${idx}`;
          warnings.push(`Duplicate node id resolved: ${node.id}`);
        }
        nodeIds.add(node.id);

        // Must have a valid type
        if (!node.type || !validTypes.includes(node.type)) {
          // Try to infer from data.type
          if (node.data?.type && validTypes.includes(node.data.type)) {
            node.type = node.data.type;
            warnings.push(`Node ${node.id}: type inferred from data.type`);
          } else {
            warnings.push(`Node ${node.id}: removed - invalid type '${node.type}'`);
            return false; // remove this node
          }
        }

        // Ensure position exists
        if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
          node.position = { x: 100 + idx * 350, y: 300 };
          warnings.push(`Node ${node.id}: auto-positioned`);
        }

        // Ensure data exists
        if (!node.data) {
          node.data = { label: node.id };
          warnings.push(`Node ${node.id}: auto-assigned empty data`);
        }

        return true;
      });

      // Filter out edges referencing non-existent nodes
      const validNodeIds = new Set(wf.nodes.map((n: any) => n.id));
      const originalEdgeCount = wf.edges.length;
      wf.edges = wf.edges.filter((edge: any) => {
        if (!edge.source || !edge.target) return false;
        if (!validNodeIds.has(edge.source) || !validNodeIds.has(edge.target)) return false;
        // Ensure edge has an id
        if (!edge.id) {
          edge.id = `e-${edge.source}-${edge.target}-${Date.now()}`;
        }
        // Ensure animated flag
        if (edge.animated === undefined) {
          edge.animated = true;
        }
        return true;
      });
      if (wf.edges.length < originalEdgeCount) {
        warnings.push(`Removed ${originalEdgeCount - wf.edges.length} invalid edges`);
      }

      return { workflow: wf, warnings };
    };

    let sanitizedWorkflow;
    try {
      const result = sanitizeWorkflow(workflow);
      sanitizedWorkflow = result.workflow;
      if (result.warnings.length > 0) {
        logger.warn('Workflow sanitization warnings', { warnings: result.warnings });
      }
    } catch (sanitizeError) {
      logger.error('Workflow sanitization failed', { error: sanitizeError });
      res.status(500).json({
        success: false,
        error: sanitizeError instanceof Error ? sanitizeError.message : 'Invalid workflow structure'
      });
      return;
    }

    logger.info('Workflow generated successfully', {
      userId,
      agentId: id,
      nodeCount: sanitizedWorkflow.nodes.length,
      edgeCount: sanitizedWorkflow.edges.length
    });

    res.status(200).json({
      success: true,
      workflow: sanitizedWorkflow
    });
  } catch (error) {
    logger.error('Unexpected error generating workflow', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// --- Workflow-based test call sessions ---

interface WorkflowSession {
  engine: WorkflowEngine;
  nodes: any[];
  edges: any[];
  agentId: string;
  userId: string;
  direction: 'inbound' | 'outbound';
  createdAt: Date;
}

// In-memory cache for active workflow test calls
const workflowSessions = new Map<string, WorkflowSession>();

// File-based persistence so sessions survive server restarts (ts-node-dev --respawn)
const SESSION_DIR = path.join(__dirname, '../../tmp/workflow-sessions');
try { fs.mkdirSync(SESSION_DIR, { recursive: true }); } catch {}

function persistSession(sessionId: string, session: WorkflowSession): void {
  try {
    const data = {
      nodes: session.nodes,
      edges: session.edges,
      engineState: session.engine.getState(),
      agentId: session.agentId,
      userId: session.userId,
      direction: session.direction,
      createdAt: session.createdAt.toISOString(),
    };
    fs.writeFileSync(path.join(SESSION_DIR, `${sessionId}.json`), JSON.stringify(data), 'utf-8');
  } catch (err) {
    logger.error('Failed to persist workflow session', { sessionId, error: err });
  }
}

function loadSessionFromDisk(sessionId: string): WorkflowSession | null {
  try {
    // Validate session ID format to prevent path traversal
    if (!/^wf-\d+-[a-z0-9]+$/.test(sessionId)) return null;

    const filePath = path.join(SESSION_DIR, `${sessionId}.json`);
    if (!fs.existsSync(filePath)) return null;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Check expiry (30 minutes)
    if (Date.now() - new Date(data.createdAt).getTime() > 30 * 60 * 1000) {
      try { fs.unlinkSync(filePath); } catch {}
      return null;
    }

    // Re-create the engine with the saved nodes/edges and restore its state
    const engine = new WorkflowEngine(data.nodes, data.edges);
    engine.restoreState(data.engineState as WorkflowEngineState);

    const session: WorkflowSession = {
      engine,
      nodes: data.nodes,
      edges: data.edges,
      agentId: data.agentId,
      userId: data.userId,
      direction: data.direction,
      createdAt: new Date(data.createdAt),
    };

    // Re-hydrate in-memory cache
    workflowSessions.set(sessionId, session);
    logger.info('Workflow session restored from disk', { sessionId });

    return session;
  } catch (err) {
    logger.error('Failed to load workflow session from disk', { sessionId, error: err });
    return null;
  }
}

function deleteSessionFromDisk(sessionId: string): void {
  try {
    const filePath = path.join(SESSION_DIR, `${sessionId}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

/** Look up a session: try in-memory first, then fall back to disk */
function getSession(sessionId: string): WorkflowSession | null {
  return workflowSessions.get(sessionId) || loadSessionFromDisk(sessionId);
}

// Cleanup stale sessions older than 30 minutes (both in-memory and disk)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of workflowSessions) {
    if (now - session.createdAt.getTime() > 30 * 60 * 1000) {
      workflowSessions.delete(sessionId);
      deleteSessionFromDisk(sessionId);
    }
  }
  // Also clean up old session files on disk
  try {
    const files = fs.readdirSync(SESSION_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(SESSION_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > 30 * 60 * 1000) {
        fs.unlinkSync(filePath);
      }
    }
  } catch {}
}, 5 * 60 * 1000);

/**
 * Start a workflow-based test call.
 * Creates a WorkflowEngine session and returns the initial messages.
 */
export const startWorkflowCall = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { direction } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!direction || !['inbound', 'outbound'].includes(direction)) {
      res.status(400).json({ success: false, error: 'Direction must be "inbound" or "outbound"' });
      return;
    }

    // Fetch the agent with its workflow config
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !agent) {
      res.status(404).json({ success: false, error: 'Agent not found' });
      return;
    }

    const nodes = agent.config?.flow?.nodes || [];
    const edges = agent.config?.flow?.edges || [];

    if (nodes.length === 0) {
      res.status(400).json({ success: false, error: 'Agent has no workflow configured' });
      return;
    }

    // Create workflow engine
    const engine = new WorkflowEngine(nodes, edges);

    // Start the workflow
    const result = await engine.start(direction);

    // Generate session ID and store (both in-memory and on disk)
    const sessionId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session: WorkflowSession = {
      engine,
      nodes,
      edges,
      agentId: id,
      userId,
      direction,
      createdAt: new Date(),
    };
    workflowSessions.set(sessionId, session);
    persistSession(sessionId, session);

    logger.info('Workflow call started', {
      sessionId,
      agentId: id,
      direction,
      messageCount: result.messages.length,
      waitingForInput: result.waitingForInput,
      isComplete: result.isComplete,
    });

    res.status(200).json({
      success: true,
      sessionId,
      ...result,
      collectedFields: engine.getFields(),
    });
  } catch (error) {
    logger.error('Failed to start workflow call', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Send a message to an active workflow test call session.
 * Processes the message through the workflow engine and returns the response.
 */
export const sendWorkflowMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id, sessionId } = req.params;
    const { message } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!message || typeof message !== 'string') {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    const session = getSession(sessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Workflow session not found or expired' });
      return;
    }

    if (session.userId !== userId || session.agentId !== id) {
      res.status(403).json({ success: false, error: 'Session does not belong to this agent/user' });
      return;
    }

    // Process the message through the workflow engine
    logger.info('Processing workflow message', {
      sessionId,
      message: message.substring(0, 100),
      engineState: {
        isInDialogue: session.engine.getState().isInDialogue,
        isWaitingAfterSpoken: session.engine.getState().isWaitingAfterSpoken,
        currentNodeId: session.engine.getState().currentNodeId,
      },
    });

    const result = await session.engine.processMessage(message);

    // Clean up if workflow is complete, otherwise persist updated state
    if (result.isComplete) {
      workflowSessions.delete(sessionId);
      deleteSessionFromDisk(sessionId);
    } else {
      persistSession(sessionId, session);
    }

    logger.info('Workflow message processed', {
      sessionId,
      messageCount: result.messages.length,
      waitingForInput: result.waitingForInput,
      isComplete: result.isComplete,
      currentStage: result.currentStage,
    });

    res.status(200).json({
      success: true,
      ...result,
      collectedFields: session.engine.getFields(),
    });
  } catch (error) {
    logger.error('Failed to process workflow message', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * End a workflow test call session.
 */
export const endWorkflowCall = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id, sessionId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Get session from memory or disk to extract collected fields before cleanup
    let collectedFields: Record<string, any> = {};
    const session = workflowSessions.get(sessionId) || loadSessionFromDisk(sessionId);
    if (session) {
      collectedFields = session.engine.getFields();
      workflowSessions.delete(sessionId);
    }
    deleteSessionFromDisk(sessionId);
    logger.info('Workflow call ended', { sessionId, agentId: id, collectedFieldCount: Object.keys(collectedFields).length });

    res.status(200).json({ success: true, collectedFields });
  } catch (error) {
    logger.error('Failed to end workflow call', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Upload audio file for PlayAudio nodes
 */
export const uploadAudio = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !agent) {
      res.status(404).json({ success: false, error: 'Agent not found' });
      return;
    }

    const file = (req as any).file;
    if (!file) {
      res.status(400).json({ success: false, error: 'No audio file provided' });
      return;
    }

    const publicUrl = await storageService.uploadPlayAudio(
      file.buffer,
      id,
      file.originalname
    );

    res.status(200).json({
      success: true,
      data: {
        audioUrl: publicUrl,
        audioFileName: file.originalname,
      },
    });
  } catch (error) {
    logger.error('Failed to upload play audio:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    });
  }
};

/**
 * Get active voice models for the voice library (public, no API keys exposed)
 */
export const getPublicVoiceModels = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('voice_models')
      .select('id, name, image_url, preview_audio_url, description, model')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to fetch public voice models:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch voice models' });
      return;
    }

    res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    logger.error('Failed to get public voice models:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch voice models' });
  }
};

/**
 * Generate TTS audio for text using the agent's configured voice settings.
 * Returns audio as binary (audio/mpeg) for direct playback.
 */
export const generateTTS = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { text } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Text is required' });
      return;
    }

    // Verify the agent belongs to the user
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !agent) {
      res.status(404).json({ success: false, error: 'Agent not found' });
      return;
    }

    // Resolve voice settings and generate audio
    const voiceSettings = await agentVoiceService.resolveVoiceSettings(id);

    logger.info('Generating TTS for agent', {
      agentId: id,
      textLength: text.length,
      provider: voiceSettings?.ttsProvider || 'default-openai',
      hasElevenLabsCreds: !!(voiceSettings?.elevenlabsApiKey && voiceSettings?.elevenlabsVoiceId),
    });

    const audioBuffer = await agentVoiceService.generateTTS(text, voiceSettings);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length.toString(),
    });
    res.send(audioBuffer);
  } catch (error) {
    logger.error('Failed to generate TTS:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      agentId: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'TTS generation failed',
    });
  }
};

export default {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  cloneAgent,
  testChat,
  generateWorkflow,
  getAgentVersions,
  restoreAgentVersion,
  startWorkflowCall,
  sendWorkflowMessage,
  endWorkflowCall,
  uploadAudio,
  getPublicVoiceModels,
  generateTTS,
};
