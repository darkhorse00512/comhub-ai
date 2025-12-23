import sttService from './stt.service';
import gptService, { ChatMessage } from './gpt.service';
import ttsService, { TTSVoice } from './tts.service';
import logger from '../../utils/logger';

export interface AIPipelineOptions {
  voice?: TTSVoice;
  conversationHistory?: ChatMessage[];
  streaming?: boolean;
}

export interface AIPipelineResult {
  transcribedText: string;
  aiResponse: string;
  audioBuffer?: Buffer;
  audioFilePath?: string;
}

class AIPipelineService {
  async processAudioToAudioResponse(
    audioInput: string | Buffer,
    callId: string,
    options: AIPipelineOptions = {}
  ): Promise<AIPipelineResult> {
    try {
      logger.info('Starting AI pipeline processing', { callId });

      let transcribedText: string;
      if (typeof audioInput === 'string') {
        transcribedText = await sttService.transcribeAudio(audioInput);
      } else {
        transcribedText = await sttService.transcribeAudioBuffer(audioInput);
      }

      logger.info('Audio transcribed', {
        callId,
        text: transcribedText.substring(0, 100),
      });

      if (!transcribedText || transcribedText.trim().length === 0) {
        logger.warn('Empty transcription received', { callId });
        return {
          transcribedText: '',
          aiResponse: '',
        };
      }

      const aiResponse = await gptService.generateResponse(
        transcribedText,
        options.conversationHistory || []
      );

      logger.info('AI response generated', {
        callId,
        response: aiResponse.text.substring(0, 100),
      });

      const audioFilePath = await ttsService.generateAudioForCall(
        aiResponse.text,
        callId
      );

      logger.info('AI pipeline completed successfully', {
        callId,
        audioFilePath,
      });

      return {
        transcribedText,
        aiResponse: aiResponse.text,
        audioFilePath,
      };
    } catch (error) {
      logger.error('AI pipeline processing failed:', error);
      throw new Error(`AI pipeline failed: ${error}`);
    }
  }

  async processTextToAudioResponse(
    text: string,
    callId: string,
    options: AIPipelineOptions = {}
  ): Promise<AIPipelineResult> {
    try {
      logger.info('Processing text to audio response', {
        callId,
        text: text.substring(0, 100),
      });

      const aiResponse = await gptService.generateResponse(
        text,
        options.conversationHistory || []
      );

      logger.info('AI response generated', {
        callId,
        response: aiResponse.text.substring(0, 100),
      });

      const audioFilePath = await ttsService.generateAudioForCall(
        aiResponse.text,
        callId
      );

      logger.info('Text to audio pipeline completed', {
        callId,
        audioFilePath,
      });

      return {
        transcribedText: text,
        aiResponse: aiResponse.text,
        audioFilePath,
      };
    } catch (error) {
      logger.error('Text to audio pipeline failed:', error);
      throw new Error(`Text to audio pipeline failed: ${error}`);
    }
  }

  async processStreamingResponse(
    userMessage: string,
    options: AIPipelineOptions = {},
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    try {
      logger.info('Processing streaming AI response');

      const aiResponse = await gptService.generateStreamingResponse(
        userMessage,
        options.conversationHistory || [],
        onChunk
      );

      return aiResponse.text;
    } catch (error) {
      logger.error('Streaming response pipeline failed:', error);
      throw new Error(`Streaming pipeline failed: ${error}`);
    }
  }

  async transcribeOnly(audioInput: string | Buffer): Promise<string> {
    try {
      if (typeof audioInput === 'string') {
        return await sttService.transcribeAudio(audioInput);
      } else {
        return await sttService.transcribeAudioBuffer(audioInput);
      }
    } catch (error) {
      logger.error('Transcription failed:', error);
      throw error;
    }
  }

  async generateResponseOnly(
    text: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<string> {
    try {
      const response = await gptService.generateResponse(text, conversationHistory);
      return response.text;
    } catch (error) {
      logger.error('Response generation failed:', error);
      throw error;
    }
  }

  async synthesizeSpeechOnly(text: string, callId: string): Promise<string> {
    try {
      return await ttsService.generateAudioForCall(text, callId);
    } catch (error) {
      logger.error('Speech synthesis failed:', error);
      throw error;
    }
  }
}

export const aiPipelineService = new AIPipelineService();
export default aiPipelineService;
