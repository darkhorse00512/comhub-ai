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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { Node, Edge } from "@/components/FlowCanvas";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

interface TestAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  nodes: Node[];
  edges: Edge[];
}

// Helper to generate system prompt from workflow
const generateSystemPromptFromWorkflow = (
  nodes: Node[],
  edges: Edge[],
  direction: "inbound" | "outbound"
): string => {
  const agentSetupNode = nodes.find((n) => n.type === "agentSetup");
  const baseSystemMessage =
    agentSetupNode?.data?.systemMessage ||
    "You are a helpful AI assistant for phone conversations.";

  const startNode = nodes.find(
    (n) => n.type === "callDirection" && n.data?.direction === direction
  );

  if (!startNode) {
    return baseSystemMessage;
  }

  const workflowSteps: string[] = [];
  const visited = new Set<string>();
  let stepNumber = 1;

  const traverseWorkflow = (nodeId: string, depth: number = 0) => {
    if (visited.has(nodeId) || depth > 10) return;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (node.type !== "agentSetup" && node.type !== "callDirection") {
      const nodeLabel = node.data?.label || node.type;
      const nodeType = node.data?.type || node.type;

      let stepDescription = `\n### Step ${stepNumber}: ${nodeLabel}`;
      stepNumber++;

      if (nodeType === "scripted" && node.data?.script) {
        stepDescription += `\n**Type:** Scripted Message (say exactly this)`;
        stepDescription += `\n**Script:** "${node.data.script}"`;
      } else if (nodeType === "dialogue" && node.data?.stageMessage) {
        stepDescription += `\n**Type:** AI Dialogue (engage naturally)`;
        stepDescription += `\n**Instructions:** ${node.data.stageMessage}`;
        if (node.data?.maxTurns) {
          stepDescription += `\n**Max turns:** ${node.data.maxTurns}`;
        }
      } else if (nodeType === "field_setter") {
        stepDescription += `\n**Type:** Collect Information`;
        if (node.data?.fieldName) {
          stepDescription += `\n**Field to collect:** ${node.data.fieldName}`;
        }
        if (node.data?.question) {
          stepDescription += `\n**Ask:** "${node.data.question}"`;
        }
      } else if (nodeType === "junction") {
        stepDescription += `\n**Type:** Decision Point`;
        if (node.data?.conditionField || node.data?.left?.field_name) {
          stepDescription += `\n**Check:** ${node.data?.conditionField || node.data?.left?.field_name}`;
        }
      } else if (nodeType === "switch") {
        stepDescription += `\n**Type:** Menu/Options`;
        if (node.data?.switchField) {
          stepDescription += `\n**Based on:** ${node.data.switchField}`;
        }
      } else if (nodeType === "call_transfer") {
        stepDescription += `\n**Type:** Transfer Call`;
        if (node.data?.transferMessage) {
          stepDescription += `\n**Say before transfer:** "${node.data.transferMessage}"`;
        }
      } else if (nodeType === "fallback") {
        stepDescription += `\n**Type:** Fallback Handler`;
        if (node.data?.fallbackMessage) {
          stepDescription += `\n**Say:** "${node.data.fallbackMessage}"`;
        }
      } else if (nodeType === "voicemail") {
        stepDescription += `\n**Type:** Voicemail`;
        if (node.data?.greetingMessage) {
          stepDescription += `\n**Greeting:** "${node.data.greetingMessage}"`;
        }
      }

      workflowSteps.push(stepDescription);
    }

    const outgoingEdges = edges.filter((e) => e.source === nodeId);
    for (const edge of outgoingEdges) {
      traverseWorkflow(edge.target, depth + 1);
    }
  };

  traverseWorkflow(startNode.id);

  let systemPrompt = baseSystemMessage;

  if (workflowSteps.length > 0) {
    systemPrompt += `\n\n## Call Flow (${direction === "inbound" ? "Inbound Call" : "Outbound Call"}):`;
    systemPrompt += `\nFollow these steps in order during the conversation:`;
    systemPrompt += workflowSteps.join("\n");
  }

  systemPrompt += `\n\n## Important Guidelines:
- Follow the workflow steps above in sequence
- For "Scripted Message" steps, say the script text exactly as written
- For "AI Dialogue" steps, follow the instructions and engage naturally
- Keep responses concise and natural for voice conversation
- Be friendly, professional, and helpful
- If you don't understand something, ask for clarification
- For ${direction} calls: ${direction === "inbound" ? "The customer is calling you, greet them warmly and assist with their needs." : "You are initiating the call, introduce yourself and state the purpose clearly."}`;

  return systemPrompt;
};

