import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';
import { gptService, ChatMessage } from '../services/ai/gpt.service';

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

    // Generate AI response using the messages (which include the system prompt from the frontend)
    const lastUserMessage = chatMessages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      res.status(400).json({ success: false, error: 'No user message found' });
      return;
    }

    // Get conversation history (excluding the last user message which will be passed separately)
    const conversationHistory = chatMessages.slice(0, -1);

    // Generate response
    const aiResponse = await gptService.generateResponse(
      lastUserMessage.content,
      conversationHistory
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
    const collectItems = callFlowConfig.collectInfo || [];
    const fieldSetterInstructions = collectItems.length > 0
      ? `\n\nINFORMATION TO COLLECT (create a field_setter node for EACH):\n${collectItems.map((item: string) => {
          const fieldMap: Record<string, string> = {
            'Customer Name': 'customer_name',
            'Email Address': 'email',
            'Phone Number': 'phone_number',
            'Company Name': 'company_name',
            'Reason for Call': 'call_reason',
            'Appointment Scheduling': 'appointment_date'
          };
          return `- ${item} → fieldName: "${fieldMap[item] || item.toLowerCase().replace(/\s+/g, '_')}", valueType: "text"`;
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
    // Lower temperature (0.2) for more consistent, deterministic JSON output
    const aiResponse = await gptService.generateWithCustomPrompt(
      userPrompt,
      systemPrompt,
      { maxTokens: 4000, temperature: 0.2 }
    );

    // Parse the AI response to extract JSON with multiple extraction strategies
    let workflow;
    try {
      // Strategy 1: Direct parse (if AI returned clean JSON)
      try {
        workflow = JSON.parse(aiResponse.text);
        logger.info('Workflow parsed with direct parse strategy');
      } catch (directError) {
        // Strategy 2: Extract from markdown code block
        const codeBlockMatch = aiResponse.text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          workflow = JSON.parse(codeBlockMatch[1]);
          logger.info('Workflow parsed from markdown code block');
        } else {
          // Strategy 3: Find any JSON object in the response
          const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No JSON found in AI response');
          }
          workflow = JSON.parse(jsonMatch[0]);
          logger.info('Workflow parsed from general JSON match');
        }
      }
    } catch (parseError) {
      logger.error('Error parsing AI workflow response', {
        error: parseError,
        responsePreview: aiResponse.text.substring(0, 500)
      });
      res.status(500).json({
        success: false,
        error: 'Failed to parse generated workflow. AI did not return valid JSON.',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      });
      return;
    }

    // Comprehensive workflow validation
    const validateWorkflow = (wf: any): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];

      // Basic structure validation
      if (!wf.nodes || !Array.isArray(wf.nodes)) {
        errors.push('Missing or invalid nodes array');
        return { valid: false, errors };
      }
      if (!wf.edges || !Array.isArray(wf.edges)) {
        errors.push('Missing or invalid edges array');
      }

      if (wf.nodes.length === 0) {
        errors.push('No nodes generated');
      }

      const nodeIds = new Set<string>();
      const positions = new Map<string, { x: number; y: number }>();
      let hasAgentSetup = false;
      let hasCallDirection = false;

      // Validate each node
      wf.nodes.forEach((node: any, idx: number) => {
        if (!node.id) errors.push(`Node ${idx}: Missing id`);
        if (!node.type) errors.push(`Node ${idx}: Missing type`);
        if (!node.position) {
          errors.push(`Node ${idx}: Missing position`);
        } else if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
          errors.push(`Node ${idx}: Invalid position coordinates`);
        }
        if (!node.data) errors.push(`Node ${idx}: Missing data`);

        // Check for duplicate IDs
        if (node.id) {
          if (nodeIds.has(node.id)) {
            errors.push(`Duplicate node id: ${node.id}`);
          }
          nodeIds.add(node.id);
        }

        // Check position collisions (nodes too close together)
        if (node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number') {
          positions.forEach((pos, id) => {
            const distance = Math.sqrt(
              Math.pow(pos.x - node.position.x, 2) +
              Math.pow(pos.y - node.position.y, 2)
            );
            if (distance < 150 && id !== node.id) {
              errors.push(
                `Nodes '${id}' and '${node.id}' are too close (${Math.round(distance)}px). Minimum 150px spacing required.`
              );
            }
          });
          positions.set(node.id, node.position);
        }

        // Check for required node types
        if (node.type === 'agentSetup') hasAgentSetup = true;
        if (node.type === 'callDirection') hasCallDirection = true;

        // Validate node type is one of the allowed types
        const validTypes = ['agentSetup', 'callDirection', 'scripted', 'dialogue', 'field_setter', 'junction', 'switch', 'call_transfer', 'voicemail', 'fallback', 'time_limit', 'reconfigure', 'function'];
        if (node.type && !validTypes.includes(node.type)) {
          errors.push(`Node ${node.id}: Invalid type '${node.type}'`);
        }
      });

      if (!hasAgentSetup) {
        errors.push("Missing required 'agentSetup' node");
      }
      if (!hasCallDirection) {
        errors.push("Missing required 'callDirection' node");
      }

      // Validate edges
      if (Array.isArray(wf.edges)) {
        wf.edges.forEach((edge: any, idx: number) => {
          if (!edge.source) {
            errors.push(`Edge ${idx}: Missing source`);
          } else if (!nodeIds.has(edge.source)) {
            errors.push(`Edge ${idx}: Invalid source node '${edge.source}'`);
          }

          if (!edge.target) {
            errors.push(`Edge ${idx}: Missing target`);
          } else if (!nodeIds.has(edge.target)) {
            errors.push(`Edge ${idx}: Invalid target node '${edge.target}'`);
          }
        });

        // Note: Reachability validation disabled - AI-generated workflows may have
        // intentionally disconnected nodes (fallback handlers, alternate paths, etc.)
        // The frontend can handle disconnected nodes gracefully
      }

      return { valid: errors.length === 0, errors };
    };

    const validation = validateWorkflow(workflow);
    if (!validation.valid) {
      logger.error('Workflow validation failed', {
        errors: validation.errors,
        nodeCount: workflow.nodes?.length,
        edgeCount: workflow.edges?.length
      });
      res.status(500).json({
        success: false,
        error: 'Generated workflow failed validation',
        validationErrors: validation.errors
      });
      return;
    }

    logger.info('Workflow generated successfully', {
      userId,
      agentId: id,
      nodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length
    });

    res.status(200).json({
      success: true,
      workflow
    });
  } catch (error) {
    logger.error('Unexpected error generating workflow', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
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
  restoreAgentVersion
};
