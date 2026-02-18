import { Request, Response } from 'express';
import callService from '../services/call.service';
import recordingService from '../services/recording.service';
import voiceConversationService from '../services/voice-conversation.service';
import logger from '../utils/logger';
import socketService from '../sockets';

export class CallController {
  async initiateCall(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { phoneNumber } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!phoneNumber) {
        res.status(400).json({ error: 'Phone number is required' });
        return;
      }

      const callSession = await callService.initiateOutboundCall(userId, phoneNumber);

      socketService.emitToUser(userId, 'call:initiated', {
        callSessionId: callSession.id,
        status: callSession.status,
      });

      res.status(200).json({
        success: true,
        callSession: {
          id: callSession.id,
          status: callSession.status,
          direction: callSession.direction,
          calleeNumber: callSession.calleeNumber,
          startedAt: callSession.startedAt,
        },
      });
    } catch (error) {
      logger.error('Failed to initiate call:', error);
      res.status(500).json({
        error: 'Failed to initiate call',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async endCall(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { callSessionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const callSession = callService.getActiveCall(callSessionId);
      if (!callSession) {
        res.status(404).json({ error: 'Call session not found' });
        return;
      }

      if (callSession.userId !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const recordingUrl = await callService.endCall(callSessionId);

      socketService.emitToUser(userId, 'call:ended', { callSessionId, recordingUrl });

      res.status(200).json({
        success: true,
        message: 'Call ended successfully',
        recordingUrl,
      });
    } catch (error) {
      logger.error('Failed to end call:', error);
      res.status(500).json({
        error: 'Failed to end call',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getCallHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const callSessions = await callService.getUserCallSessions(userId);
      
      // Get recording URLs for all call sessions
      const callIds = callSessions.map(s => s.id);
      const recordings = await recordingService.getRecordingsForCalls(callIds);

      res.status(200).json({
        success: true,
        callSessions: callSessions.map((session) => ({
          id: session.id,
          status: session.status,
          direction: session.direction,
          callerNumber: session.callerNumber,
          calleeNumber: session.calleeNumber,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          recordingUrl: recordings.get(session.id) || null,
        })),
      });
    } catch (error) {
      logger.error('Failed to get call history:', error);
      res.status(500).json({
        error: 'Failed to get call history',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getCallMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { callSessionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const messages = await callService.getCallMessages(callSessionId);

      res.status(200).json({
        success: true,
        messages: messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          audioUrl: msg.audioUrl,
        })),
      });
    } catch (error) {
      logger.error('Failed to get call messages:', error);
      res.status(500).json({
        error: 'Failed to get call messages',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { callSessionId } = req.params;
      const { message } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const callSession = callService.getActiveCall(callSessionId);
      if (!callSession) {
        res.status(404).json({ error: 'Call session not found' });
        return;
      }

      if (callSession.userId !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      await callService.addCallMessage(callSessionId, 'user', message);

      const result = await callService.processUserAudio(
        callSessionId,
        Buffer.from(message)
      );

      socketService.emitToUser(userId, 'call:ai-response', {
        callSessionId,
        text: result.aiResponse,
        audioUrl: result.audioFilePath,
      });

      res.status(200).json({
        success: true,
        aiResponse: result.aiResponse,
        audioUrl: result.audioFilePath,
      });
    } catch (error) {
      logger.error('Failed to send message:', error);
      res.status(500).json({
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getActiveCall(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { callSessionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // First try to get from active calls (in memory)
      let callSession = callService.getActiveCall(callSessionId);

      // If not in memory, try to get from database
      if (!callSession) {
        const sessions = await callService.getUserCallSessions(userId);
        const dbSession = sessions.find(s => s.id === callSessionId);
        if (dbSession) {
          callSession = dbSession;
        }
      }

      if (!callSession) {
        res.status(404).json({ error: 'Call session not found' });
        return;
      }

      if (callSession.userId !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      // Get recording URL if exists
      const recordingUrl = await recordingService.getRecordingUrlFromDb(callSessionId);

      res.status(200).json({
        success: true,
        callSession: {
          id: callSession.id,
          status: callSession.status,
          direction: callSession.direction,
          callerNumber: callSession.callerNumber,
          calleeNumber: callSession.calleeNumber,
          startedAt: callSession.startedAt,
          endedAt: callSession.endedAt,
          channelId: callSession.channelId,
          recordingUrl,
        },
      });
    } catch (error) {
      logger.error('Failed to get call:', error);
      res.status(500).json({
        error: 'Failed to get call',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Test inbound call - simulates an inbound call for testing AI greeting
  async testInboundCall(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { phoneNumber } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      logger.info('Testing inbound call', { userId, phoneNumber });

      // Create a test call session and generate greeting
      // If phoneNumber is provided, make an actual Twilio call
      const result = await voiceConversationService.testInboundCall(userId, phoneNumber);

      res.status(200).json({
        success: true,
        callSessionId: result.callSessionId,
        callSid: result.callSid,
        message: result.message,
      });
    } catch (error) {
      logger.error('Failed to test inbound call:', error);
      res.status(500).json({
        error: 'Failed to test inbound call',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Create a test call session (for UI test modal)
  async createTestCallSession(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { agentId, direction } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!direction || !['inbound', 'outbound'].includes(direction)) {
        res.status(400).json({ error: 'Valid direction (inbound/outbound) is required' });
        return;
      }

      logger.info('Creating test call session', { userId, agentId, direction });

      // Create a call session marked as a test call
      const callSession = await callService.createCallSession(
        userId,
        direction,
        direction === 'inbound' ? 'test-caller' : undefined,
        direction === 'outbound' ? 'test-callee' : undefined,
        agentId || undefined
      );

      // Update status to active immediately for test calls
      await callService.updateCallStatus(callSession.id, 'active', `test-session-${callSession.id}`);

      res.status(200).json({
        success: true,
        callSessionId: callSession.id,
      });
    } catch (error) {
      logger.error('Failed to create test call session:', error);
      res.status(500).json({
        error: 'Failed to create test call session',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Add a message to a test call session
  async addTestCallMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { callSessionId } = req.params;
      const { role, content } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!role || !['user', 'ai'].includes(role)) {
        res.status(400).json({ error: 'Valid role (user/ai) is required' });
        return;
      }

      if (!content) {
        res.status(400).json({ error: 'Content is required' });
        return;
      }

      logger.info('Adding test call message', { callSessionId, role, contentLength: content.length });

      await callService.addCallMessage(callSessionId, role, content);

      res.status(200).json({
        success: true,
        message: 'Message added successfully',
      });
    } catch (error) {
      logger.error('Failed to add test call message:', error);
      res.status(500).json({
        error: 'Failed to add test call message',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // End a test call session
  async endTestCallSession(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { callSessionId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      logger.info('Ending test call session', { callSessionId });

      await callService.updateCallStatus(callSessionId, 'ended');

      res.status(200).json({
        success: true,
        message: 'Test call session ended',
      });
    } catch (error) {
      logger.error('Failed to end test call session:', error);
      res.status(500).json({
        error: 'Failed to end test call session',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Get call history for a specific agent
  async getAgentCallHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { agentId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!agentId) {
        res.status(400).json({ error: 'Agent ID is required' });
        return;
      }

      const callSessions = await callService.getAgentCallSessions(userId, agentId);

      // Get message count for each session
      const sessionsWithCounts = await Promise.all(
        callSessions.map(async (session) => {
          const messages = await callService.getCallMessages(session.id);
          return {
            id: session.id,
            status: session.status,
            direction: session.direction,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            messageCount: messages.length,
          };
        })
      );

      res.status(200).json({
        success: true,
        callSessions: sessionsWithCounts,
      });
    } catch (error) {
      logger.error('Failed to get agent call history:', error);
      res.status(500).json({
        error: 'Failed to get agent call history',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const callController = new CallController();
export default callController;
