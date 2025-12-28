import getSupabaseClient from '../config/supabase';
import ariClientInstance from '../ari/client';
import aiPipelineService from './ai/pipeline.service';
import recordingService from './recording.service';
import logger from '../utils/logger';
import { ChatMessage } from './ai/gpt.service';

export interface CallSession {
  id: string;
  userId: string;
  status: 'ringing' | 'active' | 'ended' | 'failed';
  startedAt: string;
  endedAt: string | null;
  channelId: string | null;
  direction: 'inbound' | 'outbound';
  callerNumber: string | null;
  calleeNumber: string | null;
}

export interface CallMessage {
  id: string;
  callSessionId: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  audioUrl: string | null;
}

class CallService {
  private activeCalls: Map<string, CallSession> = new Map();
  private conversationHistories: Map<string, ChatMessage[]> = new Map();
  private supabase = getSupabaseClient();

  async createCallSession(
    userId: string,
    direction: 'inbound' | 'outbound',
    callerNumber?: string,
    calleeNumber?: string
  ): Promise<CallSession> {
    try {
      const { data, error } = await this.supabase
        .from('call_sessions')
        .insert({
          user_id: userId,
          status: 'ringing',
          direction,
          caller_number: callerNumber || null,
          callee_number: calleeNumber || null,
        })
        .select()
        .single();

      if (error) throw error;

      const callSession: CallSession = {
        id: data.id,
        userId: data.user_id,
        status: data.status as any,
        startedAt: data.started_at,
        endedAt: data.ended_at,
        channelId: data.channel_id,
        direction: data.direction as any,
        callerNumber: data.caller_number,
        calleeNumber: data.callee_number,
      };

      this.activeCalls.set(callSession.id, callSession);
      this.conversationHistories.set(callSession.id, []);

      logger.info('Call session created', { callSessionId: callSession.id });

      return callSession;
    } catch (error) {
      logger.error('Failed to create call session:', error);
      throw error;
    }
  }

  async updateCallStatus(
    callSessionId: string,
    status: 'ringing' | 'active' | 'ended' | 'failed',
    channelId?: string
  ): Promise<void> {
    try {
      const updateData: any = { status };

      if (channelId) {
        updateData.channel_id = channelId;
      }

      if (status === 'ended' || status === 'failed') {
        updateData.ended_at = new Date().toISOString();
      }

      const { error } = await this.supabase
        .from('call_sessions')
        .update(updateData)
        .eq('id', callSessionId);

      if (error) throw error;

      const callSession = this.activeCalls.get(callSessionId);
      if (callSession) {
        callSession.status = status;
        if (channelId) callSession.channelId = channelId;
        if (status === 'ended' || status === 'failed') {
          callSession.endedAt = new Date().toISOString();
        }
      }

      logger.info('Call status updated', { callSessionId, status });

      if (status === 'ended' || status === 'failed') {
        this.cleanupCall(callSessionId);
      }
    } catch (error) {
      logger.error('Failed to update call status:', error);
      throw error;
    }
  }

  async addCallMessage(
    callSessionId: string,
    role: 'user' | 'ai',
    content: string,
    audioUrl?: string
  ): Promise<CallMessage> {
    try {
      const { data, error } = await this.supabase
        .from('call_messages')
        .insert({
          call_session_id: callSessionId,
          role,
          content,
          audio_url: audioUrl || null,
        })
        .select()
        .single();

      if (error) throw error;

      const message: CallMessage = {
        id: data.id,
        callSessionId: data.call_session_id,
        role: data.role as any,
        content: data.content,
        timestamp: data.timestamp,
        audioUrl: data.audio_url,
      };

      const history = this.conversationHistories.get(callSessionId) || [];
      history.push({
        role: role === 'user' ? 'user' : 'assistant',
        content,
      });
      this.conversationHistories.set(callSessionId, history);

      logger.info('Call message added', {
        callSessionId,
        role,
        messageLength: content.length,
      });

      return message;
    } catch (error) {
      logger.error('Failed to add call message:', error);
      throw error;
    }
  }

