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
  // Find the agent setup node for the base system message
  const agentSetupNode = nodes.find((n) => n.type === "agentSetup");
  const baseSystemMessage =
    agentSetupNode?.data?.systemMessage ||
    "You are a helpful AI assistant for phone conversations.";

  // Find the start node for the given direction
  const startNode = nodes.find(
    (n) => n.type === "callDirection" && n.data?.direction === direction
  );

  if (!startNode) {
    return baseSystemMessage;
  }

  // Build workflow description by traversing the graph
  const workflowSteps: string[] = [];
  const visited = new Set<string>();

  const traverseWorkflow = (nodeId: string, depth: number = 0) => {
    if (visited.has(nodeId) || depth > 10) return;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Skip setup and direction nodes in the workflow description
    if (node.type !== "agentSetup" && node.type !== "callDirection") {
      const nodeLabel = node.data?.label || node.type;
      const nodeType = node.data?.type || node.type;
      const nodeNotes = node.data?.notes;

      let stepDescription = `- ${nodeLabel}`;
      if (nodeType === "scripted") {
        stepDescription += " (follow the script exactly)";
      } else if (nodeType === "dialogue") {
        stepDescription += " (engage in natural conversation)";
      } else if (nodeType === "field_setter") {
        stepDescription += " (collect and save information)";
      } else if (nodeType === "junction") {
        stepDescription += " (decision point based on conditions)";
      } else if (nodeType === "switch") {
        stepDescription += " (route based on user input)";
      } else if (nodeType === "function") {
        stepDescription += " (perform a specific action)";
      } else if (nodeType === "call_transfer") {
        stepDescription += " (transfer the call to another party)";
      } else if (nodeType === "time_limit") {
        stepDescription += " (time-bound action)";
      } else if (nodeType === "reconfigure") {
        stepDescription += " (adjust settings)";
      } else if (nodeType === "fallback") {
        stepDescription += " (handle unexpected situations)";
      }

      if (nodeNotes) {
        stepDescription += `: ${nodeNotes}`;
      }

      workflowSteps.push(stepDescription);
    }

    // Find connected nodes
    const outgoingEdges = edges.filter((e) => e.source === nodeId);
    for (const edge of outgoingEdges) {
      traverseWorkflow(edge.target, depth + 1);
    }
  };

  // Start traversal from the start node
  traverseWorkflow(startNode.id);

  // Build the complete system prompt
  let systemPrompt = baseSystemMessage;

  if (workflowSteps.length > 0) {
    systemPrompt += `\n\n## Call Flow (${direction === "inbound" ? "Inbound Call" : "Outbound Call"}):\n`;
    systemPrompt += workflowSteps.join("\n");
  }

  systemPrompt += `\n\n## Guidelines:
- Keep responses concise and natural for voice conversation
- Be friendly, professional, and helpful
- If you don't understand something, ask for clarification
- Guide the conversation according to the workflow above
- For ${direction} calls: ${direction === "inbound" ? "The customer is calling you, greet them warmly and assist with their needs." : "You are initiating the call, introduce yourself and state the purpose clearly."}`;

  return systemPrompt;
};

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callSessionId, setCallSessionId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const conversationHistoryRef = useRef<Array<{ role: string; content: string }>>([]);

  // Save message to call history
  const saveMessageToHistory = async (sessionId: string, role: "user" | "ai", content: string) => {
    try {
      await api.addTestCallMessage(sessionId, role, content);
    } catch (error) {
      console.error("Failed to save message to history:", error);
    }
  };

  // Check if the direction has a start node
  const hasInboundStart = nodes.some(
    (n) => n.type === "callDirection" && n.data?.direction === "inbound"
  );
  const hasOutboundStart = nodes.some(
    (n) => n.type === "callDirection" && n.data?.direction === "outbound"
  );

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const startCall = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsCallActive(true);
      setMessages([]);
      conversationHistoryRef.current = [];
      setCallDuration(0);

      // Create a test call session for history tracking
      let sessionId: string | null = null;
      try {
        const sessionResult = await api.createTestCallSession(agentId, activeTab);
        if (sessionResult.data?.callSessionId) {
          sessionId = sessionResult.data.callSessionId;
          setCallSessionId(sessionId);
        }
      } catch (sessionError) {
        console.error("Failed to create test call session:", sessionError);
        // Continue without session - call will work but won't be saved to history
      }

      // Start call duration timer
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      // Generate greeting based on direction
      const systemPrompt = generateSystemPromptFromWorkflow(nodes, edges, activeTab);

      // Add system message to history (not displayed)
      conversationHistoryRef.current.push({
        role: "system",
        content: systemPrompt,
      });

      // Generate initial AI greeting
      const greetingPrompt =
        activeTab === "inbound"
          ? "The customer just called. Greet them warmly and ask how you can help."
          : "You are starting an outbound call. Introduce yourself and state the purpose of the call.";

      const aiGreeting = await generateAIResponse(greetingPrompt, systemPrompt);

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

        // Save AI greeting to history
        if (sessionId) {
          saveMessageToHistory(sessionId, "ai", aiGreeting);
        }

        // Speak the greeting
        await speakText(aiGreeting);
      }

      toast({
        title: `${activeTab === "inbound" ? "Inbound" : "Outbound"} Test Call Started`,
        description: "You can now speak or type to test the agent",
      });
    } catch (error) {
      console.error("Error starting call:", error);
      toast({
        title: "Error",
        description: "Failed to start test call",
        variant: "destructive",
      });
      endCall();
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, nodes, edges, toast, agentId]);

  const endCall = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    // End the test call session
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

    toast({
      title: "Call Ended",
      description: `Call duration: ${formatDuration(callDuration)}. Call saved to history.`,
    });
  }, [callDuration, toast, callSessionId]);

  const generateAIResponse = async (
    userMessage: string,
    systemPrompt?: string
  ): Promise<string | null> => {
    try {
      // Use the conversation history for context
      const messages = [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : conversationHistoryRef.current),
        { role: "user", content: userMessage },
      ];

      // Call backend API to generate response
      // For now, we'll use a simple fetch to OpenAI-compatible endpoint
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
            messages: systemPrompt ? messages : [
              ...conversationHistoryRef.current,
              { role: "user", content: userMessage },
            ],
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

  const speakText = async (text: string) => {
    try {
      setIsSpeaking(true);

      // Use browser's speech synthesis as fallback
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onend = () => {
          setIsSpeaking(false);
        };

        utterance.onerror = () => {
          setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("Error speaking text:", error);
      setIsSpeaking(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processAudioInput(audioBlob);
      };

      mediaRecorder.start();
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const processAudioInput = async (audioBlob: Blob) => {
    try {
      setIsLoading(true);

      // For now, use Web Speech API for transcription
      // In production, you'd send this to the backend for Whisper transcription
      const transcribedText = await transcribeAudio(audioBlob);

      if (transcribedText) {
        await handleUserMessage(transcribedText);
      }
    } catch (error) {
      console.error("Error processing audio:", error);
      toast({
        title: "Error",
        description: "Failed to process audio input",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob): Promise<string | null> => {
    // Use Web Speech API for browser-based transcription
    return new Promise((resolve) => {
      if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
        toast({
          title: "Speech Recognition Not Supported",
          description: "Please use text input instead",
          variant: "destructive",
        });
        resolve(null);
        return;
      }

      // For simplicity, we'll just prompt the user to use text input
      // In production, send to backend for Whisper transcription
      resolve(null);
    });
  };

  const handleUserMessage = async (text: string) => {
    if (!text.trim() || !isCallActive) return;

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

    // Save user message to history
    if (callSessionId) {
      saveMessageToHistory(callSessionId, "user", text);
    }

    setIsLoading(true);
    setInputMessage("");

    try {
      const aiResponse = await generateAIResponse(text);

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

        // Save AI response to history
        if (callSessionId) {
          saveMessageToHistory(callSessionId, "ai", aiResponse);
        }

        // Speak the response
        await speakText(aiResponse);
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
      toast({
        title: "Error",
        description: "Failed to get AI response",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      handleUserMessage(inputMessage);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
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
      <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-500" />
            Test Agent: {agentName}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "inbound" | "outbound")}
          className="flex-1 flex flex-col px-6"
        >
          <TabsList className="grid w-full grid-cols-2">
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

          <TabsContent value="inbound" className="flex-1 flex flex-col mt-4">
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
                messages={messages}
                inputMessage={inputMessage}
                messagesEndRef={messagesEndRef}
                onStartCall={startCall}
                onEndCall={endCall}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onInputChange={setInputMessage}
                onSendMessage={handleSendMessage}
                onKeyPress={handleKeyPress}
                formatDuration={formatDuration}
              />
            )}
          </TabsContent>

          <TabsContent value="outbound" className="flex-1 flex flex-col mt-4">
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
                messages={messages}
                inputMessage={inputMessage}
                messagesEndRef={messagesEndRef}
                onStartCall={startCall}
                onEndCall={endCall}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onInputChange={setInputMessage}
                onSendMessage={handleSendMessage}
                onKeyPress={handleKeyPress}
                formatDuration={formatDuration}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// Separate CallInterface component for reuse
interface CallInterfaceProps {
  isCallActive: boolean;
  isLoading: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  callDuration: number;
  messages: Message[];
  inputMessage: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onStartCall: () => void;
  onEndCall: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  formatDuration: (seconds: number) => string;
}

const CallInterface = ({
  isCallActive,
  isLoading,
  isRecording,
  isSpeaking,
  callDuration,
  messages,
  inputMessage,
  messagesEndRef,
  onStartCall,
  onEndCall,
  onStartRecording,
  onStopRecording,
  onInputChange,
  onSendMessage,
  onKeyPress,
  formatDuration,
}: CallInterfaceProps) => {
  return (
    <div className="flex-1 flex flex-col">
      {/* Call Status Bar */}
      {isCallActive && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-700">
              Call Active
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isSpeaking && (
              <div className="flex items-center gap-1 text-purple-600">
                <Volume2 className="w-4 h-4 animate-pulse" />
                <span className="text-xs">Speaking...</span>
              </div>
            )}
            <span className="text-sm font-mono text-green-700">
              {formatDuration(callDuration)}
            </span>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 border rounded-lg p-4 mb-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            {isCallActive ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Starting conversation...</span>
              </div>
            ) : (
              <p>Start a call to begin testing</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "ai" && (
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-purple-600" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <span
                    className={`text-xs mt-1 block ${
                      message.role === "user"
                        ? "text-blue-100"
                        : "text-gray-500"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Controls */}
      <div className="space-y-3 pb-6">
        {/* Text Input */}
        {isCallActive && (
          <div className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyPress={onKeyPress}
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
              <Button
                onClick={onEndCall}
                className="bg-red-600 hover:bg-red-700 text-white w-12 h-12 rounded-full"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>

        {isCallActive && (
          <p className="text-xs text-center text-muted-foreground">
            Hold the microphone button to speak, or type a message
          </p>
        )}
      </div>
    </div>
  );
};

export default TestAgentModal;
