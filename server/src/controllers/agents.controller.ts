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
    const systemPrompt = `You are an AI assistant that generates phone call workflow configurations. You must respond with valid JSON only, no other text.

The workflow consists of nodes and edges. Each node has:
- id: unique string identifier
- type: either "agentSetup", "callDirection", or "standard"
- position: {x: number, y: number} - position on the canvas
- data: object with node-specific data

Node types available for "standard" nodes (set data.type to one of these):
1. "scripted" - Scripted speech node for fixed messages. data fields: { type: "scripted", label: string, content: string, voice: "professional"|"friendly"|"neutral", speed: "normal"|"slow"|"fast" }
2. "dialogue" - AI dialogue node for conversational responses. data fields: { type: "dialogue", label: string, prompt: string, maxTurns: number, collectFields: string[] }
3. "field_setter" - Sets/collects user data. data fields: { type: "field_setter", label: string, fieldName: string, fieldType: "text"|"email"|"phone"|"number"|"boolean", required: boolean, validationPrompt: string }
4. "junction" - Joins multiple paths. data fields: { type: "junction", label: string, condition: "all"|"any"|"first" }
5. "switch" - Conditional branching. data fields: { type: "switch", label: string, switchField: string, cases: Array<{value: string, label: string}> }
6. "function" - Execute custom logic. data fields: { type: "function", label: string, functionName: string, parameters: object }
7. "call_transfer" - Transfer call to human. data fields: { type: "call_transfer", label: string, transferTo: string, transferMessage: string, waitMusic: boolean }
8. "time_limit" - Set time constraints. data fields: { type: "time_limit", label: string, maxDuration: number, warningAt: number, timeoutAction: "end"|"transfer"|"repeat" }
9. "reconfigure" - Change agent settings mid-call. data fields: { type: "reconfigure", label: string, newVoice: string, newSpeed: string, newPrompt: string }
10. "fallback" - Handle errors/fallbacks. data fields: { type: "fallback", label: string, fallbackMessage: string, retryCount: number, escalateTo: string }

Edges connect nodes:
- id: unique string identifier
- source: source node id
- target: target node id
- animated: boolean (true for visual animation)

IMPORTANT RULES:
1. Always start with an "agentSetup" node at position {x: 100, y: 100}
2. Create separate flow paths for inbound and outbound if both are requested
3. Use "callDirection" nodes for inbound/outbound entry points
4. Create logical flows with proper connections
5. Space nodes appropriately (at least 200px apart horizontally, 150px vertically)
6. Use meaningful labels and prompts based on the business context
7. Include error handling with fallback nodes
8. If transfer to human is requested, include call_transfer nodes

Respond with a JSON object containing "nodes" array and "edges" array.`;

    const userPrompt = `Generate a complete phone call workflow for the following business:

BUSINESS INFORMATION:
- Business Name: ${businessInfo.businessName}
- Industry: ${businessInfo.industry || 'Not specified'}
- Description: ${businessInfo.description}
- Target Audience: ${businessInfo.targetAudience || 'General'}
- Main Services/Products: ${businessInfo.mainServices || 'Not specified'}

CALL FLOW CONFIGURATION:
- Generate Inbound Flow: ${callFlowConfig.generateInbound ? 'Yes' : 'No'}
- Generate Outbound Flow: ${callFlowConfig.generateOutbound ? 'Yes' : 'No'}
- Inbound Purpose: ${callFlowConfig.inboundPurpose || 'General customer support'}
- Outbound Purpose: ${callFlowConfig.outboundPurpose || 'Sales/follow-up calls'}
- Information to Collect: ${callFlowConfig.collectInfo?.length > 0 ? callFlowConfig.collectInfo.join(', ') : 'None specified'}
- Include Human Transfer Option: ${callFlowConfig.transferToHuman ? 'Yes' : 'No'}
- Business Hours: ${callFlowConfig.businessHours || 'Not specified'}

Generate a professional, complete workflow that handles all common scenarios for this business. Include proper greetings, information collection, conversation handling, and professional closings.`;

    // Generate workflow using GPT
    const aiResponse = await gptService.generateResponse(userPrompt, [
      { role: 'system', content: systemPrompt }
    ]);

    // Parse the AI response to extract JSON
    let workflow;
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        workflow = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      logger.error('Error parsing AI workflow response', { error: parseError, response: aiResponse.text });
      res.status(500).json({ success: false, error: 'Failed to parse generated workflow' });
      return;
    }

    // Validate the workflow structure
    if (!workflow.nodes || !Array.isArray(workflow.nodes) || !workflow.edges || !Array.isArray(workflow.edges)) {
      res.status(500).json({ success: false, error: 'Invalid workflow structure generated' });
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