  async getCallMessages(callSessionId: string): Promise<CallMessage[]> {
    try {
      const { data, error } = await this.supabase
        .from('call_messages')
        .select('*')
        .eq('call_session_id', callSessionId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      return data.map((msg) => ({
        id: msg.id,
        callSessionId: msg.call_session_id,
        role: msg.role as any,
        content: msg.content,
        timestamp: msg.timestamp,
        audioUrl: msg.audio_url,
      }));
    } catch (error) {
      logger.error('Failed to get call messages:', error);
      throw error;
    }
  }

  async processUserAudio(
    callSessionId: string,
    audioInput: string | Buffer
  ): Promise<{ transcription: string; aiResponse: string; audioFilePath: string }> {
    try {
      const history = this.conversationHistories.get(callSessionId) || [];

      const result = await aiPipelineService.processAudioToAudioResponse(
        audioInput,
        callSessionId,
        { conversationHistory: history }
      );

      if (result.transcribedText) {
        await this.addCallMessage(callSessionId, 'user', result.transcribedText);
      }

      if (result.aiResponse) {
        await this.addCallMessage(
          callSessionId,
          'ai',
          result.aiResponse,
          result.audioFilePath
        );
      }

      return {
        transcription: result.transcribedText,
        aiResponse: result.aiResponse,
        audioFilePath: result.audioFilePath || '',
      };
    } catch (error) {
      logger.error('Failed to process user audio:', error);
      throw error;
    }
  }

  async initiateOutboundCall(
    userId: string,
    phoneNumber: string
  ): Promise<CallSession> {
    try {
      const callSession = await this.createCallSession(
        userId,
        'outbound',
        undefined,
        phoneNumber
      );

      // Check if ARI is connected for real telephony
      if (ariClientInstance.isClientConnected()) {
        const endpoint = `PJSIP/${phoneNumber}`;
        const channel = await ariClientInstance.originateCall(endpoint);

        await this.updateCallStatus(callSession.id, 'active', channel.id);

        logger.info('Outbound call initiated via ARI', {
          callSessionId: callSession.id,
          phoneNumber,
          channelId: channel.id,
        });
      } else {
        // AI-only mode: Create session without ARI
        await this.updateCallStatus(callSession.id, 'active', `ai-session-${callSession.id}`);

        logger.info('AI-only call session initiated (no ARI)', {
          callSessionId: callSession.id,
          phoneNumber,
        });
      }

      return callSession;
    } catch (error) {
      logger.error('Failed to initiate outbound call:', error);
      throw error;
    }
  }

  async handleIncomingCall(
    userId: string,
    channelId: string,
    callerNumber: string
  ): Promise<CallSession> {
    try {
      const callSession = await this.createCallSession(
        userId,
        'inbound',
        callerNumber
      );

      await ariClientInstance.answerChannel(channelId);
      await this.updateCallStatus(callSession.id, 'active', channelId);

      logger.info('Incoming call handled', {
        callSessionId: callSession.id,
        channelId,
        callerNumber,
      });

      return callSession;
    } catch (error) {
      logger.error('Failed to handle incoming call:', error);
      throw error;
    }
  }

  async endCall(callSessionId: string): Promise<string | null> {
    try {
      const callSession = this.activeCalls.get(callSessionId);
      if (!callSession) {
        // Try to end call from database if not in active calls (e.g. after server restart)
        await this.updateCallStatus(callSessionId, 'ended');
        logger.info('Call ended (from database)', { callSessionId });
        return null;
      }

      // Only try to hangup via ARI if connected and not an AI-only session
      if (callSession.channelId && 
          ariClientInstance.isClientConnected() && 
          !callSession.channelId.startsWith('ai-session-')) {
        await ariClientInstance.hangupChannel(callSession.channelId);
      }

      // Finalize recording - combine all audio segments into final file
      const recordingUrl = await recordingService.finalizeRecording(callSessionId);
      
      await this.updateCallStatus(callSessionId, 'ended');

      logger.info('Call ended', { callSessionId, recordingUrl });
      
      return recordingUrl;
    } catch (error) {
      logger.error('Failed to end call:', error);
      throw error;
    }
  }

  async getUserCallSessions(userId: string): Promise<CallSession[]> {
    try {
      const { data, error } = await this.supabase
        .from('call_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      if (error) throw error;

      return data.map((session) => ({
        id: session.id,
        userId: session.user_id,
        status: session.status as any,
        startedAt: session.started_at,
        endedAt: session.ended_at,
        channelId: session.channel_id,
        direction: session.direction as any,
        callerNumber: session.caller_number,
        calleeNumber: session.callee_number,
      }));
    } catch (error) {
      logger.error('Failed to get user call sessions:', error);
      throw error;
    }
  }

  getActiveCall(callSessionId: string): CallSession | undefined {
    return this.activeCalls.get(callSessionId);
  }

  getConversationHistory(callSessionId: string): ChatMessage[] {
    return this.conversationHistories.get(callSessionId) || [];
  }

  private cleanupCall(callSessionId: string): void {
    this.activeCalls.delete(callSessionId);
    setTimeout(() => {
      this.conversationHistories.delete(callSessionId);
    }, 60000);
  }
}

export const callService = new CallService();
export default callService;
