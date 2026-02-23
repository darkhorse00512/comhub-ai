import getSupabaseClient from '../config/supabase';
import logger from '../utils/logger';
import ttsService, { TTSVoice } from './ai/tts.service';
import storageService from './storage.service';

export interface ResolvedVoiceSettings {
  ttsProvider: 'openai' | 'elevenlabs' | 'comhubai';
  openaiVoice?: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  elevenlabsModel?: string;
  language?: string;
}

class AgentVoiceService {
  private supabase = getSupabaseClient();

  /**
   * Resolve the voice settings for an agent, including looking up ComhubAI voice model credentials.
   * Reusable across test calls, production calls, and any future TTS needs.
   */
  async resolveVoiceSettings(agentId: string): Promise<ResolvedVoiceSettings | null> {
    try {
      const { data: agent, error } = await this.supabase
        .from('agents')
        .select('config')
        .eq('id', agentId)
        .single();

      if (error || !agent?.config?.settings) {
        return null;
      }

      const settings = agent.config.settings;
      const resolved: ResolvedVoiceSettings = {
        ttsProvider: settings.ttsProvider || 'openai',
        openaiVoice: settings.openaiVoice,
        elevenlabsApiKey: settings.elevenlabsApiKey,
        elevenlabsVoiceId: settings.elevenlabsVoiceId,
        language: settings.language,
      };

      // If ComhubAI voice, look up the voice model to get actual ElevenLabs credentials
      if (resolved.ttsProvider === 'comhubai' && settings.comhubaiVoiceModelId) {
        const { data: voiceModel } = await this.supabase
          .from('voice_models')
          .select('elevenlabs_api_key, elevenlabs_voice_id, model')
          .eq('id', settings.comhubaiVoiceModelId)
          .eq('is_active', true)
          .single();

        if (voiceModel) {
          resolved.elevenlabsApiKey = voiceModel.elevenlabs_api_key;
          resolved.elevenlabsVoiceId = voiceModel.elevenlabs_voice_id;
          resolved.elevenlabsModel = voiceModel.model;
        } else {
          logger.warn('ComhubAI voice model not found or inactive, falling back to default OpenAI', {
            agentId,
            voiceModelId: settings.comhubaiVoiceModelId,
          });
          resolved.ttsProvider = 'openai';
        }
      }

      return resolved;
    } catch (err) {
      logger.error('Failed to resolve agent voice settings', { agentId, error: err });
      return null;
    }
  }

  /**
   * Generate TTS audio buffer for the given text using the agent's configured voice.
   * Returns an audio Buffer (MP3 format).
   */
  async generateTTS(text: string, voiceSettings: ResolvedVoiceSettings | null): Promise<Buffer> {
    if (voiceSettings &&
        (voiceSettings.ttsProvider === 'comhubai' || voiceSettings.ttsProvider === 'elevenlabs') &&
        voiceSettings.elevenlabsApiKey && voiceSettings.elevenlabsVoiceId) {
      return ttsService.elevenlabsTextToSpeech(text, {
        apiKey: voiceSettings.elevenlabsApiKey,
        voiceId: voiceSettings.elevenlabsVoiceId,
        model: voiceSettings.elevenlabsModel,
      });
    }

    // Default: OpenAI TTS
    const voice = (voiceSettings?.openaiVoice as TTSVoice) || undefined;
    return ttsService.textToSpeech(text, voice);
  }

  /**
   * Generate TTS audio, upload to storage, and return the public URL.
   * Reusable for production calls.
   */
  async generateAndUploadTTS(
    text: string,
    callSessionId: string,
    type: string,
    voiceSettings: ResolvedVoiceSettings | null
  ): Promise<string> {
    const audioBuffer = await this.generateTTS(text, voiceSettings);
    const publicUrl = await storageService.uploadAudio(audioBuffer, callSessionId, type);
    return publicUrl;
  }
}

export const agentVoiceService = new AgentVoiceService();
export default agentVoiceService;
