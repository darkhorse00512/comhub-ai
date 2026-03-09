import OpenAI from 'openai';
import config from '../../config';
import logger from '../../utils/logger';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

class GPTService {
  private openai: OpenAI;
  private systemPrompt: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    this.systemPrompt = `You are a helpful AI assistant in a phone call.
Your responses should be:
- Concise and natural for voice conversation
- Clear and easy to understand when spoken aloud
- Friendly and professional
- Brief (1-3 sentences unless more detail is specifically requested)
- Focused on the user's questions and needs

Remember you are in a real-time voice conversation, so keep responses conversational and to the point.`;
  }

  async generateResponse(
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
    options?: { voiceMode?: boolean }
  ): Promise<AIResponse> {
    try {
      logger.info('Generating AI response', {
        userMessage: userMessage.substring(0, 100),
        voiceMode: options?.voiceMode,
      });

      const messages: ChatMessage[] = [
        { role: 'system', content: this.systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];

      // Voice mode: use faster model + shorter responses for real-time conversation
      const model = options?.voiceMode ? 'gpt-4o-mini' : config.openai.model;
      const maxTokens = options?.voiceMode ? 150 : 500;

      const completion = await this.openai.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens,
      });

      const aiMessage = completion.choices[0]?.message?.content || '';

      logger.info('AI response generated', {
        response: aiMessage.substring(0, 100),
        usage: completion.usage,
      });

      return {
        text: aiMessage,
        usage: completion.usage
          ? {
              promptTokens: completion.usage.prompt_tokens,
              completionTokens: completion.usage.completion_tokens,
              totalTokens: completion.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Failed to generate AI response:', error);
      throw new Error(`GPT generation failed: ${error}`);
    }
  }

  async generateStreamingResponse(
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
    onChunk?: (chunk: string) => void
  ): Promise<AIResponse> {
    try {
      logger.info('Generating streaming AI response');

      const messages: ChatMessage[] = [
        { role: 'system', content: this.systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];

      const stream = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages,
        temperature: 0.7,
        max_tokens: 500,
        stream: true,
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          if (onChunk) {
            onChunk(content);
          }
        }
      }

      logger.info('Streaming AI response completed', {
        response: fullResponse.substring(0, 100),
      });

      return {
        text: fullResponse,
      };
    } catch (error) {
      logger.error('Failed to generate streaming AI response:', error);
      throw new Error(`GPT streaming generation failed: ${error}`);
    }
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    logger.info('System prompt updated');
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Generate a response using full conversation history with a custom system prompt.
   * Used by WorkflowEngine for multi-turn dialogue stages.
   */
  async generateWithHistory(
    conversationHistory: ChatMessage[],
    options?: {
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<AIResponse> {
    try {
      logger.info('Generating AI response with history', {
        messageCount: conversationHistory.length,
        maxTokens: options?.maxTokens || 500,
      });

      const completion = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: conversationHistory,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens || 500,
      });

      const aiMessage = completion.choices[0]?.message?.content || '';

      logger.info('AI response with history generated', {
        response: aiMessage.substring(0, 200),
        usage: completion.usage,
      });

      return {
        text: aiMessage,
        usage: completion.usage
          ? {
              promptTokens: completion.usage.prompt_tokens,
              completionTokens: completion.usage.completion_tokens,
              totalTokens: completion.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Failed to generate AI response with history:', error);
      throw new Error(`GPT generation failed: ${error}`);
    }
  }

  /**
   * Generate a response with a custom system prompt (doesn't use the default one)
   * Useful for specialized tasks like workflow generation
   */
  async generateWithCustomPrompt(
    userMessage: string,
    customSystemPrompt: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<AIResponse> {
    try {
      logger.info('Generating AI response with custom prompt', {
        userMessage: userMessage.substring(0, 100),
        maxTokens: options?.maxTokens || 4000
      });

      const messages: ChatMessage[] = [
        { role: 'system', content: customSystemPrompt },
        { role: 'user', content: userMessage },
      ];

      const completion = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens || 4000,
      });

      const aiMessage = completion.choices[0]?.message?.content || '';

      logger.info('AI response with custom prompt generated', {
        response: aiMessage.substring(0, 200),
        usage: completion.usage,
      });

      return {
        text: aiMessage,
        usage: completion.usage
          ? {
              promptTokens: completion.usage.prompt_tokens,
              completionTokens: completion.usage.completion_tokens,
              totalTokens: completion.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Failed to generate AI response with custom prompt:', error);
      throw new Error(`GPT generation failed: ${error}`);
    }
  }
}

export const gptService = new GPTService();
export default gptService;
