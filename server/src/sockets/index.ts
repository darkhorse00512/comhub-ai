import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import logger from '../utils/logger';
import config from '../config';
import callService from '../services/call.service';
import ariClientInstance from '../ari/client';
import bulkCallingService from '../services/bulk-calling.service';
import getSupabaseClient from '../config/supabase';
import streamingWorkflow from '../services/workflow-streaming.service';

export interface SocketUser {
  userId: string;
  socketId: string;
}

class SocketService {
  private io: Server | null = null;
  private userSockets: Map<string, Set<string>> = new Map();

  initialize(server: HTTPServer): Server {
    this.io = new Server(server, {
      cors: {
        origin: config.security.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    this.setupARIEventBridge();

    logger.info('Socket.IO server initialized');

    return this.io;
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      logger.info('Client connected', { socketId: socket.id });

      socket.on('authenticate', (data: { userId: string }) => {
        this.handleAuthentication(socket, data.userId);
      });

      socket.on('call:start', async (data: { phoneNumber: string; userId: string }) => {
        await this.handleCallStart(socket, data);
      });

      socket.on('call:end', async (data: { callSessionId: string }) => {
        await this.handleCallEnd(socket, data);
      });

      socket.on('call:audio', async (data: { callSessionId: string; audioData: any }) => {
        await this.handleCallAudio(socket, data);
      });

      socket.on('call:message', async (data: { callSessionId: string; message: string }) => {
        await this.handleCallMessage(socket, data);
      });

      // Bulk call events
      socket.on('bulk-call:subscribe', (data: { jobId: string }) => {
        socket.join(`bulk-job:${data.jobId}`);
        logger.info('Client subscribed to bulk job', { socketId: socket.id, jobId: data.jobId });
      });

      socket.on('bulk-call:unsubscribe', (data: { jobId: string }) => {
        socket.leave(`bulk-job:${data.jobId}`);
        logger.info('Client unsubscribed from bulk job', { socketId: socket.id, jobId: data.jobId });
      });

      socket.on('bulk-call:get-status', async (data: { jobId: string }) => {
        const job = bulkCallingService.getBulkCallJob(data.jobId);
        if (job) {
          socket.emit('bulk-call:status', { job });
        }
      });

      // --- Streaming workflow events ---
      socket.on('workflow:start', async (data: { agentId: string; direction: 'inbound' | 'outbound' }) => {
        const userId = socket.data.userId;
        if (!userId) {
          socket.emit('workflow:error', { error: 'Not authenticated' });
          return;
        }
        try {
          const supabase = getSupabaseClient();
          const { data: agent, error: agentErr } = await supabase
            .from('agents')
            .select('*')
            .eq('id', data.agentId)
            .single();
          if (agentErr || !agent?.config?.flow?.nodes?.length) {
            socket.emit('workflow:error', { error: 'Agent not found or no workflow' });
            return;
          }
          const nodes = agent.config.flow.nodes;
          const edges = agent.config.flow.edges || [];
          const aiModel = agent.config?.settings?.aiModel || '';
          const sessionId = await streamingWorkflow.startStreamingSession(
            socket, data.agentId, userId, nodes, edges, data.direction, aiModel,
          );
          if (sessionId) {
            socket.data.workflowSessionId = sessionId;
          }
        } catch (err) {
          logger.error('workflow:start error', { error: err });
          socket.emit('workflow:error', { error: 'Failed to start workflow' });
        }
      });

      socket.on('workflow:message', async (data: { sessionId: string; message: string }) => {
        if (!data.sessionId || !data.message) {
          socket.emit('workflow:error', { error: 'sessionId and message required' });
          return;
        }
        await streamingWorkflow.handleStreamingMessage(socket, data.sessionId, data.message);
      });

      socket.on('workflow:end', (data: { sessionId: string }) => {
        if (data.sessionId) {
          const fields = streamingWorkflow.endStreamingSession(data.sessionId);
          socket.emit('workflow:ended', { collectedFields: fields });
        }
      });

      socket.on('disconnect', () => {
        // Clean up any streaming session
        if (socket.data.workflowSessionId) {
          streamingWorkflow.endStreamingSession(socket.data.workflowSessionId);
        }
        this.handleDisconnect(socket);
      });

      socket.on('error', (error) => {
        logger.error('Socket error:', { socketId: socket.id, error });
      });
    });
  }

  private handleAuthentication(socket: Socket, userId: string): void {
    socket.data.userId = userId;

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)?.add(socket.id);

    socket.join(`user:${userId}`);

    logger.info('Client authenticated', { socketId: socket.id, userId });

    socket.emit('authenticated', { success: true, userId });
  }

