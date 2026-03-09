import twilio from 'twilio';
import config from '../config';
import logger from '../utils/logger';
import gptService, { ChatMessage } from './ai/gpt.service';
import getSupabaseClient from '../config/supabase';
import { WorkflowEngine, WorkflowStepResult, WorkflowMessage } from './workflow-engine.service';
import agentVoiceService, { ResolvedVoiceSettings } from './agent-voice.service';
import { v4 as uuidv4 } from 'uuid';

const VoiceResponse = twilio.twiml.VoiceResponse;

interface ActiveConversation {
  callSid: string;
  callSessionId: string;
  userId: string;
  history: ChatMessage[];
  direction: 'inbound' | 'outbound';
  callerNumber: string;
  calleeNumber: string;
  startedAt: Date;
  workflowEngine?: WorkflowEngine;
  agentId?: string;
  voiceSettings?: ResolvedVoiceSettings;
}

class VoiceConversationService {
  private activeConversations: Map<string, ActiveConversation> = new Map();
  private supabase = getSupabaseClient();

  private readonly DEFAULT_GREETING = "Hey there! Here is ComHub AI. What can I help you with today?";
  private readonly SPEECH_TIMEOUT = 'auto'; // Twilio auto-detects end of speech
  private readonly MAX_SPEECH_TIME = 30; // seconds

  /**
   * Load an agent's workflow from the database and create a WorkflowEngine.
   */
  private async loadAgentWorkflow(agentId: string, direction: 'inbound' | 'outbound'): Promise<{
    engine: WorkflowEngine;
    initialResult: import('./workflow-engine.service').WorkflowStepResult;
    voiceSettings?: ResolvedVoiceSettings;
  } | null> {
    try {
      const { data: agent, error } = await this.supabase
        .from('agents')
        .select('config')
        .eq('id', agentId)
        .single();

      if (error || !agent?.config?.flow?.nodes?.length) {
        logger.warn('Could not load agent workflow', { agentId, error: error?.message });
        return null;
      }

      const nodes = agent.config.flow.nodes;
      const edges = agent.config.flow.edges || [];
      const engine = new WorkflowEngine(nodes, edges);
      const initialResult = await engine.start(direction);

      const voiceSettings = await agentVoiceService.resolveVoiceSettings(agentId) || undefined;

      return { engine, initialResult, voiceSettings };
    } catch (err) {
      logger.error('Failed to load agent workflow', { agentId, error: err });
      return null;
    }
  }

  /**
   * Combine all scripted/ai messages from a workflow step result into a single speak string.
   */
  private combineMessages(messages: WorkflowMessage[]): string {
    return messages
      .filter(m => m.type === 'scripted' || m.type === 'ai')
      .map(m => m.text)
      .join(' ');
  }

