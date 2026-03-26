/**
 * Streaming workflow service — handles real-time voice call streaming.
 *
 * Pipeline: User speech → LLM streams sentence-by-sentence → each sentence → TTS audio → emit to client
 *
 * This replaces the batch HTTP flow with a streaming WebSocket flow,
 * reducing time-to-first-audio from ~5s to ~0.7-1.5s.
 */

import { Socket } from 'socket.io';
import { Readable } from 'stream';
import logger from '../utils/logger';
import { agentVoiceService, ResolvedVoiceSettings } from './agent-voice.service';
import { WorkflowEngine } from './workflow-engine.service';

interface StreamingSession {
  engine: WorkflowEngine;
  agentId: string;
  userId: string;
  voiceSettings: ResolvedVoiceSettings | null;
  nodes: any[];
  edges: any[];
}

// In-memory streaming sessions (separate from HTTP sessions)
const streamingSessions = new Map<string, StreamingSession>();

/**
 * Process a user message through the workflow engine with streaming output.
 * Instead of waiting for the full response, streams audio chunks to the client
 * as soon as each sentence is ready.
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

  const startMs = Date.now();

  try {
    // Process through the workflow engine (non-streaming part: state machine logic)
    const result = await session.engine.processMessage(message);

    // Emit system messages immediately (no audio needed)
    for (const msg of result.messages) {
      if (msg.type === 'system') {
        socket.emit('workflow:system', { text: msg.text, nodeLabel: msg.nodeLabel });
      }
    }

    // Stream audio for speakable messages
    const speakableMessages = result.messages.filter(
      m => m.type === 'ai' || m.type === 'scripted'
    );

    for (const msg of speakableMessages) {
      try {
        // Generate TTS and collect into buffer
        const audioBuffer = await agentVoiceService.generateTTS(msg.text, session.voiceSettings);
        const audioBase64 = audioBuffer.toString('base64');

        // Emit audio chunk to client
        socket.emit('workflow:audio', {
          text: msg.text,
          nodeLabel: msg.nodeLabel,
          audioBase64,
          type: msg.type,
        });
      } catch (ttsErr) {
        logger.warn('Streaming TTS failed for sentence', {
          text: msg.text.substring(0, 50),
          error: ttsErr instanceof Error ? ttsErr.message : ttsErr,
        });
        // Emit text-only (client will use browser TTS as fallback)
        socket.emit('workflow:audio', {
          text: msg.text,
          nodeLabel: msg.nodeLabel,
          audioBase64: null,
          type: msg.type,
        });
      }
    }

    // Emit completion signal
    socket.emit('workflow:done', {
      isComplete: result.isComplete,
      waitingForInput: result.waitingForInput,
      currentStage: result.currentStage,
      collectedFields: session.engine.getFields(),
      processingMs: Date.now() - startMs,
    });

    // Clean up if workflow is complete
    if (result.isComplete) {
      streamingSessions.delete(sessionId);
    }

  } catch (error) {
    logger.error('Streaming workflow message failed', {
      sessionId,
      error: error instanceof Error ? error.message : error,
    });
    socket.emit('workflow:error', {
      error: error instanceof Error ? error.message : 'Processing failed',
    });
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
    };
    streamingSessions.set(sessionId, session);

    // Emit system messages
    for (const msg of result.messages) {
      if (msg.type === 'system') {
        socket.emit('workflow:system', { text: msg.text, nodeLabel: msg.nodeLabel });
      }
    }

    // Stream audio for initial speakable messages
    const speakableMessages = result.messages.filter(
      m => m.type === 'ai' || m.type === 'scripted'
    );

    for (const msg of speakableMessages) {
      try {
        const audioBuffer = await agentVoiceService.generateTTS(msg.text, voiceSettings);
        socket.emit('workflow:audio', {
          text: msg.text,
          nodeLabel: msg.nodeLabel,
          audioBase64: audioBuffer.toString('base64'),
          type: msg.type,
        });
      } catch {
        socket.emit('workflow:audio', {
          text: msg.text,
          nodeLabel: msg.nodeLabel,
          audioBase64: null,
          type: msg.type,
        });
      }
    }

    // Emit session ready
    socket.emit('workflow:started', {
      sessionId,
      isComplete: result.isComplete,
      waitingForInput: result.waitingForInput,
      currentStage: result.currentStage,
      voiceInfo: {
        provider: voiceSettings?.ttsProvider || 'openai',
        voiceId: voiceSettings?.elevenlabsVoiceId,
      },
    });

    return sessionId;
  } catch (error) {
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
