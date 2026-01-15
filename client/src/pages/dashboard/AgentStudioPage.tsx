import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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
  PhoneCall,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import AgentSetupNode from "@/components/nodes/AgentSetupNode";
import CallDirectionNode from "@/components/nodes/CallDirectionNode";
import StandardNode from "@/components/nodes/StandardNode";

// Register custom node types
const nodeTypes = {
  agentSetup: AgentSetupNode,
  callDirection: (props: any) => (
    <CallDirectionNode
      {...props}
      onDelete={props.data.onDelete}
      onUpdate={props.data.onUpdate}
    />
  ),
  standard: (props: any) => (
    <StandardNode
      {...props}
      onClone={props.data.onClone}
      onDelete={props.data.onDelete}
      onUpdate={props.data.onUpdate}
    />
  ),
};

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
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedMenuItem, setSelectedMenuItem] = useState("studio");

  // Node action handlers - defined as regular functions to avoid circular dependencies
  const handleCloneNode = (nodeId: string) => {
    setNodes((nds) => {
      const nodeToClone = nds.find(n => n.id === nodeId);
      if (!nodeToClone) return nds;

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

      return nds.concat(newNode);
    });
  };

  const handleDeleteNode = (nodeId: string) => {
    setNodes((nds) => {
      const nodeToDelete = nds.find(n => n.id === nodeId);
      if (!nodeToDelete) return nds;

      // Don't allow deleting Agent Setup node
      if (nodeToDelete.id === "agent-setup") {
        toast({
          title: "Cannot delete",
          description: "Agent Setup node cannot be deleted",
          variant: "destructive",
        });
        return nds;
      }

      setEdges((eds) => eds.filter(e => e.source !== nodeId && e.target !== nodeId));

      toast({
        title: "Node deleted",
        description: `${nodeToDelete.data.label} has been deleted`,
      });

      return nds.filter(n => n.id !== nodeId);
    });
  };

  const handleUpdateNode = (nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map(node =>
        node.id === nodeId
          ? { ...node, data: { ...newData, onClone: handleCloneNode, onDelete: handleDeleteNode, onUpdate: handleUpdateNode } }
          : node
      )
    );
  };

  // Helper to add handlers to node data
  const addHandlersToNode = (node: Node): Node => ({
    ...node,
    data: {
      ...node.data,
      onClone: handleCloneNode,
      onDelete: handleDeleteNode,
      onUpdate: handleUpdateNode,
    },
  });

  const addHandlersToNodes = (nodes: Node[]): Node[] => nodes.map(addHandlersToNode);

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
        setNodes(addHandlersToNodes(loadedNodes));
        setEdges(response.data.config.flow.edges || []);
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
    ];

    const defaultEdges: Edge[] = [
      {
        id: "e-agent-setup-start",
        source: "agent-setup",
        target: "start",
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      },
    ];

    setNodes(addHandlersToNodes(defaultNodes));
    setEdges(defaultEdges);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const handleSave = async () => {
    if (!agent) return;

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

    if (response.error) {
      toast({
        title: "Error saving agent",
        description: response.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Agent saved",
        description: "Your changes have been saved successfully",
      });
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
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 50,
      };

      const nodeCategory = nodeCategories.find((n) => n.type === type);
      if (!nodeCategory) return;

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: "standard",
        position,
        data: {
          label: nodeCategory.label,
          type: type,
          notes: "",
        },
      };

      setNodes((nds) => nds.concat(addHandlersToNode(newNode)));
    },
    [setNodes]
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
            <Button variant="outline" size="sm" onClick={handleSave}>
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
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Node Palette Sidebar */}
          {selectedMenuItem === "studio" && (
            <div className="w-64 border-r border-border bg-background overflow-y-auto">
              <div className="p-4">
                <div className="mb-4">
                  <button
                    onClick={() => {
                      const newNode: Node = {
                        id: "start-" + Date.now(),
                        type: "callDirection",
                        position: { x: 250, y: 250 },
                        data: {
                          label: "Start",
                          direction: "inbound",
                        },
                      };
                      setNodes((nds) => nds.concat(addHandlersToNode(newNode)));
                    }}
                    className="w-full p-3 rounded-lg bg-purple-100 border-2 border-purple-400 text-purple-700 hover:bg-purple-200 transition-colors mb-2"
                  >
                    <div className="flex items-center gap-3">
                      <PhoneCall className="w-5 h-5" />
                      <span className="text-sm font-medium">Add Start Node</span>
                    </div>
                  </button>
                </div>

                <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
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
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 ${nodeType.color} ${nodeType.borderColor} cursor-grab active:cursor-grabbing transition-colors hover:opacity-80`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{nodeType.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* React Flow Canvas */}
          {selectedMenuItem === "studio" && (
            <div className="flex-1" onDrop={onDrop} onDragOver={onDragOver}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
              >
                <Background color="#aaa" gap={20} />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </div>
          )}

          {/* Other Menu Content */}
          {selectedMenuItem !== "studio" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🚧</div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {selectedMenuItem.charAt(0).toUpperCase() + selectedMenuItem.slice(1)}
                </h2>
                <p className="text-muted-foreground">
                  This section is under construction
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentStudioPage;
