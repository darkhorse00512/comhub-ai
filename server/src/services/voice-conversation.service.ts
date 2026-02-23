import twilio from 'twilio';
import config from '../config';
import logger from '../utils/logger';
import sttService from './ai/stt.service';
import gptService, { ChatMessage } from './ai/gpt.service';
import getSupabaseClient from '../config/supabase';
import { WorkflowEngine, WorkflowStepResult, WorkflowMessage } from './workflow-engine.service';
import agentVoiceService, { ResolvedVoiceSettings } from './agent-voice.service';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

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
  private readonly SILENCE_TIMEOUT = 2; // seconds
  private readonly MAX_RECORDING_LENGTH = 30; // seconds

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

      // Use shared service to resolve voice settings (including ComhubAI voice model lookup)
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

      // Get or create default user for inbound calls
      let userId: string;
      try {
        userId = await this.getDefaultUserId();
        logger.info('Got default user ID', { userId });
      } catch (userError) {
        logger.error('Failed to get default user ID:', userError);
        // Fallback: create call without user tracking
        throw new Error('Failed to get system user for inbound call');
      }

      // Create call session in database
      logger.info('Creating call session in database...');
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
      logger.info('Call session created', { callSessionId: callSession.id });

      // Initialize conversation state
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

      // Determine greeting: use workflow engine if agent is provided, else default
      let greetingText = this.DEFAULT_GREETING;

      if (agentId) {
        const workflow = await this.loadAgentWorkflow(agentId, 'inbound');
        if (workflow) {
          conversation.workflowEngine = workflow.engine;
          conversation.voiceSettings = workflow.voiceSettings;
          const spokenText = this.combineMessages(workflow.initialResult.messages);
          if (spokenText) {
            greetingText = spokenText;
          }
          logger.info('Workflow engine loaded for inbound call', {
            callSid,
            agentId,
            waitingForInput: workflow.initialResult.waitingForInput,
            isComplete: workflow.initialResult.isComplete,
            ttsProvider: workflow.voiceSettings?.ttsProvider || 'openai',
          });
        }
      }

      // Generate greeting audio
      logger.info('Generating greeting audio...', { greeting: greetingText.substring(0, 100) });
      let greetingAudioUrl: string;
      try {
        greetingAudioUrl = await this.generateAndSaveAudio(
          greetingText,
          callSession.id,
          'greeting',
          conversation.voiceSettings
        );
        logger.info('Greeting audio generated', { url: greetingAudioUrl });
      } catch (audioError) {
        logger.error('Failed to generate greeting audio:', audioError);
        const response = new VoiceResponse();
        response.say({ voice: 'alice' }, greetingText);
        response.record({
          action: `${config.server.apiBaseUrl}/api/twilio/handle-recording`,
          method: 'POST',
          maxLength: this.MAX_RECORDING_LENGTH,
          timeout: this.SILENCE_TIMEOUT,
          playBeep: false,
          trim: 'trim-silence',
        });
        response.say('Goodbye!');
        response.hangup();
        return response.toString();
      }

      // Save greeting message to database
      await this.saveMessage(callSession.id, 'ai', greetingText, greetingAudioUrl);
      conversation.history.push({ role: 'assistant', content: greetingText });

      // Generate TwiML for greeting + recording
      const twiml = this.generateGreetingTwiML(greetingAudioUrl);

      logger.info('Inbound conversation started successfully', {
        callSid,
        callSessionId: callSession.id,
        callerNumber,
        audioUrl: greetingAudioUrl,
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
      logger.info('=== STARTING OUTBOUND CONVERSATION ===', { callSid, calleeNumber, userId, existingSessionId, agentId });

      let callSession: any;

      // Try to use existing session if provided
      if (existingSessionId) {
        const { data: existingSession, error: fetchError } = await this.supabase
          .from('call_sessions')
          .select('*')
          .eq('id', existingSessionId)
          .single();

        if (existingSession && !fetchError) {
          // Update the existing session with callSid and set status to active
          const { data: updatedSession, error: updateError } = await this.supabase
            .from('call_sessions')
            .update({
              channel_id: callSid,
              status: 'active',
            })
            .eq('id', existingSessionId)
            .select()
            .single();

          if (updatedSession && !updateError) {
            callSession = updatedSession;
            logger.info('Using existing call session', { callSessionId: callSession.id, userId: callSession.user_id });
          }
        }
      }

      // If no existing session found/used, create new one
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
        logger.info('Created new call session in database', { callSessionId: callSession.id });
      }

      // Initialize conversation state
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

      // Determine greeting: use workflow engine if agent is provided, else default
      let greetingText = this.DEFAULT_GREETING;

      if (agentId) {
        const workflow = await this.loadAgentWorkflow(agentId, 'outbound');
        if (workflow) {
          conversation.workflowEngine = workflow.engine;
          conversation.voiceSettings = workflow.voiceSettings;
          const spokenText = this.combineMessages(workflow.initialResult.messages);
          if (spokenText) {
            greetingText = spokenText;
          }
          logger.info('Workflow engine loaded for outbound call', {
            callSid,
            agentId,
            waitingForInput: workflow.initialResult.waitingForInput,
            isComplete: workflow.initialResult.isComplete,
            ttsProvider: workflow.voiceSettings?.ttsProvider || 'openai',
          });
        }
      }

      // Generate greeting audio and upload to Supabase
      logger.info('Generating greeting audio...', { greeting: greetingText.substring(0, 100) });
      const greetingAudioUrl = await this.generateAndSaveAudio(
        greetingText,
        callSession.id,
        'greeting',
        conversation.voiceSettings
      );
      logger.info('Greeting audio generated', { url: greetingAudioUrl });

      // Save greeting message to database
      await this.saveMessage(callSession.id, 'ai', greetingText, greetingAudioUrl);
      conversation.history.push({ role: 'assistant', content: greetingText });

      // Generate TwiML for greeting + recording
      const twiml = this.generateGreetingTwiML(greetingAudioUrl);

      logger.info('Outbound conversation started successfully', {
        callSid,
        callSessionId: callSession.id,
        calleeNumber,
        audioUrl: greetingAudioUrl,
      });

      return twiml;
    } catch (error) {
      logger.error('Failed to start outbound conversation:', error);
      throw error;
    }
  }

  async processRecording(
    callSid: string,
    recordingUrl: string,
    recordingSid: string
  ): Promise<string> {
    try {
      const conversation = this.activeConversations.get(callSid);
      if (!conversation) {
        logger.warn('No active conversation found for callSid:', callSid);
        return this.generateEndCallTwiML("Sorry, we lost track of our conversation. Goodbye!");
      }

      logger.info('Processing recording', { callSid, recordingSid });

      // Download and transcribe the recording
      const transcribedText = await this.downloadAndTranscribe(recordingUrl);

      if (!transcribedText || transcribedText.trim().length === 0) {
        // No speech detected, ask them to speak again
        const retryMessage = "I didn't catch that. Could you please repeat?";
        const retryAudioPath = await this.generateAndSaveAudio(
          retryMessage,
          conversation.callSessionId,
          'retry',
          conversation.voiceSettings
        );

        await this.saveMessage(conversation.callSessionId, 'ai', retryMessage, retryAudioPath);

        return this.generatePlayAndRecordTwiML(retryAudioPath);
      }

      // Save user message
      await this.saveMessage(conversation.callSessionId, 'user', transcribedText);
      conversation.history.push({ role: 'user', content: transcribedText });

      logger.info('User said', { callSid, text: transcribedText });

      let responseText: string;

      // Use workflow engine if available, otherwise fall back to simple AI chat
      if (conversation.workflowEngine && conversation.workflowEngine.isWaitingForInput()) {
        const result = await conversation.workflowEngine.processMessage(transcribedText);
        responseText = this.combineMessages(result.messages);

        if (!responseText) {
          responseText = 'Thank you for calling. Goodbye!';
        }

        logger.info('Workflow engine processed message', {
          callSid,
          waitingForInput: result.waitingForInput,
          isComplete: result.isComplete,
          currentStage: result.currentStage,
        });

        // If workflow is complete or call needs to transfer, handle terminal states
        if (result.isComplete) {
          const aiAudioPath = await this.generateAndSaveAudio(
            responseText,
            conversation.callSessionId,
            'response',
            conversation.voiceSettings
          );
          await this.saveMessage(conversation.callSessionId, 'ai', responseText, aiAudioPath);
          conversation.history.push({ role: 'assistant', content: responseText });

          if (result.transferTo) {
            // Handle call transfer
            logger.info('Call transfer requested', { callSid, transferTo: result.transferTo });
            const response = new VoiceResponse();
            response.play(aiAudioPath);
            const dial = response.dial();
            dial.number(result.transferTo);
            return response.toString();
          }

          // Workflow done - end call gracefully
          return this.generateEndCallTwiML(responseText);
        }
      } else {
        // Fall back to simple AI chat (no workflow)
        const aiResponse = await gptService.generateResponse(transcribedText, conversation.history);
        responseText = aiResponse.text;
      }

      // Generate audio for response
      const aiAudioPath = await this.generateAndSaveAudio(
        responseText,
        conversation.callSessionId,
        'response',
        conversation.voiceSettings
      );

      // Save AI response
      await this.saveMessage(conversation.callSessionId, 'ai', responseText, aiAudioPath);
      conversation.history.push({ role: 'assistant', content: responseText });

      logger.info('AI responded', { callSid, text: responseText.substring(0, 100) });

      // Continue conversation
      return this.generatePlayAndRecordTwiML(aiAudioPath);
    } catch (error) {
      logger.error('Failed to process recording:', error);

      const errorMessage = "I'm sorry, I encountered an error. Let me try again.";
      const conversation = this.activeConversations.get(callSid);

      if (conversation) {
        const errorAudioPath = await this.generateAndSaveAudio(
          errorMessage,
          conversation.callSessionId,
          'error',
          conversation.voiceSettings
        );
        return this.generatePlayAndRecordTwiML(errorAudioPath);
      }

      return this.generateEndCallTwiML("Sorry, something went wrong. Please try again later.");
    }
  }

  async endConversation(callSid: string): Promise<void> {
    try {
      const conversation = this.activeConversations.get(callSid);
      if (!conversation) return;

      // Update call session status in database
      await this.supabase
        .from('call_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
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

  private generateGreetingTwiML(audioUrl: string): string {
    const response = new VoiceResponse();

    // Play greeting (audioUrl is now a public Supabase URL)
    response.play(audioUrl);

    // Record user response with silence detection
    response.record({
      action: `${config.server.apiBaseUrl}/api/twilio/handle-recording`,
      method: 'POST',
      maxLength: this.MAX_RECORDING_LENGTH,
      timeout: this.SILENCE_TIMEOUT,
      playBeep: false,
      trim: 'trim-silence',
    });

    // Fallback if no recording (user hangs up during greeting)
    response.say('Goodbye!');
    response.hangup();

    return response.toString();
  }

  private generatePlayAndRecordTwiML(audioUrl: string): string {
    const response = new VoiceResponse();

    // Play AI response (audioUrl is now a public Supabase URL)
    response.play(audioUrl);

    // Record next user response
    response.record({
      action: `${config.server.apiBaseUrl}/api/twilio/handle-recording`,
      method: 'POST',
      maxLength: this.MAX_RECORDING_LENGTH,
      timeout: this.SILENCE_TIMEOUT,
      playBeep: false,
      trim: 'trim-silence',
    });

    // If recording times out completely, end call
    response.say('Thank you for calling. Goodbye!');
    response.hangup();

    return response.toString();
  }

  private generateEndCallTwiML(message: string): string {
    const response = new VoiceResponse();
    response.say({ voice: 'alice' }, message);
    response.hangup();
    return response.toString();
  }

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

      logger.info('Audio generated and uploaded', {
        callSessionId,
        type,
        provider: voiceSettings?.ttsProvider || 'openai',
        url: publicUrl,
      });

      return publicUrl;
    } catch (error) {
      logger.error('Failed to generate and save audio:', error);
      throw error;
    }
  }

  private async downloadAndTranscribe(recordingUrl: string): Promise<string> {
    try {
      // Add .wav extension and wait for Twilio to finalize recording
      const audioUrl = `${recordingUrl}.wav`;

      // Download the recording from Twilio
      const response = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        auth: {
          username: config.twilio.accountSid,
          password: config.twilio.authToken,
        },
      });

      // Save temporarily for transcription
      const tempPath = path.join(__dirname, '../../recordings/temp', `${uuidv4()}.wav`);
      const tempDir = path.dirname(tempPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(tempPath, Buffer.from(response.data));

      // Transcribe using OpenAI Whisper
      const transcription = await sttService.transcribeAudio(tempPath);

      // Clean up temp file
      fs.unlinkSync(tempPath);

      return transcription;
    } catch (error) {
      logger.error('Failed to download/transcribe recording:', error);
      throw error;
    }
  }

  private async saveMessage(
    callSessionId: string,
    role: 'user' | 'ai',
    content: string,
    audioUrl?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('call_messages')
        .insert({
          call_session_id: callSessionId,
          role,
          content,
          audio_url: audioUrl || null, // audioUrl is already a public URL
        });
    } catch (error) {
      logger.error('Failed to save message:', error);
    }
  }

  private async getDefaultUserId(): Promise<string> {
    try {
      // Get or create a default system user for inbound calls
      logger.info('Looking for system user...');
      const { data: user, error } = await this.supabase
        .from('users')
        .select('id')
        .eq('email', 'system@comhubai.com')
        .single();

      if (user) {
        logger.info('Found existing system user', { userId: user.id });
        return user.id;
      }

      // User not found - try to create
      logger.info('System user not found, creating...');
      const { data: newUser, error: createError } = await this.supabase
        .from('users')
        .insert({ email: 'system@comhubai.com' })
        .select()
        .single();

      if (createError) {
        // Check if it's a duplicate key error (user was created by another request)
        if (createError.code === '23505' || createError.message?.includes('duplicate')) {
          logger.info('User already exists (race condition), fetching again...');
          const { data: existingUser } = await this.supabase
            .from('users')
            .select('id')
            .eq('email', 'system@comhubai.com')
            .single();

          if (existingUser) return existingUser.id;
        }
        logger.error('Failed to create system user:', createError);
        throw createError;
      }

      logger.info('Created new system user', { userId: newUser.id });
      return newUser.id;
    } catch (error) {
      logger.error('getDefaultUserId error:', error);
      throw error;
    }
  }

  // Test inbound call - creates a real Twilio call to test the full flow
  async testInboundCall(userId: string, phoneNumber?: string): Promise<{
    callSessionId: string;
    callSid: string;
    message: string;
  }> {
    try {
      logger.info('=== TESTING INBOUND CALL (FULL TEST) ===', { userId, phoneNumber });

      // Import Twilio service
      const twilioSIPService = (await import('../twilio/sip.service')).default;

      if (!twilioSIPService.isConfigured()) {
        throw new Error('Twilio is not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env');
      }

      // If no phone number provided, call the Twilio number itself (will fail but test the flow)
      // Or better: create a test session without actual call for quick testing
      if (!phoneNumber) {
        // Quick test - just generate greeting and save to database
        const testCallSid = `test_${uuidv4()}`;
        const { data: callSession, error } = await this.supabase
          .from('call_sessions')
          .insert({
            user_id: userId,
            status: 'active',
            direction: 'inbound',
            caller_number: 'test-user',
            callee_number: config.twilio.phoneNumber,
            channel_id: testCallSid,
          })
          .select()
          .single();

        if (error) {
          logger.error('Failed to create test call session:', error);
          throw error;
        }

        // Generate greeting audio
        const greetingAudioUrl = await this.generateAndSaveAudio(
          this.DEFAULT_GREETING,
          callSession.id,
          'greeting'
        );

        // Save greeting message
        await this.saveMessage(callSession.id, 'ai', this.DEFAULT_GREETING, greetingAudioUrl);

        // Generate a sample user response for testing
        const testUserMessage = "Hello, I'm testing the AI assistant.";
        await this.saveMessage(callSession.id, 'user', testUserMessage);

        // Generate AI response
        const aiResponse = await gptService.generateResponse(testUserMessage, [
          { role: 'assistant', content: this.DEFAULT_GREETING },
          { role: 'user', content: testUserMessage },
        ]);

        // Generate AI response audio
        const responseAudioUrl = await this.generateAndSaveAudio(
          aiResponse.text,
          callSession.id,
          'response'
        );

        // Save AI response
        await this.saveMessage(callSession.id, 'ai', aiResponse.text, responseAudioUrl);

        // Mark call as ended
        await this.supabase
          .from('call_sessions')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
          })
          .eq('id', callSession.id);

        logger.info('Test inbound call completed (quick test)', {
          callSessionId: callSession.id,
        });

        return {
          callSessionId: callSession.id,
          callSid: testCallSid,
          message: 'Test completed! Check call history to see the greeting and AI response.',
        };
      }

      // Full test - make actual Twilio call
      // Create call session first
      const { data: callSession, error } = await this.supabase
        .from('call_sessions')
        .insert({
          user_id: userId,
          status: 'ringing',
          direction: 'outbound', // We're calling out to test
          caller_number: config.twilio.phoneNumber,
          callee_number: phoneNumber,
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create test call session:', error);
        throw error;
      }

      // Make the actual Twilio call
      const call = await twilioSIPService.makeCall(phoneNumber, undefined, callSession.id);

      // Update session with call SID
      await this.supabase
        .from('call_sessions')
        .update({ channel_id: call.sid })
        .eq('id', callSession.id);

      logger.info('Test call initiated', {
        callSessionId: callSession.id,
        callSid: call.sid,
        to: phoneNumber,
      });

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
