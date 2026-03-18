import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FlowCanvas, FlowCanvasRef, Node, Edge } from "@/components/FlowCanvas";
import {
  Save,
  Bug,
  Rocket,
  History,
  Database,
  Phone,
  MessageSquare,
  FileCode,
  GitBranch,
  ToggleLeft,
  Zap,
  Clock,
  Wrench,
  AlertCircle,
  Sparkles,
  AudioLines,
  X,
  Plus,
  Voicemail,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import UnsavedChangesModal from "@/components/UnsavedChangesModal";
import AgentSetupNode from "@/components/nodes/AgentSetupNode";
import CallDirectionNode from "@/components/nodes/CallDirectionNode";
import ScriptedNode from "@/components/nodes/ScriptedNode";
import DialogueNode from "@/components/nodes/DialogueNode";
import FieldSetterNode from "@/components/nodes/FieldSetterNode";
import JunctionNode from "@/components/nodes/JunctionNode";
import SwitchNode from "@/components/nodes/SwitchNode";
import PlayAudioNode from "@/components/nodes/PlayAudioNode";
import CallTransferNode from "@/components/nodes/CallTransferNode";
import TimeLimitNode from "@/components/nodes/TimeLimitNode";
import ReconfigureNode from "@/components/nodes/ReconfigureNode";
import FallbackNode from "@/components/nodes/FallbackNode";
import VoicemailNode from "@/components/nodes/VoicemailNode";
import EndNode from "@/components/nodes/EndNode";
import TestAgentModal from "@/components/TestAgentModal";
import AIWorkflowGenerator from "@/components/AIWorkflowGenerator";
import HistoryPanel from "@/components/HistoryPanel";
import FieldsPanel, { WorkflowField } from "@/components/FieldsPanel";
import DebugPanel from "@/components/DebugPanel";
import { validateWorkflow, ValidationItem } from "@/utils/workflowValidator";
import { useAgentContext } from "@/components/agent/AgentLayout";

const nodeCategories = [
  { type: "scripted", label: "Scripted", icon: FileCode, color: "bg-blue-100 text-blue-600", borderColor: "border-blue-400" },
  { type: "dialogue", label: "Dialogue", icon: MessageSquare, color: "bg-green-100 text-green-600", borderColor: "border-green-400" },
  { type: "field_setter", label: "Field Setter", icon: Zap, color: "bg-yellow-100 text-yellow-600", borderColor: "border-yellow-400" },
  { type: "junction", label: "Junction", icon: GitBranch, color: "bg-purple-100 text-purple-600", borderColor: "border-purple-400" },
  { type: "switch", label: "Switch", icon: ToggleLeft, color: "bg-pink-100 text-pink-600", borderColor: "border-pink-400" },
  { type: "play_audio", label: "Play Audio", icon: Volume2, color: "bg-indigo-100 text-indigo-600", borderColor: "border-indigo-400" },
  { type: "call_transfer", label: "Call Transfer", icon: Phone, color: "bg-teal-100 text-teal-600", borderColor: "border-teal-400" },
  { type: "time_limit", label: "Time Limit", icon: Clock, color: "bg-red-100 text-red-600", borderColor: "border-red-400" },
  { type: "reconfigure", label: "Reconfigure", icon: Wrench, color: "bg-indigo-100 text-indigo-600", borderColor: "border-indigo-400" },
  { type: "fallback", label: "Fallback", icon: AlertCircle, color: "bg-gray-100 text-gray-600", borderColor: "border-gray-400" },
  { type: "voicemail", label: "Voicemail", icon: Voicemail, color: "bg-amber-50 text-amber-600", borderColor: "border-amber-300" },
];

const AgentStudioPage = () => {
  const { agent, setAgent: onAgentUpdate } = useAgentContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [workflowFields, setWorkflowFields] = useState<WorkflowField[]>([]);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testMode, setTestMode] = useState<"text" | "audio">("text");
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showNodePalette, setShowNodePalette] = useState(true);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showFieldsPanel, setShowFieldsPanel] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugErrors, setDebugErrors] = useState<ValidationItem[]>([]);
  const [debugWarnings, setDebugWarnings] = useState<ValidationItem[]>([]);
  const [debugPassed, setDebugPassed] = useState(false);
  const [errorNodeIds, setErrorNodeIds] = useState<Set<string>>(new Set());

  // Unsaved changes tracking
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const savedStateRef = useRef<{ nodes: Node[]; edges: Edge[]; fields: WorkflowField[] } | null>(null);
  const flowCanvasRef = useRef<FlowCanvasRef>(null);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (!savedStateRef.current) return false;
    const savedNodes = JSON.stringify(savedStateRef.current.nodes);
    const savedEdges = JSON.stringify(savedStateRef.current.edges);
    const savedFields = JSON.stringify(savedStateRef.current.fields);
    const currentNodes = JSON.stringify(nodes);
    const currentEdges = JSON.stringify(edges);
    const currentFields = JSON.stringify(workflowFields);
    return savedNodes !== currentNodes || savedEdges !== currentEdges || savedFields !== currentFields;
  }, [nodes, edges, workflowFields]);

  // Handle browser beforeunload event
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Load flow from agent config
  useEffect(() => {
    if (agent.config?.flow) {
      const loadedNodes = agent.config.flow.nodes || [];
      const loadedEdges = agent.config.flow.edges || [];
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      savedStateRef.current = { nodes: loadedNodes, edges: loadedEdges, fields: agent.config?.fields || [] };
    } else {
      initializeDefaultFlow();
    }
    setWorkflowFields(agent.config?.fields || []);
  }, [agent.id]);

  // Clear debug error highlights when workflow changes
  useEffect(() => {
    if (errorNodeIds.size > 0) {
      setErrorNodeIds(new Set());
      setDebugPassed(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // Node action handlers
  const handleCloneNode = useCallback((nodeId: string) => {
    setNodes((currentNodes) => {
      const nodeToClone = currentNodes.find((n) => n.id === nodeId);
      if (!nodeToClone) return currentNodes;

      const newNode: Node = {
        ...nodeToClone,
        id: `clone-${Date.now()}`,
        position: {
          x: nodeToClone.position.x + 50,
          y: nodeToClone.position.y + 50,
        },
        data: {
          ...nodeToClone.data,
          label: `${nodeToClone.data.label} (Copy)`,
        },
      };

      toast({
        title: "Node cloned",
        description: `${nodeToClone.data.label} has been cloned`,
      });

      return [...currentNodes, newNode];
    });
  }, [toast]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((currentNodes) => {
      const nodeToDelete = currentNodes.find((n) => n.id === nodeId);
      if (!nodeToDelete) return currentNodes;

      if (nodeToDelete.id === "agent-setup" || nodeToDelete.id === "end-call") {
        toast({
          title: "Cannot delete",
          description: `${nodeToDelete.data.label} node cannot be deleted`,
          variant: "destructive",
        });
        return currentNodes;
      }

      toast({
        title: "Node deleted",
        description: `${nodeToDelete.data.label} has been deleted`,
      });

      return currentNodes.filter((n) => n.id !== nodeId);
    });

    setEdges((currentEdges) =>
      currentEdges.filter((e) => e.source !== nodeId && e.target !== nodeId)
    );
  }, [toast]);

  const handleUpdateNode = useCallback((nodeId: string, newData: any) => {
    setNodes((currentNodes) => {
      const nodeToUpdate = currentNodes.find(n => n.id === nodeId);
      if (nodeToUpdate?.type === "callDirection" && newData.direction) {
        const existingDirections = currentNodes
          .filter(n => n.type === "callDirection" && n.id !== nodeId)
          .map(n => n.data.direction);

        if (existingDirections.includes(newData.direction)) {
          toast({
            title: "Cannot change direction",
            description: `A start node with ${newData.direction} direction already exists`,
            variant: "destructive",
          });
          return currentNodes;
        }
      }

      return currentNodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...newData } }
          : node
      );
    });
  }, [toast]);

  const handleWorkflowFieldsChange = useCallback((fields: WorkflowField[]) => {
    setWorkflowFields(fields);
  }, []);

  const nodeComponents = {
    agentSetup: AgentSetupNode,
    callDirection: (props: any) => (
      <CallDirectionNode {...props} onDelete={handleDeleteNode} />
    ),
    scripted: (props: any) => (
      <ScriptedNode {...props} onClone={handleCloneNode} onDelete={handleDeleteNode} onUpdate={handleUpdateNode} />
    ),
    dialogue: (props: any) => (
      <DialogueNode {...props} onClone={handleCloneNode} onDelete={handleDeleteNode} onUpdate={handleUpdateNode} workflowFields={workflowFields} />
    ),
    field_setter: (props: any) => (
      <FieldSetterNode {...props} onClone={handleCloneNode} onDelete={handleDeleteNode} onUpdate={handleUpdateNode} workflowFields={workflowFields} />
    ),
    junction: (props: any) => (
      <JunctionNode {...props} onClone={handleCloneNode} onDelete={handleDeleteNode} onUpdate={handleUpdateNode} workflowFields={workflowFields} />
    ),
    switch: (props: any) => (
      <SwitchNode {...props} onClone={handleCloneNode} onDelete={handleDeleteNode} onUpdate={handleUpdateNode} workflowFields={workflowFields} />
    ),
    play_audio: (props: any) => (
      <PlayAudioNode {...props} agentId={agent?.id} onClone={handleCloneNode} onDelete={handleDeleteNode} onUpdate={handleUpdateNode} />
    ),
    call_transfer: (props: any) => (
      <CallTransferNode {...props} onClone={handleCloneNode} onDelete={handleDeleteNode} onUpdate={handleUpdateNode} />
    ),
    time_limit: (props: any) => (
      <TimeLimitNode {...props} onClone={handleCloneNode} onDelete={handleDeleteNode} onUpdate={handleUpdateNode} />
    ),
    reconfigure: (props: any) => (
      <ReconfigureNode {...props} onClone={handleCloneNode} onDelete={handleDeleteNode} onUpdate={handleUpdateNode} />
    ),
    fallback: (props: any) => (
      <FallbackNode {...props} onClone={handleCloneNode} onDelete={handleDeleteNode} onUpdate={handleUpdateNode} />
    ),
    voicemail: (props: any) => (
      <VoicemailNode {...props} onClone={handleCloneNode} onDelete={handleDeleteNode} onUpdate={handleUpdateNode} />
    ),
    end_call: EndNode,
    default: () => <div>Unknown Node</div>,
  };

  const initializeDefaultFlow = () => {
    const defaultNodes: Node[] = [
      {
        id: "agent-setup",
        type: "agentSetup",
        position: { x: 250, y: 100 },
        data: {
          label: "Agent Setup",
          systemMessage: "You are a helpful AI assistant for phone conversations.",
        },
      },
      {
        id: "start",
        type: "callDirection",
        position: { x: 700, y: 100 },
        data: {
          label: "Start",
          direction: "inbound",
        },
      },
      {
        id: "end-call",
        type: "end_call",
        position: { x: 1150, y: 100 },
        data: {
          label: "End Call",
          summaryPrompt: "",
          results: [],
        },
      },
    ];

    const defaultEdges: Edge[] = [
      {
        id: "e-agent-setup-start",
        source: "agent-setup",
        target: "start",
        animated: true,
      },
    ];

    setNodes(defaultNodes);
    setEdges(defaultEdges);
    savedStateRef.current = { nodes: defaultNodes, edges: defaultEdges, fields: [] };
  };

  const handleConnect = (sourceId: string, targetId: string, sourceHandle?: string) => {
    const newEdge: Edge = {
      id: `e-${sourceId}-${targetId}-${Date.now()}`,
      source: sourceId,
      target: targetId,
      sourceHandle: sourceHandle || undefined,
      animated: true,
    };
    setEdges([...edges, newEdge]);
  };

  const handleSave = async (showToast = true): Promise<boolean> => {
    setIsSaving(true);
    const flowData = { nodes, edges };

    const response = await api.updateAgent(agent.id, {
      config: { ...agent.config, flow: flowData, fields: workflowFields },
    });

    setIsSaving(false);

    if (response.error) {
      if (showToast) {
        toast({
          title: "Error saving agent",
          description: response.error,
          variant: "destructive",
        });
      }
      return false;
    } else {
      const updatedConfig = { ...agent.config, flow: flowData, fields: workflowFields };
      savedStateRef.current = { nodes, edges, fields: workflowFields };
      // Update the agent context so other sections (Configure, etc.) see the latest config
      onAgentUpdate({ ...agent, config: updatedConfig });
      if (showToast) {
        toast({
          title: "Agent saved",
          description: "Your changes have been saved successfully",
        });
      }
      return true;
    }
  };

  const handleBackClick = () => {
    if (hasUnsavedChanges()) {
      setPendingNavigation("/dashboard");
      setShowUnsavedModal(true);
    } else {
      navigate("/dashboard");
    }
  };

  const handleModalSave = async () => {
    const saved = await handleSave(false);
    if (saved) {
      setShowUnsavedModal(false);
      if (pendingNavigation) {
        navigate(pendingNavigation);
        setPendingNavigation(null);
      }
    } else {
      toast({
        title: "Error saving",
        description: "Could not save changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleModalRevert = () => {
    if (savedStateRef.current) {
      setNodes(savedStateRef.current.nodes);
      setEdges(savedStateRef.current.edges);
    }
    setShowUnsavedModal(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  const handleDebug = useCallback(() => {
    const result = validateWorkflow(nodes, edges);
    setDebugErrors(result.errors);
    setDebugWarnings(result.warnings);
    setDebugPassed(result.errors.length === 0);
    setErrorNodeIds(new Set(result.errors.map(e => e.nodeId).filter(Boolean)));
    setShowDebugPanel(true);
    setShowHistoryPanel(false);
    setShowFieldsPanel(false);
  }, [nodes, edges]);

  const handleNavigateToNode = useCallback((nodeId: string) => {
    flowCanvasRef.current?.panToNode(nodeId);
  }, []);

  const handleDeploy = async () => {
    if (!debugPassed) {
      toast({
        title: "Debug Required",
        description: "Please debug your workflow and fix all errors before deploying.",
        variant: "destructive",
      });
      handleDebug();
      return;
    }
    const saved = await handleSave(false);
    if (saved) {
      toast({
        title: "Agent Deployed Successfully",
        description: `${agent.name} is now live and ready to handle calls.`,
      });
    } else {
      toast({
        title: "Deploy Failed",
        description: "Could not deploy agent. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/nodeType", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/nodeType");
      if (!type) return;

      let position: { x: number; y: number };
      if (flowCanvasRef.current) {
        const canvasPos = flowCanvasRef.current.screenToCanvas(event.clientX, event.clientY);
        position = { x: canvasPos.x - 140, y: canvasPos.y - 60 };
      } else {
        const canvasRect = event.currentTarget.getBoundingClientRect();
        position = {
          x: event.clientX - canvasRect.left - 100,
          y: event.clientY - canvasRect.top - 50,
        };
      }

      const nodeCategory = nodeCategories.find((n) => n.type === type);
      if (!nodeCategory) return;

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: type,
        position,
        data: { label: nodeCategory.label },
      };

      setNodes((currentNodes) => [...currentNodes, newNode]);
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  return (
    <>
      {/* Studio has its own top bar with extra buttons */}
      <div className="flex-1 flex flex-col">
        <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackClick}
              className="mr-2"
            >
              <svg width="24" height="20" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M23.275 8.025H6.675C6.225 8.025 6.025 7.475 6.325 7.175L11.125 2.375C11.425 2.075 11.425 1.625 11.125 1.325L10.025 0.225C9.725 -0.075 9.275 -0.075 8.975 0.225L0.225 9.025C-0.075 9.325 -0.075 9.775 0.225 10.075L8.975 18.825C9.275 19.125 9.725 19.125 10.025 18.825L11.075 17.775C11.375 17.475 11.375 17.025 11.075 16.725L6.275 11.925C5.975 11.575 6.175 11.025 6.625 11.025H23.225C23.625 11.025 23.975 10.725 23.975 10.325V8.825C23.975 8.425 23.675 8.025 23.275 8.025Z" fill="white"/>
              </svg>
              Back
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                <span className="text-sm font-bold text-white">
                  {agent.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  {agent.name}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowHistoryPanel(true); setShowDebugPanel(false); setShowFieldsPanel(false); }}>
              <History className="w-4 h-4 mr-2" />
              History
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowFieldsPanel(true); setShowDebugPanel(false); setShowHistoryPanel(false); }}>
              <Database className="w-4 h-4 mr-2" />
              Fields
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleSave()}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={debugPassed ? "text-green-600 border-green-300" : "text-orange-600 border-orange-300"}
              onClick={handleDebug}
            >
              <Bug className="w-4 h-4 mr-2" />
              Debug
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleDeploy}
            >
              <Rocket className="w-4 h-4 mr-2" />
              Deploy
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
              onClick={() => setShowAIGenerator(true)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Complete by AI
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-auto relative">
          {/* Node Palette Sidebar */}
          {showNodePalette && (
            <div className="absolute left-4 top-4 z-20 w-52 bg-background overflow-y-auto max-h-[calc(100%-2rem)] shadow-lg rounded-2xl border border-border">
              <div className="sticky top-0 bg-background flex justify-start p-3 z-10">
                <button
                  onClick={() => setShowNodePalette(false)}
                  className="w-8 h-8 rounded-full bg-purple-100 hover:bg-purple-200 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-purple-600" />
                </button>
              </div>

              <div className="px-4 pb-4">
                <h2 className="text-base font-semibold text-primary mb-4">Add Node</h2>
                <div className="space-y-2">
                  {nodeCategories.map((nodeType) => {
                    const Icon = nodeType.icon;
                    return (
                      <div
                        key={nodeType.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, nodeType.type)}
                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border ${nodeType.color} ${nodeType.borderColor} cursor-grab active:cursor-grabbing transition-colors hover:opacity-80`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{nodeType.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Test Buttons */}
          <div className="absolute right-4 top-[68px] z-20 flex flex-col gap-2">
            <button
              onClick={() => { setTestMode("text"); setShowTestModal(true); }}
              className="w-11 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-lg transition-colors"
              title="Test (Text Mode)"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setTestMode("audio"); setShowTestModal(true); }}
              className="w-11 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-lg transition-colors"
              title="Test (Audio Mode)"
            >
              <AudioLines className="w-5 h-5" />
            </button>
          </div>

          {/* Floating Add Node Button */}
          {!showNodePalette && (
            <div className="absolute left-4 top-4 z-20">
              <button
                onClick={() => setShowNodePalette(true)}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-full shadow-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">Add Node</span>
              </button>
            </div>
          )}

          {/* Flow Canvas */}
          <div className="flex-1" onDrop={onDrop} onDragOver={onDragOver}>
            <FlowCanvas
              ref={flowCanvasRef}
              nodes={nodes}
              edges={edges}
              onNodesChange={setNodes}
              onEdgesChange={setEdges}
              onConnect={handleConnect}
              nodeComponents={nodeComponents}
              errorNodeIds={errorNodeIds}
            />
          </div>
        </div>
      </div>

      {/* Modals and Panels */}
      <TestAgentModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        agentId={agent.id}
        agentName={agent.name}
        nodes={nodes}
        edges={edges}
        initialMode={testMode}
        voiceConfig={{
          ttsProvider: agent.config?.settings?.ttsProvider,
          language: agent.config?.settings?.language,
        }}
      />

      <AIWorkflowGenerator
        isOpen={showAIGenerator}
        onClose={() => setShowAIGenerator(false)}
        onGenerate={(generatedNodes, generatedEdges, generatedFields) => {
          setNodes(generatedNodes);
          setEdges(generatedEdges);
          if (generatedFields && generatedFields.length > 0) {
            setWorkflowFields(generatedFields);
          }
        }}
        agentId={agent.id}
        existingNodes={nodes}
        existingEdges={edges}
        existingFields={workflowFields}
        currentLanguage={agent.config?.settings?.language || "en-US"}
        onLanguageChange={(language) => {
          const updatedConfig = {
            ...agent.config,
            settings: { ...(agent.config?.settings || {}), language },
          };
          onAgentUpdate({ ...agent, config: updatedConfig });
        }}
      />

      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onClose={() => setShowUnsavedModal(false)}
        onSave={handleModalSave}
        onRevert={handleModalRevert}
        isSaving={isSaving}
      />

      <HistoryPanel
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        agentId={agent.id}
        onRestore={(config) => {
          if (config?.flow) {
            setNodes(config.flow.nodes || []);
            setEdges(config.flow.edges || []);
            savedStateRef.current = {
              nodes: config.flow.nodes || [],
              edges: config.flow.edges || [],
              fields: config.fields || [],
            };
          }
          setWorkflowFields(config?.fields || []);
          onAgentUpdate({ ...agent, config });
        }}
      />

      <FieldsPanel
        isOpen={showFieldsPanel}
        onClose={() => setShowFieldsPanel(false)}
        fields={workflowFields}
        onFieldsChange={handleWorkflowFieldsChange}
      />

      <DebugPanel
        isOpen={showDebugPanel}
        onClose={() => { setShowDebugPanel(false); setErrorNodeIds(new Set()); }}
        errors={debugErrors}
        warnings={debugWarnings}
        onNavigateToNode={handleNavigateToNode}
        onTest={(mode) => {
          setShowDebugPanel(false);
          setTestMode(mode);
          setShowTestModal(true);
        }}
      />
    </>
  );
};

export default AgentStudioPage;
