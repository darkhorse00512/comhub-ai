import { Request, Response } from 'express';
import callService from '../services/call.service';
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

      await callService.endCall(callSessionId);

      socketService.emitToUser(userId, 'call:ended', { callSessionId });

      res.status(200).json({
        success: true,
        message: 'Call ended successfully',
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

      const callSession = callService.getActiveCall(callSessionId);

      if (!callSession) {
        res.status(404).json({ error: 'Call session not found' });
        return;
      }

      if (callSession.userId !== userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

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
        },
      });
    } catch (error) {
      logger.error('Failed to get active call:', error);
      res.status(500).json({
        error: 'Failed to get active call',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const callController = new CallController();
export default callController;
