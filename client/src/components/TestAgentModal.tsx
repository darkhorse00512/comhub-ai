import { useState, useRef, useEffect, useCallback } from "react";
// VAD removed — browser SpeechRecognition is more reliable for echo cancellation
import { useWorkflowStream, StreamAudioMessage } from "@/hooks/useWorkflowStream";
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
  Clock,
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
  /** Base64-encoded MP3 audio generated server-side (eliminates client TTS round-trip) */
  audioBase64?: string | null;
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
  deferredAudioKey?: string;
  transitionPending?: boolean;
  collectedFields?: Record<string, any>;
  callSettings?: CallSettings;
  timing?: {
    // Pipeline steps (offsets from server request received, in ms):
    llmRequestSentAt?: number;     // Step 3
    llmFirstTokenAt?: number;      // Step 4
    llmFullResponseAt?: number;    // Step 5
    transitionAnalysisStartAt?: number; // Step 5.5a (transition turns only)
    transitionAnalysisDoneAt?: number;  // Step 5.5b (transition turns only)
    ttsRequestSentAt?: number;     // Step 6
    ttsFirstAudioAt?: number;      // Step 7
    ttsAllAudioAt?: number;        // All TTS done
    serverTotalMs?: number;
    ttsProvider?: string;
    ttsError?: string | null;
  };
  voiceInfo?: Record<string, string>;
  sttConfig?: {
    provider: string;
    apiKey: string;
    language: string;
  } | null;
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
  onIdleMessage: "Are you still there?",
  onIdleTimeout: 3,
  onIdleThreshold: 3,
  onIdleTerminationMessage: "It seems you're no longer available. Goodbye!",
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
  const sttWsRef = useRef<WebSocket | null>(null);
  const sttApiKeyRef = useRef<string | null>(null);
  const sttLanguageRef = useRef<string>("en");
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

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

  // --- Streaming audio queue ---
  // Audio messages arrive via WebSocket with `index` for ordering.
  // Since TTS runs in parallel, messages may arrive out of order.
  // We buffer them and play in correct index order.
  const audioBufferRef = useRef<Map<number, StreamAudioMessage>>(new Map());
  const nextPlayIndexRef = useRef(0);
  const isPlayingQueueRef = useRef(false);
  const expectedCountRef = useRef(0);
  const outputAndSpeakRef = useRef<(text: string, nodeLabel?: string, blob?: Blob | null, isLastMessage?: boolean) => Promise<void>>(async () => {});

  const playAudioQueue = useCallback(async () => {
    if (isPlayingQueueRef.current) return;
    isPlayingQueueRef.current = true;

    // Play messages in index order
    while (audioBufferRef.current.has(nextPlayIndexRef.current)) {
      if (!isCallActiveRef.current) break;
      const msg = audioBufferRef.current.get(nextPlayIndexRef.current)!;
      audioBufferRef.current.delete(nextPlayIndexRef.current);
      nextPlayIndexRef.current++;

      let blob: Blob | null = null;
      if (msg.audioBase64) {
        try {
          const binary = atob(msg.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          blob = new Blob([bytes], { type: "audio/mpeg" });
        } catch { /* fallback to no blob */ }
      }
      // Check if this is the last message in the queue (no more buffered)
      const isLast = !audioBufferRef.current.has(nextPlayIndexRef.current) &&
                     nextPlayIndexRef.current >= expectedCountRef.current;
      await outputAndSpeakRef.current(msg.text, msg.nodeLabel, blob, isLast);
    }

    isPlayingQueueRef.current = false;
  }, []);

  // --- WebSocket streaming workflow hook ---
  const {
    isConnected: wsConnected,
    startWorkflow,
    sendMessage: wsSendMessage,
    endWorkflow,
  } = useWorkflowStream({
    onSystem: (text) => {
      addMessage("system", text);
    },
    onAudio: (msg) => {
      // Buffer audio by index and play in order
      audioBufferRef.current.set(msg.index, msg);
      playAudioQueue();
    },
    onAnalysis: (data) => {
      // Post-call analysis results arrived (summary + AI extraction)
      // This fires AFTER the call has ended and the server completed analysis
      if (data.collectedFields && Object.keys(data.collectedFields).length > 0) {
        setCollectedFields((prev) => ({ ...prev, ...data.collectedFields }));
        collectedFieldsRef.current = { ...collectedFieldsRef.current, ...data.collectedFields };
      }
    },
    onDone: (data) => {
      // Called after ALL messages for a turn are emitted
      setCurrentWorkflowStep(data.currentStage || (data.isComplete ? "Workflow completed" : null));
      if (data.collectedFields && Object.keys(data.collectedFields).length > 0) {
        setCollectedFields((prev) => ({ ...prev, ...data.collectedFields }));
        collectedFieldsRef.current = { ...collectedFieldsRef.current, ...data.collectedFields };
      }
      // WS pipeline timing
      const t0 = userSpeechEndRef.current;
      const playStart = audioPlaybackStartRef.current;
      const ttfb = t0 && playStart ? playStart - t0 : 0;
      const serverMs = data.processingMs || 0;
      const parts: string[] = [];
      if (serverMs > 0) parts.push(`Server: ${serverMs}ms`);
      if (ttfb > 0) parts.push(`TTFB: ${ttfb}ms`);
      if (parts.length > 0) addMessage("system", parts.join(" | "));
      userSpeechEndRef.current = 0;
      audioPlaybackStartRef.current = 0;
      audioPlaybackEndRef.current = 0;
      // Wait for all audio to finish playing, then start recording
      const waitForAudioDone = () => {
        if (isPlayingQueueRef.current || audioBufferRef.current.size > 0) {
          setTimeout(waitForAudioDone, 200);
          return;
        }
        setIsLoading(false);
        isLoadingRef.current = false;
        if (data.isComplete && isCallActiveRef.current) {
          addMessage("system", "Workflow complete — ending call");
          setTimeout(() => { if (isCallActiveRef.current) endCallRef.current(); }, 2000);
        } else if (callModeRef.current === "audio" && isCallActiveRef.current) {
          startAutoRecordingRef.current();
        }
      };
      waitForAudioDone();
    },
    onError: (error) => {
      addMessage("system", `⚠️ Error: ${error}`);
      setIsLoading(false);
      isLoadingRef.current = false;
      if (callModeRef.current === "audio" && isCallActiveRef.current) {
        startAutoRecordingRef.current();
      }
    },
    onConfig: (data) => {
      // Store STT config and call settings from WS session
      if (data.sttConfig?.apiKey) {
        sttApiKeyRef.current = data.sttConfig.apiKey;
        sttLanguageRef.current = data.sttConfig.language || "en";
      }
      if (data.callSettings) {
        setCallSettings(data.callSettings as any);
        callSettingsRef.current = data.callSettings as any;
      }
    },
    onStarted: (data) => {
      workflowSessionIdRef.current = data.sessionId;
      // Reset audio queue index for new session
      nextPlayIndexRef.current = 0;
      audioBufferRef.current.clear();
      if (data.voiceInfo) {
        const vi = data.voiceInfo;
        const parts: string[] = [`Voice: ${vi.provider}`];
        if (vi.voiceId) parts.push(`voiceId=${vi.voiceId}`);
        if (vi.model) parts.push(`model=${vi.model}`);
        if (vi.language) parts.push(`lang=${vi.language}`);
        addMessage("system", parts.join(" | "));
      }
      // Wait for initial audio to finish, then start recording
      const waitForAudioDone = () => {
        if (isPlayingQueueRef.current || audioBufferRef.current.size > 0) {
          setTimeout(waitForAudioDone, 200);
          return;
        }
        setIsLoading(false);
        if (!data.isComplete && callModeRef.current === "audio" && isCallActiveRef.current) {
          startAutoRecordingRef.current();
        }
      };
      waitForAudioDone();
    },
  });

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
          const earlyStartMs = Math.max(estimatedDurationMs - 1500, 300);
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
  const playBlobAudio = useCallback((blob: Blob, onStart?: () => void, isLastMessage?: boolean): Promise<void> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      serverAudioRef.current = audio;
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        URL.revokeObjectURL(url);
        serverAudioRef.current = null;
        resolve();
      };
      // Safety timeout: never hang more than 30s per audio clip
      const safetyTimer = setTimeout(done, 30000);
      let earlyRecordingTriggered = false;
      audio.onplay = () => {
        onStart?.();
        // Step 8: audio_playback_started (first audio of this turn)
        if (!audioPlaybackStartRef.current) {
          audioPlaybackStartRef.current = Date.now();
        }
        // For the last message, start STT immediately on play start.
        if (isLastMessage && !earlyRecordingTriggered) {
          earlyRecordingTriggered = true;
          startAutoRecordingRef.current();
        }
      };
      audio.ontimeupdate = () => {
        // Fallback: if not last message, still start 1.5s before end
        if (!earlyRecordingTriggered && audio.duration && isFinite(audio.duration)) {
          const remaining = audio.duration - audio.currentTime;
          if (remaining <= 1.5 && remaining > 0) {
            earlyRecordingTriggered = true;
            startAutoRecordingRef.current();
          }
        }
      };
      audio.onended = () => {
        // Step 9: audio_playback_finished (last audio of this turn)
        audioPlaybackEndRef.current = Date.now();
        clearTimeout(safetyTimer);
        done();
      };
      audio.onerror = () => { clearTimeout(safetyTimer); done(); };
      audio.play().catch(() => { clearTimeout(safetyTimer); done(); });
    });
  }, []);

  // Note: playStreamingAudio removed — playBlobAudio is more reliable
  // and has a safety timeout. Server-side TTS returns full audio anyway.

  // Pre-fetch TTS audio as a blob without playing it.
  // Used to generate audio for upcoming sentences while current one is playing.
  const prefetchTTS = useCallback(async (text: string): Promise<Blob | null> => {
    const provider = voiceConfig?.ttsProvider;
    if (!provider || provider === "browser") return null;

    try {
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
        }
      );
      if (response.ok) {
        const blob = await response.blob();
        return blob.size > 0 ? blob : null;
      }
    } catch {
      // Silent — caller will fall back to live TTS
    }
    return null;
  }, [voiceConfig?.ttsProvider, agentId, apiBaseUrl]);

  // Play a pre-fetched TTS blob (skips the TTS API call)
  const speakPrefetchedBlob = useCallback(async (blob: Blob, onAudioStart?: () => void, isLastMessage?: boolean): Promise<void> => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
      setIsRecording(false);
    }
    setIsSpeaking(true);
    isSpeakingRef.current = true;

    let startFired = false;
    const fireStart = () => {
      if (!startFired) {
        startFired = true;
        onAudioStart?.();
      }
    };

    try {
      await playBlobAudio(blob, fireStart, isLastMessage);
      fireStart();
    } catch {
      fireStart();
    }

    setIsSpeaking(false);
    isSpeakingRef.current = false;
  }, [playBlobAudio]);

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
            // Buffer full response then play (simpler and more reliable than streaming)
            const blob = await response.blob();
            if (blob.size > 0) {
              await playBlobAudio(blob, fireStart);
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
  }, [voiceConfig?.ttsProvider, agentId, apiBaseUrl, speakWithBrowser, playBlobAudio]);

  // Output a message and optionally speak it (audio mode)
  // In audio mode: text appears only when audio starts playing
  // If a pre-fetched TTS blob is provided, plays it directly (no TTS API call).
  // isLastMessage: when true, STT starts immediately when audio begins playing
  // so the mic is ready the instant audio finishes (zero gap).
  const outputAndSpeak = useCallback(
    async (text: string, nodeLabel?: string, prefetchedBlob?: Blob | null, isLastMessage?: boolean) => {
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
        setSpeakingMessageId(msgId);
        if (prefetchedBlob) {
          // Play pre-fetched audio — no TTS generation delay
          await speakPrefetchedBlob(prefetchedBlob, showMessage, isLastMessage);
        } else {
          // Live TTS generation + playback
          await speakText(text, showMessage);
        }
        setSpeakingMessageId(null);
      } else {
        // Text mode: show immediately
        showMessage();
      }
    },
    [speakText, speakPrefetchedBlob]
  );

  // Keep outputAndSpeakRef in sync for streaming audio queue
  useEffect(() => {
    outputAndSpeakRef.current = outputAndSpeak;
  }, [outputAndSpeak]);

  // --- Server-side STT (ElevenLabs Scribe v2) ---
  const transcribeViaServer = useCallback(async (audioBlob: Blob): Promise<{ text: string; provider: string } | null> => {
    try {
      const token = localStorage.getItem("backend_token");

      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.webm");
      if (voiceConfig?.language) {
        formData.append("languageCode", voiceConfig.language.split("-")[0]);
      }

      const response = await fetch(
        `${apiBaseUrl}/agents/${agentId}/transcribe`,
        {
          method: "POST",
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: formData,
        }
      );
      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[STT] Server ${response.status}:`, errText);
        return null;
      }
      const data = await response.json();
      if (data.success && data.text) {
        console.log(`[STT] ${data.provider}: "${data.text}" (${data.durationMs}ms)`);
        return { text: data.text, provider: data.provider || "server" };
      }
      console.warn("[STT] Server:", data.error || "empty transcript");
    } catch (err) {
      console.warn("[STT] Failed:", err);
    }
    return null;
  }, [apiBaseUrl, agentId, voiceConfig?.language]);

  // --- ElevenLabs Realtime STT (streaming WebSocket) ---
  // Audio streams continuously to ElevenLabs → real-time transcripts arrive
  // → ElevenLabs handles endpointing (speech-end detection) → committed_transcript fires
  // No silence timer, no batch upload. Transcription is ready the moment user stops.

  /** Stop streaming STT — close WebSocket and mic */
  const stopSTT = useCallback(() => {
    if (sttWsRef.current) {
      try { sttWsRef.current.close(); } catch {}
      sttWsRef.current = null;
    }
    if (audioWorkletRef.current) {
      try { audioWorkletRef.current.disconnect(); } catch {}
      audioWorkletRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const startAutoRecording = useCallback(async () => {
    if (!isCallActiveRef.current || callModeRef.current !== "audio") return;
    // Don't check isSpeakingRef — we WANT to open the WebSocket early
    // (while agent is still speaking). Audio chunks are filtered in onaudioprocess.
    if (sttWsRef.current) return; // Already streaming

    const apiKey = sttApiKeyRef.current;
    if (!apiKey) {
      console.warn("[STT] No ElevenLabs API key for realtime STT");
      return;
    }

    try {
      // 1. Open mic with echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micStreamRef.current = stream;

      // 2. Set up AudioContext to get raw PCM at 16kHz
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);

      // Capture raw PCM chunks — tiny buffer = minimum latency (32ms per chunk)
      const processor = audioContext.createScriptProcessor(512, 1, 1);
      audioWorkletRef.current = processor;

      // 3. Connect WebSocket to server's STT proxy (server connects to ElevenLabs with API key header)
      const lang = sttLanguageRef.current.split("-")[0] || "en";
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = window.location.host; // Same host as the page
      const wsParams = new URLSearchParams({
        apiKey: apiKey,
        language_code: lang,
      });
      const wsUrl = `${wsProtocol}//${wsHost}/stt-realtime?${wsParams}`;

      const ws = new WebSocket(wsUrl);
      sttWsRef.current = ws;

      let isProcessing = false;
      let speechDetectedMs = 0;
      let fullTranscript = ""; // Accumulated from all committed chunks
      let currentPartial = ""; // Current partial (not yet committed)
      let partialCommitTimer: ReturnType<typeof setTimeout> | null = null;
      let liveMessageId: string | null = null; // ID of the live transcript message in chat
      let maxUtteranceTimer: ReturnType<typeof setTimeout> | null = null;

      // --- Client-side amplitude VAD ---
      // Tracks RMS energy of mic audio to detect when user truly stops speaking.
      // The amplitude VAD is the PRIMARY finalization signal. Transcript timers
      // are FALLBACKS only — they use longer timeouts so they don't cut off speech.
      //
      // Flow: user speaks → partials arrive → user pauses between words (timers reset)
      //   → user finishes → amplitude drops for 400ms → VAD finalizes
      //   → OR: no new transcript for 0.8s → timer finalizes (fallback)
      const VAD_SPEECH_THRESHOLD = 0.006;    // RMS above this = speech (more sensitive)
      const VAD_SILENCE_MS = 400;            // 400ms of amplitude silence after speech = done
      const MAX_UTTERANCE_MS = 30000;        // Force-finalize after 30s (safety net)
      const PARTIAL_TIMEOUT_MS = 800;        // 0.8s without new partial = done (fallback)
      const COMMIT_WAIT_MS = 700;            // 0.7s after last committed chunk (fallback)

      let vadSpeechActive = false;
      let vadSilenceStartMs = 0;
      let vadFinalizeScheduled = false;
      let vadFinalizeTimer: ReturnType<typeof setTimeout> | null = null;

      // Start the idle timer only after speaking stops (not when WebSocket opens)
      const startIdleTimer = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        const onIdleTimeoutMs = (callSettingsRef.current.onIdleTimeout || 3) * 1000;
        silenceTimerRef.current = setTimeout(() => {
          if (sttWsRef.current && !isProcessing) {
            console.log("[STT] Idle timeout — closing STT after", onIdleTimeoutMs, "ms");
            stopSTT();
          }
        }, onIdleTimeoutMs);
      };

      // Reset the idle timer when user starts speaking
      const resetIdleTimer = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      // Update or create the live transcript message in chat
      const updateLiveTranscript = (text: string) => {
        if (!text.trim()) return;
        const displayText = (fullTranscript + " " + text).trim();
        if (!liveMessageId) {
          liveMessageId = crypto.randomUUID();
          setMessages((prev) => [...prev, {
            id: liveMessageId!,
            role: "user" as const,
            content: displayText + " ...",
            timestamp: new Date(),
          }]);
        } else {
          setMessages((prev) => prev.map((m) =>
            m.id === liveMessageId ? { ...m, content: displayText + " ..." } : m
          ));
        }
      };

      // Finalize transcript and process
      const finalizeTranscript = async (text: string, trigger?: string) => {
        if (isProcessing || !text.trim()) return;
        isProcessing = true;
        finalizedByRef.current = trigger || "unknown";

        // Speech end detected
        userSpeechEndRef.current = Date.now();
        if (partialCommitTimer) clearTimeout(partialCommitTimer);
        if (maxUtteranceTimer) clearTimeout(maxUtteranceTimer);
        if (vadFinalizeTimer) clearTimeout(vadFinalizeTimer);

        const finalText = text.trim();
        const speechDurationMs = speechDetectedMs ? Date.now() - speechDetectedMs : 0;
        console.log(`[STT] Final: "${finalText}" (speech: ${speechDurationMs}ms, trigger: ${finalizedByRef.current})`);

        // Update the live message to final text (remove "...")
        if (liveMessageId) {
          setMessages((prev) => prev.map((m) =>
            m.id === liveMessageId ? { ...m, content: finalText } : m
          ));
        }

        stopSTT();
        sttEndTimeRef.current = Date.now();
        sttFinalRef.current = Date.now();

        if (!isCallActiveRef.current) return;

        noSpeechCountRef.current = 0;
        idleCountRef.current = 0;
        // Remove the live message — handleUserMessage will add the final one
        if (liveMessageId) {
          setMessages((prev) => prev.filter((m) => m.id !== liveMessageId));
        }
        await handleUserMessageRef.current(finalText);
      };

      ws.onopen = () => {
        console.log("[STT] WebSocket connected...");
        sttStartTimeRef.current = Date.now();
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.message_type === "session_started") {
            setIsRecording(true);
            console.log("[STT] Session started:", msg.session_id);

          } else if (msg.message_type === "partial_transcript") {
            // IGNORE transcripts while agent is speaking or loading
            if (isSpeakingRef.current || isLoadingRef.current) return;

            // IGNORE phantom transcripts from noise — ElevenLabs can hallucinate
            // text (e.g., "The American Pronunciation Guide...") from ambient noise.
            // Only accept transcripts when the amplitude VAD has confirmed real speech.
            if (!vadSpeechActive && msg.text?.trim()) {
              console.log("[STT] Ignoring partial (no amplitude speech detected):", (msg.text || "").substring(0, 60));
              return;
            }

            // Real-time partial — show in chat as user types
            if (!speechDetectedMs && msg.text?.trim()) speechDetectedMs = Date.now();
            currentPartial = msg.text || "";
            if (currentPartial.trim()) {
              updateLiveTranscript(currentPartial);
              // User IS speaking — cancel ALL finalization signals
              resetIdleTimer();
              if (vadFinalizeTimer) { clearTimeout(vadFinalizeTimer); vadFinalizeScheduled = false; }
              vadSilenceStartMs = 0;    // Reset silence counter

              // Start max utterance safety timer on first speech
              if (!maxUtteranceTimer) {
                maxUtteranceTimer = setTimeout(() => {
                  console.log("[STT] Max utterance timeout — force finalizing");
                  const final = (fullTranscript + " " + currentPartial).trim();
                  if (final) finalizeTranscript(final, "max_utterance_30s");
                }, MAX_UTTERANCE_MS);
              }
            }

            // Reset fallback timer — user is still speaking
            if (partialCommitTimer) clearTimeout(partialCommitTimer);
            if (currentPartial.trim()) {
              partialCommitTimer = setTimeout(() => {
                const final = (fullTranscript + " " + currentPartial).trim();
                finalizeTranscript(final, "partial_silence_0.8s");
              }, PARTIAL_TIMEOUT_MS);
            }

          } else if (msg.message_type === "committed_transcript") {
            // IGNORE while agent is speaking or loading
            if (isSpeakingRef.current || isLoadingRef.current) {
              console.log("[STT] Ignoring committed_transcript during agent speech:", (msg.text || "").substring(0, 50));
              return;
            }

            // IGNORE phantom commits from noise — require amplitude-confirmed speech
            if (!vadSpeechActive) {
              console.log("[STT] Ignoring committed_transcript (no amplitude speech detected):", (msg.text || "").substring(0, 60));
              return;
            }

            // ElevenLabs committed a chunk — accumulate it
            if (partialCommitTimer) clearTimeout(partialCommitTimer);
            // User spoke — cancel ALL finalization signals
            resetIdleTimer();
            if (vadFinalizeTimer) { clearTimeout(vadFinalizeTimer); vadFinalizeScheduled = false; }
            vadSilenceStartMs = 0;

            const chunk = (msg.text || "").trim();
            if (chunk) {
              fullTranscript = (fullTranscript + " " + chunk).trim();
              currentPartial = "";
              console.log(`[STT] Chunk committed: "${chunk}" | Full: "${fullTranscript}"`);
              updateLiveTranscript("");

              // Fallback timer — VAD will usually finalize before this
              partialCommitTimer = setTimeout(() => {
                finalizeTranscript(fullTranscript, "eleven_commit_wait_0.7s");
              }, COMMIT_WAIT_MS);
            }

          } else if (msg.message_type === "end_of_speech" || msg.message_type === "speech_end") {
            // IGNORE while agent is speaking or if no real speech detected
            if (isSpeakingRef.current || isLoadingRef.current || !vadSpeechActive) return;

            // ElevenLabs VAD detected speech ended — finalize almost immediately
            console.log("[STT] ElevenLabs end_of_speech detected");
            if (partialCommitTimer) clearTimeout(partialCommitTimer);
            const final = (fullTranscript + " " + currentPartial).trim();
            if (final) {
              // Minimal delay to catch any in-flight committed_transcript
              partialCommitTimer = setTimeout(() => {
                const latestFinal = (fullTranscript + " " + currentPartial).trim();
                finalizeTranscript(latestFinal || final, "eleven_vad_end_of_speech");
              }, 50);
            }

          } else if (msg.message_type === "error") {
            console.error("[STT] Error:", msg.error_type, msg.error_message);
          }
        } catch {}
      };

      ws.onerror = (err) => {
        console.error("[STT] WebSocket error:", err);
        stopSTT();
        if (isCallActiveRef.current && !isSpeakingRef.current) {
          setTimeout(() => startAutoRecording(), 500);
        }
      };

      ws.onclose = (event) => {
        console.log("[STT] WebSocket closed, code:", event.code, "reason:", event.reason);
        if (maxUtteranceTimer) clearTimeout(maxUtteranceTimer);
        if (vadFinalizeTimer) clearTimeout(vadFinalizeTimer);
        if (!isProcessing && isCallActiveRef.current && !isSpeakingRef.current && !isLoadingRef.current) {
          const cs = callSettingsRef.current;
          idleCountRef.current++;
          console.log(`[STT] Idle count: ${idleCountRef.current}/${cs.onIdleThreshold}`);

          if (cs.onIdleThreshold > 0 && idleCountRef.current >= cs.onIdleThreshold) {
            // Max idle reached — speak termination message and end call
            if (cs.onIdleTerminationMessage) {
              outputAndSpeakRef.current(cs.onIdleTerminationMessage).then(() => {
                endCallRef.current();
              });
            } else {
              endCallRef.current();
            }
          } else if (cs.onIdleMessage) {
            // Speak idle prompt and restart listening
            outputAndSpeakRef.current(cs.onIdleMessage).then(() => {
              if (isCallActiveRef.current) startAutoRecording();
            });
          } else if (isCallActiveRef.current) {
            startAutoRecording();
          }
        }
      };

      // 4. Send audio chunks as PCM Int16 via WebSocket
      // Also performs client-side amplitude VAD to detect speech end faster.
      // Barge-in support: audio is ALWAYS sent to ElevenLabs, even while agent
      // is speaking. The browser's echo cancellation removes agent audio from
      // the mic feed, so ElevenLabs only hears the user. If user speaks during
      // agent playback, the transcript captures it. VAD only runs when agent
      // is NOT speaking (to avoid false triggers from residual echo).
      let idleTimerStarted = false;
      let wasAgentSpeaking = false;
      processor.onaudioprocess = (e) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const pcmFloat = e.inputBuffer.getChannelData(0);
        const isSpeaking = isSpeakingRef.current;

        if (isSpeaking) {
          idleTimerStarted = false;
          wasAgentSpeaking = true;
          // Reset VAD state while speaking — don't detect silence from echo
          vadSpeechActive = false;
          vadSilenceStartMs = 0;
          vadFinalizeScheduled = false;
          if (vadFinalizeTimer) { clearTimeout(vadFinalizeTimer); vadFinalizeTimer = null; }
          if (partialCommitTimer) { clearTimeout(partialCommitTimer); partialCommitTimer = null; }
          if (maxUtteranceTimer) { clearTimeout(maxUtteranceTimer); maxUtteranceTimer = null; }
        }

        // Agent just stopped speaking — clear any echo garbage accumulated during speech
        if (!isSpeaking && wasAgentSpeaking) {
          wasAgentSpeaking = false;
          if (fullTranscript || currentPartial) {
            console.log("[STT] Agent stopped speaking — clearing echo transcript:", (fullTranscript + " " + currentPartial).trim().substring(0, 80));
          }
          fullTranscript = "";
          currentPartial = "";
          speechDetectedMs = 0;
          // Remove any live transcript message showing echo garbage
          if (liveMessageId) {
            setMessages((prev) => prev.filter((m) => m.id !== liveMessageId));
            liveMessageId = null;
          }
        }

        // Start idle timer the first time agent is NOT speaking
        if (!isSpeaking && !idleTimerStarted) {
          idleTimerStarted = true;
          startIdleTimer();
        }

        // --- Amplitude VAD (only when agent is NOT speaking) ---
        if (!isSpeaking) {
          let sumSquares = 0;
          for (let i = 0; i < pcmFloat.length; i++) {
            sumSquares += pcmFloat[i] * pcmFloat[i];
          }
          const rms = Math.sqrt(sumSquares / pcmFloat.length);

          if (rms > VAD_SPEECH_THRESHOLD) {
            vadSpeechActive = true;
            vadSilenceStartMs = 0;
            if (vadFinalizeTimer) { clearTimeout(vadFinalizeTimer); vadFinalizeScheduled = false; }
          } else if (vadSpeechActive && vadSilenceStartMs === 0) {
            vadSilenceStartMs = Date.now();
          }

          if (vadSpeechActive && vadSilenceStartMs > 0 && !vadFinalizeScheduled) {
            const silenceDuration = Date.now() - vadSilenceStartMs;
            const pendingText = (fullTranscript + " " + currentPartial).trim();
            if (silenceDuration >= VAD_SILENCE_MS) {
              if (pendingText && !isProcessing) {
                vadFinalizeScheduled = true;
                console.log(`[STT] VAD: silence ${silenceDuration}ms — finalizing`);
                // Finalize immediately — VAD already waited VAD_SILENCE_MS
                const final = (fullTranscript + " " + currentPartial).trim();
                if (final) finalizeTranscript(final, `amplitude_vad_${VAD_SILENCE_MS}ms`);
              }
            }
          }
        }

        // Only send audio to ElevenLabs when agent is NOT speaking.
        // Sending echo audio causes hallucinated transcripts from noise.
        if (isSpeaking) return;

        // Convert Float32 [-1,1] to Int16 PCM
        const pcm16 = new Int16Array(pcmFloat.length);
        for (let i = 0; i < pcmFloat.length; i++) {
          const s = Math.max(-1, Math.min(1, pcmFloat[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);

        // Send with correct message format
        ws.send(JSON.stringify({
          message_type: "input_audio_chunk",
          audio_base_64: b64,
        }));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

    } catch (error) {
      console.error("[STT] Failed to start:", error);
      stopSTT();
    }
  }, [stopSTT, addMessage, speakText]);

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

      // Convert server-provided base64 audio to Blobs.
      // Server generates TTS for all sentences in parallel — audio arrives
      // with the response, eliminating the client→server TTS round-trip.
      const speakableMessages = result.messages.filter(
        (m) => m.type === "scripted" || m.type === "ai"
      );

      // Convert base64 audio → Blob
      const base64ToBlob = (b64: string): Blob | null => {
        try {
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return new Blob([bytes], { type: "audio/mpeg" });
        } catch {
          return null;
        }
      };

      const hasServerAudio = callModeRef.current === "audio" && speakableMessages.some((m) => m.audioBase64);

      // Pre-fetch client TTS only if server didn't provide audio
      let clientTTSBlobs: (Blob | null)[] | null = null;
      if (callModeRef.current === "audio" && !hasServerAudio && speakableMessages.length > 0) {
        clientTTSBlobs = await Promise.all(
          speakableMessages.map((m) => prefetchTTS(m.text).catch(() => null))
        );
      }

      // Fetch deferred content in background while first message plays.
      // This includes: remaining audio from current response AND/OR
      // transition messages + audio from phase 2 (new node opening).
      let deferredAudioBlobs: (Blob | null)[] = [];
      let deferredTransitionResult: WorkflowCallResult | null = null;
      let deferredFetchPromise: Promise<void> | null = null;
      if (result.deferredAudioKey) {
        deferredFetchPromise = (async () => {
          try {
            const token = localStorage.getItem("backend_token");
            const resp = await fetch(
              `${apiBaseUrl}/agents/${agentId}/workflow-call/deferred-audio/${result.deferredAudioKey}`,
              { headers: { ...(token && { Authorization: `Bearer ${token}` }) } }
            );
            if (resp.ok) {
              const data = await resp.json();
              if (data.audio) {
                deferredAudioBlobs = (data.audio as (string | null)[]).map(
                  (b64: string | null) => b64 ? base64ToBlob(b64) : null
                );
              }
              if (data.transitionResult) {
                deferredTransitionResult = data.transitionResult as WorkflowCallResult;
              }
            }
          } catch (err) {
            console.warn('[deferred-audio] Fetch failed:', err);
          }
        })();
      }

      // Play messages sequentially — first message plays immediately,
      // deferred audio arrives in background during first playback
      let speakableIdx = 0;
      let deferredIdx = 0;
      console.log('[processWorkflowResult] Playing', result.messages.length, 'messages, isCallActive:', isCallActiveRef.current);
      for (const msg of result.messages) {
        if (!isCallActiveRef.current) {
          console.warn('[processWorkflowResult] Call became inactive during playback — breaking');
          break;
        }

        if (msg.type === "scripted" || msg.type === "ai") {
          let blob: Blob | null = null;
          if (hasServerAudio && msg.audioBase64) {
            // First message — audio embedded in response
            blob = base64ToBlob(msg.audioBase64);
          } else if (hasServerAudio && !msg.audioBase64) {
            // Deferred message — wait for background fetch if needed
            if (deferredFetchPromise) {
              await deferredFetchPromise;
              deferredFetchPromise = null; // only await once
            }
            blob = deferredAudioBlobs[deferredIdx] ?? null;
            deferredIdx++;
          } else if (clientTTSBlobs) {
            blob = clientTTSBlobs[speakableIdx] ?? null;
          }
          speakableIdx++;
          const isLast = speakableIdx >= speakableMessages.length;
          await outputAndSpeak(msg.text, msg.nodeLabel, blob, isLast);
          // Tiny pause between sentences for natural breath rhythm
          if (!isLast) {
            await new Promise((r) => setTimeout(r, 80));
          }
        } else if (msg.type === "system") {
          addMessage("system", msg.text);
        }
      }

      // --- Play transition messages (phase 2) if pending ---
      if (result.transitionPending && deferredFetchPromise) {
        await deferredFetchPromise;
        deferredFetchPromise = null;

        if (deferredTransitionResult) {
          // Display system messages and play audio from transition result
          const trSpeakable = deferredTransitionResult.messages.filter(
            (m: any) => m.type === "ai" || m.type === "scripted"
          );
          let trSpeakableIdx = 0;
          for (const msg of deferredTransitionResult.messages) {
            if (!isCallActiveRef.current) break;
            if (msg.type === "scripted" || msg.type === "ai") {
              const blob = deferredAudioBlobs[trSpeakableIdx] ?? null;
              trSpeakableIdx++;
              const isLast = trSpeakableIdx >= trSpeakable.length;
              await outputAndSpeak(msg.text, msg.nodeLabel, blob, isLast);
              if (!isLast) await new Promise((r) => setTimeout(r, 80));
            } else if (msg.type === "system") {
              addMessage("system", msg.text);
            }
          }

          // Update state from transition result
          if (deferredTransitionResult.collectedFields) {
            setCollectedFields((prev) => {
              const merged = { ...prev, ...deferredTransitionResult!.collectedFields };
              collectedFieldsRef.current = merged;
              return merged;
            });
          }
          setCurrentWorkflowStep(
            deferredTransitionResult.currentStage || result.currentStage
          );
          setWaitingForInput(deferredTransitionResult.waitingForInput);
          waitingForInputRef.current = deferredTransitionResult.waitingForInput;

          // Use transition result's completion state
          result = { ...result, ...deferredTransitionResult, messages: [...result.messages, ...deferredTransitionResult.messages] };
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
        // Note: call ending is handled by the caller (handleUserMessage/startCall)
        // after processWorkflowResult returns, NOT here — to avoid premature endCall.
      }

      return result;
    },
    [outputAndSpeak, addMessage, prefetchTTS]
  );

  // --- Handle user message (sent to server-side workflow engine) ---
  const isLoadingRef = useRef(false);
  /** Step 1: user_speech_end_detected — when VAD/silence detected user stopped */
  const userSpeechEndRef = useRef<number>(0);
  /** Step 2: stt_final_received — when final transcript was produced */
  const sttFinalRef = useRef<number>(0);
  /** Step 8: audio_playback_started — when first audio byte played to speaker */
  const audioPlaybackStartRef = useRef<number>(0);
  /** Step 9: audio_playback_finished — when last audio byte finished */
  const audioPlaybackEndRef = useRef<number>(0);
  // Legacy refs (still used by STT internals)
  const sttStartTimeRef = useRef<number>(0);
  const sttEndTimeRef = useRef<number>(0);
  /** Which VAD/timer mechanism triggered finalization */
  const finalizedByRef = useRef<string>("");

  const handleUserMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !isCallActiveRef.current) return;

      const isSpeechNotRecognized = text === "[SPEECH_NOT_RECOGNIZED]";

      // Prevent concurrent sends
      if (isLoadingRef.current) return;

      // Don't show [SPEECH_NOT_RECOGNIZED] as a user message
      if (!isSpeechNotRecognized) {
        addMessage("user", text);
      }
      setInputMessage("");
      setIsLoading(true);
      isLoadingRef.current = true;

      // --- STREAMING MODE (audio calls via WebSocket) ---
      // Send via WebSocket — responses arrive as streaming events (onAudio, onDone)
      // which are handled by the useWorkflowStream callbacks above.
      // Only use streaming if a streaming session actually exists (sendMessage returns true).
      if (callModeRef.current === "audio" && wsConnected) {
        // Reset audio index for new turn
        nextPlayIndexRef.current = 0;
        audioBufferRef.current.clear();
        audioPlaybackStartRef.current = 0;
        audioPlaybackEndRef.current = 0;
        const sent = wsSendMessage(text);
        if (sent) {
          // Don't await — the onDone callback handles recording restart and loading state
          return;
        }
        // Streaming session not active — fall through to HTTP mode
      }

      // --- HTTP MODE (text calls — original batch flow) ---
      const sttDoneAt = sttEndTimeRef.current || Date.now();
      const apiStartMs = Date.now();

      const { result, error } = await sendWorkflowMessageAPI(text);

      const apiEndMs = Date.now();
      const networkMs = apiEndMs - apiStartMs; // Full API roundtrip

      if (!isCallActiveRef.current) {
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      if (result) {
        console.log('[handleUserMessage] Server result:', {
          isComplete: result.isComplete,
          waitingForInput: result.waitingForInput,
          messageCount: result.messages?.length,
          messageTypes: result.messages?.map((m: any) => `${m.type}:${m.nodeLabel}`),
          currentStage: result.currentStage,
        });
        addMessage("system", `[DEBUG] msg: isComplete=${result.isComplete}, waitingForInput=${result.waitingForInput}, stage=${result.currentStage}, msgs=${result.messages?.length}`);

        // Reset playback timestamps before playing
        audioPlaybackStartRef.current = 0;
        audioPlaybackEndRef.current = 0;

        // processWorkflowResult may merge transition data (including isComplete from end_call)
        const finalResult = await processWorkflowResult(result);

        setIsLoading(false);
        isLoadingRef.current = false;

        // --- Detailed Pipeline Timing ---
        // Shows every step from "I stopped speaking" to "agent starts speaking"
        if (!isSpeechNotRecognized) {
          const t = result.timing;
          const t0 = userSpeechEndRef.current || sttFinalRef.current || sttDoneAt;

          // All offsets from t0 (user speech end = 0ms baseline)
          const sttDone = sttFinalRef.current ? sttFinalRef.current - t0 : 0;
          const netOneWay = Math.round(Math.max(0, networkMs - (t?.serverTotalMs ?? 0)) / 2);
          const serverBase = sttDone + netOneWay;
          const llmReq   = t?.llmRequestSentAt  ? serverBase + t.llmRequestSentAt  : 0;
          const llm1st   = t?.llmFirstTokenAt    ? serverBase + t.llmFirstTokenAt   : 0;
          const llmDone  = t?.llmFullResponseAt  ? serverBase + t.llmFullResponseAt : 0;
          const transStart = t?.transitionAnalysisStartAt ? serverBase + t.transitionAnalysisStartAt : 0;
          const transDone  = t?.transitionAnalysisDoneAt  ? serverBase + t.transitionAnalysisDoneAt  : 0;
          const ttsReq   = t?.ttsRequestSentAt   ? serverBase + t.ttsRequestSentAt  : 0;
          const tts1st   = t?.ttsFirstAudioAt    ? serverBase + t.ttsFirstAudioAt   : 0;
          const playStart = audioPlaybackStartRef.current ? audioPlaybackStartRef.current - t0 : 0;
          const playEnd   = audioPlaybackEndRef.current   ? audioPlaybackEndRef.current - t0   : 0;

          // Build readable timeline:
          //   0ms  You stopped speaking (trigger: amplitude_vad_1s_silence)
          //  +12ms STT transcript ready
          //  +45ms → Server received
          //  +52ms → LLM request sent
          // +1050ms → LLM first token
          // +1052ms → LLM full response
          // +1052ms → TTS started
          // +1390ms → TTS first audio byte
          // +1520ms → Audio playback started  ← TTFB
          // +4700ms → Audio playback finished
          const lines: string[] = [];
          lines.push(`  0ms  You stopped speaking (${finalizedByRef.current})`);
          if (sttDone > 0)   lines.push(`+${sttDone}ms  STT transcript ready`);
          if (netOneWay > 0) lines.push(`+${sttDone + netOneWay}ms  Server received (net: ${netOneWay}ms)`);
          if (llmReq > 0)    lines.push(`+${llmReq}ms  LLM request sent`);
          if (llm1st > 0)    lines.push(`+${llm1st}ms  LLM first token (${llm1st - llmReq}ms wait)`);
          if (llmDone > 0)   lines.push(`+${llmDone}ms  LLM full response (${llmDone - (llm1st || llmReq)}ms gen)`);
          if (transStart > 0 && transDone > 0) lines.push(`+${transDone}ms  Transition analysis (${transDone - transStart}ms)`);
          if (ttsReq > 0)    lines.push(`+${ttsReq}ms  TTS request sent`);
          if (tts1st > 0)    lines.push(`+${tts1st}ms  TTS first audio byte (${tts1st - ttsReq}ms wait)`);
          if (playStart > 0) lines.push(`+${playStart}ms  Audio playback started ← TTFB`);
          if (playEnd > 0)   lines.push(`+${playEnd}ms  Audio playback finished`);
          addMessage("system", lines.join("\n"));

          if (t?.ttsError) {
            addMessage("system", `⚠️ TTS Error: ${t.ttsError} (used ${t.ttsProvider || 'openai'} fallback)`);
          }
        }

        // Reset timing refs for next turn
        userSpeechEndRef.current = 0;
        sttFinalRef.current = 0;
        audioPlaybackStartRef.current = 0;
        audioPlaybackEndRef.current = 0;
        if (callModeRef.current === "audio" && isCallActiveRef.current) {
          if (finalResult.isComplete) {
            addMessage("system", "Workflow complete — ending call");
            setTimeout(() => { if (isCallActiveRef.current) endCallRef.current(); }, 2000);
          } else {
            startAutoRecording();
          }
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
    [sendWorkflowMessageAPI, processWorkflowResult, addMessage, startAutoRecording, wsConnected, wsSendMessage]
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

      // In audio mode, request mic permission
      if (callMode === "audio") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
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

      // Reset idle counter
      idleCountRef.current = 0;

      // Set up max call duration enforcement
      const maxDur = DEFAULT_CALL_SETTINGS.maxCallDuration;
      if (maxDur > 0) {
        if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
        maxDurationTimerRef.current = setTimeout(() => {
          if (isCallActiveRef.current) {
            addMessage("system", `Max duration reached (${maxDur}s), ending call`);
            endCallRef.current();
          }
        }, maxDur * 1000);
      }

      // --- Start workflow ---
      // Audio mode: use WebSocket for low-latency streaming (no HTTP round-trip)
      // Text mode: use HTTP (simpler, no audio needed)
      if (callMode === "audio" && wsConnected) {
        // WebSocket mode — initial messages + config arrive via events
        // (onStarted, onConfig, onAudio, onDone callbacks handle everything)
        startWorkflow(agentId, activeTab);

        toast({
          title: `${activeTab === "inbound" ? "Inbound" : "Outbound"} Test Call Started`,
          description: "Audio mode active (WebSocket).",
        });
        // Don't setIsLoading(false) here — onStarted/onDone will do it
      } else {
        // HTTP mode (text calls or WS not connected)
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

        workflowSessionIdRef.current = result.sessionId || null;

        if (result.sttConfig?.apiKey) {
          sttApiKeyRef.current = result.sttConfig.apiKey;
          sttLanguageRef.current = result.sttConfig.language || "en";
        }

        if (result.callSettings) {
          setCallSettings(result.callSettings);
          callSettingsRef.current = result.callSettings;
        }

        setIsLoading(false);

        toast({
          title: `${activeTab === "inbound" ? "Inbound" : "Outbound"} Test Call Started`,
          description: "Text mode active.",
        });

        await processWorkflowResult(result);

        if (
          !result.isComplete &&
          callModeRef.current === "audio" &&
          isCallActiveRef.current
        ) {
          startAutoRecording();
        }
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
    wsConnected,
    startWorkflow,
  ]);

  // --- End call ---
  const endCall = useCallback(async () => {
    isCallActiveRef.current = false;
    waitingForInputRef.current = false;

    // Stop streaming STT
    stopSTT();

    // End streaming WebSocket session if active
    endWorkflow();

    // End HTTP workflow session on server and get any remaining collected fields
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
  }, [callDuration, toast, callSessionId, endWorkflowCallAPI, endWorkflow, stopSTT]);

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
                      {message.content.includes("You stopped speaking") ? (
                        <div className="w-full max-w-md bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-[10px] leading-relaxed text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                          <div className="flex items-center gap-1.5 mb-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                            <Clock className="w-3 h-3" />
                            Pipeline Timing
                          </div>
                          {message.content}
                        </div>
                      ) : message.content.startsWith("⚠️") || message.content.toLowerCase().includes("no fallback") ? (
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
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
