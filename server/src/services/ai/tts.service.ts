import OpenAI from 'openai';
import axios from 'axios';
import config from '../../config';
import logger from '../../utils/logger';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import storageService from '../storage.service';

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface ElevenLabsTTSOptions {
  apiKey: string;
  voiceId: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  speed?: number;
}

function buildElevenLabsVoiceSettings(options: ElevenLabsTTSOptions) {
  const vs: Record<string, unknown> = {
    stability: typeof options.stability === 'number' ? options.stability : 0.5,
    similarity_boost: typeof options.similarityBoost === 'number' ? options.similarityBoost : 0.75,
  };
  if (typeof options.style === 'number') vs.style = options.style;
  if (typeof options.useSpeakerBoost === 'boolean') vs.use_speaker_boost = options.useSpeakerBoost;
  if (typeof options.speed === 'number') vs.speed = options.speed;
  return vs;
}

class TTSService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async textToSpeech(
    text: string,
    voice: TTSVoice = config.openai.ttsVoice as TTSVoice,
    speed?: number,
  ): Promise<Buffer> {
    try {
      logger.info('Converting text to speech', {
        textLength: text.length,
        voice,
        speed,
      });

      const mp3 = await this.openai.audio.speech.create({
        model: config.openai.ttsModel,
        voice,
        input: text,
        response_format: 'mp3',
        ...(typeof speed === 'number' ? { speed } : {}),
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());

      logger.info('Text converted to speech successfully', {
        bufferSize: buffer.length,
      });

      return buffer;
    } catch (error) {
      logger.error('Failed to convert text to speech:', error);
      throw new Error(`TTS conversion failed: ${error}`);
    }
  }

  async textToSpeechStream(
    text: string,
    voice: TTSVoice = config.openai.ttsVoice as TTSVoice,
    speed?: number,
  ): Promise<Readable> {
    try {
      logger.info('Converting text to speech (streaming)', {
        textLength: text.length,
        voice,
        speed,
      });

      const mp3 = await this.openai.audio.speech.create({
        model: config.openai.ttsModel,
        voice,
        input: text,
        response_format: 'mp3',
        ...(typeof speed === 'number' ? { speed } : {}),
      });

      const stream = Readable.from(mp3.body as any);

      logger.info('Text to speech stream created successfully');

      return stream;
    } catch (error) {
      logger.error('Failed to create text to speech stream:', error);
      throw new Error(`TTS streaming failed: ${error}`);
    }
  }

  async textToSpeechFile(
    text: string,
    outputPath: string,
    voice: TTSVoice = config.openai.ttsVoice as TTSVoice
  ): Promise<string> {
    try {
      logger.info('Converting text to speech file', {
        textLength: text.length,
        voice,
        outputPath,
      });

      const mp3 = await this.openai.audio.speech.create({
        model: config.openai.ttsModel,
        voice,
        input: text,
        response_format: 'mp3',
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());

      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(outputPath, buffer);

      logger.info('Text to speech file created successfully', {
        outputPath,
        fileSize: buffer.length,
      });

      return outputPath;
    } catch (error) {
      logger.error('Failed to create text to speech file:', error);
      throw new Error(`TTS file creation failed: ${error}`);
    }
  }

  async elevenlabsTextToSpeech(
    text: string,
    options: ElevenLabsTTSOptions
  ): Promise<Buffer> {
    try {
      logger.info('Converting text to speech via ElevenLabs (streaming endpoint)', {
        textLength: text.length,
        voiceId: options.voiceId,
        model: options.model || 'eleven_turbo_v2_5',
      });

      // Use the /stream endpoint — it returns audio chunks as they're generated.
      // First audio chunk arrives ~100-200ms faster than the batch endpoint.
      // We collect all chunks into a Buffer for the HTTP response.
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${options.voiceId}/stream?optimize_streaming_latency=4&output_format=mp3_22050_32`,
        {
          text,
          model_id: options.model || 'eleven_turbo_v2_5',
          voice_settings: buildElevenLabsVoiceSettings(options),
        },
        {
          headers: {
            'xi-api-key': options.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          responseType: 'stream',
        }
      );

      // Collect stream chunks into a Buffer
      const chunks: Buffer[] = [];
      const stream = response.data as Readable;
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      logger.info('ElevenLabs TTS (stream) completed successfully', {
        bufferSize: buffer.length,
      });

      return buffer;
    } catch (error) {
      logger.error('Failed to convert text to speech via ElevenLabs:', error);
      throw new Error(`ElevenLabs TTS conversion failed: ${error}`);
    }
  }

  /**
   * ElevenLabs streaming TTS with early callback.
   * Fires onFirstChunk as soon as the first audio data arrives (~100-200ms),
   * then continues collecting. Returns the full Buffer when done.
   * This allows the caller to start processing audio before TTS completes.
   */
  async elevenlabsTextToSpeechWithEarlyCallback(
    text: string,
    options: ElevenLabsTTSOptions,
    onFirstChunk?: (partialBuffer: Buffer) => void,
  ): Promise<Buffer> {
    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${options.voiceId}/stream?optimize_streaming_latency=4&output_format=mp3_22050_32`,
        {
          text,
          model_id: options.model || 'eleven_turbo_v2_5',
          voice_settings: buildElevenLabsVoiceSettings(options),
        },
        {
          headers: {
            'xi-api-key': options.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          responseType: 'stream',
        }
      );

      const chunks: Buffer[] = [];
      const stream = response.data as Readable;
      let firstFired = false;

      for await (const chunk of stream) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(buf);

        // Fire callback on first chunk — caller can start sending to client
        if (!firstFired && onFirstChunk) {
          firstFired = true;
          onFirstChunk(buf);
        }
      }

      return Buffer.concat(chunks);
    } catch (error) {
      logger.error('Failed ElevenLabs TTS with early callback:', error);
      throw new Error(`ElevenLabs TTS streaming failed: ${error}`);
    }
  }

  /**
   * ElevenLabs streaming TTS - returns a readable stream for low-latency piping.
   * Uses /stream endpoint which sends audio chunks as they're generated.
   */
  async elevenlabsTextToSpeechStream(
    text: string,
    options: ElevenLabsTTSOptions
  ): Promise<Readable> {
    try {
      logger.info('Streaming text to speech via ElevenLabs', {
        textLength: text.length,
        voiceId: options.voiceId,
        model: options.model || 'eleven_turbo_v2_5',
      });

      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${options.voiceId}/stream?optimize_streaming_latency=4&output_format=mp3_22050_32`,
        {
          text,
          model_id: options.model || 'eleven_turbo_v2_5',
          voice_settings: buildElevenLabsVoiceSettings(options),
        },
        {
          headers: {
            'xi-api-key': options.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          responseType: 'stream',
        }
      );

      logger.info('ElevenLabs TTS stream started');
      return response.data as Readable;
    } catch (error) {
      logger.error('Failed to stream text to speech via ElevenLabs:', error);
      throw new Error(`ElevenLabs TTS streaming failed: ${error}`);
    }
  }

  async generateAudioForCall(text: string, callId: string): Promise<string> {
    try {
      // Generate audio buffer
      const audioBuffer = await this.textToSpeech(text);

      // Upload to Supabase Storage and get public URL
      const publicUrl = await storageService.uploadAudio(audioBuffer, callId, 'tts');

      logger.info('Audio generated and uploaded to Supabase', { callId, url: publicUrl });

      return publicUrl;
    } catch (error) {
      logger.error('Failed to generate audio for call:', error);
      throw error;
    }
  }
}

export const ttsService = new TTSService();
export default ttsService;
