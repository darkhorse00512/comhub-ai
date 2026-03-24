import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  PhoneIncoming,
  PhoneOutgoing,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
  Volume2,
  Loader2,
  Bot,
  User,
  MessageSquare,
  AudioLines,
  Info,
  AlertTriangle,
  History,
  ArrowLeft,
  RefreshCw,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { Node, Edge } from "@/components/FlowCanvas";
import CallResultsModal from "@/components/CallResultsModal";

interface AgentCallHistoryItem {
  id: string;
  status: "ringing" | "active" | "ended" | "failed";
  direction: "inbound" | "outbound";
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  collectedData: Record<string, any> | null;
}

interface CallMessageItem {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  audioUrl: string | null;
}

interface Message {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  timestamp: Date;
  nodeLabel?: string;
}

interface WorkflowMessage {
  type: "scripted" | "ai" | "system";
  text: string;
  nodeLabel?: string;
}

interface WorkflowCallResult {
  success: boolean;
  sessionId?: string;
  messages: WorkflowMessage[];
  waitingForInput: boolean;
  isComplete: boolean;
  currentStage: string | null;
  transferTo?: string;
  transferType?: string;
  error?: string;
  collectedFields?: Record<string, any>;
  callSettings?: CallSettings;
}

interface CallSettings {
  language: string;
  speechTimeout: string;
  maxCallDuration: number;
  silenceTimeout: number;
  interruptionSensitivity: "low" | "high";
  interruptionWordCountThreshold: number;
  onIdleMessage: string;
  onIdleTimeout: number;
  onIdleThreshold: number;
  onIdleTerminationMessage: string;
}

const DEFAULT_CALL_SETTINGS: CallSettings = {
  language: "en-US",
  speechTimeout: "auto",
  maxCallDuration: 600,
  silenceTimeout: 2,
  interruptionSensitivity: "low",
  interruptionWordCountThreshold: 1,
  onIdleMessage: "",
  onIdleTimeout: 10,
  onIdleThreshold: 3,
  onIdleTerminationMessage: "",
};

interface AgentVoiceConfig {
  ttsProvider?: string;
  language?: string;
}

interface TestAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  nodes: Node[];
  edges: Edge[];
  initialMode?: CallMode;
  voiceConfig?: AgentVoiceConfig;
}

type CallMode = "text" | "audio";