type CallMode = "text" | "audio";

const TestAgentModal = ({
  isOpen,
  onClose,
  agentId,
  agentName,
  nodes,
  edges,
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const conversationHistoryRef = useRef<Array<{ role: string; content: string }>>([]);
  const isCallActiveRef = useRef(false);
  const callModeRef = useRef<CallMode>("text");
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Save message to call history
  const saveMessageToHistory = async (sessionId: string, role: "user" | "ai", content: string) => {
    try {
      await api.addTestCallMessage(sessionId, role, content);
    } catch (error) {
      console.error("Failed to save message to history:", error);
    }
  };

  const hasInboundStart = nodes.some(
    (n) => n.type === "callDirection" && n.data?.direction === "inbound"
  );
  const hasOutboundStart = nodes.some(
    (n) => n.type === "callDirection" && n.data?.direction === "outbound"
  );

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
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
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Auto-start recording in audio mode after AI finishes speaking
  const startAutoRecording = useCallback(() => {
    if (!isCallActiveRef.current || callModeRef.current !== "audio") return;
    if (isSpeakingRef.current) return;

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    // Small delay before starting to listen
    setTimeout(() => {
      if (!isCallActiveRef.current || callModeRef.current !== "audio") return;

      try {
        const recognition = new SpeechRecognitionAPI();
        recognitionRef.current = recognition;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let finalTranscript = '';
        let hasReceivedSpeech = false;

        const resetSilenceTimer = () => {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            // 2 seconds of silence - stop and process
            if (recognitionRef.current) {
              try { recognitionRef.current.stop(); } catch {}
            }
          }, 2000);
        };

        recognition.onstart = () => {
          setIsRecording(true);
          // Start silence timer immediately - if user doesn't speak in 2s, stop
          resetSilenceTimer();
        };

        recognition.onresult = (event: any) => {
          hasReceivedSpeech = true;
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          // Reset silence timer on any speech
          resetSilenceTimer();
        };

        recognition.onend = async () => {
          setIsRecording(false);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          recognitionRef.current = null;

          const text = finalTranscript.trim();
          if (text && isCallActiveRef.current) {
            // Process the transcribed text
            await handleUserMessage(text);
          } else if (!hasReceivedSpeech && isCallActiveRef.current && callModeRef.current === "audio") {
            // No speech detected, restart listening
            startAutoRecording();
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error === 'no-speech') {
            // No speech - just restart if still in audio mode
            setIsRecording(false);
            if (isCallActiveRef.current && callModeRef.current === "audio") {
              startAutoRecording();
            }
          } else if (event.error !== 'aborted') {
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

  const generateAIResponse = async (
    userMessage: string,
    initialSystemPrompt?: string
  ): Promise<string | null> => {
    try {
      let msgs: Array<{ role: string; content: string }>;

      if (initialSystemPrompt) {
        msgs = [
          { role: "system", content: initialSystemPrompt },
          { role: "user", content: userMessage },
        ];
      } else {
        msgs = [
          ...conversationHistoryRef.current,
          { role: "user", content: userMessage },
        ];
      }

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      const token = localStorage.getItem("backend_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api"}/agents/${agentId}/test-chat`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages: msgs,
            direction: activeTab,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate AI response");
      }

      const data = await response.json();
      return data.response || data.message || null;
    } catch (error) {
      console.error("Error generating AI response:", error);
      return null;
    }
  };

  const speakText = useCallback(async (text: string): Promise<void> => {
    return new Promise((resolve) => {
      try {
        setIsSpeaking(true);
        isSpeakingRef.current = true;

        if ("speechSynthesis" in window) {
          // Cancel any ongoing speech
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
        } else {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          resolve();
        }
      } catch (error) {
        console.error("Error speaking text:", error);
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        resolve();
      }
    });
  }, []);

  const handleUserMessage = useCallback(async (text: string) => {
    if (!text.trim() || !isCallActiveRef.current) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    conversationHistoryRef.current.push({
      role: "user",
      content: text,
    });

    if (callSessionId) {
      saveMessageToHistory(callSessionId, "user", text);
    }

    setIsLoading(true);
    setInputMessage("");
    setCurrentWorkflowStep("Processing response...");

    try {
      const aiResponse = await generateAIResponse(text);
      setCurrentWorkflowStep("Following workflow...");

      if (aiResponse) {
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: "ai",
          content: aiResponse,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);
        conversationHistoryRef.current.push({
          role: "assistant",
          content: aiResponse,
        });

        if (callSessionId) {
          saveMessageToHistory(callSessionId, "ai", aiResponse);
        }

        setIsLoading(false);

        // In audio mode, speak then auto-record
        if (callModeRef.current === "audio") {
          await speakText(aiResponse);
          // After speaking, auto-start recording for next user input
          if (isCallActiveRef.current) {
            startAutoRecording();
          }
        }
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
      toast({
        title: "Error",
        description: "Failed to get AI response",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  }, [callSessionId, activeTab, agentId, toast, speakText, startAutoRecording]);

  const startCall = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsCallActive(true);
      isCallActiveRef.current = true;
      setMessages([]);
      conversationHistoryRef.current = [];
      setCallDuration(0);
      setCurrentWorkflowStep("Initializing call...");

      // In audio mode, request mic permission upfront
      if (callMode === "audio") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop()); // Release immediately, just checking permission
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

      let sessionId: string | null = null;
      try {
        const sessionResult = await api.createTestCallSession(agentId, activeTab);
        if (sessionResult.data?.callSessionId) {
          sessionId = sessionResult.data.callSessionId;
          setCallSessionId(sessionId);
        }
      } catch (sessionError) {
        console.error("Failed to create test call session:", sessionError);
      }

      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      const systemPrompt = generateSystemPromptFromWorkflow(nodes, edges, activeTab);

      conversationHistoryRef.current.push({
        role: "system",
        content: systemPrompt,
      });

      setCurrentWorkflowStep("Generating greeting...");
      const greetingPrompt =
        activeTab === "inbound"
          ? "The customer just called. Greet them warmly and ask how you can help."
          : "You are starting an outbound call. Introduce yourself and state the purpose of the call.";

      const aiGreeting = await generateAIResponse(greetingPrompt, systemPrompt);
      setCurrentWorkflowStep("Following workflow...");

      if (aiGreeting) {
        const greetingMessage: Message = {
          id: crypto.randomUUID(),
          role: "ai",
          content: aiGreeting,
          timestamp: new Date(),
        };
        setMessages([greetingMessage]);
        conversationHistoryRef.current.push({
          role: "assistant",
          content: aiGreeting,
        });

        if (sessionId) {
          saveMessageToHistory(sessionId, "ai", aiGreeting);
        }

        setIsLoading(false);

        // In audio mode, speak greeting then auto-record
        if (callMode === "audio") {
          await speakText(aiGreeting);
          if (isCallActiveRef.current) {
            startAutoRecording();
          }
        }
      } else {
        setIsLoading(false);
      }

      toast({
        title: `${activeTab === "inbound" ? "Inbound" : "Outbound"} Test Call Started`,
        description: callMode === "audio"
          ? "Audio mode active. Speak after the AI finishes."
          : "You can type messages to test the agent.",
      });
    } catch (error) {
      console.error("Error starting call:", error);
      toast({
        title: "Error",
        description: "Failed to start test call",
        variant: "destructive",
      });
      endCall();
    }
  }, [activeTab, callMode, nodes, edges, toast, agentId, speakText, startAutoRecording]);

  const endCall = useCallback(async () => {
    isCallActiveRef.current = false;

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
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    window.speechSynthesis?.cancel();

    if (callSessionId) {
      try {
        await api.endTestCallSession(callSessionId);
      } catch (error) {
        console.error("Failed to end test call session:", error);
      }
      setCallSessionId(null);
    }

    setIsCallActive(false);
    setIsRecording(false);
    setIsSpeaking(false);
    isSpeakingRef.current = false;

    toast({
      title: "Call Ended",
      description: `Call duration: ${formatDuration(callDuration)}. Call saved to history.`,
    });
  }, [callDuration, toast, callSessionId]);

  // Manual mic for text mode
  const startRecording = async () => {
    try {
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognitionAPI) {
        toast({
          title: "Speech Recognition Not Supported",
          description: "Your browser doesn't support speech recognition. Please use text input.",
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
      recognition.lang = 'en-US';

      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && transcript.trim()) {
          await handleUserMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'no-speech') {
          toast({
            title: "No speech detected",
            description: "Please speak into your microphone",
          });
        } else if (event.error !== 'aborted') {
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
      try { recognitionRef.current.stop(); } catch {}
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

  const handleClose = () => {
    if (isCallActive) {
      endCall();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-500" />
            Test Agent: {agentName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 px-5 pb-5">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "inbound" | "outbound")}
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

            <TabsContent value="inbound" className="flex-1 flex flex-col min-h-0 mt-3 data-[state=inactive]:hidden">
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
                  onStartCall={startCall}
                  onEndCall={endCall}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onInputChange={setInputMessage}
                  onSendMessage={handleSendMessage}
                  onKeyDown={handleKeyDown}
                  onModeChange={setCallMode}
                  formatDuration={formatDuration}
                />
              )}
            </TabsContent>

            <TabsContent value="outbound" className="flex-1 flex flex-col min-h-0 mt-3 data-[state=inactive]:hidden">
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
                  onStartCall={startCall}
                  onEndCall={endCall}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onInputChange={setInputMessage}
                  onSendMessage={handleSendMessage}
                  onKeyDown={handleKeyDown}
                  onModeChange={setCallMode}
                  formatDuration={formatDuration}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Separate CallInterface component
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
  onStartCall: () => void;
  onEndCall: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onModeChange: (mode: CallMode) => void;
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
  onStartCall,
  onEndCall,
  onStartRecording,
  onStopRecording,
  onInputChange,
  onSendMessage,
  onKeyDown,
  onModeChange,
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
                <span>{currentWorkflowStep}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 border rounded-lg mb-3">
        <div className="p-3">
          {messages.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              {isCallActive ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Starting conversation...</span>
                </div>
              ) : (
                <p className="text-sm">Select a mode and start a call to begin testing</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${
                    message.role === "user" ? "justify-end" : "justify-start"
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
                    <p className="text-sm leading-relaxed">{message.content}</p>
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
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Controls */}
      <div className="space-y-3 shrink-0">
        {/* Text Input - only in text mode when call is active */}
        {isCallActive && callMode === "text" && (
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

        {/* Mode Selection - before call starts */}
        {!isCallActive && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant={callMode === "text" ? "default" : "outline"}
              size="sm"
              onClick={() => onModeChange("text")}
              className="gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Text Mode
            </Button>
            <Button
              variant={callMode === "audio" ? "default" : "outline"}
              size="sm"
              onClick={() => onModeChange("audio")}
              className="gap-2"
            >
              <AudioLines className="w-4 h-4" />
              Audio Mode
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
              {/* Manual mic button - only in text mode */}
              {callMode === "text" && (
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
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                  isRecording
                    ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                    : isSpeaking
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                    : "border-muted bg-muted/30"
                }`}>
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
              ? "Text mode: Type messages or hold mic button to speak"
              : "Audio mode: AI speaks, then auto-listens for your response"}
          </p>
        )}
        {isCallActive && callMode === "text" && (
          <p className="text-xs text-center text-muted-foreground">
            Hold the microphone button to speak, or type a message
          </p>
        )}
        {isCallActive && callMode === "audio" && (
          <p className="text-xs text-center text-muted-foreground">
            {isRecording ? "Listening... speak now (stops after 2s silence)" : isSpeaking ? "AI is speaking..." : isLoading ? "Processing..." : "Waiting..."}
          </p>
        )}
      </div>
    </div>
  );
};

export default TestAgentModal;
