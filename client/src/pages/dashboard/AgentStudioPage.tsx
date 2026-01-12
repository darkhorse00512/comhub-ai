import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Save,
  Upload,
  Rocket,
  History,
  Database,
  ChevronLeft,
  Plus,
  FileCode,
  MessageSquare,
  Settings,
  GitBranch,
  ToggleLeft,
  Zap,
  Phone,
  Clock,
  Wrench,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";

interface Node {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  data?: any;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  config: any;
}

const nodeTypes = [
  { type: "scripted", label: "Scripted", icon: FileCode, color: "blue" },
  { type: "dialogue", label: "Dialogue", icon: MessageSquare, color: "green" },
  { type: "field_setter", label: "Field Setter", icon: Settings, color: "yellow" },
  { type: "junction", label: "Junction", icon: GitBranch, color: "purple" },
  { type: "switch", label: "Switch", icon: ToggleLeft, color: "pink" },
  { type: "function", label: "Function", icon: Zap, color: "orange" },
  { type: "call_transfer", label: "Call Transfer", icon: Phone, color: "teal" },
  { type: "time_limit", label: "Time Limit", icon: Clock, color: "red" },
  { type: "reconfigure", label: "Reconfigure", icon: Wrench, color: "indigo" },
  { type: "fallback", label: "Fallback", icon: AlertCircle, color: "gray" },
];

const AgentStudioPage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([
    { id: "agent_entry", type: "agent_entry", label: "Agent Entry", x: 150, y: 100 },
    { id: "start", type: "start", label: "Start", x: 150, y: 200 },
  ]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null);

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
      // Load nodes from agent config if available
      if (response.data?.config?.nodes) {
        setNodes(response.data.config.nodes);
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!agent) return;

    const response = await api.updateAgent(agent.id, {
      config: {
        ...agent.config,
        nodes,
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
      description: "This feature is coming soon!",
    });
  };

  const handleDeploy = () => {
    toast({
      title: "Deploy Agent",
      description: "This feature is coming soon!",
    });
  };

  const handleDragStart = (nodeType: string) => {
    setDraggedNodeType(nodeType);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedNodeType(null);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNodeType) return;

    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const nodeType = nodeTypes.find((n) => n.type === draggedNodeType);
    if (!nodeType) return;

    const newNode: Node = {
      id: `${draggedNodeType}_${Date.now()}`,
      type: draggedNodeType,
      label: nodeType.label,
      x,
      y,
      data: {},
    };

    setNodes([...nodes, newNode]);
    setDraggedNodeType(null);
    setIsDragging(false);
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleNodeClick = (node: Node) => {
    setSelectedNode(node);
  };

  const handleBack = () => {
    navigate("/dashboard/agents");
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
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Top Bar */}
      <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronLeft className="w-5 h-5" />
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
              <p className="text-xs text-muted-foreground">
                {agent.description || "No description"}
              </p>
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
          <Button variant="outline" size="sm" className="text-purple-600" onClick={handlePublish}>
            <Upload className="w-4 h-4 mr-2" />
            Publish
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleDeploy}>
            <Rocket className="w-4 h-4 mr-2" />
            Deploy
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Node Palette */}
        <div className="w-64 border-r border-border bg-background overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Add Node</h2>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {nodeTypes.map((nodeType) => {
                const Icon = nodeType.icon;
                return (
                  <div
                    key={nodeType.type}
                    draggable
                    onDragStart={() => handleDragStart(nodeType.type)}
                    onDragEnd={handleDragEnd}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary cursor-grab active:cursor-grabbing transition-colors"
                  >
                    <Icon className={`w-5 h-5 text-${nodeType.color}-500`} />
                    <span className="text-sm font-medium text-foreground">
                      {nodeType.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Canvas */}
        <div
          className="flex-1 relative bg-grid-pattern overflow-auto"
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
          <div className="absolute inset-0 p-8">
            {/* Render Nodes */}
            {nodes.map((node) => (
              <motion.div
                key={node.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  position: "absolute",
                  left: node.x,
                  top: node.y,
                }}
                onClick={() => handleNodeClick(node)}
                className={`cursor-pointer ${
                  selectedNode?.id === node.id ? "ring-2 ring-primary" : ""
                }`}
              >
                <div
                  className={`min-w-[180px] rounded-xl shadow-lg p-4 border-2 ${
                    node.type === "agent_entry" || node.type === "start"
                      ? "bg-purple-500 border-purple-600 text-white"
                      : "bg-background border-border"
                  }`}
                >
                  <div className="text-sm font-semibold mb-1">{node.label}</div>
                  {node.type === "agent_entry" && (
                    <div className="text-xs opacity-90 mt-2">
                      <div>Agent: "{agent.name}"</div>
                      <div>Temperature: 0.7</div>
                      <div>Max tokens: 2000</div>
                    </div>
                  )}
                  {node.type === "start" && (
                    <div className="text-xs opacity-90">Entry point</div>
                  )}

                  {/* Connection Points */}
                  <div className="flex justify-between mt-3 -mx-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                    <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Drop Zone Indicator */}
            {isDragging && (
              <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <Plus className="w-12 h-12 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Drop node here
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Properties */}
        {selectedNode && (
          <div className="w-80 border-l border-border bg-background overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Node Properties
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedNode(null)}
                >
                  ×
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">
                    Node Type
                  </label>
                  <p className="text-sm text-foreground mt-1">
                    {selectedNode.label}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">
                    Node ID
                  </label>
                  <p className="text-sm text-foreground mt-1 font-mono">
                    {selectedNode.id}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">
                    Position
                  </label>
                  <p className="text-sm text-foreground mt-1">
                    X: {Math.round(selectedNode.x)}, Y: {Math.round(selectedNode.y)}
                  </p>
                </div>

                {selectedNode.type === "agent_entry" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">
                        Agent Name
                      </label>
                      <p className="text-sm text-foreground mt-1">
                        {agent.name}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">
                        Configuration
                      </label>
                      <div className="mt-2 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Temperature:</span>
                          <span className="text-foreground">0.7</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Max Tokens:</span>
                          <span className="text-foreground">2000</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="h-10 border-t border-border bg-background flex items-center justify-between px-6 text-xs text-muted-foreground">
        <div>Nodes: {nodes.length}</div>
        <div>Studio v1.0</div>
      </div>
    </div>
  );
};

export default AgentStudioPage;
