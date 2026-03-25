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
  silenceTimeout: 2,
  interruptionSensitivity: 'low',
  interruptionWordCountThreshold: 1,
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

  /**
   * Pending AI responses keyed by callSid.
   * When a filler is returned, the real processing runs in the background.
   * The get-response endpoint awaits this promise.
   */
  private pendingResponses: Map<string, Promise<string>> = new Map();

  // --- Language-aware filler phrases ---
  // Short, natural phrases that buy time while AI processes the real response.
  private readonly FILLER_PHRASES: Record<string, string[]> = {
    en: [
      'Hmm, let me think...',
      'One moment...',
      'Let me see...',
      'So...',
      'Alright...',
    ],
    de: [
      'Hmm, einen Moment...',
      'Lass mich überlegen...',
      'Moment bitte...',
      'Also...',
      'Einen Augenblick...',
    ],
    es: [
      'Hmm, déjame pensar...',
      'Un momento...',
      'A ver...',
      'Bueno...',
      'Un segundo...',
    ],
    fr: [
      'Hmm, laissez-moi réfléchir...',
      'Un instant...',
      'Voyons voir...',
      'Alors...',
      'Un moment...',
    ],
    it: [
      'Hmm, un momento...',
      'Vediamo...',
      'Allora...',
      'Un attimo...',
      'Fammi pensare...',
    ],
    pt: [
      'Hmm, um momento...',
      'Deixe-me pensar...',
      'Vamos ver...',
      'Então...',
      'Um instante...',
    ],
    nl: [
      'Hmm, even denken...',
      'Een moment...',
      'Laat me even kijken...',
      'Dus...',
      'Een ogenblik...',
    ],
  };

  /**
   * Common short words/phrases that Twilio STT often misses without hints.
   * These are passed as the `hints` parameter on <Gather> to boost recognition.
   */
  private readonly SPEECH_HINTS: Record<string, string> = {
    en: 'yes, no, yeah, yep, nope, hello, hi, hey, okay, ok, sure, right, correct, wrong, maybe, please, thanks, thank you, goodbye, bye, one, two, three, four, five, six, seven, eight, nine, ten',
    de: 'ja, nein, hallo, hi, okay, richtig, falsch, vielleicht, bitte, danke, tschüss, auf wiedersehen, eins, zwei, drei, vier, fünf, sechs, sieben, acht, neun, zehn',
    es: 'sí, no, hola, bueno, vale, claro, correcto, incorrecto, quizás, por favor, gracias, adiós, uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez',
    fr: 'oui, non, bonjour, salut, d\'accord, bien sûr, correct, peut-être, s\'il vous plaît, merci, au revoir, un, deux, trois, quatre, cinq, six, sept, huit, neuf, dix',
    it: 'sì, no, ciao, salve, okay, va bene, corretto, forse, per favore, grazie, arrivederci, uno, due, tre, quattro, cinque, sei, sette, otto, nove, dieci',
    pt: 'sim, não, olá, oi, tudo bem, certo, errado, talvez, por favor, obrigado, tchau, um, dois, três, quatro, cinco, seis, sete, oito, nove, dez',
    nl: 'ja, nee, hallo, hoi, oké, goed, juist, fout, misschien, alstublieft, dank u, tot ziens, een, twee, drie, vier, vijf, zes, zeven, acht, negen, tien',
  };

  /**
   * Get speech hints for the given language.
   */
  private getSpeechHints(language: string): string {
    const langCode = (language || 'en-US').substring(0, 2);
    return this.SPEECH_HINTS[langCode] || this.SPEECH_HINTS.en;
  }

  /**
   * Pick a random filler phrase for the given language.
   */
  private getFillerPhrase(language: string): string {
    const langCode = (language || 'en-US').substring(0, 2);
    const phrases = this.FILLER_PHRASES[langCode] || this.FILLER_PHRASES.en;
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

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
      const agentAiModel = agent.config?.settings?.aiModel || '';
      const engine = new WorkflowEngine(nodes, edges, undefined, agentAiModel);
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

          // Wire up full history callback so end_call analysis gets ALL messages
          workflow.engine.fetchFullHistory = () => this.fetchCallMessages(conversation.callSessionId);

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

          // Wire up full history callback so end_call analysis gets ALL messages
          workflow.engine.fetchFullHistory = () => this.fetchCallMessages(conversation.callSessionId);

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

      // --- Low confidence: treat as unrecognized speech ---
      // Threshold is intentionally low (0.15) — short words like "yes", "no", "hello"
      // often return moderate confidence (0.3-0.6) and must NOT be rejected.
      if (confidence > 0 && confidence < 0.15 && speechResult.trim().length > 0) {
        logger.info('Very low confidence speech, treating as unrecognized', { callSid, confidence, text: speechResult });
        // Route through workflow engine's [SPEECH_NOT_RECOGNIZED] handler
        if (conversation.workflowEngine && conversation.workflowEngine.isWaitingForInput()) {
          const result = await conversation.workflowEngine.processMessage('[SPEECH_NOT_RECOGNIZED]');
          const responseText = this.combineMessages(result.messages) || "I didn't catch that. Could you please repeat?";
          const audioUrl = await this.generateAndSaveAudio(responseText, conversation.callSessionId, 'retry', conversation.voiceSettings);
          await this.saveMessage(conversation.callSessionId, 'ai', responseText, audioUrl);
          return this.generatePlayAndGatherTwiML(audioUrl, cs);
        }
      }

      // --- Max call duration check ---
      const callDurationSec = Math.floor((Date.now() - conversation.startedAt.getTime()) / 1000);
      if (cs.maxCallDuration > 0 && callDurationSec >= cs.maxCallDuration) {
        logger.info('Max call duration reached', { callSid, duration: callDurationSec, limit: cs.maxCallDuration });
        const endMsg = this.getLocalizedMessage(cs.language, 'maxDuration');
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
          const termMsg = cs.onIdleTerminationMessage || this.getLocalizedMessage(cs.language, 'idleTermination');
          const termAudioUrl = await this.generateAndSaveAudio(termMsg, conversation.callSessionId, 'idle-end', conversation.voiceSettings);
          await this.saveMessage(conversation.callSessionId, 'ai', termMsg, termAudioUrl);
          const response = new VoiceResponse();
          response.play(termAudioUrl);
          response.hangup();
          return response.toString();
        }

        // Send idle message if configured, otherwise generic retry in agent's language
        const idleMsg = cs.onIdleMessage || this.getLocalizedMessage(cs.language, 'idleRetry');
        const idleAudioUrl = await this.generateAndSaveAudio(idleMsg, conversation.callSessionId, 'idle', conversation.voiceSettings);
        await this.saveMessage(conversation.callSessionId, 'ai', idleMsg, idleAudioUrl);
        return this.generatePlayAndGatherTwiML(idleAudioUrl, cs);
      }

      // --- Interruption word count threshold (barge-in only) ---
      // Only applies when barge-in is active AND the agent is currently speaking.
      // This filters accidental noise/breath during playback, NOT legitimate short answers.
      // Threshold defaults to 1, meaning only completely empty post-trim results are filtered.
      const wordCount = speechResult.trim().split(/\s+/).length;
      if (cs.interruptionSensitivity === 'high' && cs.interruptionWordCountThreshold > 1 && wordCount < cs.interruptionWordCountThreshold) {
        logger.info('Barge-in speech below word count threshold, re-listening', {
          callSid, wordCount, threshold: cs.interruptionWordCountThreshold, text: speechResult,
        });
        const response = new VoiceResponse();
        this.appendGather(response, cs);
        return response.toString();
      }

      // Reset idle count on valid speech
      conversation.idleCount = 0;

      await this.saveMessage(conversation.callSessionId, 'user', speechResult);
      conversation.history.push({ role: 'user', content: speechResult });

      logger.info('User said', { callSid, text: speechResult });

      // --- Filler response pattern ---
      // Start AI processing in the background, return a short filler immediately,
      // then redirect to /get-response which awaits the real answer.
      // This dramatically reduces perceived latency on voice calls.

      const processingPromise = this.processAIResponse(callSid, speechResult, conversation);
      this.pendingResponses.set(callSid, processingPromise);

      const fillerPhrase = this.getFillerPhrase(cs.language);
      logger.info('Returning filler while AI processes', { callSid, filler: fillerPhrase });

      const response = new VoiceResponse();
      response.say({
        voice: 'Polly.Joanna',
        language: cs.language as any,
      }, fillerPhrase);
      response.redirect({
        method: 'POST',
      }, `${config.server.apiBaseUrl}/api/twilio/get-response?callSid=${encodeURIComponent(callSid)}`);

      return response.toString();
    } catch (error) {
      logger.error('Failed to process speech result:', error);

      const conversation = this.activeConversations.get(callSid);
      const errorMessage = this.getLocalizedMessage(conversation?.callSettings?.language || 'en-US', 'error');

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
   * Process the AI response in the background (called from processSpeechResult).
   * Returns the final TwiML string once ready.
   */
  private async processAIResponse(
    callSid: string,
    speechResult: string,
    conversation: ActiveConversation,
  ): Promise<string> {
    try {
      const cs = conversation.callSettings;
      let responseText: string;

      if (conversation.workflowEngine && conversation.workflowEngine.isWaitingForInput()) {
        const result = await conversation.workflowEngine.processMessage(speechResult);
        responseText = this.combineMessages(result.messages);

        if (!responseText) responseText = 'Thank you for calling. Goodbye!';

        logger.info('Workflow engine processed message (background)', {
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

        // Sync messages to workflow engine's conversationContext so that
        // end_call summary/analysis has the complete conversation history
        if (conversation.workflowEngine) {
          conversation.workflowEngine.addToConversationContext('user', speechResult);
          conversation.workflowEngine.addToConversationContext('agent', responseText);
        }
      }

      const aiAudioUrl = await this.generateAndSaveAudio(
        responseText, conversation.callSessionId, 'response', conversation.voiceSettings
      );

      await this.saveMessage(conversation.callSessionId, 'ai', responseText, aiAudioUrl);
      conversation.history.push({ role: 'assistant', content: responseText });

      logger.info('AI responded (background)', { callSid, text: responseText.substring(0, 100) });

      return this.generatePlayAndGatherTwiML(aiAudioUrl, cs);
    } catch (error) {
      logger.error('Background AI processing failed', { callSid, error });
      const errorMessage = this.getLocalizedMessage(conversation.callSettings.language, 'error');
      try {
        const errorAudioUrl = await this.generateAndSaveAudio(
          errorMessage, conversation.callSessionId, 'error', conversation.voiceSettings
        );
        return this.generatePlayAndGatherTwiML(errorAudioUrl, conversation.callSettings);
      } catch {
        const response = new VoiceResponse();
        response.say({ voice: 'Polly.Joanna' }, errorMessage);
        this.appendGather(response, conversation.callSettings);
        return response.toString();
      }
    }
  }

  /**
   * Await the pending AI response for a call.
   * Called by the /get-response endpoint after the filler has played.
   */
  async getProcessedResponse(callSid: string): Promise<string> {
    const pending = this.pendingResponses.get(callSid);
    if (!pending) {
      logger.warn('No pending response found for callSid', { callSid });
      const conversation = this.activeConversations.get(callSid);
      if (conversation) {
        // No pending response — just re-gather
        const response = new VoiceResponse();
        this.appendGather(response, conversation.callSettings);
        return response.toString();
      }
      return this.generateEndCallTwiML("Sorry, something went wrong. Goodbye!");
    }

    try {
      const twiml = await pending;
      return twiml;
    } finally {
      this.pendingResponses.delete(callSid);
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
      this.pendingResponses.delete(callSid);

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

  // ===== Localized Messages =====

  private getLocalizedMessage(language: string, key: string): string {
    const langCode = (language || 'en-US').substring(0, 2);
    const messages: Record<string, Record<string, string>> = {
      en: {
        idleRetry: "I didn't catch that. Could you please repeat?",
        idleTermination: "It seems you're no longer there. Thank you for calling. Goodbye!",
        error: "I'm sorry, I encountered an error. Let me try again.",
        maxDuration: "We have reached the maximum call duration. Thank you for calling. Goodbye!",
      },
      de: {
        idleRetry: 'Das habe ich leider nicht verstanden. Könnten Sie das bitte wiederholen?',
        idleTermination: 'Es scheint, als wären Sie nicht mehr da. Vielen Dank für Ihren Anruf. Auf Wiederhören!',
        error: 'Entschuldigung, es ist ein Fehler aufgetreten. Lassen Sie es mich erneut versuchen.',
        maxDuration: 'Wir haben die maximale Anrufdauer erreicht. Vielen Dank für Ihren Anruf. Auf Wiederhören!',
      },
      es: {
        idleRetry: 'No entendí eso. ¿Podría repetirlo, por favor?',
        idleTermination: 'Parece que ya no está ahí. Gracias por llamar. ¡Adiós!',
        error: 'Lo siento, encontré un error. Déjeme intentar de nuevo.',
        maxDuration: 'Hemos alcanzado la duración máxima de la llamada. Gracias por llamar. ¡Adiós!',
      },
      fr: {
        idleRetry: "Je n'ai pas compris. Pourriez-vous répéter, s'il vous plaît?",
        idleTermination: "Il semble que vous ne soyez plus là. Merci d'avoir appelé. Au revoir!",
        error: "Désolé, j'ai rencontré une erreur. Laissez-moi réessayer.",
        maxDuration: "Nous avons atteint la durée maximale de l'appel. Merci d'avoir appelé. Au revoir!",
      },
    };
    return messages[langCode]?.[key] || messages.en[key] || messages.en.idleRetry;
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
      profanityFilter: false,
      hints: this.getSpeechHints(s.language),
    } as any);

    // Fallback if no speech detected — use agent's language
    const langCode = s.language?.substring(0, 2) || 'en';
    const goodbyeMessages: Record<string, string> = {
      en: 'Thank you for calling. Goodbye!',
      de: 'Vielen Dank für Ihren Anruf. Auf Wiederhören!',
      es: 'Gracias por llamar. ¡Adiós!',
      fr: 'Merci de votre appel. Au revoir!',
      it: 'Grazie per la chiamata. Arrivederci!',
      pt: 'Obrigado pela ligação. Até logo!',
      nl: 'Bedankt voor uw telefoontje. Tot ziens!',
    };
    response.say({ voice: 'Polly.Joanna', language: s.language as any }, goodbyeMessages[langCode] || goodbyeMessages.en);
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
        profanityFilter: false,
        hints: this.getSpeechHints(s.language),
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

  /**
   * Fetch all messages for a call session from the database.
   * Used by WorkflowEngine's end_call node to send the complete
   * conversation history to AI for accurate analysis/summary.
   */
  private async fetchCallMessages(callSessionId: string): Promise<Array<{ role: string; content: string }>> {
    const { data, error } = await this.supabase
      .from('call_messages')
      .select('role, content')
      .eq('call_session_id', callSessionId)
      .order('timestamp', { ascending: true });

    if (error) {
      logger.error('Failed to fetch call messages for analysis', { callSessionId, error });
      throw error;
    }

    return (data || []).map((m: any) => ({
      role: m.role === 'ai' ? 'agent' : m.role,
      content: m.content,
    }));
  }

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
