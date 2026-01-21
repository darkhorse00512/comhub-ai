import { memo, useState } from "react";
import { Copy, Pencil, Trash2, AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FallbackNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const FallbackNode = ({ id, data, onClone, onDelete, onUpdate }: FallbackNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedFallbackMessage, setEditedFallbackMessage] = useState(data.fallbackMessage || "");
  const [editedRetryCount, setEditedRetryCount] = useState(data.retryCount || "3");
  const [editedEscalateTo, setEditedEscalateTo] = useState(data.escalateTo || "");

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

  const handleSaveEdit = () => {
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
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100">
            <AlertCircle className="w-4 h-4 text-gray-700" />
            <span className="text-sm font-medium text-gray-700">Fallback</span>
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

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 min-h-[40px]">
            {getPreviewText()}
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
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Enter node name..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fallbackMessage">Fallback Message</Label>
              <Textarea
                id="fallbackMessage"
                value={editedFallbackMessage}
                onChange={(e) => setEditedFallbackMessage(e.target.value)}
                placeholder="Message to say when fallback is triggered..."
                className="min-h-[100px] resize-none"
              />
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
                onChange={(e) => setEditedRetryCount(e.target.value)}
                placeholder="e.g., 3"
              />
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
