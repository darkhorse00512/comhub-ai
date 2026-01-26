import { memo, useState } from "react";
import { Copy, Pencil, Trash2, MessageSquare, ChevronRight, HelpCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { nodeDescriptions } from "@/data/nodeDescriptions";

interface DialogueNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const DialogueNode = ({ id, data, onClone, onDelete, onUpdate }: DialogueNodeProps) => {
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedStageMessage, setEditedStageMessage] = useState(data.stageMessage || "");
  const [editedMaxTurns, setEditedMaxTurns] = useState(data.maxTurns || "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleClone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClone) onClone(id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedName(data.label || "");
    setEditedStageMessage(data.stageMessage || "");
    setEditedMaxTurns(data.maxTurns || "");
    setIsEditModalOpen(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editedName.trim()) {
      newErrors.label = "Name is required";
    }

    if (!editedStageMessage.trim()) {
      newErrors.stageMessage = "Stage message/instructions are required";
    }

    if (editedMaxTurns && (isNaN(Number(editedMaxTurns)) || Number(editedMaxTurns) < 1)) {
      newErrors.maxTurns = "Max turns must be a positive number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveEdit = () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving",
        variant: "destructive"
      });
      return;
    }

    if (onUpdate) {
      onUpdate(id, {
        ...data,
        label: editedName,
        stageMessage: editedStageMessage,
        maxTurns: editedMaxTurns,
      });
    }
    setIsEditModalOpen(false);
    setErrors({});
  };

  const handleCancel = () => {
    setEditedName(data.label || "");
    setEditedStageMessage(data.stageMessage || "");
    setEditedMaxTurns(data.maxTurns || "");
    setIsEditModalOpen(false);
  };

  // Get preview text for the node
  const getPreviewText = () => {
    if (data.stageMessage) {
      return data.stageMessage.length > 80
        ? data.stageMessage.substring(0, 80) + "..."
        : data.stageMessage;
    }
    return "No stage message configured";
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-100">
            <MessageSquare className="w-4 h-4 text-green-700" />
            <span className="text-sm font-medium text-green-700">Dialogue</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-help ml-1 text-green-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium mb-1">{nodeDescriptions.dialogue.tooltip}</p>
                  {nodeDescriptions.dialogue.examples && (
                    <div className="text-xs opacity-90 mt-2">
                      <strong>Examples:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {nodeDescriptions.dialogue.examples.map((ex, i) => (
                          <li key={i}>{ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleClone}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
              title="Clone"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={handleEdit}
              className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors text-blue-500 hover:text-blue-700"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-500 hover:text-red-700"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Node Content */}
        <div className="px-4 py-3">
          {/* Node Name */}
          <h3 className="font-semibold text-gray-900 text-base mb-2">
            {data.label || "Dialogue Node"}
          </h3>

          {/* Preview - Enhanced */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm min-h-[60px]">
            {data.stageMessage ? (
              <>
                <div className="flex items-center gap-2 mb-1.5">
                  <MessageSquare className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-green-700">AI Conversation</span>
                </div>
                <p className="text-gray-700 text-xs line-clamp-2 leading-relaxed">
                  {data.stageMessage}
                </p>
                {data.maxTurns && (
                  <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Max {data.maxTurns} conversation turns
                  </div>
                )}
              </>
            ) : (
              <span className="text-gray-400">No instructions configured</span>
            )}
          </div>
        </div>

        {/* Transitions */}
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 border border-green-200">
            <span className="text-sm font-medium text-green-700">Next Stage</span>
            <ChevronRight className="w-4 h-4 text-green-500" />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Dialogue Node Configuration</DialogTitle>
            <DialogDescription>
              Configure the AI agent's behavior and instructions for this conversation stage.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nodeName">Name</Label>
              <Input
                id="nodeName"
                value={editedName}
                onChange={(e) => {
                  setEditedName(e.target.value);
                  if (errors.label) setErrors({...errors, label: ""});
                }}
                placeholder="Enter node name..."
                className={errors.label ? "border-red-500" : ""}
              />
              {errors.label && (
                <p className="text-xs text-red-600 mt-1">{errors.label}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="stageMessage">Stage Message / Instructions</Label>
              <Textarea
                id="stageMessage"
                value={editedStageMessage}
                onChange={(e) => {
                  setEditedStageMessage(e.target.value);
                  if (errors.stageMessage) setErrors({...errors, stageMessage: ""});
                }}
                placeholder="Enter instructions for the AI agent at this stage..."
                className={`min-h-[180px] resize-none ${errors.stageMessage ? "border-red-500" : ""}`}
              />
              {errors.stageMessage && (
                <p className="text-xs text-red-600 mt-1">{errors.stageMessage}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Describe what the agent should do at this stage, questions to ask, and how to respond
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="maxTurns">Max Conversation Turns (Optional)</Label>
              <Input
                id="maxTurns"
                type="number"
                value={editedMaxTurns}
                onChange={(e) => {
                  setEditedMaxTurns(e.target.value);
                  if (errors.maxTurns) setErrors({...errors, maxTurns: ""});
                }}
                placeholder="e.g., 10"
                className={errors.maxTurns ? "border-red-500" : ""}
              />
              {errors.maxTurns && (
                <p className="text-xs text-red-600 mt-1">{errors.maxTurns}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Leave empty for unlimited turns
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(DialogueNode);
