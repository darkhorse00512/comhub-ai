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
    const systemPrompt = `You are an expert AI workflow generator. Return ONLY valid JSON - no markdown, no code blocks, no explanations.

## WORKFLOW STRUCTURE
{
  "nodes": [...],  // Array of node objects
  "edges": [...]   // Array of edge connections
}

## NODE TYPES - USE THE TYPE DIRECTLY (NOT "standard")

### 1. AgentSetup Node (REQUIRED - exactly one)
{"id": "agent-setup", "type": "agentSetup", "position": {"x": 400, "y": 50}, "data": {"label": "Agent Setup", "systemMessage": "You are a helpful AI."}}

### 2. CallDirection Node
{"id": "inbound", "type": "callDirection", "position": {"x": 200, "y": 200}, "data": {"label": "Inbound", "direction": "inbound"}}

### 3. Scripted Node (type: "scripted", use "script" field)
{"id": "greeting", "type": "scripted", "position": {"x": 200, "y": 350}, "data": {"label": "Greeting", "script": "Hello! How can I help?"}}

### 4. Dialogue Node (type: "dialogue")
{"id": "dialogue-1", "type": "dialogue", "position": {"x": 200, "y": 500}, "data": {"label": "Conversation", "stageMessage": "Listen and respond helpfully.", "maxTurns": 10}}

### 5. FieldSetter Node (type: "field_setter")
{"id": "collect-1", "type": "field_setter", "position": {"x": 200, "y": 650}, "data": {"label": "Collect Name", "fieldName": "customer_name", "valueType": "text", "value": ""}}

### 6. Junction Node (type: "junction", for True/False branching)
{"id": "check-1", "type": "junction", "position": {"x": 200, "y": 800}, "data": {"label": "Resolved?", "left": {"field_name": "resolved"}, "operator": "==", "right": {"type": "text", "literal": "true"}}}

### 7. CallTransfer Node (type: "call_transfer")
{"id": "transfer-1", "type": "call_transfer", "position": {"x": 400, "y": 950}, "data": {"label": "Transfer", "transferTo": "+15551234567", "transferMessage": "Connecting you.", "transferType": "warm"}}

### 8. Voicemail Node (type: "voicemail")
{"id": "vm-1", "type": "voicemail", "position": {"x": 600, "y": 350}, "data": {"label": "Voicemail", "greetingMessage": "Leave a message.", "maxDuration": 120, "beepSound": true, "transcribe": true, "saveRecording": true}}

### 9. Fallback Node (type: "fallback")
{"id": "fallback-1", "type": "fallback", "position": {"x": 50, "y": 950}, "data": {"label": "Fallback", "fallbackMessage": "Sorry, could you repeat?", "retryCount": 3, "escalateTo": "+15551234567"}}

## EDGE STRUCTURE
Basic: {"id": "e1", "source": "agent-setup", "target": "inbound", "animated": true}
Junction True: {"id": "e-true", "source": "check-1", "target": "thanks", "sourceHandle": "true", "animated": true}
Junction False: {"id": "e-false", "source": "check-1", "target": "transfer", "sourceHandle": "false", "animated": true}

## HORIZONTAL LAYOUT RULES (CRITICAL - NODES FLOW LEFT TO RIGHT!)
- Agent Setup: x=50, y=300 (left side, vertically centered)
- Inbound CallDirection: x=300, y=150 (top row)
- Outbound CallDirection: x=300, y=450 (bottom row)
- Flow direction: LEFT → RIGHT (x increases by 350px per node)
- Inbound flow nodes: y=150 (top row), x increases: 300, 650, 1000, 1350, 1700...
- Outbound flow nodes: y=450 (bottom row), x increases: 300, 650, 1000, 1350, 1700...
- Horizontal spacing: 350px between nodes
- Vertical spacing: 300px between inbound and outbound rows
- Branch nodes (from junction): position vertically offset, same x

## EXAMPLE (HORIZONTAL FLOW)
{
  "nodes": [
    {"id": "agent-setup", "type": "agentSetup", "position": {"x": 50, "y": 300}, "data": {"label": "Agent Setup", "systemMessage": "You are a helpful AI."}},
    {"id": "inbound", "type": "callDirection", "position": {"x": 300, "y": 150}, "data": {"label": "Inbound", "direction": "inbound"}},
    {"id": "outbound", "type": "callDirection", "position": {"x": 300, "y": 450}, "data": {"label": "Outbound", "direction": "outbound"}},
    {"id": "greeting", "type": "scripted", "position": {"x": 650, "y": 150}, "data": {"label": "Greeting", "script": "Hello! How can I help?"}},
    {"id": "dialogue", "type": "dialogue", "position": {"x": 1000, "y": 150}, "data": {"label": "Conversation", "stageMessage": "Help the customer.", "maxTurns": 10}},
    {"id": "intro", "type": "scripted", "position": {"x": 650, "y": 450}, "data": {"label": "Introduction", "script": "Hi, this is an AI calling."}}
  ],
  "edges": [
    {"id": "e1", "source": "agent-setup", "target": "inbound", "animated": true},
    {"id": "e2", "source": "agent-setup", "target": "outbound", "animated": true},
    {"id": "e3", "source": "inbound", "target": "greeting", "animated": true},
    {"id": "e4", "source": "greeting", "target": "dialogue", "animated": true},
    {"id": "e5", "source": "outbound", "target": "intro", "animated": true}
  ]
}

## CRITICAL REQUIREMENTS
1. Return ONLY valid JSON
2. Node "type" must be: agentSetup, callDirection, scripted, dialogue, field_setter, junction, call_transfer, voicemail, fallback
3. DO NOT use "standard" as type - use the specific type directly
4. Use "script" field for scripted nodes
5. Agent-setup must connect to all call-direction nodes`;

    const userPrompt = `Generate a workflow for: ${businessInfo.businessName}
Industry: ${businessInfo.industry || 'General'}
Description: ${businessInfo.description}

GENERATE:
${callFlowConfig.generateInbound ? `- INBOUND flow (purpose: ${callFlowConfig.inboundPurpose || 'customer support'})` : ''}
${callFlowConfig.generateOutbound ? `- OUTBOUND flow (purpose: ${callFlowConfig.outboundPurpose || 'sales/follow-up'})` : ''}
${callFlowConfig.transferToHuman ? '- Include call_transfer node for human escalation' : ''}
${callFlowConfig.collectInfo?.length > 0 ? `- Collect: ${callFlowConfig.collectInfo.join(', ')} (use field_setter nodes)` : ''}

HORIZONTAL LAYOUT (CRITICAL - LEFT TO RIGHT FLOW!):
- Agent Setup: x=50, y=300 (left side)
- Inbound CallDirection: x=300, y=150 (top row)
- Outbound CallDirection: x=300, y=450 (bottom row)
- Inbound nodes flow LEFT→RIGHT at y=150: x=650, 1000, 1350, 1700...
- Outbound nodes flow LEFT→RIGHT at y=450: x=650, 1000, 1350, 1700...
- Horizontal spacing: 350px between nodes
- Agent-setup connects to BOTH call-direction nodes

REMEMBER:
- HORIZONTAL flow (x increases), NOT vertical
- Use "script" field for scripted nodes
- Return ONLY raw JSON
- Professional messages for ${businessInfo.industry}`;

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
