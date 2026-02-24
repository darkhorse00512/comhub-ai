import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Plus, Upload, MoreVertical, Pencil, Copy, Download, Trash2, AlertTriangle, X, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface Group {
  id: string;
  name: string;
}

const AgentsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const [importGroupId, setImportGroupId] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [agentToEdit, setAgentToEdit] = useState<Agent | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGroupId, setEditGroupId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAgents();
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    const response = await api.getGroups();
    if (!response.error && response.data) {
      setGroups(response.data);
    }
  };

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
    setImportModalOpen(true);
    setImportFile(null);
    setImportData(null);
    setImportGroupId("");
  };

  const handleCloseImportModal = () => {
    setImportModalOpen(false);
    setImportFile(null);
    setImportData(null);
    setImportGroupId("");
    setIsDragOver(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.name) {
        toast({
          title: "Invalid file",
          description: "The JSON file must contain at least a 'name' field",
          variant: "destructive",
        });
        return;
      }

      setImportFile(file);
      setImportData(data);
    } catch (error) {
      toast({
        title: "Error reading file",
        description: "The file is not a valid JSON file",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/json") {
      await processFile(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please drop a JSON file",
        variant: "destructive",
      });
    }
  }, []);

  const handleConfirmImport = async () => {
    if (!importData || !importGroupId) {
      toast({
        title: "Missing information",
        description: "Please select a group for the agent",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    const agentData = {
      name: importData.name + " (Imported)",
      description: importData.description || "",
      group_id: importGroupId,
      config: importData.config || {},
    };

    const response = await api.createAgent(agentData);
    if (response.error) {
      toast({
        title: "Error importing agent",
        description: response.error,
        variant: "destructive",
      });
    } else if (response.data) {
      setAgents([response.data, ...agents]);
      toast({
        title: "Agent imported",
        description: `${response.data.name} has been imported successfully`,
      });
      handleCloseImportModal();
    }

    setIsImporting(false);
  };

  const handleEditAgent = (agent: Agent) => {
    setAgentToEdit(agent);
    setEditName(agent.name);
    setEditDescription(agent.description || "");
    setEditGroupId(agent.group_id || "");
    setEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setAgentToEdit(null);
    setEditName("");
    setEditDescription("");
    setEditGroupId("");
  };

  const handleSaveEdit = async () => {
    if (!agentToEdit || !editName.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a name for the agent",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    const response = await api.updateAgent(agentToEdit.id, {
      name: editName.trim(),
      description: editDescription.trim(),
      group_id: editGroupId,
    });

    if (response.error) {
      toast({
        title: "Error updating agent",
        description: response.error,
        variant: "destructive",
      });
    } else if (response.data) {
      // Update the agent in the local state
      setAgents(agents.map((a) =>
        a.id === agentToEdit.id ? { ...a, ...response.data } : a
      ));
      toast({
        title: "Agent updated",
        description: `${editName} has been updated successfully`,
      });
      handleCloseEditModal();
    }

    setIsSaving(false);
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

  const handleExportAgent = async (agent: Agent) => {
    try {
      // Fetch the full agent data including config
      const response = await api.getAgent(agent.id);
      if (response.error) {
        toast({
          title: "Error exporting agent",
          description: response.error,
          variant: "destructive",
        });
        return;
      }

      const fullAgent = response.data;

      // Create export data object
      const exportData = {
        name: fullAgent.name,
        description: fullAgent.description,
        config: fullAgent.config || {},
        exportedAt: new Date().toISOString(),
        version: "1.0",
      };

      // Create and download the JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${agent.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_agent.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Agent exported",
        description: `${agent.name} has been exported successfully`,
      });
    } catch (error) {
      toast({
        title: "Error exporting agent",
        description: "Failed to export agent",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAgent = (agent: Agent) => {
    setAgentToDelete(agent);
    setDeleteModalOpen(true);
  };

  const confirmDeleteAgent = async () => {
    if (!agentToDelete) return;

    setIsDeleting(true);
    const response = await api.deleteAgent(agentToDelete.id);
    if (response.error) {
      toast({
        title: "Error deleting agent",
        description: response.error,
        variant: "destructive",
      });
    } else {
      setAgents(agents.filter((a) => a.id !== agentToDelete.id));
      toast({
        title: "Agent deleted",
        description: `${agentToDelete.name} has been deleted successfully`,
      });
    }
    setIsDeleting(false);
    setDeleteModalOpen(false);
    setAgentToDelete(null);
  };

  const cancelDeleteAgent = () => {
    setDeleteModalOpen(false);
    setAgentToDelete(null);
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
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => navigate(`/agents/${agent.id}/studio`)}
                >
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow shrink-0">
                    <span className="text-xl font-bold text-primary-foreground">
                      {agent.icon || agent.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-lg hover:text-primary transition-colors">
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

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Import Agent Modal */}
      {importModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={handleCloseImportModal}
        >
          <div className="absolute inset-0 bg-black/50" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Import Agent</h2>
              <button
                onClick={handleCloseImportModal}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-5 space-y-5">
              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                  ${isDragOver
                    ? "border-purple-500 bg-purple-50"
                    : importFile
                      ? "border-green-500 bg-green-50"
                      : "border-border hover:border-purple-400 hover:bg-purple-50/50"
                  }
                `}
              >
                <CloudUpload className={`w-10 h-10 mx-auto mb-3 ${importFile ? "text-green-500" : "text-purple-500"}`} />
                {importFile ? (
                  <div>
                    <p className="text-sm font-medium text-foreground">{importFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Agent: {importData?.name || "Unknown"}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Drag and drop a JSON file here, or click to select one
                  </p>
                )}
              </div>

              {/* Group Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Group <span className="text-red-500">*</span>
                </Label>
                <Select value={importGroupId} onValueChange={setImportGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-secondary/30">
              <Button
                variant="outline"
                onClick={handleCloseImportModal}
                disabled={isImporting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={!importFile || !importGroupId || isImporting}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Importing...
                  </>
                ) : (
                  "Import"
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && agentToDelete && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={cancelDeleteAgent}
        >
          <div className="absolute inset-0 bg-black/50" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Delete Agent</h2>
              </div>
              <button
                onClick={cancelDeleteAgent}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-5">
              <p className="text-muted-foreground">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">"{agentToDelete.name}"</span>?
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                This action cannot be undone. All data associated with this agent will be permanently removed.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-secondary/30">
              <Button
                variant="outline"
                onClick={cancelDeleteAgent}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteAgent}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Agent
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Agent Modal */}
      {editModalOpen && agentToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCloseEditModal}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-lg mx-4 bg-background rounded-2xl shadow-2xl border border-border">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Edit Agent</h2>
              <button
                onClick={handleCloseEditModal}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-6 space-y-5">
              {/* Agent Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Agent Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Enter Agent Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <Textarea
                  placeholder="Enter Description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Group */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Group <span className="text-red-500">*</span>
                </label>
                <Select value={editGroupId} onValueChange={setEditGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No groups available.
                      </div>
                    ) : (
                      groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseEditModal}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={!editName.trim() || !editGroupId || isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white min-w-[100px]"
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsPage;
