import twilio from 'twilio';
import config from '../config';
import logger from '../utils/logger';
import ttsService from './ai/tts.service';
import sttService from './ai/stt.service';
import gptService, { ChatMessage } from './ai/gpt.service';
import getSupabaseClient from '../config/supabase';
import storageService from './storage.service';
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
}

class VoiceConversationService {
  private activeConversations: Map<string, ActiveConversation> = new Map();
  private supabase = getSupabaseClient();

  private readonly GREETING_MESSAGE = "Hey there! Here is ComHub AI. What can I help you with today?";
  private readonly SILENCE_TIMEOUT = 2; // seconds
  private readonly MAX_RECORDING_LENGTH = 30; // seconds

  async startInboundConversation(
    callSid: string,
    callerNumber: string,
    calleeNumber: string
  ): Promise<string> {
    try {
      // Create call session in database
      const { data: callSession, error } = await this.supabase
        .from('call_sessions')
        .insert({
          user_id: await this.getDefaultUserId(),
          status: 'active',
          direction: 'inbound',
          caller_number: callerNumber,
          callee_number: calleeNumber,
          channel_id: callSid,
        })
        .select()
        .single();

      if (error) throw error;

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
      };

      this.activeConversations.set(callSid, conversation);

      // Generate greeting audio
      const greetingAudioPath = await this.generateAndSaveAudio(
        this.GREETING_MESSAGE,
        callSession.id,
        'greeting'
      );

      // Save greeting message to database
      await this.saveMessage(callSession.id, 'ai', this.GREETING_MESSAGE, greetingAudioPath);
      conversation.history.push({ role: 'assistant', content: this.GREETING_MESSAGE });

      // Generate TwiML for greeting + recording
      const twiml = this.generateGreetingTwiML(greetingAudioPath);

      logger.info('Inbound conversation started', {
        callSid,
        callSessionId: callSession.id,
        callerNumber,
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
    userId: string
  ): Promise<string> {
    try {
      logger.info('=== STARTING OUTBOUND CONVERSATION ===', { callSid, calleeNumber, userId });

      // Create call session in database
      const { data: callSession, error } = await this.supabase
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

      logger.info('Call session created in database', { callSessionId: callSession.id });

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
      };

      this.activeConversations.set(callSid, conversation);

      // Generate greeting audio and upload to Supabase
      logger.info('Generating greeting audio...', { greeting: this.GREETING_MESSAGE });
      const greetingAudioUrl = await this.generateAndSaveAudio(
        this.GREETING_MESSAGE,
        callSession.id,
        'greeting'
      );
      logger.info('Greeting audio generated', { url: greetingAudioUrl });

      // Save greeting message to database
      await this.saveMessage(callSession.id, 'ai', this.GREETING_MESSAGE, greetingAudioUrl);
      conversation.history.push({ role: 'assistant', content: this.GREETING_MESSAGE });

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
          'retry'
        );

        await this.saveMessage(conversation.callSessionId, 'ai', retryMessage, retryAudioPath);

        return this.generatePlayAndRecordTwiML(retryAudioPath);
      }

      // Save user message
      await this.saveMessage(conversation.callSessionId, 'user', transcribedText);
      conversation.history.push({ role: 'user', content: transcribedText });

      logger.info('User said', { callSid, text: transcribedText });

      // Generate AI response
      const aiResponse = await gptService.generateResponse(transcribedText, conversation.history);

      // Generate audio for AI response
      const aiAudioPath = await this.generateAndSaveAudio(
        aiResponse.text,
        conversation.callSessionId,
        'response'
      );

      // Save AI response
      await this.saveMessage(conversation.callSessionId, 'ai', aiResponse.text, aiAudioPath);
      conversation.history.push({ role: 'assistant', content: aiResponse.text });

      logger.info('AI responded', { callSid, text: aiResponse.text.substring(0, 100) });

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
          'error'
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
    type: string
  ): Promise<string> {
    try {
      // Generate audio using TTS
      const audioBuffer = await ttsService.textToSpeech(text);

      // Upload to Supabase Storage and get public URL
      const publicUrl = await storageService.uploadAudio(audioBuffer, callSessionId, type);

      logger.info('Audio generated and uploaded', {
        callSessionId,
        type,
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
    // Get or create a default system user for inbound calls
    const { data: user, error } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', 'system@comhubai.com')
      .single();

    if (user) return user.id;

    // Create system user if doesn't exist
    const { data: newUser, error: createError } = await this.supabase
      .from('users')
      .insert({ email: 'system@comhubai.com' })
      .select()
      .single();

    if (createError) throw createError;
    return newUser.id;
  }
}

export const voiceConversationService = new VoiceConversationService();
export default voiceConversationService;
