/**
 * Hook for streaming workflow voice calls via WebSocket.
 *
 * Events emitted to server:
 *   workflow:start   { agentId, direction }
 *   workflow:message  { sessionId, message }
 *   workflow:end      { sessionId }
 *
 * Events received from server:
 *   workflow:started  { sessionId, isComplete, waitingForInput, currentStage, voiceInfo }
 *   workflow:system   { text, nodeLabel }
 *   workflow:audio    { text, nodeLabel, audioBase64, type }
 *   workflow:done     { isComplete, waitingForInput, currentStage, collectedFields, processingMs }
 *   workflow:error    { error }
 *   workflow:ended    { collectedFields }
 */

import { useCallback, useRef, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./useAuth";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export interface WorkflowErrorDetails {
  fatal?: boolean;
  code?: string;
  provider?: string;
  voiceId?: string;
  status?: number;
  hint?: string;
}

export interface StreamAudioMessage {
  text: string;
  nodeLabel?: string;
  audioBase64: string | null;
  type: "ai" | "scripted";
  index: number;
}

interface UseWorkflowStreamOptions {
  onSystem?: (text: string, nodeLabel?: string) => void;
  onAudio?: (msg: StreamAudioMessage) => void;
  onDone?: (data: {
    isComplete: boolean;
    waitingForInput: boolean;
    currentStage: string | null;
    collectedFields?: Record<string, any>;
    processingMs?: number;
  }) => void;
  /** Fired after post-call analysis completes (summary + AI extraction), after the call has ended */
  onAnalysis?: (data: {
    collectedFields: Record<string, any>;
  }) => void;
  onError?: (error: string, details?: WorkflowErrorDetails) => void;
  onStarted?: (data: {
    sessionId: string;
    isComplete: boolean;
    waitingForInput: boolean;
    currentStage: string | null;
    voiceInfo?: Record<string, string>;
  }) => void;
  onConfig?: (data: {
    sttConfig: { apiKey: string; language: string };
    callSettings: Record<string, any>;
  }) => void;
}

export function useWorkflowStream(opts: UseWorkflowStreamOptions) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Store callbacks in refs so we don't reconnect on every render
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Connect socket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    if (!user?.id) return;

    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("authenticate", { userId: user.id });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Workflow streaming events
    socket.on("workflow:started", (data) => {
      sessionIdRef.current = data.sessionId;
      optsRef.current.onStarted?.(data);
    });

    socket.on("workflow:system", (data) => {
      optsRef.current.onSystem?.(data.text, data.nodeLabel);
    });

    socket.on("workflow:audio-start", () => {
      // Server is about to send audio messages — client can prepare
    });

    socket.on("workflow:audio", (data: StreamAudioMessage) => {
      optsRef.current.onAudio?.(data);
    });

    socket.on("workflow:done", (data) => {
      optsRef.current.onDone?.(data);
    });

    socket.on("workflow:analysis", (data) => {
      optsRef.current.onAnalysis?.(data);
    });

    socket.on("workflow:error", (data) => {
      optsRef.current.onError?.(data.error, {
        fatal: data.fatal,
        code: data.code,
        provider: data.provider,
        voiceId: data.voiceId,
        status: data.status,
        hint: data.hint,
      });
    });

    socket.on("workflow:config", (data) => {
      optsRef.current.onConfig?.(data);
    });

    socket.on("workflow:ended", (data) => {
      // Session ended (cleanup)
    });

    socketRef.current = socket;
  }, [user?.id]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (sessionIdRef.current && socketRef.current?.connected) {
      socketRef.current.emit("workflow:end", { sessionId: sessionIdRef.current });
    }
    sessionIdRef.current = null;
    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsConnected(false);
  }, []);

  // Start workflow
  const startWorkflow = useCallback(
    (agentId: string, direction: "inbound" | "outbound") => {
      if (!socketRef.current?.connected) {
        console.error("[useWorkflowStream] Not connected");
        return;
      }
      socketRef.current.emit("workflow:start", { agentId, direction });
    },
    []
  );

  // Send message — returns true if sent, false if no active streaming session
  const sendMessage = useCallback((message: string): boolean => {
    if (!socketRef.current?.connected || !sessionIdRef.current) {
      console.warn("[useWorkflowStream] Not connected or no session — falling back to HTTP");
      return false;
    }
    socketRef.current.emit("workflow:message", {
      sessionId: sessionIdRef.current,
      message,
    });
    return true;
  }, []);

  // End workflow
  const endWorkflow = useCallback(() => {
    if (socketRef.current?.connected && sessionIdRef.current) {
      socketRef.current.emit("workflow:end", { sessionId: sessionIdRef.current });
    }
    sessionIdRef.current = null;
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    sessionId: sessionIdRef.current,
    connect,
    disconnect,
    startWorkflow,
    sendMessage,
    endWorkflow,
  };
}
