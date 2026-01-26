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
    const systemPrompt = `You are an expert AI assistant that generates phone call workflow configurations. You MUST respond ONLY with valid JSON - no markdown code blocks, no explanations, just raw JSON.

## WORKFLOW STRUCTURE

A workflow has two arrays:
- **nodes**: Array of node objects
- **edges**: Array of edge objects connecting nodes

## NODE STRUCTURE

Every node must have:
- **id**: Unique string (e.g., "agent-setup", "inbound-greeting-1")
- **type**: "agentSetup" | "callDirection" | "standard"
- **position**: {x: number, y: number}
- **data**: Object with type-specific fields (see below)

## NODE TYPES AND EXACT DATA STRUCTURES

### 1. Agent Setup Node (REQUIRED - EXACTLY ONE)
{
  "id": "agent-setup",
  "type": "agentSetup",
  "position": {"x": 100, "y": 100},
  "data": {
    "label": "Agent Setup",
    "systemMessage": "You are a professional AI assistant for [Business Name]. Your role is to [specific instructions]..."
  }
}

### 2. Call Direction Node (REQUIRED - ONE OR TWO)
{
  "id": "call-direction-inbound",
  "type": "callDirection",
  "position": {"x": 100, "y": 300},
  "data": {
    "label": "Inbound Calls",
    "direction": "inbound"
  }
}

### 3. Scripted Node (for fixed messages)
{
  "id": "greeting-1",
  "type": "standard",
  "position": {"x": 100, "y": 500},
  "data": {
    "type": "scripted",
    "label": "Welcome Greeting",
    "content": "Thank you for calling [Business]. This is [Agent Name]. How may I help you today?"
  }
}

### 4. Field Setter Node (for data collection)
{
  "id": "collect-name",
  "type": "standard",
  "position": {"x": 100, "y": 700},
  "data": {
    "type": "field_setter",
    "label": "Collect Customer Name",
    "fieldName": "customer_name",
    "valueType": "text",
    "value": ""
  }
}

### 5. Dialogue Node (for AI conversation)
{
  "id": "main-conversation",
  "type": "standard",
  "position": {"x": 100, "y": 900},
  "data": {
    "type": "dialogue",
    "label": "Main Conversation",
    "stageMessage": "Listen to the customer's request and provide helpful assistance. Ask clarifying questions if needed.",
    "maxTurns": 10
  }
}

### 6. Junction Node (for True/False branching)
{
  "id": "check-resolved",
  "type": "standard",
  "position": {"x": 100, "y": 1100},
  "data": {
    "type": "junction",
    "label": "Issue Resolved?",
    "left": {"field_name": "issue_resolved"},
    "operator": "==",
    "right": {"type": "text", "literal": "true"}
  }
}

### 7. Switch Node (for multi-way branching)
{
  "id": "department-router",
  "type": "standard",
  "position": {"x": 100, "y": 1300},
  "data": {
    "type": "switch",
    "label": "Route by Department",
    "switchField": "department_choice",
    "cases": [
      {"value": "1", "label": "Sales"},
      {"value": "2", "label": "Support"},
      {"value": "3", "label": "Billing"}
    ]
  }
}

### 8. Call Transfer Node
{
  "id": "transfer-human",
  "type": "standard",
  "position": {"x": 100, "y": 1500},
  "data": {
    "type": "call_transfer",
    "label": "Transfer to Human Agent",
    "transferTo": "+15555551234",
    "transferMessage": "Let me connect you with a specialist who can help you better.",
    "transferType": "warm"
  }
}

### 9. Voicemail Node
{
  "id": "after-hours-vm",
  "type": "standard",
  "position": {"x": 100, "y": 1700},
  "data": {
    "type": "voicemail",
    "label": "After Hours Voicemail",
    "greetingMessage": "Thank you for calling. Our office is currently closed. Please leave a message.",
    "maxDuration": 120,
    "beepSound": true,
    "transcribe": true,
    "saveRecording": true
  }
}

### 10. Function Node
{
  "id": "lookup-customer",
  "type": "standard",
  "position": {"x": 100, "y": 1900},
  "data": {
    "type": "function",
    "label": "Look Up Customer",
    "functionName": "customer_lookup",
    "functionType": "api_call",
    "url": "https://api.example.com/customers",
    "method": "GET"
  }
}

### 11. Fallback Node
{
  "id": "fallback-1",
  "type": "standard",
  "position": {"x": 100, "y": 2100},
  "data": {
    "type": "fallback",
    "label": "Error Handler",
    "fallbackMessage": "I'm sorry, I didn't understand that. Could you please repeat?",
    "retryCount": 3,
    "escalateTo": "+15555551234"
  }
}

## EDGE STRUCTURE

{
  "id": "edge-1",
  "source": "agent-setup",
  "target": "call-direction-inbound",
  "animated": true
}

For junction nodes, use sourceHandle:
{
  "id": "edge-junction-true",
  "source": "check-resolved",
  "target": "thank-you-node",
  "sourceHandle": "true",
  "animated": true
}

## POSITIONING RULES (CRITICAL!)

1. **Agent Setup**: Always at (100, 100)
2. **Inbound Flow**: Start call direction at (100, 300), then stack vertically at x=100-400 with 200px vertical spacing
3. **Outbound Flow**: Start call direction at (800, 300), then stack vertically at x=800-1100 with 200px vertical spacing
4. **Keep flows SEPARATE**: Inbound on left (x < 500), Outbound on right (x >= 800)
5. **Minimum spacing**: 200px vertically between nodes, 500px horizontally between lanes

## COMPLETE EXAMPLE: INBOUND CUSTOMER SERVICE

{
  "nodes": [
    {
      "id": "agent-setup",
      "type": "agentSetup",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Agent Setup",
        "systemMessage": "You are a professional customer service AI for Acme Corporation. Be polite, empathetic, and solution-oriented. Listen carefully to customer needs and provide helpful assistance."
      }
    },
    {
      "id": "inbound-direction",
      "type": "callDirection",
      "position": {"x": 100, "y": 300},
      "data": {
        "label": "Inbound Calls",
        "direction": "inbound"
      }
    },
    {
      "id": "greeting",
      "type": "standard",
      "position": {"x": 100, "y": 500},
      "data": {
        "type": "scripted",
        "label": "Welcome Greeting",
        "content": "Thank you for calling Acme Corporation. My name is Sarah, your AI assistant. How may I help you today?"
      }
    },
    {
      "id": "collect-name",
      "type": "standard",
      "position": {"x": 100, "y": 700},
      "data": {
        "type": "field_setter",
        "label": "Collect Name",
        "fieldName": "customer_name",
        "valueType": "text",
        "value": ""
      }
    },
    {
      "id": "main-dialogue",
      "type": "standard",
      "position": {"x": 100, "y": 900},
      "data": {
        "type": "dialogue",
        "label": "Main Conversation",
        "stageMessage": "Listen to the customer's inquiry. Ask clarifying questions to understand their needs. Provide helpful information or solutions.",
        "maxTurns": 10
      }
    },
    {
      "id": "check-resolved",
      "type": "standard",
      "position": {"x": 100, "y": 1100},
      "data": {
        "type": "junction",
        "label": "Issue Resolved?",
        "left": {"field_name": "issue_resolved"},
        "operator": "==",
        "right": {"type": "text", "literal": "true"}
      }
    },
    {
      "id": "thank-you",
      "type": "standard",
      "position": {"x": 300, "y": 1300},
      "data": {
        "type": "scripted",
        "label": "Thank You",
        "content": "I'm glad I could help you today! Is there anything else you need assistance with?"
      }
    },
    {
      "id": "transfer",
      "type": "standard",
      "position": {"x": -100, "y": 1300},
      "data": {
        "type": "call_transfer",
        "label": "Transfer to Agent",
        "transferTo": "+15555551234",
        "transferMessage": "Let me connect you with a specialist who can provide more detailed assistance.",
        "transferType": "warm"
      }
    }
  ],
  "edges": [
    {"id": "e1", "source": "agent-setup", "target": "inbound-direction", "animated": true},
    {"id": "e2", "source": "inbound-direction", "target": "greeting", "animated": true},
    {"id": "e3", "source": "greeting", "target": "collect-name", "animated": true},
    {"id": "e4", "source": "collect-name", "target": "main-dialogue", "animated": true},
    {"id": "e5", "source": "main-dialogue", "target": "check-resolved", "animated": true},
    {"id": "e6", "source": "check-resolved", "target": "thank-you", "sourceHandle": "true", "animated": true},
    {"id": "e7", "source": "check-resolved", "target": "transfer", "sourceHandle": "false", "animated": true}
  ]
}

## CRITICAL REQUIREMENTS

1. **Return ONLY valid JSON** - No markdown, no code blocks, no explanations
2. **Always include agent-setup node** at (100, 100)
3. **Always include call-direction nodes** for requested flow types
4. **Use exact data structures** shown above
5. **Position nodes properly** - Inbound left (x=100-400), Outbound right (x=800-1100), 200px vertical spacing
6. **Create realistic dialogue** - Professional, business-appropriate language
7. **Connect all nodes** - No orphaned nodes, clear paths from start to end
8. **Handle requested features** - If transfer to human requested, include call_transfer nodes. If field collection requested, include field_setter nodes.

Generate the workflow now.`;

    const userPrompt = `Generate a complete phone call workflow for:

BUSINESS DETAILS:
- Name: ${businessInfo.businessName}
- Industry: ${businessInfo.industry || 'General'}
- Description: ${businessInfo.description}
- Target Audience: ${businessInfo.targetAudience || 'General public'}
- Services: ${businessInfo.mainServices || 'Various services'}

WORKFLOW REQUIREMENTS:

${callFlowConfig.generateInbound ? `
=== INBOUND CALL FLOW ===
Purpose: ${callFlowConfig.inboundPurpose || 'General customer support'}