  async startInboundConversation(
    callSid: string,
    callerNumber: string,
    calleeNumber: string,
    agentId?: string
  ): Promise<string> {
    try {
      logger.info('=== STARTING INBOUND CONVERSATION ===', { callSid, callerNumber, calleeNumber });

      let userId: string;
      try {
        userId = await this.getDefaultUserId();
      } catch (userError) {
        logger.error('Failed to get default user ID:', userError);
        throw new Error('Failed to get system user for inbound call');
      }

      const { data: callSession, error } = await this.supabase
        .from('call_sessions')
        .insert({
          user_id: userId,
          status: 'active',
          direction: 'inbound',
          caller_number: callerNumber,
          callee_number: calleeNumber,
          channel_id: callSid,
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create call session:', error);
        throw error;
      }

      const conversation: ActiveConversation = {
        callSid,
        callSessionId: callSession.id,
        userId: callSession.user_id,
        history: [],
        direction: 'inbound',
        callerNumber,
        calleeNumber,
        startedAt: new Date(),
        agentId,
      };

      this.activeConversations.set(callSid, conversation);

      let greetingText = this.DEFAULT_GREETING;

      if (agentId) {
        const workflow = await this.loadAgentWorkflow(agentId, 'inbound');
        if (workflow) {
          conversation.workflowEngine = workflow.engine;
          conversation.voiceSettings = workflow.voiceSettings;
          const spokenText = this.combineMessages(workflow.initialResult.messages);
          if (spokenText) greetingText = spokenText;
          logger.info('Workflow engine loaded for inbound call', {
            callSid, agentId,
            ttsProvider: workflow.voiceSettings?.ttsProvider || 'openai',
          });
        }
      }

      let greetingAudioUrl: string;
      try {
        greetingAudioUrl = await this.generateAndSaveAudio(
          greetingText, callSession.id, 'greeting', conversation.voiceSettings
        );
      } catch (audioError) {
        logger.error('Failed to generate greeting audio:', audioError);
        const response = new VoiceResponse();
        response.say({ voice: 'Polly.Joanna' }, greetingText);
        this.appendGather(response);
        return response.toString();
      }

      await this.saveMessage(callSession.id, 'ai', greetingText, greetingAudioUrl);
      conversation.history.push({ role: 'assistant', content: greetingText });

      const twiml = this.generatePlayAndGatherTwiML(greetingAudioUrl);

      logger.info('Inbound conversation started successfully', {
        callSid, callSessionId: callSession.id,
      });

      return twiml;
    } catch (error) {
      logger.error('Failed to start inbound conversation:', error);
      throw error;
    }
  }

  async startOutboundConversation(
    callSid: string,
    calleeNumber: string,
    userId: string,
    existingSessionId?: string,
    agentId?: string
  ): Promise<string> {
    try {
      logger.info('=== STARTING OUTBOUND CONVERSATION ===', { callSid, calleeNumber, userId });

      let callSession: any;

      if (existingSessionId) {
        const { data: existingSession, error: fetchError } = await this.supabase
          .from('call_sessions')
          .select('*')
          .eq('id', existingSessionId)
          .single();

        if (existingSession && !fetchError) {
          const { data: updatedSession, error: updateError } = await this.supabase
            .from('call_sessions')
            .update({ channel_id: callSid, status: 'active' })
            .eq('id', existingSessionId)
            .select()
            .single();

          if (updatedSession && !updateError) callSession = updatedSession;
        }
      }

      if (!callSession) {
        const { data: newSession, error } = await this.supabase
          .from('call_sessions')
          .insert({
            user_id: userId,
            status: 'active',
            direction: 'outbound',
            caller_number: config.twilio.phoneNumber,
            callee_number: calleeNumber,
            channel_id: callSid,
          })
          .select()
          .single();

        if (error) {
          logger.error('Failed to create call session in database:', error);
          throw error;
        }
        callSession = newSession;
      }

      const conversation: ActiveConversation = {
        callSid,
        callSessionId: callSession.id,
        userId,
        history: [],
        direction: 'outbound',
        callerNumber: config.twilio.phoneNumber,
        calleeNumber,
        startedAt: new Date(),
        agentId,
      };

      this.activeConversations.set(callSid, conversation);

      let greetingText = this.DEFAULT_GREETING;

      if (agentId) {
        const workflow = await this.loadAgentWorkflow(agentId, 'outbound');
        if (workflow) {
          conversation.workflowEngine = workflow.engine;
          conversation.voiceSettings = workflow.voiceSettings;
          const spokenText = this.combineMessages(workflow.initialResult.messages);
          if (spokenText) greetingText = spokenText;
          logger.info('Workflow engine loaded for outbound call', {
            callSid, agentId,
            ttsProvider: workflow.voiceSettings?.ttsProvider || 'openai',
          });
        }
      }

      const greetingAudioUrl = await this.generateAndSaveAudio(
        greetingText, callSession.id, 'greeting', conversation.voiceSettings
      );

      await this.saveMessage(callSession.id, 'ai', greetingText, greetingAudioUrl);
      conversation.history.push({ role: 'assistant', content: greetingText });

      const twiml = this.generatePlayAndGatherTwiML(greetingAudioUrl);

      logger.info('Outbound conversation started successfully', {
        callSid, callSessionId: callSession.id,
      });

      return twiml;
    } catch (error) {
      logger.error('Failed to start outbound conversation:', error);
      throw error;
    }
  }

  /**
   * Process speech result from Twilio <Gather input="speech">.
   * This replaces the old Record → Download → Whisper flow.
   * Twilio does real-time STT and returns text directly — saves 3-5 seconds per turn.
   */
  async processSpeechResult(
    callSid: string,
    speechResult: string,
    confidence: number
  ): Promise<string> {
    try {
      const conversation = this.activeConversations.get(callSid);
      if (!conversation) {
        logger.warn('No active conversation found for callSid:', callSid);
        return this.generateEndCallTwiML("Sorry, we lost track of our conversation. Goodbye!");
      }

      logger.info('Processing speech result', { callSid, text: speechResult, confidence });

      if (!speechResult || speechResult.trim().length === 0) {
        const retryMessage = "I didn't catch that. Could you please repeat?";
        const retryAudioUrl = await this.generateAndSaveAudio(
          retryMessage, conversation.callSessionId, 'retry', conversation.voiceSettings
        );
        await this.saveMessage(conversation.callSessionId, 'ai', retryMessage, retryAudioUrl);
        return this.generatePlayAndGatherTwiML(retryAudioUrl);
      }

      await this.saveMessage(conversation.callSessionId, 'user', speechResult);
      conversation.history.push({ role: 'user', content: speechResult });

      logger.info('User said', { callSid, text: speechResult });

      let responseText: string;

      if (conversation.workflowEngine && conversation.workflowEngine.isWaitingForInput()) {
        const result = await conversation.workflowEngine.processMessage(speechResult);
        responseText = this.combineMessages(result.messages);

        if (!responseText) responseText = 'Thank you for calling. Goodbye!';

        logger.info('Workflow engine processed message', {
          callSid,
          waitingForInput: result.waitingForInput,
          isComplete: result.isComplete,
          currentStage: result.currentStage,
        });

        if (result.isComplete) {
          const aiAudioUrl = await this.generateAndSaveAudio(
            responseText, conversation.callSessionId, 'response', conversation.voiceSettings
          );
          await this.saveMessage(conversation.callSessionId, 'ai', responseText, aiAudioUrl);
          conversation.history.push({ role: 'assistant', content: responseText });

          if (result.transferTo) {
            const response = new VoiceResponse();
            response.play(aiAudioUrl);
            const dial = response.dial();
            dial.number(result.transferTo);
            return response.toString();
          }

          const response = new VoiceResponse();
          response.play(aiAudioUrl);
          response.hangup();
          return response.toString();
        }
      } else {
        const aiResponse = await gptService.generateResponse(speechResult, conversation.history, { voiceMode: true });
        responseText = aiResponse.text;
      }

      const aiAudioUrl = await this.generateAndSaveAudio(
        responseText, conversation.callSessionId, 'response', conversation.voiceSettings
      );

      await this.saveMessage(conversation.callSessionId, 'ai', responseText, aiAudioUrl);
      conversation.history.push({ role: 'assistant', content: responseText });

      logger.info('AI responded', { callSid, text: responseText.substring(0, 100) });

      return this.generatePlayAndGatherTwiML(aiAudioUrl);
    } catch (error) {
      logger.error('Failed to process speech result:', error);

      const errorMessage = "I'm sorry, I encountered an error. Let me try again.";
      const conversation = this.activeConversations.get(callSid);

      if (conversation) {
        try {
          const errorAudioUrl = await this.generateAndSaveAudio(
            errorMessage, conversation.callSessionId, 'error', conversation.voiceSettings
          );
          return this.generatePlayAndGatherTwiML(errorAudioUrl);
        } catch {
          // Fall through to Twilio Say
        }
      }

      const response = new VoiceResponse();
      response.say({ voice: 'Polly.Joanna' }, errorMessage);
      this.appendGather(response);
      return response.toString();
    }
  }

  /**
   * Legacy: Process recording (kept for backward compatibility).
   */
  async processRecording(
    callSid: string,
    recordingUrl: string,
    recordingSid: string
  ): Promise<string> {
    try {
      const conversation = this.activeConversations.get(callSid);
      if (!conversation) {
        return this.generateEndCallTwiML("Sorry, we lost track of our conversation. Goodbye!");
      }

      logger.info('Processing recording (legacy path)', { callSid, recordingSid });
      const transcribedText = await this.downloadAndTranscribe(recordingUrl);
      return this.processSpeechResult(callSid, transcribedText, 1.0);
    } catch (error) {
      logger.error('Failed to process recording:', error);
      return this.generateEndCallTwiML("Sorry, something went wrong. Please try again later.");
    }
  }

  async endConversation(callSid: string): Promise<void> {
    try {
      const conversation = this.activeConversations.get(callSid);
      if (!conversation) return;

      await this.supabase
        .from('call_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('channel_id', callSid);

      this.activeConversations.delete(callSid);

      logger.info('Conversation ended', {
        callSid,
        callSessionId: conversation.callSessionId,
        duration: Math.floor((Date.now() - conversation.startedAt.getTime()) / 1000),
      });
    } catch (error) {
      logger.error('Failed to end conversation:', error);
    }
  }

  getConversation(callSid: string): ActiveConversation | undefined {
    return this.activeConversations.get(callSid);
  }

  // ===== TwiML Generation =====

  /**
   * Append <Gather input="speech"> for real-time speech recognition.
   * Uses Twilio's built-in STT — eliminates Record → Download → Whisper latency.
   *
   * Key settings for natural conversation:
   * - speechModel: "experimental_conversations" — optimized for back-and-forth dialogue
   * - speechTimeout: "auto" — Twilio auto-detects natural pauses
   * - enhanced: true — higher accuracy speech recognition
   */
  private appendGather(response: twilio.twiml.VoiceResponse): void {
    response.gather({
      input: ['speech'],
      action: `${config.server.apiBaseUrl}/api/twilio/handle-speech`,
      method: 'POST',
      speechTimeout: this.SPEECH_TIMEOUT,
      speechModel: 'experimental_conversations',
      enhanced: true,
      language: 'en-US',
    } as any);

    // Fallback if no speech detected
    response.say({ voice: 'Polly.Joanna' }, 'Thank you for calling. Goodbye!');
    response.hangup();
  }

  private generatePlayAndGatherTwiML(audioUrl: string): string {
    const response = new VoiceResponse();
    response.play(audioUrl);
    this.appendGather(response);
    return response.toString();
  }

  private generateEndCallTwiML(message: string): string {
    const response = new VoiceResponse();
    response.say({ voice: 'Polly.Joanna' }, message);
    response.hangup();
    return response.toString();
  }

  // ===== Audio Generation =====

  private async generateAndSaveAudio(
    text: string,
    callSessionId: string,
    type: string,
    voiceSettings?: ResolvedVoiceSettings
  ): Promise<string> {
    try {
      const publicUrl = await agentVoiceService.generateAndUploadTTS(
        text, callSessionId, type, voiceSettings || null
      );
      return publicUrl;
    } catch (error) {
      logger.error('Failed to generate and save audio:', error);
      throw error;
    }
  }

  /**
   * Legacy: Download and transcribe recording.
   */
  private async downloadAndTranscribe(recordingUrl: string): Promise<string> {
    try {
      const axios = (await import('axios')).default;
      const path = await import('path');
      const fs = await import('fs');
      const sttService = (await import('./ai/stt.service')).default;

      const audioUrl = `${recordingUrl}.wav`;
      const response = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        auth: { username: config.twilio.accountSid, password: config.twilio.authToken },
      });

      const tempPath = path.join(__dirname, '../../recordings/temp', `${uuidv4()}.wav`);
      const tempDir = path.dirname(tempPath);
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(tempPath, Buffer.from(response.data));
      const transcription = await sttService.transcribeAudio(tempPath);
      fs.unlinkSync(tempPath);

      return transcription;
    } catch (error) {
      logger.error('Failed to download/transcribe recording:', error);
      throw error;
    }
  }

