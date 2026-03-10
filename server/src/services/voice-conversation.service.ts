import twilio from 'twilio';
import config from '../config';
import logger from '../utils/logger';
import gptService, { ChatMessage } from './ai/gpt.service';
import getSupabaseClient from '../config/supabase';
import { WorkflowEngine, WorkflowStepResult, WorkflowMessage } from './workflow-engine.service';
import agentVoiceService, { ResolvedVoiceSettings } from './agent-voice.service';
import { v4 as uuidv4 } from 'uuid';

const VoiceResponse = twilio.twiml.VoiceResponse;

interface CallSettings {
  language: string;
  speechTimeout: string;       // seconds or 'auto'
  maxCallDuration: number;     // seconds
  silenceTimeout: number;      // seconds — used as speechTimeout when not 'auto'
  interruptionSensitivity: 'low' | 'high';
  interruptionWordCountThreshold: number;
  onIdleMessage: string;
  onIdleTimeout: number;       // seconds
  onIdleThreshold: number;
  onIdleTerminationMessage: string;
}

const DEFAULT_CALL_SETTINGS: CallSettings = {
  language: 'en-US',
  speechTimeout: 'auto',
  maxCallDuration: 600,
  silenceTimeout: 1,
  interruptionSensitivity: 'low',
  interruptionWordCountThreshold: 3,
  onIdleMessage: '',
  onIdleTimeout: 10,
  onIdleThreshold: 3,
  onIdleTerminationMessage: '',
};

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
  callSettings: CallSettings;
  idleCount: number; // How many idle messages have been sent
}

class VoiceConversationService {
  private activeConversations: Map<string, ActiveConversation> = new Map();
  private supabase = getSupabaseClient();

  private readonly DEFAULT_GREETING = "Hey there! Here is ComHub AI. What can I help you with today?";

  /**
   * Load an agent's workflow from the database and create a WorkflowEngine.
   */
  private async loadAgentWorkflow(agentId: string, direction: 'inbound' | 'outbound'): Promise<{
    engine: WorkflowEngine;
    initialResult: import('./workflow-engine.service').WorkflowStepResult;
    voiceSettings?: ResolvedVoiceSettings;
    callSettings: CallSettings;
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

      // Extract call settings from agent config
      const s = agent.config.settings || {};
      const callSettings: CallSettings = {
        language: s.language || DEFAULT_CALL_SETTINGS.language,
        speechTimeout: s.speechTimeout || (s.silenceTimeout ? String(s.silenceTimeout) : DEFAULT_CALL_SETTINGS.speechTimeout),
        maxCallDuration: s.maxCallDuration || DEFAULT_CALL_SETTINGS.maxCallDuration,
        silenceTimeout: s.silenceTimeout || DEFAULT_CALL_SETTINGS.silenceTimeout,
        interruptionSensitivity: s.interruptionSensitivity || DEFAULT_CALL_SETTINGS.interruptionSensitivity,
        interruptionWordCountThreshold: s.interruptionWordCountThreshold || DEFAULT_CALL_SETTINGS.interruptionWordCountThreshold,
        onIdleMessage: s.onIdleMessage || DEFAULT_CALL_SETTINGS.onIdleMessage,
        onIdleTimeout: s.onIdleTimeout || DEFAULT_CALL_SETTINGS.onIdleTimeout,
        onIdleThreshold: s.onIdleThreshold || DEFAULT_CALL_SETTINGS.onIdleThreshold,
        onIdleTerminationMessage: s.onIdleTerminationMessage || DEFAULT_CALL_SETTINGS.onIdleTerminationMessage,
      };

      return { engine, initialResult, voiceSettings, callSettings };
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
        callSettings: { ...DEFAULT_CALL_SETTINGS },
        idleCount: 0,
      };

      this.activeConversations.set(callSid, conversation);

      let greetingText = this.DEFAULT_GREETING;

