import OpenAI from 'openai';
import config from '../../config';
import logger from '../../utils/logger';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

class TTSService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async textToSpeech(
    text: string,
    voice: TTSVoice = config.openai.ttsVoice as TTSVoice
  ): Promise<Buffer> {
    try {
      logger.info('Converting text to speech', {
        textLength: text.length,
        voice,
      });

      const mp3 = await this.openai.audio.speech.create({
        model: config.openai.ttsModel,
        voice,
        input: text,
        response_format: 'mp3',
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
    voice: TTSVoice = config.openai.ttsVoice as TTSVoice
  ): Promise<Readable> {
    try {
      logger.info('Converting text to speech (streaming)', {
        textLength: text.length,
        voice,
      });

      const mp3 = await this.openai.audio.speech.create({
        model: config.openai.ttsModel,
        voice,
        input: text,
        response_format: 'mp3',
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

  async generateAudioForCall(text: string, callId: string): Promise<string> {
    try {
      const recordingsDir = path.join(__dirname, '../../../recordings/tts');
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }

      const filename = `${callId}_${Date.now()}.mp3`;
      const outputPath = path.join(recordingsDir, filename);

      await this.textToSpeechFile(text, outputPath);

      return outputPath;
    } catch (error) {
      logger.error('Failed to generate audio for call:', error);
      throw error;
    }
  }
}

export const ttsService = new TTSService();
export default ttsService;
