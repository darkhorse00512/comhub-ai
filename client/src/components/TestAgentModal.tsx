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
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { Node, Edge } from "@/components/FlowCanvas";

interface HistoryCallItem {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: "ringing" | "active" | "ended" | "failed";
  direction: "inbound" | "outbound";
  callerNumber: string | null;
  calleeNumber: string | null;
  duration?: number;
  recordingUrl?: string;
}

interface HistoryMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
}

interface Message {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  timestamp: Date;
  nodeLabel?: string;
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

// Evaluate a condition for junction nodes
const evaluateCondition = (
  fieldValue: any,
  operator: string,
  compareValue: string
): boolean => {
  switch (operator) {
    case "==":
      return String(fieldValue ?? "") === String(compareValue);
    case "!=":
      return String(fieldValue ?? "") !== String(compareValue);
    case ">":
      return Number(fieldValue) > Number(compareValue);
    case "<":
      return Number(fieldValue) < Number(compareValue);
    case ">=":
      return Number(fieldValue) >= Number(compareValue);
    case "<=":
      return Number(fieldValue) <= Number(compareValue);
    case "is_null":
      return fieldValue === null || fieldValue === undefined || fieldValue === "";
    case "is_not_null":
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== "";
    default:
      return false;
  }
};

// Parse AI response to detect stage completion signal
const parseAIResponse = (
  response: string
): { text: string; isComplete: boolean; transition?: string } => {
  // Check for [TRANSITION:name] first
  const transitionMatch = response.match(/\[TRANSITION:([^\]]+)\]/);
  const transition = transitionMatch ? transitionMatch[1].trim() : undefined;