Required structure:
1. Agent Setup node (system prompt specific to ${businessInfo.businessName})
2. Call Direction node with direction="inbound" at position (100, 300)
3. Greeting (scripted node with warm, professional welcome)
4. ${callFlowConfig.collectInfo?.length > 0 ? `Information collection (field_setter nodes for: ${callFlowConfig.collectInfo.join(', ')})` : 'Information gathering'}
5. Main conversation (dialogue node with clear instructions for the AI)
6. Issue resolution check (junction node)
7. ${callFlowConfig.transferToHuman ? 'Transfer to human option (call_transfer node)' : 'Closing message'}
${callFlowConfig.businessHours ? `8. After-hours voicemail (voicemail node for outside ${callFlowConfig.businessHours})` : ''}

Position all inbound nodes in vertical column starting at x=100
` : ''}

${callFlowConfig.generateOutbound ? `
=== OUTBOUND CALL FLOW ===
Purpose: ${callFlowConfig.outboundPurpose || 'Sales and follow-up'}

Required structure:
1. Call Direction node with direction="outbound" at position (800, 300) - SEPARATE from inbound
2. Introduction (scripted node asking permission to continue)
3. Interest check (junction node - prospect_interested)
4. Main pitch/conversation (dialogue node if interested)
5. Polite decline handling (scripted node if not interested)
6. Follow-up scheduling (field_setter for next steps)
7. Closing thank you (scripted node)

