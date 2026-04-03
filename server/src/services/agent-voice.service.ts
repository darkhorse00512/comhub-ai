import { Readable } from 'stream';
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

interface CachedVoiceSettings {
  settings: ResolvedVoiceSettings | null;
  expiresAt: number;
}

class AgentVoiceService {
  private supabase = getSupabaseClient();

  /** TTL cache for resolved voice settings (avoids repeated DB queries during a call) */
  private voiceSettingsCache = new Map<string, CachedVoiceSettings>();
  private readonly CACHE_TTL_MS = 60_000; // 60 seconds

  /**
   * Resolve the voice settings for an agent, including looking up ComhubAI voice model credentials.
   * Results are cached for 60s to avoid repeated DB queries during test calls.
   */
  async resolveVoiceSettings(agentId: string): Promise<ResolvedVoiceSettings | null> {
    // Check cache first
    const cached = this.voiceSettingsCache.get(agentId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.settings;
    }

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
        logger.info('Looking up ComhubAI voice model', {
          agentId,
          voiceModelId: settings.comhubaiVoiceModelId,
        });

        const { data: voiceModel, error: vmError } = await this.supabase
          .from('voice_models')
          .select('elevenlabs_api_key, elevenlabs_voice_id, model')
          .eq('id', settings.comhubaiVoiceModelId)
          .eq('is_active', true)
          .single();

        if (vmError) {
          logger.warn('Error fetching voice model from DB', {
            agentId,
            voiceModelId: settings.comhubaiVoiceModelId,
            error: vmError.message,
          });
        }

        if (voiceModel) {
          resolved.elevenlabsApiKey = voiceModel.elevenlabs_api_key;
          resolved.elevenlabsVoiceId = voiceModel.elevenlabs_voice_id;
          resolved.elevenlabsModel = voiceModel.model;
          logger.info('Voice model credentials resolved', {
            agentId,
            voiceModelId: settings.comhubaiVoiceModelId,
            hasApiKey: !!voiceModel.elevenlabs_api_key,
            voiceId: voiceModel.elevenlabs_voice_id,
            model: voiceModel.model,
          });
        } else {
          logger.warn('ComhubAI voice model not found or inactive, falling back to default OpenAI', {
            agentId,
            voiceModelId: settings.comhubaiVoiceModelId,
          });
          resolved.ttsProvider = 'openai';
        }
      }

      // Cache the resolved settings
      this.voiceSettingsCache.set(agentId, {
        settings: resolved,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });

      return resolved;
    } catch (err) {
      logger.error('Failed to resolve agent voice settings', { agentId, error: err });
      return null;
    }
  }

  /**
   * Generate TTS audio buffer for the given text using the agent's configured voice.
   * Returns an audio Buffer (MP3 format). Used by production calls that need to upload.
   */
  /** Track which provider was actually used for the last TTS call */
  public lastTTSProvider: string = 'openai';
  public lastTTSError: string | null = null;

  async generateTTS(
    text: string,
    voiceSettings: ResolvedVoiceSettings | null,
    onFirstChunk?: (partialBuffer: Buffer) => void,
  ): Promise<Buffer> {
    this.lastTTSError = null;

    if (voiceSettings &&
        (voiceSettings.ttsProvider === 'comhubai' || voiceSettings.ttsProvider === 'elevenlabs') &&
        voiceSettings.elevenlabsApiKey && voiceSettings.elevenlabsVoiceId) {
      try {
        logger.info('Generating TTS via ElevenLabs (streaming)', {
          provider: voiceSettings.ttsProvider,
          voiceId: voiceSettings.elevenlabsVoiceId,
          textLength: text.length,
        });
        const buffer = await ttsService.elevenlabsTextToSpeechWithEarlyCallback(
          text,
          {
            apiKey: voiceSettings.elevenlabsApiKey,
            voiceId: voiceSettings.elevenlabsVoiceId,
            model: 'eleven_turbo_v2_5',
          },
          onFirstChunk,
        );
        this.lastTTSProvider = voiceSettings.ttsProvider;
        return buffer;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error('ElevenLabs TTS failed, falling back to OpenAI', {
          error: errMsg,
          voiceId: voiceSettings.elevenlabsVoiceId,
        });
        this.lastTTSError = `ElevenLabs failed: ${errMsg}`;
      }
    }

    // Default / Fallback: OpenAI TTS
    this.lastTTSProvider = 'openai-fallback';
    const voice = (voiceSettings?.openaiVoice as TTSVoice) || undefined;
    return ttsService.textToSpeech(text, voice);
  }

  /**
   * Generate TTS as a streaming Readable. Used by the test-call endpoint
   * to pipe audio to the client for low-latency playback.
   * ElevenLabs streaming sends chunks as they're generated (much faster first byte).
   */
  async generateTTSStream(text: string, voiceSettings: ResolvedVoiceSettings | null): Promise<Readable> {
    if (voiceSettings &&
        (voiceSettings.ttsProvider === 'comhubai' || voiceSettings.ttsProvider === 'elevenlabs') &&
        voiceSettings.elevenlabsApiKey && voiceSettings.elevenlabsVoiceId) {
      try {
        return await ttsService.elevenlabsTextToSpeechStream(text, {
          apiKey: voiceSettings.elevenlabsApiKey,
          voiceId: voiceSettings.elevenlabsVoiceId,
          model: 'eleven_turbo_v2_5',
        });
      } catch (err) {
        logger.error('ElevenLabs TTS stream failed, falling back to OpenAI stream', {
          error: err instanceof Error ? err.message : err,
          voiceId: voiceSettings.elevenlabsVoiceId,
        });
        // Fall through to OpenAI
      }
    }

    const voice = (voiceSettings?.openaiVoice as TTSVoice) || undefined;
    return ttsService.textToSpeechStream(text, voice);
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
