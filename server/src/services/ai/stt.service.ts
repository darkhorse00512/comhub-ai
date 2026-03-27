import OpenAI from 'openai';
import axios from 'axios';
import config from '../../config';
import logger from '../../utils/logger';
import fs from 'fs';
import FormData from 'form-data';

export interface STTResult {
  text: string;
  language?: string;
  durationMs?: number;
  provider: 'elevenlabs' | 'openai';
}

class STTService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  /**
   * Transcribe audio using ElevenLabs Scribe v2.
   * Accepts raw audio buffer (webm/ogg/mp3/wav).
   * Much more accurate than browser SpeechRecognition.
   */
  async elevenlabsTranscribe(
    audioBuffer: Buffer,
    apiKey: string,
    options?: {
      languageCode?: string;
      fileName?: string;
      contentType?: string;
    }
  ): Promise<STTResult> {
    const startMs = Date.now();

    try {
      const form = new FormData();
      form.append('file', audioBuffer, {
        filename: options?.fileName || 'audio.webm',
        contentType: options?.contentType || 'audio/webm',
      });
      form.append('model_id', 'scribe_v2');
      if (options?.languageCode) {
        form.append('language_code', options.languageCode);
      }

      const response = await axios.post(
        'https://api.elevenlabs.io/v1/speech-to-text',
        form,
        {
          headers: {
            'xi-api-key': apiKey,
            ...form.getHeaders(),
          },
          timeout: 15000,
        }
      );

      const durationMs = Date.now() - startMs;
      const text = (response.data?.text || '').trim();

      logger.info('ElevenLabs STT completed', {
        textLength: text.length,
        text: text.substring(0, 100),
        language: response.data?.language_code,
        durationMs,
      });

      return {
        text,
        language: response.data?.language_code,
        durationMs,
        provider: 'elevenlabs',
      };
    } catch (error) {
      const durationMs = Date.now() - startMs;
      logger.error('ElevenLabs STT failed', {
        error: error instanceof Error ? error.message : error,
        status: (error as any)?.response?.status,
        durationMs,
      });
      throw new Error(
        `ElevenLabs STT failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  // --- Legacy OpenAI Whisper methods ---

  async transcribeAudio(audioFilePath: string): Promise<string> {
    try {
      logger.info('Transcribing audio file', { audioFilePath });

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: config.openai.whisperModel,
        language: 'en',
      });

      logger.info('Audio transcribed successfully', {
        text: transcription.text.substring(0, 100),
      });

      return transcription.text;
    } catch (error) {
      logger.error('Failed to transcribe audio:', error);
      throw new Error(`STT transcription failed: ${error}`);
    }
  }

  async transcribeAudioBuffer(audioBuffer: Buffer, filename: string = 'audio.wav'): Promise<string> {
    try {
      logger.info('Transcribing audio buffer', { size: audioBuffer.length });

      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename,
        contentType: 'audio/wav',
      });
      formData.append('model', config.openai.whisperModel);
      formData.append('language', 'en');

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(filename),
        model: config.openai.whisperModel,
      });

      logger.info('Audio buffer transcribed successfully');

      return transcription.text;
    } catch (error) {
      logger.error('Failed to transcribe audio buffer:', error);
      throw new Error(`STT transcription failed: ${error}`);
    }
  }

  async transcribeStream(audioStream: NodeJS.ReadableStream): Promise<string> {
    try {
      logger.info('Transcribing audio stream');

      const transcription = await this.openai.audio.transcriptions.create({
        file: audioStream as any,
        model: config.openai.whisperModel,
        language: 'en',
      });

      logger.info('Audio stream transcribed successfully');

      return transcription.text;
    } catch (error) {
      logger.error('Failed to transcribe audio stream:', error);
      throw new Error(`STT transcription failed: ${error}`);
    }
  }
}

export const sttService = new STTService();
export default sttService;