Position all outbound nodes in vertical column starting at x=800 (SEPARATE HORIZONTAL LANE)
` : ''}

CRITICAL RULES:
1. Return ONLY valid JSON, no markdown code blocks
2. Use EXACT node data structures from examples in system prompt
3. Space nodes 200px apart vertically
4. Keep inbound (x=100-400) and outbound (x=800-1100) in separate lanes
5. Create realistic, professional messages appropriate for ${businessInfo.industry}
6. Include error handling (fallback nodes)
7. Agent setup system message should reference ${businessInfo.businessName} specifically

Generate the workflow NOW as raw JSON.`;

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

        // Check for unreachable nodes (nodes not connected to the workflow)
        const reachable = new Set<string>();
        const findReachable = (nodeId: string) => {
          if (reachable.has(nodeId)) return;
          reachable.add(nodeId);
          wf.edges.forEach((e: any) => {
            if (e.source === nodeId && e.target) {
              findReachable(e.target);
            }
          });
        };

        // Start from agent-setup node
        const agentSetupNode = wf.nodes.find((n: any) => n.type === 'agentSetup');
        if (agentSetupNode) {
          findReachable(agentSetupNode.id);
        }

        wf.nodes.forEach((node: any) => {
          if (node.type !== 'agentSetup' && !reachable.has(node.id)) {
            errors.push(`Node '${node.id}' is unreachable from the workflow entry point`);
          }
        });
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
