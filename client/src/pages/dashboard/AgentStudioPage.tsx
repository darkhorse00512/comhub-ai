import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FlowCanvas, Node, Edge } from "@/components/FlowCanvas";
import {
  Save,
  Upload,
  Rocket,
  History,
  Database,
  Bot,
  Settings,
  PhoneOutgoing,
  Phone,
  MessageSquare,
  BarChart3,
  MessageCircle,
  FileCode,
  GitBranch,
  ToggleLeft,
  Zap,
  Clock,
  Wrench,
  AlertCircle,
  Play,
  Sparkles,
  X,
  Plus,
  Voicemail,
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
import FunctionNode from "@/components/nodes/FunctionNode";
import CallTransferNode from "@/components/nodes/CallTransferNode";
import TimeLimitNode from "@/components/nodes/TimeLimitNode";
import ReconfigureNode from "@/components/nodes/ReconfigureNode";
import FallbackNode from "@/components/nodes/FallbackNode";
import VoicemailNode from "@/components/nodes/VoicemailNode";
import TestAgentModal from "@/components/TestAgentModal";
import AIWorkflowGenerator from "@/components/AIWorkflowGenerator";

interface Agent {
  id: string;
  name: string;
  description: string;
  config: any;
}

const nodeCategories = [
  { type: "scripted", label: "Scripted", icon: FileCode, color: "bg-blue-100 text-blue-600", borderColor: "border-blue-400" },
  { type: "dialogue", label: "Dialogue", icon: MessageSquare, color: "bg-green-100 text-green-600", borderColor: "border-green-400" },
  { type: "field_setter", label: "Field Setter", icon: Zap, color: "bg-yellow-100 text-yellow-600", borderColor: "border-yellow-400" },
  { type: "junction", label: "Junction", icon: GitBranch, color: "bg-purple-100 text-purple-600", borderColor: "border-purple-400" },
  { type: "switch", label: "Switch", icon: ToggleLeft, color: "bg-pink-100 text-pink-600", borderColor: "border-pink-400" },
  { type: "function", label: "Function", icon: Zap, color: "bg-orange-100 text-orange-600", borderColor: "border-orange-400" },
  { type: "call_transfer", label: "Call Transfer", icon: Phone, color: "bg-teal-100 text-teal-600", borderColor: "border-teal-400" },
  { type: "time_limit", label: "Time Limit", icon: Clock, color: "bg-red-100 text-red-600", borderColor: "border-red-400" },
  { type: "reconfigure", label: "Reconfigure", icon: Wrench, color: "bg-indigo-100 text-indigo-600", borderColor: "border-indigo-400" },
  { type: "fallback", label: "Fallback", icon: AlertCircle, color: "bg-gray-100 text-gray-600", borderColor: "border-gray-400" },
  { type: "voicemail", label: "Voicemail", icon: Voicemail, color: "bg-amber-50 text-amber-600", borderColor: "border-amber-300" },
];

const leftMenuItems = [
  { id: "studio", label: "Studio", icon: Bot, path: "studio" },
  { id: "configure", label: "Configure", icon: Settings, path: "configure" },
  { id: "outbound", label: "Outbound", icon: PhoneOutgoing, path: "outbound" },
  { id: "calls", label: "Calls", icon: Phone, path: "calls" },
  { id: "chats", label: "Chats", icon: MessageCircle, path: "chats" },
  { id: "analytics", label: "Analytics", icon: BarChart3, path: "analytics" },
  { id: "feedback", label: "Feedback", icon: MessageSquare, path: "feedback" },
];

const AgentStudioPage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedMenuItem, setSelectedMenuItem] = useState("studio");
  const [showTestModal, setShowTestModal] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showNodePalette, setShowNodePalette] = useState(true);

  // Unsaved changes tracking
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const savedStateRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    if (!savedStateRef.current) return false;
    const savedNodes = JSON.stringify(savedStateRef.current.nodes);
    const savedEdges = JSON.stringify(savedStateRef.current.edges);
    const currentNodes = JSON.stringify(nodes);
    const currentEdges = JSON.stringify(edges);
    return savedNodes !== currentNodes || savedEdges !== currentEdges;
  }, [nodes, edges]);

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

  // Node action handlers - use functional updates to avoid stale closures
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

      // Don't allow deleting Agent Setup node
      if (nodeToDelete.id === "agent-setup") {
        toast({
          title: "Cannot delete",
          description: "Agent Setup node cannot be deleted",
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
      // If updating a callDirection node, check if the new direction already exists
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
          ? {
              ...node,
              data: {
                ...newData,
              },
            }
          : node
      );
    });
  }, [toast]);

  // Node components with handlers - defined inside component to access callbacks
  const nodeComponents = {
    agentSetup: AgentSetupNode,
    callDirection: (props: any) => (
      <CallDirectionNode
        {...props}
        onDelete={handleDeleteNode}
      />
    ),
    scripted: (props: any) => (
      <ScriptedNode
        {...props}
        onClone={handleCloneNode}
        onDelete={handleDeleteNode}
        onUpdate={handleUpdateNode}
      />
    ),
    dialogue: (props: any) => (
      <DialogueNode
        {...props}
        onClone={handleCloneNode}
        onDelete={handleDeleteNode}
        onUpdate={handleUpdateNode}
      />
    ),
    field_setter: (props: any) => (
      <FieldSetterNode
        {...props}
        onClone={handleCloneNode}
        onDelete={handleDeleteNode}
        onUpdate={handleUpdateNode}
      />
    ),
    junction: (props: any) => (
      <JunctionNode
        {...props}
        onClone={handleCloneNode}
        onDelete={handleDeleteNode}
        onUpdate={handleUpdateNode}
      />
    ),
    switch: (props: any) => (
      <SwitchNode
        {...props}
        onClone={handleCloneNode}
        onDelete={handleDeleteNode}
        onUpdate={handleUpdateNode}
      />
    ),
    function: (props: any) => (
      <FunctionNode
        {...props}
        onClone={handleCloneNode}
        onDelete={handleDeleteNode}
        onUpdate={handleUpdateNode}
      />
    ),
    call_transfer: (props: any) => (
      <CallTransferNode
        {...props}
        onClone={handleCloneNode}
        onDelete={handleDeleteNode}
        onUpdate={handleUpdateNode}
      />
    ),
    time_limit: (props: any) => (
      <TimeLimitNode
        {...props}
        onClone={handleCloneNode}
        onDelete={handleDeleteNode}
        onUpdate={handleUpdateNode}
      />
    ),
    reconfigure: (props: any) => (
      <ReconfigureNode
        {...props}
        onClone={handleCloneNode}
        onDelete={handleDeleteNode}
        onUpdate={handleUpdateNode}
      />
    ),
    fallback: (props: any) => (
      <FallbackNode
        {...props}
        onClone={handleCloneNode}
        onDelete={handleDeleteNode}
        onUpdate={handleUpdateNode}
      />
    ),
    voicemail: (props: any) => (
      <VoicemailNode
        {...props}
        onClone={handleCloneNode}
        onDelete={handleDeleteNode}
        onUpdate={handleUpdateNode}
      />
    ),
    default: () => <div>Unknown Node</div>,
  };

  useEffect(() => {
    if (agentId) {
      fetchAgent();
    }
  }, [agentId]);

  const fetchAgent = async () => {
    if (!agentId) return;

    setLoading(true);
    const response = await api.getAgent(agentId);
    if (response.error) {
      toast({
        title: "Error loading agent",
        description: response.error,
        variant: "destructive",
      });
      navigate("/dashboard/agents");
    } else {
      setAgent(response.data);
      // Load flow from agent config
      if (response.data?.config?.flow) {
        const loadedNodes = response.data.config.flow.nodes || [];
        const loadedEdges = response.data.config.flow.edges || [];
        setNodes(loadedNodes);
        setEdges(loadedEdges);
        // Save the initial state for unsaved changes detection
        savedStateRef.current = { nodes: loadedNodes, edges: loadedEdges };
      } else {
        // Initialize with default Agent Setup node
        initializeDefaultFlow();
      }
    }
    setLoading(false);
  };

  const initializeDefaultFlow = () => {
    const defaultNodes: Node[] = [
      {
        id: "agent-setup",
        type: "agentSetup",
        position: { x: 250, y: 100 },
        data: {
          label: "Agent Setup",
          systemMessage:
            "You are a helpful AI assistant for phone conversations.",
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
    // Save the initial state for unsaved changes detection
    savedStateRef.current = { nodes: defaultNodes, edges: defaultEdges };
  };

  const handleConnect = (sourceId: string, targetId: string) => {
    const newEdge: Edge = {
      id: `e-${sourceId}-${targetId}-${Date.now()}`,
      source: sourceId,
      target: targetId,
      animated: true,
    };
    setEdges([...edges, newEdge]);
  };

  const handleSave = async (showToast = true): Promise<boolean> => {
    if (!agent) return false;

    setIsSaving(true);
    const flowData = {
      nodes,
      edges,
    };

    const response = await api.updateAgent(agent.id, {
      config: {
        ...agent.config,
        flow: flowData,
      },
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
      // Update saved state after successful save
      savedStateRef.current = { nodes, edges };
      if (showToast) {
        toast({
          title: "Agent saved",
          description: "Your changes have been saved successfully",
        });
      }
      return true;
    }
  };

  // Handle back button click with unsaved changes check
  const handleBackClick = () => {
    if (hasUnsavedChanges()) {
      setPendingNavigation("/dashboard/agents");
      setShowUnsavedModal(true);
    } else {
      navigate("/dashboard/agents");
    }
  };

  // Handle save from modal
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

  // Handle revert from modal
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

  const handlePublish = () => {
    toast({
      title: "Publish Agent",
      description: "Publishing agent to production...",
    });
  };

  const handleDeploy = () => {
    toast({
      title: "Deploy Agent",
      description: "Deploying agent...",
    });
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

      const canvasRect = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - canvasRect.left - 100,
        y: event.clientY - canvasRect.top - 50,
      };

      const nodeCategory = nodeCategories.find((n) => n.type === type);
      if (!nodeCategory) return;

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: type,
        position,
        data: {
          label: nodeCategory.label,
        },
      };

      setNodes((currentNodes) => [...currentNodes, newNode]);
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleMenuItemClick = (itemId: string) => {
    setSelectedMenuItem(itemId);
    if (itemId !== "studio") {
      toast({
        title: itemId.charAt(0).toUpperCase() + itemId.slice(1),
        description: "This section is coming soon!",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background flex">
      {/* Left Sidebar Menu */}
      <div className="w-16 bg-secondary border-r border-border flex flex-col items-center py-4 gap-4">
        {leftMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = selectedMenuItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleMenuItemClick(item.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary-foreground/10"
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
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
            <Button variant="outline" size="sm">
              <History className="w-4 h-4 mr-2" />
              History
            </Button>
            <Button variant="outline" size="sm">
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
              className="text-purple-600"
              onClick={handlePublish}
            >
              <Upload className="w-4 h-4 mr-2" />
              Publish
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
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => setShowTestModal(true)}
            >
              <Play className="w-4 h-4 mr-2" />
              Test
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

        <div className="flex-1 flex overflow-hidden relative">
          {/* Node Palette Sidebar - Sticky */}
          {selectedMenuItem === "studio" && showNodePalette && (
            <div className="absolute left-4 top-4 z-20 w-52 bg-background overflow-y-auto max-h-[calc(100%-2rem)] shadow-lg rounded-2xl border border-border">
              {/* Close Button */}
              <div className="sticky top-0 bg-background flex justify-start p-3 z-10">
                <button
                  onClick={() => setShowNodePalette(false)}
                  className="w-8 h-8 rounded-full bg-purple-100 hover:bg-purple-200 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-purple-600" />
                </button>
              </div>

              <div className="px-4 pb-4">
                {/* Add Node Title */}
                <h2 className="text-base font-semibold text-primary mb-4">
                  Add Node
                </h2>

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
                        <span className="text-sm font-medium">
                          {nodeType.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Floating Add Node Button - shown when palette is closed */}
          {selectedMenuItem === "studio" && !showNodePalette && (
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

          {/* Flow Canvas - Always rendered but hidden when not on studio */}
          <div
            className={`flex-1 ${selectedMenuItem !== "studio" ? "hidden" : ""}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={setNodes}
              onEdgesChange={setEdges}
              onConnect={handleConnect}
              nodeComponents={nodeComponents}
            />
          </div>

          {/* Other Menu Content */}
          {selectedMenuItem !== "studio" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🚧</div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {selectedMenuItem.charAt(0).toUpperCase() +
                    selectedMenuItem.slice(1)}
                </h2>
                <p className="text-muted-foreground">
                  This section is under construction
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test Agent Modal */}
      {agent && (
        <TestAgentModal
          isOpen={showTestModal}
          onClose={() => setShowTestModal(false)}
          agentId={agent.id}
          agentName={agent.name}
          nodes={nodes}
          edges={edges}
        />
      )}

      {/* AI Workflow Generator Modal */}
      {agent && (
        <AIWorkflowGenerator
          isOpen={showAIGenerator}
          onClose={() => setShowAIGenerator(false)}
          onGenerate={(generatedNodes, generatedEdges) => {
            setNodes(generatedNodes);
            setEdges(generatedEdges);
          }}
          agentId={agent.id}
        />
      )}

      {/* Unsaved Changes Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onClose={() => setShowUnsavedModal(false)}
        onSave={handleModalSave}
        onRevert={handleModalRevert}
        isSaving={isSaving}
      />
    </div>
  );
};

export default AgentStudioPage;