  // ===== Database =====

  private async saveMessage(
    callSessionId: string,
    role: 'user' | 'ai',
    content: string,
    audioUrl?: string
  ): Promise<void> {
    try {
      await this.supabase.from('call_messages').insert({
        call_session_id: callSessionId, role, content, audio_url: audioUrl || null,
      });
    } catch (error) {
      logger.error('Failed to save message:', error);
    }
  }

  private async getDefaultUserId(): Promise<string> {
    try {
      const { data: user } = await this.supabase
        .from('users').select('id').eq('email', 'system@comhubai.com').single();
      if (user) return user.id;

      const { data: newUser, error: createError } = await this.supabase
        .from('users').insert({ email: 'system@comhubai.com' }).select().single();

      if (createError) {
        if (createError.code === '23505' || createError.message?.includes('duplicate')) {
          const { data: existingUser } = await this.supabase
            .from('users').select('id').eq('email', 'system@comhubai.com').single();
          if (existingUser) return existingUser.id;
        }
        throw createError;
      }
      return newUser.id;
    } catch (error) {
      logger.error('getDefaultUserId error:', error);
      throw error;
    }
  }

  // ===== Test Calls =====

  async testInboundCall(userId: string, phoneNumber?: string): Promise<{
    callSessionId: string;
    callSid: string;
    message: string;
  }> {
    try {
      logger.info('=== TESTING INBOUND CALL ===', { userId, phoneNumber });
      const twilioSIPService = (await import('../twilio/sip.service')).default;

      if (!twilioSIPService.isConfigured()) {
        throw new Error('Twilio is not configured');
      }

      if (!phoneNumber) {
        const testCallSid = `test_${uuidv4()}`;
        const { data: callSession, error } = await this.supabase
          .from('call_sessions')
          .insert({
            user_id: userId, status: 'active', direction: 'inbound',
            caller_number: 'test-user', callee_number: config.twilio.phoneNumber,
            channel_id: testCallSid,
          })
          .select().single();

        if (error) throw error;

        const greetingAudioUrl = await this.generateAndSaveAudio(
          this.DEFAULT_GREETING, callSession.id, 'greeting'
        );
        await this.saveMessage(callSession.id, 'ai', this.DEFAULT_GREETING, greetingAudioUrl);

        const testUserMessage = "Hello, I'm testing the AI assistant.";
        await this.saveMessage(callSession.id, 'user', testUserMessage);

        const aiResponse = await gptService.generateResponse(testUserMessage, [
          { role: 'assistant', content: this.DEFAULT_GREETING },
          { role: 'user', content: testUserMessage },
        ], { voiceMode: true });

        const responseAudioUrl = await this.generateAndSaveAudio(
          aiResponse.text, callSession.id, 'response'
        );
        await this.saveMessage(callSession.id, 'ai', aiResponse.text, responseAudioUrl);

        await this.supabase.from('call_sessions')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', callSession.id);

        return {
          callSessionId: callSession.id,
          callSid: testCallSid,
          message: 'Test completed! Check call history to see the greeting and AI response.',
        };
      }

      const { data: callSession, error } = await this.supabase
        .from('call_sessions')
        .insert({
          user_id: userId, status: 'ringing', direction: 'outbound',
          caller_number: config.twilio.phoneNumber, callee_number: phoneNumber,
        })
        .select().single();

      if (error) throw error;

      const call = await twilioSIPService.makeCall(phoneNumber, undefined, callSession.id);

      await this.supabase.from('call_sessions')
        .update({ channel_id: call.sid }).eq('id', callSession.id);

      return {
        callSessionId: callSession.id,
        callSid: call.sid,
        message: `Calling ${phoneNumber}... Answer the call to test the AI greeting.`,
      };
    } catch (error) {
      logger.error('Failed to test inbound call:', error);
      throw error;
    }
  }
}

export const voiceConversationService = new VoiceConversationService();
export default voiceConversationService;
