/**
 * Streaming workflow service — handles real-time voice call streaming.
 *
 * Pipeline: User speech → Engine processes → TTS generated per-sentence → emit audio immediately
 *
 * Key optimization: TTS for each sentence starts in parallel. As soon as any
 * sentence's TTS completes, it's emitted to the client. The client queues and
 * plays them in order, so the first sentence starts playing as soon as its TTS
 * is ready (~0.5-1s) while later sentences are still generating.
 */

import { Socket } from 'socket.io';
import logger from '../utils/logger';
import { agentVoiceService, ResolvedVoiceSettings, TTSProviderError } from './agent-voice.service';
import { WorkflowEngine, WorkflowMessage } from './workflow-engine.service';

interface StreamingSession {
  engine: WorkflowEngine;
  agentId: string;
  userId: string;
  voiceSettings: ResolvedVoiceSettings | null;
  nodes: any[];
  edges: any[];
  processing: boolean;
}

const streamingSessions = new Map<string, StreamingSession>();

/**
 * Generate TTS for a message and emit the audio via WebSocket.
 * Returns immediately — the caller doesn't wait for this to complete.
 */
async function generateAndEmitAudio(
  socket: Socket,
  msg: WorkflowMessage,
  voiceSettings: ResolvedVoiceSettings | null,
  index: number,
): Promise<void> {
  try {
    const audioBuffer = await agentVoiceService.generateTTS(msg.text, voiceSettings);
    socket.emit('workflow:audio', {
      text: msg.text,
      nodeLabel: msg.nodeLabel,
      audioBase64: audioBuffer.toString('base64'),
      type: msg.type,
      index,
    });
  } catch (ttsErr) {
    // For configured-provider failures (ElevenLabs / ComhubAI bad key/voice ID),
    // do NOT swallow — propagate so the call ends with a clear error to the user.
    if (ttsErr instanceof TTSProviderError) {
      throw ttsErr;
    }
    // OpenAI fallback path failures: emit empty audio so the loop continues.
    logger.warn('Streaming TTS failed (non-fatal)', {
      text: msg.text.substring(0, 50),
      error: ttsErr instanceof Error ? ttsErr.message : ttsErr,
    });
    socket.emit('workflow:audio', {
      text: msg.text,
      nodeLabel: msg.nodeLabel,
      audioBase64: null,
      type: msg.type,
      index,
    });
  }
}

/** Emit a fatal voice error and tear down the session. */
function emitFatalVoiceError(socket: Socket, sessionId: string | null, err: TTSProviderError): void {
  socket.emit('workflow:error', {
    fatal: true,
    code: 'TTS_PROVIDER_ERROR',
    provider: err.provider,
    voiceId: err.voiceId,
    status: err.status,
    error: err.message,
    hint: err.status === 401
      ? 'Open the agent Configure → Voice & Audio tab and update the API key.'
      : err.status === 404
      ? 'Open the agent Configure → Voice & Audio tab and verify the Voice ID.'
      : 'Check your voice provider configuration in the agent settings.',
  });
  if (sessionId) {
    streamingSessions.delete(sessionId);
  }
}

/**
 * Emit all messages from a workflow result with pipelined TTS.
 *
 * System messages are emitted immediately (no TTS needed).
 * Speakable messages (ai/scripted) get TTS generated in parallel.
 * Each audio chunk is emitted as soon as its TTS completes.
 * The client receives an `index` field to play them in the correct order.
 */
async function emitResultMessages(
  socket: Socket,
  messages: WorkflowMessage[],
  voiceSettings: ResolvedVoiceSettings | null,
  startIndex: number = 0,
): Promise<void> {
  // Emit system messages immediately
  for (const msg of messages) {
    if (msg.type === 'system') {
      socket.emit('workflow:system', { text: msg.text, nodeLabel: msg.nodeLabel });
    }
  }

  // Generate TTS for all speakable messages in parallel
  const speakable = messages.filter(m => m.type === 'ai' || m.type === 'scripted');
  if (speakable.length === 0) return;

  // Tell client how many audio messages to expect (for ordering)
  socket.emit('workflow:audio-start', { count: startIndex + speakable.length });

  // Fire ALL TTS generations in parallel — each emits as soon as ready
  await Promise.all(
    speakable.map((msg, idx) => generateAndEmitAudio(socket, msg, voiceSettings, startIndex + idx))
  );
}

/**
 * Process a user message through the workflow engine with streaming output.
 */
