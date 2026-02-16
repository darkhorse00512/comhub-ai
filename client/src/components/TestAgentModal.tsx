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
  History,
  ArrowLeft,
  RefreshCw,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { Node, Edge } from "@/components/FlowCanvas";

interface AgentVersionItem {
  id: string;
  agent_id: string;
  version_number: number;
  name: string;
  node_count: number;
  edge_count: number;
  created_at: string;
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
}

interface TestAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  nodes: Node[];
  edges: Edge[];
  initialMode?: CallMode;
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
  const [callDuration, setCallDuration] = useState(0);
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState<string | null>(null);
  const [waitingForInput, setWaitingForInput] = useState(false);

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [historyVersions, setHistoryVersions] = useState<AgentVersionItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);

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

  const hasInboundStart = nodes.some(
    (n) => n.type === "callDirection" && n.data?.direction === "inbound"
  );
  const hasOutboundStart = nodes.some(
    (n) => n.type === "callDirection" && n.data?.direction === "outbound"
  );

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
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

  // --- Speech ---
  const speakText = useCallback(async (text: string): Promise<void> => {
    return new Promise((resolve) => {
      try {
        if (!("speechSynthesis" in window)) {
          resolve();
          return;
        }

        setIsSpeaking(true);
        isSpeakingRef.current = true;
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onend = () => {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          resolve();
        };

        utterance.onerror = () => {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        resolve();
      }
    });
  }, []);

  // Output a message and optionally speak it (audio mode)
  const outputAndSpeak = useCallback(
    async (text: string, nodeLabel?: string) => {
      addMessage("ai", text, nodeLabel);
      if (callModeRef.current === "audio") {
        await speakText(text);
      }
    },
    [addMessage, speakText]
  );

  // --- Auto recording for audio mode ---
  const startAutoRecording = useCallback(() => {
    if (!isCallActiveRef.current || callModeRef.current !== "audio") return;
    if (isSpeakingRef.current) return;
    if (!waitingForInputRef.current) return;

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
        recognition.lang = "en-US";

        let finalTranscript = "";
        let hasReceivedSpeech = false;

        const resetSilenceTimer = () => {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (recognitionRef.current) {
              try {
                recognitionRef.current.stop();
              } catch {}
            }
          }, 2000);
        };

        recognition.onstart = () => {
          setIsRecording(true);
          resetSilenceTimer();
        };

        recognition.onresult = (event: any) => {
          hasReceivedSpeech = true;
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          resetSilenceTimer();
        };

        recognition.onend = async () => {
          setIsRecording(false);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          recognitionRef.current = null;

          const text = finalTranscript.trim();
          if (text && isCallActiveRef.current) {
            await handleUserMessage(text);
          } else if (
            !hasReceivedSpeech &&
            isCallActiveRef.current &&
            callModeRef.current === "audio" &&
            waitingForInputRef.current
          ) {
            startAutoRecording();
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error === "no-speech") {
            setIsRecording(false);
            if (
              isCallActiveRef.current &&
              callModeRef.current === "audio" &&
              waitingForInputRef.current
            ) {
              startAutoRecording();
            }
          } else if (event.error !== "aborted") {
            console.error("Speech recognition error:", event.error);
            setIsRecording(false);
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

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

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
    async (message: string): Promise<WorkflowCallResult | null> => {
      const sessionId = workflowSessionIdRef.current;
      if (!sessionId) {
        console.error("sendWorkflowMessageAPI: No session ID");
        return null;
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
            statusText: response.statusText,
            error: errorData,
          });
          throw new Error(errorData.error || `Server error (${response.status})`);
        }

        return await response.json();
      } catch (error) {
        console.error("Error sending workflow message:", error);
        return null;
      }
    },
    [agentId, getAuthHeaders, apiBaseUrl]
  );

  const endWorkflowCallAPI = useCallback(async () => {
    const sessionId = workflowSessionIdRef.current;
    if (!sessionId) return;

    try {
      await fetch(
        `${apiBaseUrl}/agents/${agentId}/workflow-call/${sessionId}/end`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );
    } catch (error) {
      console.error("Error ending workflow call:", error);
    }
  }, [agentId, getAuthHeaders, apiBaseUrl]);

  // Process workflow result messages - display them and update state
  const processWorkflowResult = useCallback(
    async (result: WorkflowCallResult) => {
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

      setWaitingForInput(result.waitingForInput);
      waitingForInputRef.current = result.waitingForInput;
      setCurrentWorkflowStep(
        result.currentStage || (result.isComplete ? "Workflow completed" : null)
      );

      if (result.isComplete && isCallActiveRef.current) {
        if (result.transferTo) {
          addMessage(
            "system",
            `Call would be transferred to ${result.transferTo} (${result.transferType || "cold"} transfer)`
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

      if (!waitingForInputRef.current) {
        addMessage("system", "Waiting for the next conversation stage...");
        return;
      }

      // Prevent concurrent sends — use a ref for instant check (state is async)
      if (isLoadingRef.current) {
        return;
      }

      addMessage("user", text);
      setInputMessage("");
      setIsLoading(true);
      isLoadingRef.current = true;

      const result = await sendWorkflowMessageAPI(text);

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
        addMessage("system", "Failed to get workflow response. Try again.");
        if (callModeRef.current === "audio" && isCallActiveRef.current) {
          startAutoRecording();
        }
      }
    },
    [sendWorkflowMessageAPI, processWorkflowResult, addMessage, startAutoRecording]
  );

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

    // End workflow session on server
    await endWorkflowCallAPI();
    workflowSessionIdRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

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

    if (callSessionId) {
      try {
        await api.endTestCallSession(callSessionId);
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

    toast({
      title: "Call Ended",
      description: `Call duration: ${formatDuration(callDuration)}. Call saved to history.`,
    });
  }, [callDuration, toast, callSessionId, endWorkflowCallAPI]);

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
      recognition.lang = "en-US";

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
      const result = await api.getAgentVersions(agentId);
      if (!result.error) {
        setHistoryVersions(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch agent versions:", error);
    }
    setLoadingHistory(false);
  }, [agentId]);

  const openHistory = useCallback(() => {
    setShowHistory(true);
    fetchHistory();
  }, [fetchHistory]);

  const closeHistory = useCallback(() => {
    setShowHistory(false);
  }, []);

  const handleClose = () => {
    if (isCallActive) {
      endCall();
    }
    setShowHistory(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          {showHistory ? (
            <DialogTitle className="flex items-center gap-2">
              <button
                onClick={closeHistory}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <History className="w-5 h-5 text-purple-500" />
              Agent History
              <button
                onClick={fetchHistory}
                disabled={loadingHistory}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors ml-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 opacity-50 hover:opacity-100 ${loadingHistory ? "animate-spin" : ""}`} />
              </button>
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
            <AgentVersionHistoryView
              versions={historyVersions}
              loadingHistory={loadingHistory}
              agentId={agentId}
              restoringVersionId={restoringVersionId}
              setRestoringVersionId={setRestoringVersionId}
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
                />
              )}
            </TabsContent>
          </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// --- Agent Version History View component ---
interface AgentVersionHistoryViewProps {
  versions: AgentVersionItem[];
  loadingHistory: boolean;
  agentId: string;
  restoringVersionId: string | null;
  setRestoringVersionId: (id: string | null) => void;
}

const AgentVersionHistoryView = ({
  versions,
  loadingHistory,
  agentId,
  restoringVersionId,
  setRestoringVersionId,
}: AgentVersionHistoryViewProps) => {
  const { toast } = useToast();

  const handleRestore = async (version: AgentVersionItem) => {
    setRestoringVersionId(version.id);
    try {
      const result = await api.restoreAgentVersion(agentId, version.id);
      if (result.error) {
        toast({
          title: "Error restoring version",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Version restored",
          description: `Restored to version ${version.version_number}. Reload the page to see changes.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to restore version",
        variant: "destructive",
      });
    } finally {
      setRestoringVersionId(null);
    }
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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {loadingHistory ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            <span className="text-sm text-muted-foreground">Loading history...</span>
          </div>
        </div>
      ) : versions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <History className="w-7 h-7 text-gray-300" />
          </div>
          <p className="font-medium text-gray-700 mb-1">No version history yet</p>
          <p className="text-xs text-muted-foreground max-w-[250px]">
            Save your agent to start tracking version history
          </p>
        </div>
      ) : (
        <div className="flex-1 h-0 overflow-y-auto">
          <div className="space-y-2">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className="group rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50/30 transition-all p-3.5"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      index === 0
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      v{version.version_number}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-900">
                          {index === 0 ? "Latest" : `Version ${version.version_number}`}
                        </p>
                        {index === 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {getTimeAgo(version.created_at)} · {version.node_count} nodes · {version.edge_count} edges
                      </p>
                    </div>
                  </div>

                  {index > 0 && (
                    <button
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-purple-100"
                      onClick={() => handleRestore(version)}
                      disabled={restoringVersionId === version.id}
                    >
                      {restoringVersionId === version.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {versions.length > 0 && (
        <div className="pt-3 mt-2 border-t shrink-0">
          <p className="text-xs text-center text-muted-foreground">
            {versions.length} version{versions.length !== 1 ? "s" : ""} saved
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
}

const CallInterface = ({
  isCallActive,
  isLoading,
  isRecording,
  isSpeaking,
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
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                        <Info className="w-3 h-3" />
                        {message.content}
                      </span>
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
                        <span
                          className={`text-[10px] mt-1 block ${
                            message.role === "user"
                              ? "text-blue-100"
                              : "text-muted-foreground"
                          }`}
                        >
                          {message.timestamp.toLocaleTimeString()}
                        </span>
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
              ? "Listening... speak now (stops after 2s silence)"
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
