import { memo, useState } from "react";
import { Copy, Pencil, Trash2, AlertCircle, ChevronRight, HelpCircle } from "lucide-react";
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

interface FallbackNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const FallbackNode = ({ id, data, onClone, onDelete, onUpdate }: FallbackNodeProps) => {
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedFallbackMessage, setEditedFallbackMessage] = useState(data.fallbackMessage || "");
  const [editedRetryCount, setEditedRetryCount] = useState(data.retryCount || "3");
  const [editedEscalateTo, setEditedEscalateTo] = useState(data.escalateTo || "");
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
    setEditedFallbackMessage(data.fallbackMessage || "");
    setEditedRetryCount(data.retryCount || "3");
    setEditedEscalateTo(data.escalateTo || "");
    setIsEditModalOpen(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editedName.trim()) {
      newErrors.label = "Name is required";
    }

    if (!editedFallbackMessage.trim()) {
      newErrors.fallbackMessage = "Fallback message is required";
    }

    if (!editedRetryCount || isNaN(Number(editedRetryCount)) || Number(editedRetryCount) < 0) {
      newErrors.retryCount = "Retry count must be a non-negative number";
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
        fallbackMessage: editedFallbackMessage,
        retryCount: editedRetryCount,
        escalateTo: editedEscalateTo,
      });
    }
    setIsEditModalOpen(false);
    setErrors({});
  };

  const handleCancel = () => {
    setEditedName(data.label || "");
    setEditedFallbackMessage(data.fallbackMessage || "");
    setEditedRetryCount(data.retryCount || "3");
    setEditedEscalateTo(data.escalateTo || "");
    setIsEditModalOpen(false);
  };

  // Get preview
  const getPreviewText = () => {
    if (data.fallbackMessage) {
      return data.fallbackMessage.length > 60
        ? data.fallbackMessage.substring(0, 60) + "..."
        : data.fallbackMessage;
    }
    return "No fallback message set";
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-auto">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100">
            <AlertCircle className="w-4 h-4 text-gray-700" />
            <span className="text-sm font-medium text-gray-700">Fallback</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-help ml-1 text-gray-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium mb-1">{nodeDescriptions.fallback?.tooltip || "Handle cases where the agent doesn't understand the user."}</p>
                  {nodeDescriptions.fallback?.examples && (
                    <div className="text-xs opacity-90 mt-2">
                      <strong>Examples:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {nodeDescriptions.fallback.examples.map((ex, i) => (
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
            {data.label || "Fallback Node"}
          </h3>

          {/* Preview - Enhanced */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm min-h-[70px]">
            {data.fallbackMessage ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-gray-600" />
                  <span className="font-semibold text-gray-700">Fallback</span>
                </div>
                <p className="text-gray-700 text-xs line-clamp-2 leading-relaxed mb-2">
                  {data.fallbackMessage}
                </p>
                <div className="flex gap-2 text-xs">
                  {data.retryCount && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                      Retries: {data.retryCount}
                    </span>
                  )}
                  {data.escalateTo && (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                      Escalate to {data.escalateTo}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <span className="text-gray-400">No fallback message set</span>
            )}
          </div>
        </div>

        {/* Transition */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between bg-gray-100 rounded-lg px-3 py-2 border border-gray-300">
            <span className="text-sm font-medium text-gray-700">Next Stage</span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Fallback Configuration</DialogTitle>
            <DialogDescription>
              Configure what happens when the agent cannot understand or handle the conversation.
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
              <Label htmlFor="fallbackMessage">Fallback Message</Label>
              <Textarea
                id="fallbackMessage"
                value={editedFallbackMessage}
                onChange={(e) => {
                  setEditedFallbackMessage(e.target.value);
                  if (errors.fallbackMessage) setErrors({...errors, fallbackMessage: ""});
                }}
                placeholder="Message to say when fallback is triggered..."
                className={`min-h-[100px] resize-none ${errors.fallbackMessage ? "border-red-500" : ""}`}
              />
              {errors.fallbackMessage && (
                <p className="text-xs text-red-600 mt-1">{errors.fallbackMessage}</p>
              )}
              <p className="text-xs text-muted-foreground">
                This message will be spoken when the agent doesn't understand the user.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="retryCount">Retry Count</Label>
              <Input
                id="retryCount"
                type="number"
                value={editedRetryCount}
                onChange={(e) => {
                  setEditedRetryCount(e.target.value);
                  if (errors.retryCount) setErrors({...errors, retryCount: ""});
                }}
                placeholder="e.g., 3"
                className={errors.retryCount ? "border-red-500" : ""}
              />
              {errors.retryCount && (
                <p className="text-xs text-red-600 mt-1">{errors.retryCount}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Number of times to retry before escalating.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="escalateTo">Escalate To (phone number or department)</Label>
              <Input
                id="escalateTo"
                value={editedEscalateTo}
                onChange={(e) => setEditedEscalateTo(e.target.value)}
                placeholder="e.g., +1234567890 or support"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-gray-600 hover:bg-gray-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(FallbackNode);