  const isComplete =
    !!transition ||
    response.includes("[NEXT]") ||
    response.includes("[STAGE_COMPLETE]");
  const text = response
    .replace(/\[TRANSITION:[^\]]+\]/g, "")
    .replace(/\[NEXT\]/g, "")
    .replace(/\[STAGE_COMPLETE\]/g, "")
    .trim();
  return { text, isComplete, transition };
};

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

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryCallItem[]>([]);
  const [selectedHistoryCall, setSelectedHistoryCall] = useState<HistoryCallItem | null>(null);
  const [historyMessages, setHistoryMessages] = useState<HistoryMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingHistoryMessages, setLoadingHistoryMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Workflow execution refs
  const isCallActiveRef = useRef(false);
  const callModeRef = useRef<CallMode>("text");
  const isSpeakingRef = useRef(false);
  const agentSystemMessageRef = useRef("");
  const workflowFieldsRef = useRef<Record<string, any>>({});
  const dialogueResolveRef = useRef<((transition?: string) => void) | null>(null);
  const activeDialogueNodeRef = useRef<Node | null>(null);
  const dialogueTurnCountRef = useRef(0);
  const dialogueMessagesRef = useRef<Array<{ role: string; content: string }>>([]);
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

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    setTimeout(() => {
      if (!isCallActiveRef.current || callModeRef.current !== "audio") return;

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
            callModeRef.current === "audio"
          ) {
            startAutoRecording();
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error === "no-speech") {
            setIsRecording(false);
            if (
              isCallActiveRef.current &&
              callModeRef.current === "audio"
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

  // --- AI call for dialogue nodes only ---
  const generateDialogueResponse = useCallback(
    async (userMessage: string): Promise<string | null> => {
      try {
        const msgs = [
          ...dialogueMessagesRef.current,
          { role: "user", content: userMessage },
        ];

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
    },
    [agentId, activeTab]
  );

  // Build the system prompt for a dialogue stage
  const buildDialogueSystemPrompt = useCallback((node: Node): string => {
    let prompt =
      agentSystemMessageRef.current ||
      "You are a helpful AI phone assistant.";

    prompt += `\n\n---\n\n## Current Conversation Stage: "${node.data?.label || "Dialogue"}"`;
    prompt += `\n\n### Stage Instructions:\n${node.data?.stageMessage || "Engage in natural conversation with the caller."}`;

    // Extra instructions
    const extraInstructions: string[] = (node.data?.extraInstructions || []).filter((i: string) => i.trim());
    if (extraInstructions.length > 0) {
      prompt += `\n\n### Additional Instructions:`;
      extraInstructions.forEach((inst: string, idx: number) => {
        prompt += `\n${idx + 1}. ${inst}`;
      });
    }

    // Stage overrides
    const overrides: Array<{ key: string; value: string }> = (node.data?.stageOverrides || []).filter((o: any) => o.key.trim());
    if (overrides.length > 0) {
      prompt += `\n\n### Stage Settings Overrides:`;
      overrides.forEach((o: any) => {
        prompt += `\n- ${o.key}: ${o.value}`;
      });
    }

    // Enabled functions
    const enabledFunctions: Array<{ name: string; enabled: boolean }> = (node.data?.functions || []).filter((f: any) => f.enabled);
    if (enabledFunctions.length > 0) {
      prompt += `\n\n### Available Functions:`;
      prompt += `\nYou have access to the following functions in this stage: ${enabledFunctions.map((f: any) => f.name).join(", ")}`;
      prompt += `\nYou can reference these functions when appropriate in the conversation.`;
    }

    // Enabled knowledge bases
    const enabledKBs: Array<{ name: string; enabled: boolean }> = (node.data?.knowledgeBases || []).filter((kb: any) => kb.enabled);
    if (enabledKBs.length > 0) {
      prompt += `\n\n### Knowledge Bases:`;
      prompt += `\nYou have access to the following knowledge bases: ${enabledKBs.map((kb: any) => kb.name).join(", ")}`;
      prompt += `\nUse information from these knowledge bases to provide accurate, informed responses.`;
    }

    const maxTurns = parseInt(node.data?.maxTurns);
    if (maxTurns > 0) {
      prompt += `\n\nYou have a maximum of ${maxTurns} conversation turns in this stage.`;
    }

    // Transitions
    const transitions: Array<{ id: string; name: string }> = node.data?.transitions || [];

    if (transitions.length > 0) {
      prompt += `\n\n### Transitions:
This stage has the following named transitions:
${transitions.map((t: any) => `- "${t.name}"`).join("\n")}

When the conversation reaches a point where it should move to a specific transition, append [TRANSITION:transition_name] at the very end of your response.
For example: [TRANSITION:${transitions[0].name}]

### Important Rules:
- Follow the stage instructions precisely
- Keep responses concise and natural for voice conversation
- Be friendly and professional
- Choose the most appropriate transition based on the conversation outcome
- Only include [TRANSITION:name] when the stage objectives are fulfilled and you are ready to move on
- Do NOT say the transition signal aloud - it is an invisible system signal
- If the conversation needs to continue, do NOT include any transition signal`;
    } else {
      prompt += `\n\n### Important Rules:
- Follow the stage instructions precisely
- Keep responses concise and natural for voice conversation
- Be friendly and professional
- When you have completed the objectives of this conversation stage, append [NEXT] at the very end of your response
- Only include [NEXT] when the stage objectives are truly fulfilled
- Do NOT say "[NEXT]" aloud - it is an invisible system signal
- If the conversation needs to continue, do NOT include [NEXT]`;
    }

    return prompt;
  }, []);

  // --- Workflow edge traversal ---
  const getNextNodeId = useCallback(
    (currentNodeId: string): string | null => {
      const outEdges = edges.filter((e) => e.source === currentNodeId);
      if (outEdges.length === 0) return null;
      return outEdges[0].target;
    },
    [edges]
  );

  const evaluateJunction = useCallback(
    (node: Node): string | null => {
      const fieldName = node.data?.left?.field_name;
      const operator = node.data?.operator || "==";
      const compareValue = node.data?.right?.literal || "";
      const fieldValue = workflowFieldsRef.current[fieldName];

      const result = evaluateCondition(fieldValue, operator, compareValue);
      const outEdges = edges.filter((e) => e.source === node.id);

      if (result) {
        return outEdges[0]?.target || null;
      } else {
        return (outEdges[1] || outEdges[0])?.target || null;
      }
    },
    [edges]
  );

  const evaluateSwitch = useCallback(
    (node: Node): string | null => {
      const switchField = node.data?.switchField;
      const fieldValue = workflowFieldsRef.current[switchField];
      const cases = node.data?.cases || [];
      const outEdges = edges.filter((e) => e.source === node.id);

      const matchIndex = cases.findIndex(
        (c: any) => String(c.value) === String(fieldValue)
      );

      if (matchIndex >= 0 && outEdges[matchIndex]) {
        return outEdges[matchIndex].target;
      }

      // Default: first edge
      return outEdges[0]?.target || null;
    },
    [edges]
  );

  // --- Dialogue stage execution (blocks until complete, returns transition name if any) ---
  const runDialogueStage = useCallback(
    async (node: Node): Promise<string | undefined> => {
      return new Promise<string | undefined>((resolve) => {
        dialogueResolveRef.current = resolve;
        activeDialogueNodeRef.current = node;
        dialogueTurnCountRef.current = 0;

        const stagePrompt = buildDialogueSystemPrompt(node);
        dialogueMessagesRef.current = [
          { role: "system", content: stagePrompt },
        ];

        setCurrentWorkflowStep(node.data?.label || "AI Dialogue");

        // Generate first AI message for this stage
        generateDialogueResponse(
          "Begin the conversation for this stage. Greet or address the caller following your stage instructions."
        ).then(async (response) => {
          if (!isCallActiveRef.current) {
            resolve(undefined);
            return;
          }

          if (response) {
            const { text, isComplete, transition } = parseAIResponse(response);
            await outputAndSpeak(text, node.data?.label);
            dialogueMessagesRef.current.push({
              role: "assistant",
              content: text,
            });

            if (isComplete) {
              activeDialogueNodeRef.current = null;
              dialogueResolveRef.current = null;
              resolve(transition);
              return;
            }

            // Wait for user input
            if (callModeRef.current === "audio" && isCallActiveRef.current) {
              startAutoRecording();
            }
          } else {
            // AI failed - try to continue anyway
            addMessage(
              "system",
              "AI response unavailable. Advancing workflow."
            );
            activeDialogueNodeRef.current = null;
            dialogueResolveRef.current = null;
            resolve(undefined);
          }
        });
      });
    },
    [
      buildDialogueSystemPrompt,
      generateDialogueResponse,
      outputAndSpeak,
      startAutoRecording,
      addMessage,
    ]
  );

  // --- Handle user message (only active during dialogue nodes) ---
  const handleUserMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !isCallActiveRef.current) return;

      addMessage("user", text);
      setInputMessage("");

      const dialogueNode = activeDialogueNodeRef.current;
      if (!dialogueNode) {
        // Not in a dialogue stage - ignore user input
        addMessage(
          "system",
          "Waiting for the next conversation stage..."
        );
        return;
      }

      setIsLoading(true);
      dialogueMessagesRef.current.push({ role: "user", content: text });
      dialogueTurnCountRef.current++;

      const aiResponse = await generateDialogueResponse(text);

      if (!isCallActiveRef.current) {
        setIsLoading(false);
        return;
      }

      if (aiResponse) {
        const { text: responseText, isComplete, transition } = parseAIResponse(aiResponse);
        await outputAndSpeak(responseText, dialogueNode.data?.label);
        dialogueMessagesRef.current.push({
          role: "assistant",
          content: responseText,
        });

        const maxTurns = parseInt(dialogueNode.data?.maxTurns) || 0;
        const shouldAdvance =
          isComplete ||
          (maxTurns > 0 && dialogueTurnCountRef.current >= maxTurns);

        setIsLoading(false);

        if (shouldAdvance) {
          if (maxTurns > 0 && dialogueTurnCountRef.current >= maxTurns && !isComplete) {
            addMessage("system", `Max turns (${maxTurns}) reached. Moving to next stage.`);
          }
          if (transition) {
            addMessage("system", `Transition: ${transition}`);
          }
          const resolve = dialogueResolveRef.current;
          activeDialogueNodeRef.current = null;
          dialogueResolveRef.current = null;
          resolve?.(transition);
        } else {
          // Continue listening in audio mode
          if (callModeRef.current === "audio" && isCallActiveRef.current) {
            startAutoRecording();
          }
        }
      } else {
        setIsLoading(false);
        addMessage("system", "Failed to get AI response. Try again.");
        if (callModeRef.current === "audio" && isCallActiveRef.current) {
          startAutoRecording();
        }
      }
    },
    [generateDialogueResponse, outputAndSpeak, startAutoRecording, addMessage]
  );

  // --- Main workflow execution engine ---
  const executeWorkflow = useCallback(
    async (startNodeId: string) => {
      let currentId: string | null = startNodeId;

      while (currentId && isCallActiveRef.current) {
        const node = nodes.find((n) => n.id === currentId);
        if (!node) break;

        const nodeType = node.data?.type || node.type;

        switch (nodeType) {
          case "agentSetup": {
            agentSystemMessageRef.current =
              node.data?.systemMessage || "";
            currentId = getNextNodeId(currentId);
            break;
          }

          case "callDirection": {
            currentId = getNextNodeId(currentId);
            break;
          }

          case "scripted": {
            setCurrentWorkflowStep(node.data?.label || "Scripted Message");
            const script = node.data?.script || "No script configured.";
            await outputAndSpeak(script, node.data?.label);
            // Small pause between scripted messages
            await new Promise((r) => setTimeout(r, 300));
            currentId = getNextNodeId(currentId);
            break;
          }

          case "dialogue": {
            // AI handles this stage - blocks until dialogue completes
            setIsLoading(false);
            const transitionName = await runDialogueStage(node);
            if (!isCallActiveRef.current) return;
            // Small pause before next node
            await new Promise((r) => setTimeout(r, 300));

            // Use transition name to pick the correct outgoing edge
            const nodeTransitions: Array<{ id: string; name: string }> = node.data?.transitions || [];
            const outEdges = edges.filter((e) => e.source === node.id);

            if (transitionName && nodeTransitions.length > 0) {
              const transitionIndex = nodeTransitions.findIndex(
                (t) => t.name.toLowerCase() === transitionName.toLowerCase()
              );
              if (transitionIndex >= 0 && outEdges[transitionIndex]) {
                currentId = outEdges[transitionIndex].target;
              } else {
                // Transition name didn't match - fall back to first edge
                currentId = outEdges[0]?.target || null;
              }
            } else {
              currentId = getNextNodeId(currentId);
            }
            break;
          }

          case "field_setter": {
            setCurrentWorkflowStep(node.data?.label || "Setting Field");
            const fieldName = node.data?.fieldName;
            const value = node.data?.value;
            const valueType = node.data?.valueType || "text";

            if (fieldName) {
              let parsedValue = value;
              if (valueType === "number") parsedValue = Number(value);
              if (valueType === "boolean")
                parsedValue = value === "true" || value === true;

              workflowFieldsRef.current[fieldName] = parsedValue;
              addMessage(
                "system",
                `Field "${fieldName}" set to ${JSON.stringify(parsedValue)}`
              );
            }
            currentId = getNextNodeId(currentId);
            break;
          }

          case "junction": {
            setCurrentWorkflowStep(node.data?.label || "Evaluating Condition");
            const fieldName = node.data?.left?.field_name || "";
            const operator = node.data?.operator || "==";
            const compareVal = node.data?.right?.literal || "";
            const fieldVal = workflowFieldsRef.current[fieldName];
            const result = evaluateCondition(fieldVal, operator, compareVal);

            addMessage(
              "system",
              `Condition: ${fieldName} ${operator} "${compareVal}" → ${result ? "True" : "False"}`
            );

            currentId = evaluateJunction(node);
            break;
          }

          case "switch": {
            setCurrentWorkflowStep(node.data?.label || "Switch");
            const switchField = node.data?.switchField || "";
            const switchVal = workflowFieldsRef.current[switchField];
            addMessage(
              "system",
              `Switch: ${switchField} = "${switchVal ?? "undefined"}"`
            );
            currentId = evaluateSwitch(node);
            break;
          }

          case "call_transfer": {
            setCurrentWorkflowStep(node.data?.label || "Call Transfer");
            const transferMsg =
              node.data?.transferMessage ||
              `Transferring your call to ${node.data?.transferTo || "an agent"}.`;
            await outputAndSpeak(transferMsg, node.data?.label);
            addMessage(
              "system",
              `Call transferred to ${node.data?.transferTo || "agent"} (${node.data?.transferType || "cold"} transfer)`
            );
            currentId = null; // End workflow
            break;
          }

          case "voicemail": {
            setCurrentWorkflowStep(node.data?.label || "Voicemail");
            const greeting =
              node.data?.greetingMessage ||
              "Please leave a message after the beep.";
            await outputAndSpeak(greeting, node.data?.label);
            addMessage("system", "Voicemail recording started.");
            currentId = null; // End workflow
            break;
          }

          case "time_limit": {
            setCurrentWorkflowStep(node.data?.label || "Time Limit");
            const maxDuration = node.data?.maxDuration;
            if (maxDuration) {
              addMessage(
                "system",
                `Time limit set: ${maxDuration}s`
              );
            }
            currentId = getNextNodeId(currentId);
            break;
          }

          case "reconfigure": {
            setCurrentWorkflowStep(node.data?.label || "Reconfigure");
            addMessage(
              "system",
              `Agent reconfigured: ${node.data?.setting || "setting"} → ${node.data?.newValue || "value"}`
            );
            currentId = getNextNodeId(currentId);
            break;
          }

          case "fallback": {
            setCurrentWorkflowStep(node.data?.label || "Fallback");
            const fallbackMsg =
              node.data?.fallbackMessage ||
              "I'm sorry, I didn't understand that.";
            await outputAndSpeak(fallbackMsg, node.data?.label);
            currentId = getNextNodeId(currentId);
            break;
          }

          case "function": {
            setCurrentWorkflowStep(node.data?.label || "Function Call");
            addMessage(
              "system",
              `Function "${node.data?.functionName || "unknown"}" executed (simulated)`
            );
            currentId = getNextNodeId(currentId);
            break;
          }

          default: {
            // Unknown node type - just advance
            currentId = getNextNodeId(currentId);
            break;
          }
        }
      }

      // Workflow completed
      if (isCallActiveRef.current) {
        setCurrentWorkflowStep("Workflow completed");
        addMessage("system", "Call workflow completed.");
      }
    },
    [
      nodes,
      edges,
      getNextNodeId,
      evaluateJunction,
      evaluateSwitch,
      outputAndSpeak,
      runDialogueStage,
      addMessage,
    ]
  );

  // --- Start call ---
  const startCall = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsCallActive(true);
      isCallActiveRef.current = true;
      setMessages([]);
      workflowFieldsRef.current = {};
      dialogueResolveRef.current = null;
      activeDialogueNodeRef.current = null;
      dialogueTurnCountRef.current = 0;
      dialogueMessagesRef.current = [];
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

      // Create test call session
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

      // Find agent setup node and extract system message
      const agentSetupNode = nodes.find((n) => n.type === "agentSetup");
      agentSystemMessageRef.current =
        agentSetupNode?.data?.systemMessage || "";

      // Find start node for selected direction
      const startNode = nodes.find(
        (n) =>
          n.type === "callDirection" && n.data?.direction === activeTab
      );

      if (!startNode) {
        toast({
          title: "No Start Node",
          description: `No ${activeTab} call direction node found in the workflow.`,
          variant: "destructive",
        });
        setIsCallActive(false);
        isCallActiveRef.current = false;
        setIsLoading(false);
        return;
      }

      setIsLoading(false);

      toast({
        title: `${activeTab === "inbound" ? "Inbound" : "Outbound"} Test Call Started`,
        description:
          callMode === "audio"
            ? "Audio mode active. The workflow will execute step by step."
            : "Text mode active. The workflow will execute step by step.",
      });

      // Execute the workflow starting from callDirection
      await executeWorkflow(startNode.id);
    } catch (error) {
      console.error("Error starting call:", error);
      toast({
        title: "Error",
        description: "Failed to start test call",
        variant: "destructive",
      });
      endCall();
    }
  }, [activeTab, callMode, nodes, toast, agentId, executeWorkflow]);

  // --- End call ---
  const endCall = useCallback(async () => {
    isCallActiveRef.current = false;

    // Resolve any pending dialogue stage
    if (dialogueResolveRef.current) {
      dialogueResolveRef.current(undefined);
      dialogueResolveRef.current = null;
    }
    activeDialogueNodeRef.current = null;

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

    toast({
      title: "Call Ended",
      description: `Call duration: ${formatDuration(callDuration)}. Call saved to history.`,
    });
  }, [callDuration, toast, callSessionId]);

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
      const result = await api.getCallHistory();
      if (!result.error) {
        setHistoryData(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch call history:", error);
    }
    setLoadingHistory(false);
  }, []);

  const openHistory = useCallback(() => {
    setShowHistory(true);
    setSelectedHistoryCall(null);
    setHistoryMessages([]);
    fetchHistory();
  }, [fetchHistory]);

  const closeHistory = useCallback(() => {
    setShowHistory(false);
    setSelectedHistoryCall(null);
    setHistoryMessages([]);
  }, []);

  const selectHistoryCall = useCallback(async (call: HistoryCallItem) => {
    setSelectedHistoryCall(call);
    setLoadingHistoryMessages(true);
    try {
      const result = await api.getCallMessages(call.id);
      if (!result.error) {
        setHistoryMessages(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch call messages:", error);
    }
    setLoadingHistoryMessages(false);
  }, []);

  const formatHistoryDuration = (startedAt: string, endedAt: string | null): string => {
    if (!endedAt) return "0:00";
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    const seconds = Math.floor((end - start) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
                onClick={selectedHistoryCall ? () => { setSelectedHistoryCall(null); setHistoryMessages([]); } : closeHistory}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <History className="w-5 h-5 text-purple-500" />
              {selectedHistoryCall ? "Call Details" : "Call History"}
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
                  title="View call history"
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
              historyData={historyData}
              selectedCall={selectedHistoryCall}
              historyMessages={historyMessages}
              loadingHistory={loadingHistory}
              loadingMessages={loadingHistoryMessages}
              onSelectCall={selectHistoryCall}
              formatDurationFromDates={formatHistoryDuration}
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
                  hasActiveDialogue={!!activeDialogueNodeRef.current}
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
                  hasActiveDialogue={!!activeDialogueNodeRef.current}
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// --- Call History View component ---
interface CallHistoryViewProps {
  historyData: HistoryCallItem[];
  selectedCall: HistoryCallItem | null;
  historyMessages: HistoryMessage[];
  loadingHistory: boolean;
  loadingMessages: boolean;
  onSelectCall: (call: HistoryCallItem) => void;
  formatDurationFromDates: (startedAt: string, endedAt: string | null) => string;
}

const CallHistoryView = ({
  historyData,
  selectedCall,
  historyMessages,
  loadingHistory,
  loadingMessages,
  onSelectCall,
  formatDurationFromDates,
}: CallHistoryViewProps) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "ended":
        return { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", border: "border-green-200", label: "Completed" };
      case "active":
        return { icon: Phone, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", label: "Active" };
      case "failed":
        return { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", label: "Failed" };
      default:
        return { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200", label: "Ringing" };
    }
  };

  // Selected call detail view
  if (selectedCall) {
    const statusInfo = getStatusConfig(selectedCall.status);
    const StatusIcon = statusInfo.icon;

    return (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Call Info */}
        <div className={`rounded-xl p-4 mb-3 ${statusInfo.bg} border ${statusInfo.border}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg bg-white/80`}>
                {selectedCall.direction === "inbound" ? (
                  <PhoneIncoming className={`w-5 h-5 ${statusInfo.color}`} />
                ) : (
                  <PhoneOutgoing className={`w-5 h-5 ${statusInfo.color}`} />
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900 capitalize">
                  {selectedCall.direction} Call
                </p>
                <p className="text-xs text-gray-500">
                  {format(new Date(selectedCall.startedAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
              <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-medium">{formatDurationFromDates(selectedCall.startedAt, selectedCall.endedAt)}</span>
            </div>
            {(selectedCall.callerNumber || selectedCall.calleeNumber) && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Phone className="w-3.5 h-3.5" />
                <span>{selectedCall.direction === "inbound" ? selectedCall.callerNumber : selectedCall.calleeNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className="flex items-center gap-2 mb-2 px-1">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Conversation</span>
          <span className="text-xs text-gray-400">
            {historyMessages.length} message{historyMessages.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex-1 h-0 overflow-y-auto border rounded-xl">
          <div className="p-3">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : historyMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-sm text-muted-foreground">No messages recorded</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {historyMessages.map((msg) => (
                  <div key={msg.id}>
                    <div
                      className={`flex gap-2.5 ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "ai" && (
                        <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5 text-purple-600" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${
                          msg.role === "user"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-900"
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <span
                          className={`text-[10px] mt-1.5 block ${
                            msg.role === "user" ? "text-blue-100" : "text-gray-400"
                          }`}
                        >
                          {format(new Date(msg.timestamp), "h:mm:ss a")}
                        </span>
                      </div>
                      {msg.role === "user" && (
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Call list view
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {loadingHistory ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            <span className="text-sm text-muted-foreground">Loading history...</span>
          </div>
        </div>
      ) : historyData.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <Phone className="w-7 h-7 text-gray-300" />
          </div>
          <p className="font-medium text-gray-700 mb-1">No call history yet</p>
          <p className="text-xs text-muted-foreground max-w-[250px]">
            Test calls and real calls will appear here once you start testing
          </p>
        </div>
      ) : (
        <div className="flex-1 h-0 overflow-y-auto">
          <div className="space-y-2">
            {historyData.map((call) => {
              const statusInfo = getStatusConfig(call.status);
              const StatusIcon = statusInfo.icon;
              const duration = formatDurationFromDates(call.startedAt, call.endedAt);

              return (
                <button
                  key={call.id}
                  onClick={() => onSelectCall(call)}
                  className="w-full text-left rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50/30 transition-all p-3.5 group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${statusInfo.bg}`}>
                        {call.direction === "inbound" ? (
                          <PhoneIncoming className={`w-4 h-4 ${statusInfo.color}`} />
                        ) : (
                          <PhoneOutgoing className={`w-4 h-4 ${statusInfo.color}`} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {call.direction} Call
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {format(new Date(call.startedAt), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <StatusIcon className={`w-3.5 h-3.5 ${statusInfo.color}`} />
                          <span className={`text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400 font-mono">
                          {duration}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-400 transition-colors" />
                    </div>
                  </div>
                  {(call.callerNumber || call.calleeNumber) &&
                    call.callerNumber !== "test-caller" &&
                    call.calleeNumber !== "test-callee" && (
                    <div className="text-[11px] text-gray-400 ml-9">
                      {call.direction === "inbound" ? call.callerNumber : call.calleeNumber}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {historyData.length > 0 && (
        <div className="pt-3 mt-2 border-t shrink-0">
          <p className="text-xs text-center text-muted-foreground">
            {historyData.length} call{historyData.length !== 1 ? "s" : ""} in history
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
  hasActiveDialogue: boolean;
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
  hasActiveDialogue,
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
        {/* Text Input - only in text mode when call is active and dialogue is active */}
        {isCallActive && callMode === "text" && hasActiveDialogue && (
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
              {/* Manual mic button - only in text mode during dialogue */}
              {callMode === "text" && hasActiveDialogue && (
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
        {isCallActive && callMode === "text" && !hasActiveDialogue && (
          <p className="text-xs text-center text-muted-foreground">
            Executing workflow... waiting for dialogue stage
          </p>
        )}
        {isCallActive && callMode === "text" && hasActiveDialogue && (
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
                  : hasActiveDialogue
                    ? "Waiting for your response..."
                    : "Executing workflow..."}
          </p>
        )}
      </div>
    </div>
  );
};

export default TestAgentModal;
