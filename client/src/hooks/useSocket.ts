import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./useAuth";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

interface BulkCallUpdate {
  job: {
    id: string;
    status: string;
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    activeCalls: number;
    results: any[];
    startedAt: string | null;
    endedAt: string | null;
  };
}

interface UseSocketReturn {
  isConnected: boolean;
  messages: Message[];
  socket: Socket | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (content: string, callSessionId?: string) => void;
  sendAudio: (audioData: ArrayBuffer, callSessionId: string) => void;
  clearMessages: () => void;
  subscribeToBulkJob: (jobId: string, onUpdate: (data: BulkCallUpdate) => void) => () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const WS_URL = import.meta.env.VITE_WS_URL || API_BASE_URL.replace(/^https?:\/\//, "").replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://");

export const useSocket = (): UseSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) return;
    if (!user?.id) {
      console.warn("Cannot connect socket: user not authenticated");
      return;
    }

    socketRef.current = io(WS_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socketRef.current.on("connect", () => {
      console.log("Socket connected");
      setIsConnected(true);
      
      // Authenticate with backend
      socketRef.current?.emit("authenticate", { userId: user.id });
    });

    socketRef.current.on("authenticated", (data: { success: boolean; userId: string }) => {
      console.log("Socket authenticated", data);
    });

    socketRef.current.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    // Backend emits: call:message with role and content
    socketRef.current.on("call:message", (data: { callSessionId: string; role: "user" | "ai"; content: string }) => {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        role: data.role,
        content: data.content,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
    });

    // Backend emits: call:ai-response
    socketRef.current.on("call:ai-response", (data: { callSessionId: string; text: string; audioUrl?: string }) => {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        role: "ai",
        content: data.text,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
    });

    // Backend emits: call:transcription
    socketRef.current.on("call:transcription", (data: { callSessionId: string; text: string }) => {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: data.text,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
    });

    // Legacy event names for compatibility
    socketRef.current.on("ai_message", (data: { content: string }) => {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        role: "ai",
        content: data.content,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
    });

    socketRef.current.on("transcript", (data: { content: string }) => {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: data.content,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
    });

    socketRef.current.on("call:error", (data: { error: string; details?: string }) => {
      console.error("Call error:", data);
    });

    socketRef.current.on("call:status", (data: { callSessionId: string; status: string }) => {
      console.log("Call status:", data);
    });
  }, [user?.id]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const sendMessage = useCallback((content: string, callSessionId?: string) => {
    if (socketRef.current?.connected) {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
      
      if (callSessionId) {
        socketRef.current.emit("call:message", { callSessionId, message: content });
      } else {
        socketRef.current.emit("user_message", { content });
      }
    }
  }, []);

  const sendAudio = useCallback((audioData: ArrayBuffer, callSessionId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("call:audio", {
        callSessionId,
        audioData: Array.from(new Uint8Array(audioData)),
      });
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const subscribeToBulkJob = useCallback((jobId: string, onUpdate: (data: BulkCallUpdate) => void): (() => void) => {
    if (!socketRef.current?.connected) {
      console.warn("Cannot subscribe to bulk job: socket not connected");
      return () => {};
    }

    // Subscribe to the job room
    socketRef.current.emit("bulk-call:subscribe", { jobId });

    // Listen for updates
    const handleUpdate = (data: BulkCallUpdate) => {
      if (data.job.id === jobId) {
        onUpdate(data);
      }
    };

    socketRef.current.on("bulk-call:update", handleUpdate);

    // Return unsubscribe function
    return () => {
      if (socketRef.current) {
        socketRef.current.emit("bulk-call:unsubscribe", { jobId });
        socketRef.current.off("bulk-call:update", handleUpdate);
      }
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user?.id, connect, disconnect]);

  return {
    isConnected,
    messages,
    socket: socketRef.current,
    connect,
    disconnect,
    sendMessage,
    sendAudio,
    clearMessages,
    subscribeToBulkJob,
  };
};
