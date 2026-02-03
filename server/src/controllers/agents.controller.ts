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

## NODE TYPES WITH EXACT DATA STRUCTURES

### 1. AgentSetup Node (REQUIRED - exactly one, at top)
{
  "id": "agent-setup",
  "type": "agentSetup",
  "position": {"x": 400, "y": 50},
  "data": {
    "label": "Agent Setup",
    "systemMessage": "You are a professional AI assistant for [Business]. Be helpful, polite, and efficient."
  }
}

### 2. CallDirection Node (connects below agent-setup)
{
  "id": "inbound-direction",
  "type": "callDirection",
  "position": {"x": 200, "y": 200},
  "data": {
    "label": "Inbound Calls",
    "direction": "inbound"
  }
}

### 3. Scripted Node (IMPORTANT: use "script" not "content")
{
  "id": "greeting",
  "type": "standard",
  "position": {"x": 200, "y": 350},
  "data": {
    "type": "scripted",
    "label": "Welcome Greeting",
    "script": "Thank you for calling! How may I help you today?"
  }
}

### 4. Dialogue Node (AI conversation)
{
  "id": "main-dialogue",
  "type": "standard",
  "position": {"x": 200, "y": 500},
  "data": {
    "type": "dialogue",
    "label": "Main Conversation",
    "stageMessage": "Listen to the customer and provide helpful assistance.",
    "maxTurns": 10
  }
}

### 5. FieldSetter Node (collect data)
{
  "id": "collect-info",
  "type": "standard",
  "position": {"x": 200, "y": 650},
  "data": {
    "type": "field_setter",
    "label": "Collect Name",
    "fieldName": "customer_name",
    "valueType": "text",
    "value": ""
  }
}

### 6. Junction Node (True/False branching)
{
  "id": "check-condition",
  "type": "standard",
  "position": {"x": 200, "y": 800},
  "data": {
    "type": "junction",
    "label": "Issue Resolved?",
    "left": {"field_name": "resolved"},
    "operator": "==",
    "right": {"type": "text", "literal": "true"}
  }
}

### 7. CallTransfer Node
{
  "id": "transfer",
  "type": "standard",
  "position": {"x": 400, "y": 950},
  "data": {
    "type": "call_transfer",
    "label": "Transfer to Human",
    "transferTo": "+15551234567",
    "transferMessage": "Connecting you to a specialist.",
    "transferType": "warm",
    "waitMusic": true
  }
}

### 8. Voicemail Node
{
  "id": "voicemail",
  "type": "standard",
  "position": {"x": 600, "y": 350},
  "data": {
    "type": "voicemail",
    "label": "Leave Voicemail",
    "greetingMessage": "Please leave a message after the beep.",
    "maxDuration": 120,
    "beepSound": true,
    "transcribe": true,
    "saveRecording": true
  }
}

### 9. Fallback Node
{
  "id": "fallback",
  "type": "standard",
  "position": {"x": 50, "y": 950},
  "data": {
    "type": "fallback",
    "label": "Error Handler",
    "fallbackMessage": "I'm sorry, could you please repeat that?",
    "retryCount": 3,
    "escalateTo": "+15551234567"
  }
}

## EDGE STRUCTURE
Basic edge:
{"id": "e1", "source": "agent-setup", "target": "inbound-direction", "animated": true}

Junction edges (use sourceHandle "true" or "false"):
{"id": "e-true", "source": "check-condition", "target": "thank-you", "sourceHandle": "true", "animated": true}
{"id": "e-false", "source": "check-condition", "target": "transfer", "sourceHandle": "false", "animated": true}

## HORIZONTAL LAYOUT RULES (CRITICAL!)
- Agent Setup: Center top at x=400, y=50
- Flow direction: LEFT to RIGHT (x increases)
- Inbound flow: Start at x=200, y=200
- Outbound flow: Start at x=700, y=200
- Node spacing: 150px horizontal, 150px vertical
- Branch nodes: Position side by side horizontally
- BOTH call-direction nodes must connect FROM agent-setup

## COMPLETE EXAMPLE
{
  "nodes": [
    {"id": "agent-setup", "type": "agentSetup", "position": {"x": 400, "y": 50}, "data": {"label": "Agent Setup", "systemMessage": "You are a helpful AI assistant."}},
    {"id": "inbound", "type": "callDirection", "position": {"x": 200, "y": 200}, "data": {"label": "Inbound", "direction": "inbound"}},
    {"id": "outbound", "type": "callDirection", "position": {"x": 600, "y": 200}, "data": {"label": "Outbound", "direction": "outbound"}},
    {"id": "greeting", "type": "standard", "position": {"x": 200, "y": 350}, "data": {"type": "scripted", "label": "Greeting", "script": "Hello! How can I help?"}},
    {"id": "intro", "type": "standard", "position": {"x": 600, "y": 350}, "data": {"type": "scripted", "label": "Introduction", "script": "Hi, this is an AI calling from Acme Corp."}}
  ],
  "edges": [
    {"id": "e1", "source": "agent-setup", "target": "inbound", "animated": true},
    {"id": "e2", "source": "agent-setup", "target": "outbound", "animated": true},
    {"id": "e3", "source": "inbound", "target": "greeting", "animated": true},
    {"id": "e4", "source": "outbound", "target": "intro", "animated": true}
  ]
}

## REQUIREMENTS
1. Return ONLY valid JSON
2. Use "script" field for scripted nodes (NOT "content")
3. Agent-setup connects to ALL call-direction nodes
4. Horizontal layout (x increases left to right)
5. All nodes must have proper data structure
6. All edges must have valid source/target IDs`;

    const userPrompt = `Generate a workflow for: ${businessInfo.businessName}
Industry: ${businessInfo.industry || 'General'}
Description: ${businessInfo.description}

GENERATE:
${callFlowConfig.generateInbound ? `- INBOUND flow (purpose: ${callFlowConfig.inboundPurpose || 'customer support'})` : ''}
${callFlowConfig.generateOutbound ? `- OUTBOUND flow (purpose: ${callFlowConfig.outboundPurpose || 'sales/follow-up'})` : ''}
${callFlowConfig.transferToHuman ? '- Include call_transfer node for human escalation' : ''}
${callFlowConfig.collectInfo?.length > 0 ? `- Collect: ${callFlowConfig.collectInfo.join(', ')} (use field_setter nodes)` : ''}

LAYOUT REQUIREMENTS:
- Agent Setup at x=400, y=50 (center top)
- Inbound CallDirection at x=200, y=200 (left side)
- Outbound CallDirection at x=700, y=200 (right side)
- Connect agent-setup to BOTH call-direction nodes
- Nodes flow TOP to BOTTOM with 150px vertical spacing
- Inbound flow nodes: x=100-350
- Outbound flow nodes: x=600-850

REMEMBER:
- Use "script" field for scripted nodes (NOT "content")
- Return ONLY raw JSON, no markdown
- All nodes need proper data structure
- Professional messages for ${businessInfo.industry} industry`;

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

        // Validate node data structure
        if (node.type === 'standard' && node.data && !node.data.type) {
          errors.push(`Node ${node.id}: Standard node missing data.type`);
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
  generateWorkflow
};