  private async handleCallStart(
    socket: Socket,
    data: { phoneNumber: string; userId: string }
  ): Promise<void> {
    try {
      const { phoneNumber, userId } = data;

      logger.info('Starting call', { userId, phoneNumber });

      const callSession = await callService.initiateOutboundCall(userId, phoneNumber);

      socket.emit('call:started', {
        callSessionId: callSession.id,
        status: callSession.status,
      });

      this.emitToUser(userId, 'call:status', {
        callSessionId: callSession.id,
        status: 'active',
      });
    } catch (error) {
      logger.error('Failed to start call:', error);
      socket.emit('call:error', {
        error: 'Failed to start call',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleCallEnd(
    socket: Socket,
    data: { callSessionId: string }
  ): Promise<void> {
    try {
      const { callSessionId } = data;

      logger.info('Ending call', { callSessionId });

      await callService.endCall(callSessionId);

      socket.emit('call:ended', { callSessionId });

      const callSession = callService.getActiveCall(callSessionId);
      if (callSession) {
        this.emitToUser(callSession.userId, 'call:status', {
          callSessionId,
          status: 'ended',
        });
      }
    } catch (error) {
      logger.error('Failed to end call:', error);
      socket.emit('call:error', {
        error: 'Failed to end call',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleCallAudio(
    socket: Socket,
    data: { callSessionId: string; audioData: any }
  ): Promise<void> {
    try {
      const { callSessionId, audioData } = data;

      logger.debug('Processing call audio', { callSessionId });

      const result = await callService.processUserAudio(
        callSessionId,
        Buffer.from(audioData)
      );

      socket.emit('call:transcription', {
        callSessionId,
        text: result.transcription,
      });

      socket.emit('call:ai-response', {
        callSessionId,
        text: result.aiResponse,
        audioUrl: result.audioFilePath,
      });

      const callSession = callService.getActiveCall(callSessionId);
      if (callSession) {
        this.emitToUser(callSession.userId, 'call:message', {
          callSessionId,
          role: 'user',
          content: result.transcription,
        });

        this.emitToUser(callSession.userId, 'call:message', {
          callSessionId,
          role: 'ai',
          content: result.aiResponse,
        });
      }
    } catch (error) {
      logger.error('Failed to process call audio:', error);
      socket.emit('call:error', {
        error: 'Failed to process audio',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleCallMessage(
    socket: Socket,
    data: { callSessionId: string; message: string }
  ): Promise<void> {
    try {
      const { callSessionId, message } = data;

      logger.info('Processing call message', { callSessionId, message });

      await callService.addCallMessage(callSessionId, 'user', message);

      const aiResponse = await callService.processUserAudio(callSessionId, Buffer.from(message));

      socket.emit('call:ai-response', {
        callSessionId,
        text: aiResponse.aiResponse,
        audioUrl: aiResponse.audioFilePath,
      });

      const callSession = callService.getActiveCall(callSessionId);
      if (callSession) {
        this.emitToUser(callSession.userId, 'call:message', {
          callSessionId,
          role: 'ai',
          content: aiResponse.aiResponse,
        });
      }
    } catch (error) {
      logger.error('Failed to process call message:', error);
      socket.emit('call:error', {
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private handleDisconnect(socket: Socket): void {
    const userId = socket.data.userId;

    if (userId) {
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }

    logger.info('Client disconnected', { socketId: socket.id, userId });
  }

  private setupARIEventBridge(): void {
    ariClientInstance.on('stasisStart', (_event, channel) => {
      logger.info('ARI: Stasis start event', { channelId: channel.id });
      this.io?.emit('ari:stasis-start', {
        channelId: channel.id,
        callerNumber: channel.caller.number,
      });
    });

    ariClientInstance.on('channelStateChange', (_event, channel) => {
      logger.debug('ARI: Channel state changed', {
        channelId: channel.id,
        state: channel.state,
      });
      this.io?.emit('ari:channel-state', {
        channelId: channel.id,
        state: channel.state,
      });
    });

    ariClientInstance.on('channelDestroyed', (event, channel) => {
      logger.info('ARI: Channel destroyed', { channelId: channel.id });
      this.io?.emit('ari:channel-destroyed', {
        channelId: channel.id,
        cause: event.cause,
      });
    });
  }

  emitToUser(userId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
      logger.debug('Event emitted to user', { userId, event });
    }
  }

  emitToAll(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
      logger.debug('Event emitted to all clients', { event });
    }
  }

  emitToBulkJob(jobId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`bulk-job:${jobId}`).emit(event, data);
      logger.debug('Event emitted to bulk job', { jobId, event });
    }
  }

  getIO(): Server | null {
    return this.io;
  }
}

export const socketService = new SocketService();
export default socketService;
