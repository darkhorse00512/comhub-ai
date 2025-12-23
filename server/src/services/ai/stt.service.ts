import OpenAI from 'openai';
import config from '../../config';
import logger from '../../utils/logger';
import fs from 'fs';
import FormData from 'form-data';

class STTService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

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
