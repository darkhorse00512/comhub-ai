import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Upload, MoreVertical, Pencil, Copy, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import CreateAgentDialog from "@/components/dialogs/CreateAgentDialog";

interface Agent {
  id: string;
  name: string;
  description: string;
  group_id: string;
  groups?: {
    id: string;
    name: string;
  };
  company: string;
  email: string;
  created_at: string;
  updated_at: string;
  icon?: string;
}

const AgentsPage = () => {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    const response = await api.getAgents();
    if (response.error) {
      toast({
        title: "Error loading agents",
        description: response.error,
        variant: "destructive",
      });
    } else {
      setAgents(response.data || []);
    }
    setLoading(false);
  };

  const handleCreateAgent = () => {
    setCreateDialogOpen(true);
  };

  const handleAgentCreated = (newAgent: Agent) => {
    setAgents([newAgent, ...agents]);
    toast({
      title: "Agent created",
      description: `${newAgent.name} has been created successfully`,
    });
  };

  const handleImportAgent = () => {
    toast({
      title: "Import Agent",
      description: "This feature is coming soon!",
    });
  };

  const handleEditAgent = (agent: Agent) => {
    toast({
      title: "Edit Agent",
      description: "This feature is coming soon!",
    });
  };

  const handleCloneAgent = async (agent: Agent) => {
    const response = await api.cloneAgent(agent.id);
    if (response.error) {
      toast({
        title: "Error cloning agent",
        description: response.error,
        variant: "destructive",
      });
    } else if (response.data) {
      setAgents([response.data, ...agents]);
      toast({
        title: "Agent cloned",
        description: `${agent.name} has been cloned successfully`,
      });
    }
  };

  const handleExportAgent = (agent: Agent) => {
    toast({
      title: "Export Agent",
      description: "This feature is coming soon!",
    });
  };

  const handleDeleteAgent = async (agent: Agent) => {
    if (!confirm(`Are you sure you want to delete "${agent.name}"?`)) {
      return;
    }

    const response = await api.deleteAgent(agent.id);
    if (response.error) {
      toast({
        title: "Error deleting agent",
        description: response.error,
        variant: "destructive",
      });
    } else {
      setAgents(agents.filter((a) => a.id !== agent.id));
      toast({
        title: "Agent deleted",
        description: `${agent.name} has been deleted successfully`,
      });
    }
  };

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (agent.description && agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold text-foreground">Agents</h1>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleCreateAgent}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </Button>
            <Button
              onClick={handleImportAgent}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Agent
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
      </motion.div>

      {/* Agents Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      ) : filteredAgents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Plus className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {searchQuery ? "No agents found" : "No agents yet"}
          </h3>
          <p className="text-muted-foreground mb-6">
            {searchQuery
              ? "Try adjusting your search query"
              : "Create your first AI agent to get started"}
          </p>
          {!searchQuery && (
            <Button
              onClick={handleCreateAgent}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent, index) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-2xl p-6 shadow-elevated hover:shadow-glow-lg transition-all"
            >
              {/* Agent Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow shrink-0">
                    <span className="text-xl font-bold text-primary-foreground">
                      {agent.icon || agent.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">
                      {agent.name}
                    </h3>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => handleEditAgent(agent)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCloneAgent(agent)}>
                      <Copy className="w-4 h-4 mr-2" />
                      Clone
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleImportAgent()}>
                      <Upload className="w-4 h-4 mr-2" />
                      Import
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportAgent(agent)}>
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteAgent(agent)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Agent Details */}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {agent.description || "No description"}
                </p>

                <div className="space-y-2 text-sm">
                  {agent.groups && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Group:</span>
                      <span className="text-foreground font-medium">
                        {agent.groups.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border/50 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{formatDate(agent.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Updated:</span>
                    <span>{formatDate(agent.updated_at)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Agent Dialog */}
      <CreateAgentDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleAgentCreated}
      />
    </div>
  );
};

export default AgentsPage;