export async function handleStreamingMessage(
  socket: Socket,
  sessionId: string,
  message: string,
): Promise<void> {
  const session = streamingSessions.get(sessionId);
  if (!session) {
    socket.emit('workflow:error', { error: 'Session not found', sessionId });
    return;
  }

  // Prevent concurrent processing
  if (session.processing) {
    socket.emit('workflow:system', { text: 'Still processing, please wait' });
    return;
  }
  session.processing = true;

  const startMs = Date.now();

  try {
    // Process through workflow engine (LLM + transition logic)
    const result = await session.engine.processMessage(message);

    // Emit dialogue response immediately — client starts playing
    await emitResultMessages(socket, result.messages, session.voiceSettings, 0);

    let finalResult = result;

    // If transition is pending, execute it and emit those messages too
    if (result.transitionPending) {
      const mainSpeakableCount = result.messages.filter(
        m => m.type === 'ai' || m.type === 'scripted'
      ).length;

      const transitionResult = await session.engine.executePendingTransition();
      if (transitionResult) {
        // Emit transition messages with indices continuing from main messages
        await emitResultMessages(socket, transitionResult.messages, session.voiceSettings, mainSpeakableCount);
        finalResult = transitionResult;
      }
    }

    // Emit completion signal — send immediately so client can end the call
    socket.emit('workflow:done', {
      isComplete: finalResult.isComplete,
      waitingForInput: finalResult.waitingForInput,
      currentStage: finalResult.currentStage,
      collectedFields: finalResult.isComplete ? undefined : session.engine.getFields(),
      processingMs: Date.now() - startMs,
    });

    if (finalResult.isComplete) {
      // Perform post-call analysis AFTER emitting done (call ends first, then analysis)
      try {
        const analysisFields = await session.engine.performPostCallAnalysis();
        socket.emit('workflow:analysis', {
          collectedFields: analysisFields,
        });
      } catch (err) {
        logger.error('Post-call analysis failed in streaming session', {
          sessionId,
          error: err instanceof Error ? err.message : err,
        });
        // Still emit analysis with whatever fields we have
        socket.emit('workflow:analysis', {
          collectedFields: session.engine.getFields(),
        });
      }
      streamingSessions.delete(sessionId);
    }

  } catch (error) {
    if (error instanceof TTSProviderError) {
      logger.error('Voice provider error during call — ending call', {
        sessionId,
        provider: error.provider,
        status: error.status,
        message: error.message,
      });
      emitFatalVoiceError(socket, sessionId, error);
      return;
    }
    logger.error('Streaming workflow message failed', {
      sessionId,
      error: error instanceof Error ? error.message : error,
    });
    socket.emit('workflow:error', {
      error: error instanceof Error ? error.message : 'Processing failed',
    });
  } finally {
    if (streamingSessions.has(sessionId)) {
      session.processing = false;
    }
  }
}

/**
 * Start a new streaming workflow session.
 */
export async function startStreamingSession(
  socket: Socket,
  agentId: string,
  userId: string,
  nodes: any[],
  edges: any[],
  direction: 'inbound' | 'outbound',
  agentAiModel?: string,
): Promise<string | null> {
  try {
    const engine = new WorkflowEngine(nodes, edges, undefined, agentAiModel);
    const result = await engine.start(direction);

    const sessionId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Resolve voice settings
    const voiceSettings = await agentVoiceService.resolveVoiceSettings(agentId);

    const session: StreamingSession = {
      engine,
      agentId,
      userId,
      voiceSettings,
      nodes,
      edges,
      processing: false,
    };
    streamingSessions.set(sessionId, session);

    // Pipeline: emit system messages + generate TTS in parallel
    await emitResultMessages(socket, result.messages, voiceSettings);

    // Emit session ready
    socket.emit('workflow:started', {
      sessionId,
      isComplete: result.isComplete,
      waitingForInput: result.waitingForInput,
      currentStage: result.currentStage,
      voiceInfo: {
        provider: voiceSettings?.ttsProvider || 'openai',
        voiceId: voiceSettings?.elevenlabsVoiceId,
        model: voiceSettings?.elevenlabsModel,
        language: voiceSettings?.language,
      },
    });

    return sessionId;
  } catch (error) {
    if (error instanceof TTSProviderError) {
      logger.error('Voice provider error during session start — call cannot begin', {
        agentId,
        provider: error.provider,
        status: error.status,
        message: error.message,
      });
      emitFatalVoiceError(socket, null, error);
      return null;
    }
    logger.error('Failed to start streaming session', {
      agentId,
      error: error instanceof Error ? error.message : error,
    });
    socket.emit('workflow:error', {
      error: error instanceof Error ? error.message : 'Failed to start session',
    });
    return null;
  }
}

/**
 * End a streaming session.
 */
export function endStreamingSession(sessionId: string): Record<string, any> {
  const session = streamingSessions.get(sessionId);
  const fields = session?.engine.getFields() || {};
  streamingSessions.delete(sessionId);
  return fields;
}

export default {
  handleStreamingMessage,
  startStreamingSession,
  endStreamingSession,
};
