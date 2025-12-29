import { useState, useCallback, useRef } from "react";
import { api } from "@/services/api";

export type CallStatus = "idle" | "connecting" | "ringing" | "active" | "ended";

interface UseCallReturn {
  status: CallStatus;
  isMuted: boolean;
  duration: number;
  callSessionId: string | null;
  startCall: (phoneNumber?: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
}

export const useCall = (): UseCallReturn => {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const startCall = useCallback(async (phoneNumber?: string) => {
    try {
      setStatus("connecting");
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Start call via backend API
      const result = await api.startCall(phoneNumber);
      
      if (result.error || !result.data) {
        throw new Error(result.error || "Failed to start call");
      }

      const callId = result.data.callId || result.data.callSession?.id;
      if (!callId) {
        throw new Error("No call session ID returned");
      }

      setCallSessionId(callId);
      setStatus("ringing");
      
      // Simulate ringing, then go active
      setTimeout(() => {
        setStatus("active");
        startTimeRef.current = new Date();
        
        // Start duration timer
        timerRef.current = setInterval(() => {
          if (startTimeRef.current) {
            const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
            setDuration(elapsed);
          }
        }, 1000);
      }, 1500);
      
    } catch (error) {
      console.error("Failed to start call:", error);
      setStatus("idle");
      
      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      throw error;
    }
  }, []);

  const endCall = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // End call via backend API if we have a session ID
    if (callSessionId) {
      try {
        await api.endCall(callSessionId);
      } catch (error) {
        console.error("Error ending call on backend:", error);
      }
    }
    
    setStatus("ended");
    startTimeRef.current = null;
    
    setTimeout(() => {
      setStatus("idle");
      setDuration(0);
      setCallSessionId(null);
    }, 2000);
  }, [callSessionId]);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
    setIsMuted(prev => !prev);
  }, []);

  return {
    status,
    isMuted,
    duration,
    callSessionId,
    startCall,
    endCall,
    toggleMute,
  };
};