const TestAgentModal = ({
  isOpen,
  onClose,
  agentId,
  agentName,
  nodes,
  edges,
  initialMode,
  voiceConfig,
}: TestAgentModalProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"inbound" | "outbound">("inbound");
  const [callMode, setCallMode] = useState<CallMode>("text");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState<string | null>(null);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [collectedFields, setCollectedFields] = useState<Record<string, any>>({});
  const collectedFieldsRef = useRef<Record<string, any>>({});
  const [callSettings, setCallSettings] = useState<CallSettings>(DEFAULT_CALL_SETTINGS);
  const callSettingsRef = useRef<CallSettings>(DEFAULT_CALL_SETTINGS);
  const idleCountRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [callHistoryItems, setCallHistoryItems] = useState<AgentCallHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryCall, setSelectedHistoryCall] = useState<AgentCallHistoryItem | null>(null);
  const [selectedCallMessages, setSelectedCallMessages] = useState<CallMessageItem[]>([]);
  const [resultsModalCall, setResultsModalCall] = useState<AgentCallHistoryItem | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Workflow state refs
  const isCallActiveRef = useRef(false);
  const callModeRef = useRef<CallMode>("text");
  const isSpeakingRef = useRef(false);
  const workflowSessionIdRef = useRef<string | null>(null);
  const waitingForInputRef = useRef(false);
  const callSessionIdRef = useRef<string | null>(null);
  const handleUserMessageRef = useRef<(text: string) => Promise<void>>(async () => {});
  const endCallRef = useRef<() => Promise<void>>(async () => {});
  const startAutoRecordingRef = useRef<(opts?: { skipSpeakingCheck?: boolean }) => void>(() => {});
  const noSpeechCountRef = useRef(0);

  // Set mode when modal opens with initialMode
  useEffect(() => {
    if (isOpen && initialMode) {
      setCallMode(initialMode);
    }
  }, [isOpen, initialMode]);

  // Keep refs in sync
  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  useEffect(() => {
    callModeRef.current = callMode;
  }, [callMode]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    callSettingsRef.current = callSettings;
  }, [callSettings]);

  const hasInboundStart = nodes.some(
    (n) => n.type === "callDirection" && n.data?.direction === "inbound"
  );
  const hasOutboundStart = nodes.some(
    (n) => n.type === "callDirection" && n.data?.direction === "outbound"
  );

  // Scroll to bottom helper — used whenever content changes
  const scrollToBottom = useCallback(() => {
    // Small delay to ensure DOM has rendered the new content
    const timer = setTimeout(() => {
      // Approach 1: scroll the Radix viewport directly
      if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector(
          "[data-radix-scroll-area-viewport]"
        );
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
      // Approach 2: scrollIntoView as backup
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 100);
    return timer;
  }, []);

  // Scroll to bottom when messages change, loading state changes, or speaking state changes
  useEffect(() => {
    const timer = scrollToBottom();
    return () => clearTimeout(timer);
  }, [messages, isLoading, isSpeaking, scrollToBottom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Save message to call history
  const saveMessageToHistory = async (
    sessionId: string,
    role: "user" | "ai",
    content: string
  ) => {
    try {
      await api.addTestCallMessage(sessionId, role, content);
    } catch (error) {
      console.error("Failed to save message to history:", error);
    }
  };

  // --- Message helpers ---
  const addMessage = useCallback(
    (role: "user" | "ai" | "system", content: string, nodeLabel?: string) => {
      const msg: Message = {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: new Date(),
        nodeLabel,
      };
      setMessages((prev) => [...prev, msg]);

      // Save to call history (not for system messages)
      if (role !== "system" && callSessionIdRef.current) {
        saveMessageToHistory(
          callSessionIdRef.current,
          role === "ai" ? "ai" : "user",
          content
        );
      }
    },
    []
  );

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

  // --- Speech ---
  const serverAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);

  // Use browser TTS as fallback only
  const speakWithBrowser = useCallback((text: string, onStart?: () => void): Promise<void> => {
    return new Promise((resolve) => {
      try {
        if (!("speechSynthesis" in window)) {
          onStart?.();
          resolve();
          return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        if (voiceConfig?.language) {
          utterance.lang = voiceConfig.language;
        }
        let earlyRecordingTriggered = false;
        utterance.onstart = () => {
          onStart?.();
          // Estimate speech duration (~150 words/min) and start recording 2s before end
          const wordCount = text.split(/\s+/).length;
          const estimatedDurationMs = (wordCount / 150) * 60 * 1000;
          const earlyStartMs = Math.max(estimatedDurationMs - 2000, 500);
          if (estimatedDurationMs > 3000) {
            setTimeout(() => {
              if (!earlyRecordingTriggered) {
                earlyRecordingTriggered = true;
                startAutoRecordingRef.current({ skipSpeakingCheck: true });
              }
            }, earlyStartMs);
          }
        };
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      } catch {
        resolve();
      }
    });
  }, [voiceConfig?.language]);

  // Play audio from a Blob (non-streaming fallback)
  const playBlobAudio = useCallback((blob: Blob, onStart?: () => void): Promise<void> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      serverAudioRef.current = audio;
      let earlyRecordingTriggered = false;
      audio.onplay = () => onStart?.();
      // Start recording ~2s before audio ends to eliminate dead time
      audio.ontimeupdate = () => {
        if (!earlyRecordingTriggered && audio.duration && isFinite(audio.duration)) {
          const remaining = audio.duration - audio.currentTime;
          if (remaining <= 2 && remaining > 0) {
            earlyRecordingTriggered = true;
            startAutoRecordingRef.current({ skipSpeakingCheck: true });
          }
        }
      };
      audio.onended = () => {
        URL.revokeObjectURL(url);
        serverAudioRef.current = null;
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        serverAudioRef.current = null;
        resolve();
      };
      audio.play().catch(() => resolve());
    });
  }, []);

  // Streaming audio playback via MediaSource API (plays audio as chunks arrive)
  const playStreamingAudio = useCallback((stream: ReadableStream<Uint8Array>, onStart?: () => void): Promise<void> => {
    return new Promise((resolve) => {
      const mediaSource = new MediaSource();
      const audio = new Audio();
      serverAudioRef.current = audio;
      const objectUrl = URL.createObjectURL(mediaSource);
      audio.src = objectUrl;
      let earlyRecordingTriggered = false;

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        serverAudioRef.current = null;
        resolve();
      };

      audio.onplay = () => onStart?.();
      // Start recording ~2s before audio ends to eliminate dead time
      audio.ontimeupdate = () => {
        if (!earlyRecordingTriggered && audio.duration && isFinite(audio.duration)) {
          const remaining = audio.duration - audio.currentTime;
          if (remaining <= 2 && remaining > 0) {
            earlyRecordingTriggered = true;
            startAutoRecordingRef.current({ skipSpeakingCheck: true });
          }
        }
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;

      mediaSource.addEventListener("sourceopen", async () => {
        let sourceBuffer: SourceBuffer;
        try {
          sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
        } catch {
          // Codec not supported - abort streaming, caller will use blob fallback
          cleanup();
          return;
        }

        const reader = stream.getReader();
        let started = false;

        const pump = async (): Promise<void> => {
          try {
            // Abort if call ended
            if (!isCallActiveRef.current) {
              reader.cancel();
              if (mediaSource.readyState === "open") {
                try { mediaSource.endOfStream(); } catch {}
              }
              cleanup();
              return;
            }

            const { done, value } = await reader.read();
            if (done) {
              // Wait for any pending appends to finish before ending stream
              if (sourceBuffer.updating) {
                await new Promise<void>((r) =>
                  sourceBuffer.addEventListener("updateend", () => r(), { once: true })
                );
              }
              if (mediaSource.readyState === "open") {
                mediaSource.endOfStream();
              }
              return;
            }

            // Wait for previous append to complete
            if (sourceBuffer.updating) {
              await new Promise<void>((r) =>
                sourceBuffer.addEventListener("updateend", () => r(), { once: true })
              );
            }

            sourceBuffer.appendBuffer(value as unknown as ArrayBuffer);

            // Start playback as soon as we have the first chunk
            if (!started) {
              started = true;
              audio.play().catch(() => {});
            }

            await new Promise<void>((r) =>
              sourceBuffer.addEventListener("updateend", () => r(), { once: true })
            );

            return pump();
          } catch {
            if (mediaSource.readyState === "open") {
              try { mediaSource.endOfStream(); } catch {}
            }
            cleanup();
          }
        };

        await pump();
      });
    });
  }, []);

  const speakText = useCallback(async (text: string, onAudioStart?: () => void): Promise<void> => {
    // Stop any early-started recording before playing next audio
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
      setIsRecording(false);
    }
    setIsSpeaking(true);
    isSpeakingRef.current = true;

    // Ensure onAudioStart fires at most once
    let startFired = false;
    const fireStart = () => {
      if (!startFired) {
        startFired = true;
        onAudioStart?.();
      }
    };

    try {
      // Use server-side TTS for configured voices (ComhubAI, ElevenLabs, OpenAI)
      const provider = voiceConfig?.ttsProvider;
      if (provider && provider !== "browser") {
        try {
          const abortController = new AbortController();
          ttsAbortRef.current = abortController;

          const token = localStorage.getItem("backend_token");
          const response = await fetch(
            `${apiBaseUrl}/agents/${agentId}/generate-tts`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token && { Authorization: `Bearer ${token}` }),
              },
              body: JSON.stringify({ text }),
              signal: abortController.signal,
            }
          );

          ttsAbortRef.current = null;

          if (response.ok) {
            // Try streaming playback (MediaSource) for instant audio start
            const canStream = response.body
              && typeof MediaSource !== "undefined"
              && MediaSource.isTypeSupported("audio/mpeg");

            if (canStream) {
              await playStreamingAudio(response.body!, fireStart);
            } else {
              // Fallback: buffer full response then play
              const blob = await response.blob();
              if (blob.size > 0) {
                await playBlobAudio(blob, fireStart);
              }
            }

            // If audio never started (e.g. empty response), still show the message
            fireStart();

            setIsSpeaking(false);
            isSpeakingRef.current = false;
            return;
          }
        } catch (serverErr) {
          if ((serverErr as Error).name !== "AbortError") {
            console.warn("Server TTS failed, falling back to browser TTS:", serverErr);
          }
          ttsAbortRef.current = null;
        }
      }

      // Fallback: browser TTS
      await speakWithBrowser(text, fireStart);
    } catch {
      // Silent fallback
    }

    // Safety net: always ensure message is shown even if all audio paths fail
    fireStart();

    setIsSpeaking(false);
    isSpeakingRef.current = false;
  }, [voiceConfig?.ttsProvider, agentId, apiBaseUrl, speakWithBrowser, playStreamingAudio, playBlobAudio]);

  // Output a message and optionally speak it (audio mode)
  // In audio mode: text appears only when audio starts playing
  const outputAndSpeak = useCallback(
    async (text: string, nodeLabel?: string) => {
      const msgId = crypto.randomUUID();
      const msg: Message = {
        id: msgId,
        role: "ai",
        content: text,
        timestamp: new Date(),
        nodeLabel,
      };

      const showMessage = () => {
        setMessages((prev) => [...prev, msg]);
        if (callSessionIdRef.current) {
          saveMessageToHistory(callSessionIdRef.current, "ai", text);
        }
      };

      if (callModeRef.current === "audio") {
        // Defer showing text until audio actually starts playing
        setSpeakingMessageId(msgId);
        await speakText(text, showMessage);
        setSpeakingMessageId(null);
      } else {
        // Text mode: show immediately
        showMessage();
      }
    },
    [speakText]
  );

  // --- Auto recording for audio mode ---
  const startAutoRecording = useCallback((opts?: { skipSpeakingCheck?: boolean }) => {
    if (!isCallActiveRef.current || callModeRef.current !== "audio") return;
    if (!opts?.skipSpeakingCheck && isSpeakingRef.current) return;
    if (!waitingForInputRef.current) return;
    // Prevent duplicate: if already recording, skip
    if (recognitionRef.current) return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    setTimeout(() => {
      if (!isCallActiveRef.current || callModeRef.current !== "audio") return;
      if (!waitingForInputRef.current) return;

      try {
        const recognition = new SpeechRecognitionAPI();
        recognitionRef.current = recognition;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = voiceConfig?.language || "en-US";

        let finalTranscript = "";
        let interimTranscript = "";
        let hasReceivedSpeech = false;

        const stopRecognition = () => {
          if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch {}
          }
        };

        // Use configured silence timeout; fall back to 2s default
        const silenceTimeoutMs = (callSettingsRef.current.silenceTimeout || 2) * 1000;
        const initialWaitMs = Math.max(silenceTimeoutMs, 5000); // at least 5s for user to start speaking

        const startSilenceTimer = (ms: number) => {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(stopRecognition, ms);
        };

        recognition.onstart = () => {
          setIsRecording(true);
          startSilenceTimer(initialWaitMs);
        };

        recognition.onresult = (event: any) => {
          hasReceivedSpeech = true;
          noSpeechCountRef.current = 0; // reset no-speech counter on actual speech
          interimTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          startSilenceTimer(silenceTimeoutMs); // configured silence timeout after last speech
        };

        recognition.onend = async () => {
          setIsRecording(false);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          recognitionRef.current = null;

          if (!isCallActiveRef.current || callModeRef.current !== "audio") return;

          // Use final transcript, or fall back to interim if final is empty
          const text = (finalTranscript.trim() || interimTranscript.trim());

          if (text) {
            const cs = callSettingsRef.current;
            // Interruption sensitivity: only filter when barge-in is active AND threshold > 1.
            // Default threshold is 1, so single-word responses ("yes", "hello") are always accepted.
            const wordCount = text.split(/\s+/).length;
            if (cs.interruptionSensitivity === "high" && cs.interruptionWordCountThreshold > 1 && wordCount < cs.interruptionWordCountThreshold) {
              // Too few words during barge-in — likely accidental noise, re-listen
              if (waitingForInputRef.current && isCallActiveRef.current) {
                startAutoRecording();
              }
              return;
            }
            noSpeechCountRef.current = 0;
            idleCountRef.current = 0; // reset idle on valid speech
            await handleUserMessageRef.current(text);
          } else if (hasReceivedSpeech) {
            // User spoke but speech couldn't be transcribed — trigger fallback
            await handleUserMessageRef.current("[SPEECH_NOT_RECOGNIZED]");
          } else {
            // No speech detected — handle idle behavior
            const cs = callSettingsRef.current;
            idleCountRef.current++;

            if (cs.onIdleThreshold > 0 && idleCountRef.current >= cs.onIdleThreshold) {
              // Max idle threshold reached — terminate call
              if (cs.onIdleTerminationMessage) {
                addMessage("ai", cs.onIdleTerminationMessage);
                if (callModeRef.current === "audio") {
                  await speakText(cs.onIdleTerminationMessage);
                }
              }
              endCallRef.current();
            } else if (cs.onIdleMessage) {
              // Send configured idle prompt message
              addMessage("ai", cs.onIdleMessage);
              if (callModeRef.current === "audio") {
                await speakText(cs.onIdleMessage);
              }
              if (waitingForInputRef.current && isCallActiveRef.current) {
                startAutoRecording();
              }
            } else if (idleCountRef.current >= 2) {
              // No idle message configured — fall back to workflow after 2 cycles
              noSpeechCountRef.current = 0;
              await handleUserMessageRef.current("[SPEECH_NOT_RECOGNIZED]");
            } else if (waitingForInputRef.current) {
              startAutoRecording();
            }
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error === "no-speech") {
            // Handled by onend
            setIsRecording(false);
          } else if (event.error !== "aborted") {
            console.error("Speech recognition error:", event.error);
            setIsRecording(false);
            // Restart on transient errors
            if (isCallActiveRef.current && callModeRef.current === "audio" && waitingForInputRef.current) {
              startAutoRecording();
            }
          }
        };

        recognition.start();
      } catch (error) {
        console.error("Error starting auto-recording:", error);
        setIsRecording(false);
      }
    }, 500);
  }, []);

  // --- Server-side workflow API calls ---
  const getAuthHeaders = useCallback((): HeadersInit => {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    const token = localStorage.getItem("backend_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  const startWorkflowCallAPI = useCallback(
    async (direction: "inbound" | "outbound"): Promise<WorkflowCallResult | null> => {
      try {
        const response = await fetch(
          `${apiBaseUrl}/agents/${agentId}/workflow-call/start`,
          {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ direction }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to start workflow call");
        }

        return await response.json();
      } catch (error) {
        console.error("Error starting workflow call:", error);
        return null;
      }
    },
    [agentId, getAuthHeaders, apiBaseUrl]
  );

  const sendWorkflowMessageAPI = useCallback(
    async (message: string): Promise<{ result: WorkflowCallResult | null; error?: string }> => {
      const sessionId = workflowSessionIdRef.current;
      if (!sessionId) {
        return { result: null, error: "No active session. Please start a new call." };
      }

      try {
        const response = await fetch(
          `${apiBaseUrl}/agents/${agentId}/workflow-call/${sessionId}/message`,
          {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ message }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Workflow message API error:", {
            status: response.status,
            error: errorData,
          });

          // Build a user-friendly error message based on HTTP status
          if (response.status === 404) {
            return { result: null, error: "Session expired or lost. Please end the call and start a new one." };
          }
          return { result: null, error: errorData.error || `Server error (${response.status})` };
        }

        const data = await response.json();
        return { result: data };
      } catch (error) {
        console.error("Error sending workflow message:", error);
        return { result: null, error: error instanceof Error ? error.message : "Network error — could not reach server." };
      }
    },
    [agentId, getAuthHeaders, apiBaseUrl]
  );

  const endWorkflowCallAPI = useCallback(async (): Promise<Record<string, any>> => {
    const sessionId = workflowSessionIdRef.current;
    if (!sessionId) return {};

    try {
      const response = await fetch(
        `${apiBaseUrl}/agents/${agentId}/workflow-call/${sessionId}/end`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );
      if (response.ok) {
        const data = await response.json();
        return data.collectedFields || {};
      }
    } catch (error) {
      console.error("Error ending workflow call:", error);
    }
    return {};
  }, [agentId, getAuthHeaders, apiBaseUrl]);

  // Process workflow result messages - display them and update state
  const processWorkflowResult = useCallback(
    async (result: WorkflowCallResult) => {
      // Set waitingForInput BEFORE playing messages so early recording
      // (triggered ~2s before last audio ends) can check this flag
      setWaitingForInput(result.waitingForInput);
      waitingForInputRef.current = result.waitingForInput;

      for (const msg of result.messages) {
        if (!isCallActiveRef.current) break;

        if (msg.type === "scripted" || msg.type === "ai") {
          await outputAndSpeak(msg.text, msg.nodeLabel);
          // Small pause between messages for natural feel
          await new Promise((r) => setTimeout(r, 300));
        } else if (msg.type === "system") {
          addMessage("system", msg.text);
        }
      }

      // Merge collected fields from workflow engine
      if (result.collectedFields && Object.keys(result.collectedFields).length > 0) {
        setCollectedFields((prev) => {
          const merged = { ...prev, ...result.collectedFields };
          collectedFieldsRef.current = merged;
          return merged;
        });
      }
      setCurrentWorkflowStep(
        result.currentStage || (result.isComplete ? "Workflow completed" : null)
      );

      if (result.isComplete && isCallActiveRef.current) {
        if (result.transferTo) {
          addMessage(
            "system",
            `Transferring to ${result.transferTo}`
          );
        }
      }

      return result;
    },
    [outputAndSpeak, addMessage]
  );

  // --- Handle user message (sent to server-side workflow engine) ---
  const isLoadingRef = useRef(false);
  const handleUserMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !isCallActiveRef.current) return;

      const isSpeechNotRecognized = text === "[SPEECH_NOT_RECOGNIZED]";

      if (!waitingForInputRef.current) {
        if (!isSpeechNotRecognized) {
          addMessage("system", "Waiting for next stage...");
        }
        return;
      }

      // Prevent concurrent sends — use a ref for instant check (state is async)
      if (isLoadingRef.current) {
        return;
      }

      // Don't show [SPEECH_NOT_RECOGNIZED] as a user message
      if (!isSpeechNotRecognized) {
        addMessage("user", text);
      }
      setInputMessage("");
      setIsLoading(true);
      isLoadingRef.current = true;

      const { result, error } = await sendWorkflowMessageAPI(text);

      if (!isCallActiveRef.current) {
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      if (result) {
        await processWorkflowResult(result);
        setIsLoading(false);
        isLoadingRef.current = false;

        if (!result.isComplete && result.waitingForInput && callModeRef.current === "audio" && isCallActiveRef.current) {
          startAutoRecording();
        }
      } else {
        setIsLoading(false);
        isLoadingRef.current = false;
        addMessage("system", error || "Failed to get response, try again");
        if (callModeRef.current === "audio" && isCallActiveRef.current) {
          startAutoRecording();
        }
      }
    },
    [sendWorkflowMessageAPI, processWorkflowResult, addMessage, startAutoRecording]
  );

  // Keep ref always pointing to the latest handleUserMessage
  useEffect(() => {
    handleUserMessageRef.current = handleUserMessage;
  }, [handleUserMessage]);

  // --- Start call ---
  const startCall = useCallback(async () => {
    try {
      setIsLoading(true);
      isLoadingRef.current = false;
      setIsCallActive(true);
      isCallActiveRef.current = true;
      setMessages([]);
      setWaitingForInput(false);
      waitingForInputRef.current = false;
      workflowSessionIdRef.current = null;
      noSpeechCountRef.current = 0;
      setCallDuration(0);
      setCurrentWorkflowStep("Initializing call...");

      // In audio mode, request mic permission upfront
      if (callMode === "audio") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          stream.getTracks().forEach((track) => track.stop());
        } catch {
          toast({
            title: "Microphone Access Required",
            description: "Please allow microphone access for audio mode.",
            variant: "destructive",
          });
          setIsCallActive(false);
          isCallActiveRef.current = false;
          setIsLoading(false);
          return;
        }
      }

      // Create test call session for history tracking
      let sessionId: string | null = null;
      try {
        const sessionResult = await api.createTestCallSession(
          agentId,
          activeTab
        );
        if (sessionResult.data?.callSessionId) {
          sessionId = sessionResult.data.callSessionId;
          setCallSessionId(sessionId);
          callSessionIdRef.current = sessionId;
        }
      } catch (sessionError) {
        console.error("Failed to create test call session:", sessionError);
      }

      // Start timer
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      // Start workflow via server-side engine
      const result = await startWorkflowCallAPI(activeTab);

      if (!result || !result.success) {
        toast({
          title: "Workflow Error",
          description:
            result?.error ||
            `Failed to start workflow. Check if the workflow has a valid ${activeTab} call direction node.`,
          variant: "destructive",
        });
        setIsCallActive(false);
        isCallActiveRef.current = false;
        setIsLoading(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }

      // Store workflow session ID
      workflowSessionIdRef.current = result.sessionId || null;

      // Apply call settings from server
      if (result.callSettings) {
        setCallSettings(result.callSettings);
        callSettingsRef.current = result.callSettings;
      }

      // Reset idle counter
      idleCountRef.current = 0;

      // Set up max call duration enforcement
      const maxDur = result.callSettings?.maxCallDuration || DEFAULT_CALL_SETTINGS.maxCallDuration;
      if (maxDur > 0) {
        if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
        maxDurationTimerRef.current = setTimeout(() => {
          if (isCallActiveRef.current) {
            addMessage("system", `Max duration reached (${maxDur}s), ending call`);
            endCallRef.current();
          }
        }, maxDur * 1000);
      }

      setIsLoading(false);

      toast({
        title: `${activeTab === "inbound" ? "Inbound" : "Outbound"} Test Call Started`,
        description:
          callMode === "audio"
            ? "Audio mode active. The workflow will execute step by step."
            : "Text mode active. The workflow will execute step by step.",
      });

      // Process initial workflow messages (greetings, scripted messages, etc.)
      await processWorkflowResult(result);

      // If waiting for input in audio mode, start recording
      if (
        result.waitingForInput &&
        callModeRef.current === "audio" &&
        isCallActiveRef.current
      ) {
        startAutoRecording();
      }
    } catch (error) {
      console.error("Error starting call:", error);
      toast({
        title: "Error",
        description: "Failed to start test call",
        variant: "destructive",
      });
      endCall();
    }
  }, [
    activeTab,
    callMode,
    toast,
    agentId,
    startWorkflowCallAPI,
    processWorkflowResult,
    startAutoRecording,
  ]);

  // --- End call ---
  const endCall = useCallback(async () => {
    isCallActiveRef.current = false;
    waitingForInputRef.current = false;

    // End workflow session on server and get any remaining collected fields
    const endFields = await endWorkflowCallAPI();
    const finalFields = { ...collectedFieldsRef.current, ...endFields };
    workflowSessionIdRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }

    idleCountRef.current = 0;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    window.speechSynthesis?.cancel();

    // Abort any in-flight TTS request
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }

    // Stop server-generated audio if playing
    if (serverAudioRef.current) {
      serverAudioRef.current.pause();
      serverAudioRef.current = null;
    }

    if (callSessionId) {
      try {
        await api.endTestCallSession(
          callSessionId,
          Object.keys(finalFields).length > 0 ? finalFields : undefined
        );
      } catch (error) {
        console.error("Failed to end test call session:", error);
      }
      setCallSessionId(null);
      callSessionIdRef.current = null;
    }

    setIsCallActive(false);
    setIsRecording(false);
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setIsLoading(false);
    setWaitingForInput(false);
    setCollectedFields({});
    collectedFieldsRef.current = {};

    toast({
      title: "Call Ended",
      description: `Call duration: ${formatDuration(callDuration)}. Call saved to history.`,
    });
  }, [callDuration, toast, callSessionId, endWorkflowCallAPI]);

  // Keep endCallRef in sync
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  // Keep startAutoRecordingRef in sync
  useEffect(() => {
    startAutoRecordingRef.current = startAutoRecording;
  }, [startAutoRecording]);

  // Manual mic for text mode
  const startRecording = async () => {
    try {
      const SpeechRecognitionAPI =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognitionAPI) {
        toast({
          title: "Speech Recognition Not Supported",
          description:
            "Your browser doesn't support speech recognition. Please use text input.",
          variant: "destructive",
        });
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = voiceConfig?.language || "en-US";

      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && transcript.trim()) {
          await handleUserMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech") {
          toast({
            title: "No speech detected",
            description: "Please speak into your microphone",
          });
        } else if (event.error !== "aborted") {
          toast({
            title: "Microphone Error",
            description: `Speech recognition error: ${event.error}`,
            variant: "destructive",
          });
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      recognition.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      handleUserMessage(inputMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // --- History functions ---
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const result = await api.getAgentCallHistory(agentId);
      if (!result.error) {
        setCallHistoryItems(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch call history:", error);
    }
    setLoadingHistory(false);
  }, [agentId]);

  const fetchCallMessages = useCallback(async (callId: string) => {
    setLoadingMessages(true);
    try {
      const result = await api.getCallMessages(callId);
      if (!result.error) {
        setSelectedCallMessages(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch call messages:", error);
    }
    setLoadingMessages(false);
  }, []);

  const selectHistoryCall = useCallback((call: AgentCallHistoryItem) => {
    setSelectedHistoryCall(call);
    fetchCallMessages(call.id);
  }, [fetchCallMessages]);

  const backToCallList = useCallback(() => {
    setSelectedHistoryCall(null);
    setSelectedCallMessages([]);
  }, []);

  const openHistory = useCallback(() => {
    setShowHistory(true);
    fetchHistory();
  }, [fetchHistory]);

  const closeHistory = useCallback(() => {
    setShowHistory(false);
    setSelectedHistoryCall(null);
    setSelectedCallMessages([]);
  }, []);

  const handleClose = () => {
    if (isCallActive) {
      endCall();
    }
    setShowHistory(false);
    onClose();
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-auto">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          {showHistory ? (
            <DialogTitle className="flex items-center gap-2">
              <button
                onClick={selectedHistoryCall ? backToCallList : closeHistory}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <History className="w-5 h-5 text-purple-500" />
              {selectedHistoryCall ? "Conversation" : "Call History"}
              {!selectedHistoryCall && (
                <button
                  onClick={fetchHistory}
                  disabled={loadingHistory}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors ml-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 opacity-50 hover:opacity-100 ${loadingHistory ? "animate-spin" : ""}`} />
                </button>
              )}
            </DialogTitle>
          ) : (
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-500" />
              Test Agent: {agentName}
              {!isCallActive && (
                <button
                  onClick={openHistory}
                  className="ml-1 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title="View agent history"
                >
                  <History className="w-4 h-4 opacity-50 hover:opacity-100" />
                </button>
              )}
            </DialogTitle>
          )}
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 px-5 pb-5">
          {showHistory ? (
            <CallHistoryView
              calls={callHistoryItems}
              loadingHistory={loadingHistory}
              selectedCall={selectedHistoryCall}
              selectedCallMessages={selectedCallMessages}
              loadingMessages={loadingMessages}
              onSelectCall={selectHistoryCall}
              onShowResults={(call) => setResultsModalCall(call)}
            />
          ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) =>
              setActiveTab(v as "inbound" | "outbound")
            }
            className="flex flex-col min-h-0 flex-1"
          >
            <TabsList className="grid w-full grid-cols-2 shrink-0">
              <TabsTrigger
                value="inbound"
                disabled={!hasInboundStart || isCallActive}
                className="flex items-center gap-2"
              >
                <PhoneIncoming className="w-4 h-4" />
                Inbound
              </TabsTrigger>
              <TabsTrigger
                value="outbound"
                disabled={!hasOutboundStart || isCallActive}
                className="flex items-center gap-2"
              >
                <PhoneOutgoing className="w-4 h-4" />
                Outbound
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="inbound"
              className="flex-1 flex flex-col min-h-0 mt-3 data-[state=inactive]:hidden"
            >
              {!hasInboundStart ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <p>No inbound start node configured</p>
                </div>
              ) : (
                <CallInterface
                  isCallActive={isCallActive}
                  isLoading={isLoading}
                  isRecording={isRecording}
                  isSpeaking={isSpeaking}
                  speakingMessageId={speakingMessageId}
                  callDuration={callDuration}
                  callMode={callMode}
                  messages={messages}
                  inputMessage={inputMessage}
                  messagesEndRef={messagesEndRef}
                  scrollAreaRef={scrollAreaRef}
                  currentWorkflowStep={currentWorkflowStep}
                  waitingForInput={waitingForInput}
                  onStartCall={startCall}
                  onEndCall={endCall}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onInputChange={setInputMessage}
                  onSendMessage={handleSendMessage}
                  onKeyDown={handleKeyDown}
                  formatDuration={formatDuration}
                  silenceTimeout={callSettings.silenceTimeout}
                />
              )}
            </TabsContent>

            <TabsContent
              value="outbound"
              className="flex-1 flex flex-col min-h-0 mt-3 data-[state=inactive]:hidden"
            >
              {!hasOutboundStart ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <p>No outbound start node configured</p>
                </div>
              ) : (
                <CallInterface
                  isCallActive={isCallActive}
                  isLoading={isLoading}
                  isRecording={isRecording}
                  isSpeaking={isSpeaking}
                  speakingMessageId={speakingMessageId}
                  callDuration={callDuration}
                  callMode={callMode}
                  messages={messages}
                  inputMessage={inputMessage}
                  messagesEndRef={messagesEndRef}
                  scrollAreaRef={scrollAreaRef}
                  currentWorkflowStep={currentWorkflowStep}
                  waitingForInput={waitingForInput}
                  onStartCall={startCall}
                  onEndCall={endCall}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onInputChange={setInputMessage}
                  onSendMessage={handleSendMessage}
                  onKeyDown={handleKeyDown}
                  formatDuration={formatDuration}
                  silenceTimeout={callSettings.silenceTimeout}
                />
              )}
            </TabsContent>
          </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Call Results Modal */}
    {resultsModalCall?.collectedData && (
      <CallResultsModal
        isOpen={!!resultsModalCall}
        onClose={() => setResultsModalCall(null)}
        data={resultsModalCall.collectedData}
        callDirection={resultsModalCall.direction}
        callStatus={resultsModalCall.status}
      />
    )}
    </>
  );
};

// --- Call History View component ---
interface CallHistoryViewProps {
  calls: AgentCallHistoryItem[];
  loadingHistory: boolean;
  selectedCall: AgentCallHistoryItem | null;
  selectedCallMessages: CallMessageItem[];
  loadingMessages: boolean;
  onSelectCall: (call: AgentCallHistoryItem) => void;
  onShowResults?: (call: AgentCallHistoryItem) => void;
}

const CallHistoryView = ({
  calls,
  loadingHistory,
  selectedCall,
  selectedCallMessages,
  loadingMessages,
  onSelectCall,
  onShowResults,
}: CallHistoryViewProps) => {
  const formatCallDuration = (startedAt: string, endedAt: string | null): string => {
    if (!endedAt) return "0:00";
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    const seconds = Math.floor((end - start) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimeAgo = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(date, "MMM d");
  };

  // --- Message detail view ---
  if (selectedCall) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="rounded-lg border border-border bg-secondary/50 p-3 mb-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedCall.direction === "inbound" ? (
                <PhoneIncoming className="w-4 h-4 text-blue-400" />
              ) : (
                <PhoneOutgoing className="w-4 h-4 text-green-400" />
              )}
              <span className="text-sm font-medium capitalize">{selectedCall.direction}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{formatCallDuration(selectedCall.startedAt, selectedCall.endedAt)}</span>
              <span>{selectedCall.messageCount} messages</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {format(new Date(selectedCall.startedAt), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>

        {selectedCall.collectedData && Object.keys(selectedCall.collectedData).length > 0 && (
          <div className="mb-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
              onClick={() => onShowResults?.(selectedCall)}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Call Results ({Object.keys(selectedCall.collectedData).length} fields)
            </Button>
          </div>
        )}

        {loadingMessages ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
              <span className="text-sm text-muted-foreground">Loading conversation...</span>
            </div>
          </div>
        ) : selectedCallMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <MessageSquare className="w-7 h-7 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No messages in this call</p>
          </div>
        ) : (
          <div className="flex-1 h-0 overflow-y-auto space-y-3 pr-1">
            {selectedCallMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "ai" && (
                  <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 ${
                    msg.role === "user" ? "bg-blue-500 text-white" : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <span
                    className={`text-[10px] mt-1 block ${
                      msg.role === "user" ? "text-blue-100" : "text-muted-foreground"
                    }`}
                  >
                    {format(new Date(msg.timestamp), "h:mm a")}
                  </span>
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Call list view ---
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {loadingHistory ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            <span className="text-sm text-muted-foreground">Loading call history...</span>
          </div>
        </div>
      ) : calls.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-3">
            <Phone className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground mb-1">No test calls yet</p>
          <p className="text-xs text-muted-foreground max-w-[250px]">
            Start a test call to begin recording conversation history
          </p>
        </div>
      ) : (
        <div className="flex-1 h-0 overflow-y-auto">
          <div className="space-y-2">
            {calls.map((call) => (
              <button
                key={call.id}
                onClick={() => onSelectCall(call)}
                className="w-full group rounded-xl border border-border hover:border-purple-500/50 hover:bg-purple-500/10 transition-all p-3.5 text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      call.direction === "inbound"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-green-500/20 text-green-400"
                    }`}>
                      {call.direction === "inbound" ? (
                        <PhoneIncoming className="w-4 h-4" />
                      ) : (
                        <PhoneOutgoing className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">
                        {call.direction} Call
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {getTimeAgo(call.startedAt)} ·{" "}
                        {formatCallDuration(call.startedAt, call.endedAt)} ·{" "}
                        {call.messageCount} msg{call.messageCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                    call.status === "ended"
                      ? "bg-green-500/20 text-green-400"
                      : call.status === "active"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-secondary text-muted-foreground"
                  }`}>
                    {call.status === "ended" ? "Completed" : call.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {calls.length > 0 && (
        <div className="pt-3 mt-2 border-t shrink-0">
          <p className="text-xs text-center text-muted-foreground">
            {calls.length} test call{calls.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
};

// --- CallInterface component ---
interface CallInterfaceProps {
  isCallActive: boolean;
  isLoading: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  speakingMessageId: string | null;
  callDuration: number;
  callMode: CallMode;
  messages: Message[];
  inputMessage: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  currentWorkflowStep: string | null;
  waitingForInput: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  formatDuration: (seconds: number) => string;
  silenceTimeout: number;
}

const CallInterface = ({
  isCallActive,
  isLoading,
  isRecording,
  isSpeaking,
  speakingMessageId,
  callDuration,
  callMode,
  messages,
  inputMessage,
  messagesEndRef,
  scrollAreaRef,
  currentWorkflowStep,
  waitingForInput,
  onStartCall,
  onEndCall,
  onStartRecording,
  onStopRecording,
  onInputChange,
  onSendMessage,
  onKeyDown,
  formatDuration,
  silenceTimeout,
}: CallInterfaceProps) => {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Call Status Bar */}
      {isCallActive && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Call Active
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300">
                {callMode === "audio" ? "Audio" : "Text"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isSpeaking && (
                <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  <span className="text-xs">Speaking...</span>
                </div>
              )}
              {isRecording && (
                <div className="flex items-center gap-1 text-red-500">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span className="text-xs">Listening...</span>
                </div>
              )}
              <span className="text-sm font-mono text-green-700 dark:text-green-400">
                {formatDuration(callDuration)}
              </span>
            </div>
          </div>
          {currentWorkflowStep && (
            <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <Bot className="w-3 h-3" />
                <span>Stage: {currentWorkflowStep}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea
        ref={scrollAreaRef}
        className="flex-1 min-h-0 border rounded-lg mb-3"
      >
        <div className="p-3">
          {messages.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              {isCallActive ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Starting workflow...</span>
                </div>
              ) : (
                <p className="text-sm">
                  Select a mode and start a call to begin testing
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id}>
                  {message.role === "system" ? (
                    <div className="flex justify-center">
                      {message.content.startsWith("⚠️") || message.content.toLowerCase().includes("no fallback") ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 px-3 py-1 rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          {message.content}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                          <Info className="w-3 h-3" />
                          {message.content}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`flex gap-2 ${
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      {message.role === "ai" && (
                        <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 ${
                          message.role === "user"
                            ? "bg-blue-500 text-white"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {message.nodeLabel && message.role === "ai" && (
                          <span className="text-[10px] font-medium text-purple-500 dark:text-purple-400 block mb-0.5">
                            {message.nodeLabel}
                          </span>
                        )}
                        <p className="text-sm leading-relaxed">
                          {message.content}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {speakingMessageId === message.id && (
                            <span className="inline-flex items-center gap-1 text-purple-500 dark:text-purple-400">
                              <Volume2 className="w-3 h-3 animate-pulse" />
                              <span className="text-[10px]">Playing</span>
                            </span>
                          )}
                          <span
                            className={`text-[10px] ${
                              message.role === "user"
                                ? "text-blue-100"
                                : "text-muted-foreground"
                            }`}
                          >
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      {message.role === "user" && (
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {/* Thinking indicator — shown while AI is processing */}
              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="max-w-[75%] rounded-lg px-3 py-2 bg-muted text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Controls */}
      <div className="space-y-3 shrink-0">
        {/* Text Input - only in text mode when call is active and waiting for input */}
        {isCallActive && callMode === "text" && waitingForInput && (
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type a message..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={onSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        )}

        {/* Call Controls */}
        <div className="flex justify-center gap-4">
          {!isCallActive ? (
            <Button
              onClick={onStartCall}
              className="bg-green-600 hover:bg-green-700 text-white px-8"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Phone className="w-4 h-4 mr-2" />
              )}
              Start Test Call
            </Button>
          ) : (
            <>
              {/* Manual mic button - only in text mode during dialogue */}
              {callMode === "text" && waitingForInput && (
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  size="icon"
                  className="w-12 h-12 rounded-full"
                  onMouseDown={onStartRecording}
                  onMouseUp={onStopRecording}
                  onMouseLeave={isRecording ? onStopRecording : undefined}
                  disabled={isLoading || isSpeaking}
                >
                  {isRecording ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </Button>
              )}

              {/* Audio mode indicator */}
              {callMode === "audio" && (
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                    isRecording
                      ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                      : isSpeaking
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                        : "border-muted bg-muted/30"
                  }`}
                >
                  {isRecording ? (
                    <Mic className="w-5 h-5 text-red-500 animate-pulse" />
                  ) : isSpeaking ? (
                    <Volume2 className="w-5 h-5 text-purple-500 animate-pulse" />
                  ) : isLoading ? (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  ) : (
                    <AudioLines className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              )}

              <Button
                onClick={onEndCall}
                className="bg-red-600 hover:bg-red-700 text-white w-12 h-12 rounded-full"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>

        {/* Help text */}
        {!isCallActive && (
          <p className="text-xs text-center text-muted-foreground">
            {callMode === "text"
              ? "Text mode: Type messages during AI dialogue stages"
              : "Audio mode: AI speaks, then auto-listens for your response"}
          </p>
        )}
        {isCallActive && callMode === "text" && !waitingForInput && (
          <p className="text-xs text-center text-muted-foreground">
            Executing workflow... waiting for dialogue stage
          </p>
        )}
        {isCallActive && callMode === "text" && waitingForInput && (
          <p className="text-xs text-center text-muted-foreground">
            AI dialogue active - type a message or hold mic to speak
          </p>
        )}
        {isCallActive && callMode === "audio" && (
          <p className="text-xs text-center text-muted-foreground">
            {isRecording
              ? `Listening... speak now (stops after ${silenceTimeout}s silence)`
              : isSpeaking
                ? "AI is speaking..."
                : isLoading
                  ? "Processing..."
                  : waitingForInput
                    ? "Waiting for your response..."
                    : "Executing workflow..."}
          </p>
        )}
      </div>
    </div>
  );
};

export default TestAgentModal;
