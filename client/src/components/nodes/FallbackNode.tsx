import { memo, useState } from "react";
import { Copy, Pencil, Trash2, AlertCircle, ChevronRight, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  const handleCloseModal = () => {
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
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={handleCloseModal}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Fallback Configuration</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="bg-gray-600 hover:bg-gray-700 text-white gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Save
                </Button>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="nodeName" className="text-sm font-medium text-gray-700">
                  Name
                </Label>
                <Input
                  id="nodeName"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter node name..."
                  className="w-full border-gray-200 focus:border-gray-500 focus:ring-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fallbackMessage" className="text-sm font-medium text-gray-700">
                  Fallback Message
                </Label>
                <Textarea
                  id="fallbackMessage"
                  value={editedFallbackMessage}
                  onChange={(e) => setEditedFallbackMessage(e.target.value)}
                  placeholder="Message to say when fallback is triggered..."
                  rows={4}
                  className="w-full border-gray-200 focus:border-gray-500 focus:ring-gray-500 resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="retryCount" className="text-sm font-medium text-gray-700">
                  Retry Count
                </Label>
                <Input
                  id="retryCount"
                  type="number"
                  value={editedRetryCount}
                  onChange={(e) => setEditedRetryCount(e.target.value)}
                  placeholder="e.g., 3"
                  className="w-full border-gray-200 focus:border-gray-500 focus:ring-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="escalateTo" className="text-sm font-medium text-gray-700">
                  Escalate To (phone number or department)
                </Label>
                <Input
                  id="escalateTo"
                  value={editedEscalateTo}
                  onChange={(e) => setEditedEscalateTo(e.target.value)}
                  placeholder="e.g., +1234567890 or support"
                  className="w-full border-gray-200 focus:border-gray-500 focus:ring-gray-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default memo(FallbackNode);