      if (agentId) {
        const workflow = await this.loadAgentWorkflow(agentId, 'inbound');
        if (workflow) {
          conversation.workflowEngine = workflow.engine;
          conversation.voiceSettings = workflow.voiceSettings;
          conversation.callSettings = workflow.callSettings;
          const spokenText = this.combineMessages(workflow.initialResult.messages);
          if (spokenText) greetingText = spokenText;
          logger.info('Workflow engine loaded for inbound call', {
            callSid, agentId,
            ttsProvider: workflow.voiceSettings?.ttsProvider || 'openai',
            callSettings: workflow.callSettings,
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
        this.appendGather(response, conversation.callSettings);
        return response.toString();
      }

      await this.saveMessage(callSession.id, 'ai', greetingText, greetingAudioUrl);
      conversation.history.push({ role: 'assistant', content: greetingText });

      const twiml = this.generatePlayAndGatherTwiML(greetingAudioUrl, conversation.callSettings);

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
        callSettings: { ...DEFAULT_CALL_SETTINGS },
        idleCount: 0,
      };

      this.activeConversations.set(callSid, conversation);

      let greetingText = this.DEFAULT_GREETING;

      if (agentId) {
        const workflow = await this.loadAgentWorkflow(agentId, 'outbound');
        if (workflow) {
          conversation.workflowEngine = workflow.engine;
          conversation.voiceSettings = workflow.voiceSettings;
          conversation.callSettings = workflow.callSettings;
          const spokenText = this.combineMessages(workflow.initialResult.messages);
          if (spokenText) greetingText = spokenText;
          logger.info('Workflow engine loaded for outbound call', {
            callSid, agentId,
            ttsProvider: workflow.voiceSettings?.ttsProvider || 'openai',
            callSettings: workflow.callSettings,
          });
        }
      }

      const greetingAudioUrl = await this.generateAndSaveAudio(
        greetingText, callSession.id, 'greeting', conversation.voiceSettings
      );

      await this.saveMessage(callSession.id, 'ai', greetingText, greetingAudioUrl);
      conversation.history.push({ role: 'assistant', content: greetingText });

      const twiml = this.generatePlayAndGatherTwiML(greetingAudioUrl, conversation.callSettings);

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

      const cs = conversation.callSettings;

      logger.info('Processing speech result', { callSid, text: speechResult, confidence });

      // --- Max call duration check ---
      const callDurationSec = Math.floor((Date.now() - conversation.startedAt.getTime()) / 1000);
      if (cs.maxCallDuration > 0 && callDurationSec >= cs.maxCallDuration) {
        logger.info('Max call duration reached', { callSid, duration: callDurationSec, limit: cs.maxCallDuration });
        const endMsg = 'We have reached the maximum call duration. Thank you for calling. Goodbye!';
        const endAudioUrl = await this.generateAndSaveAudio(endMsg, conversation.callSessionId, 'end', conversation.voiceSettings);
        await this.saveMessage(conversation.callSessionId, 'ai', endMsg, endAudioUrl);
        const response = new VoiceResponse();
        response.play(endAudioUrl);
        response.hangup();
        return response.toString();
      }

      // --- Empty speech / idle handling ---
      if (!speechResult || speechResult.trim().length === 0) {
        conversation.idleCount++;
        logger.info('Empty speech (idle)', { callSid, idleCount: conversation.idleCount, threshold: cs.onIdleThreshold });

        // Check if idle threshold exceeded → terminate
        if (cs.onIdleThreshold > 0 && conversation.idleCount >= cs.onIdleThreshold) {
          const termMsg = cs.onIdleTerminationMessage || "It seems you're no longer there. Thank you for calling. Goodbye!";
          const termAudioUrl = await this.generateAndSaveAudio(termMsg, conversation.callSessionId, 'idle-end', conversation.voiceSettings);
          await this.saveMessage(conversation.callSessionId, 'ai', termMsg, termAudioUrl);
          const response = new VoiceResponse();
          response.play(termAudioUrl);
          response.hangup();
          return response.toString();
        }

        // Send idle message if configured, otherwise generic retry
        const idleMsg = cs.onIdleMessage || "I didn't catch that. Could you please repeat?";
        const idleAudioUrl = await this.generateAndSaveAudio(idleMsg, conversation.callSessionId, 'idle', conversation.voiceSettings);
        await this.saveMessage(conversation.callSessionId, 'ai', idleMsg, idleAudioUrl);
        return this.generatePlayAndGatherTwiML(idleAudioUrl, cs);
      }

      // --- Interruption word count threshold ---
      // If barge-in is enabled, short utterances (below threshold) are likely accidental
      const wordCount = speechResult.trim().split(/\s+/).length;
      if (cs.interruptionSensitivity === 'high' && wordCount < cs.interruptionWordCountThreshold) {
        logger.info('Speech below word count threshold, ignoring', {
          callSid, wordCount, threshold: cs.interruptionWordCountThreshold,
        });
        // Re-listen without responding — just Gather again
        const response = new VoiceResponse();
        this.appendGather(response, cs);
        return response.toString();
      }

      // Reset idle count on valid speech
      conversation.idleCount = 0;

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

      return this.generatePlayAndGatherTwiML(aiAudioUrl, conversation.callSettings);
    } catch (error) {
      logger.error('Failed to process speech result:', error);

      const errorMessage = "I'm sorry, I encountered an error. Let me try again.";
      const conversation = this.activeConversations.get(callSid);

      if (conversation) {
        try {
          const errorAudioUrl = await this.generateAndSaveAudio(
            errorMessage, conversation.callSessionId, 'error', conversation.voiceSettings
          );
          return this.generatePlayAndGatherTwiML(errorAudioUrl, conversation.callSettings);
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
   * Settings from agent config:
   * - speechTimeout: configurable silence detection (seconds or 'auto')
   * - language: agent's configured language
   * - speechModel: "experimental_conversations" — optimized for back-and-forth dialogue
   * - enhanced: true — higher accuracy speech recognition
   */
  private appendGather(response: twilio.twiml.VoiceResponse, cs?: CallSettings): void {
    const s = cs || DEFAULT_CALL_SETTINGS;
    response.gather({
      input: ['speech'],
      action: `${config.server.apiBaseUrl}/api/twilio/handle-speech`,
      method: 'POST',
      speechTimeout: s.speechTimeout,
      speechModel: 'experimental_conversations',
      enhanced: true,
      language: s.language,
    } as any);

    // Fallback if no speech detected
    response.say({ voice: 'Polly.Joanna' }, 'Thank you for calling. Goodbye!');
    response.hangup();
  }

  /**
   * Generate TwiML that plays audio then listens for speech.
   *
   * Interruption handling:
   * - HIGH sensitivity: <Play> is nested inside <Gather> so user speech
   *   immediately stops playback and is captured (barge-in).
   * - LOW sensitivity: <Play> runs first, then <Gather> listens after
   *   audio finishes — agent completes speaking before listening.
   */
  private generatePlayAndGatherTwiML(audioUrl: string, cs?: CallSettings): string {
    const s = cs || DEFAULT_CALL_SETTINGS;
    const response = new VoiceResponse();

    if (s.interruptionSensitivity === 'high') {
      // Barge-in: Gather wraps Play — user speech interrupts audio
      const gather = response.gather({
        input: ['speech'],
        action: `${config.server.apiBaseUrl}/api/twilio/handle-speech`,
        method: 'POST',
        speechTimeout: s.speechTimeout,
        speechModel: 'experimental_conversations',
        enhanced: true,
        language: s.language,
      } as any);
      gather.play(audioUrl);

      // If user doesn't speak during playback, add a standalone Gather to wait
      this.appendGather(response, s);
    } else {
      // No barge-in: Play finishes, then Gather listens
      response.play(audioUrl);
      this.appendGather(response, s);
    }

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
