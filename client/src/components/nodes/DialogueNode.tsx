import { memo, useState } from "react";
import { Copy, Pencil, Trash2, MessageSquare, ChevronRight, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DialogueNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const DialogueNode = ({ id, data, onClone, onDelete, onUpdate }: DialogueNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedStageMessage, setEditedStageMessage] = useState(data.stageMessage || "");
  const [editedMaxTurns, setEditedMaxTurns] = useState(data.maxTurns || "");

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

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(id, {
        ...data,
        label: editedName,
        stageMessage: editedStageMessage,
        maxTurns: editedMaxTurns,
      });
    }
    setIsEditModalOpen(false);
  };

  const handleCloseModal = () => {
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

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 min-h-[40px]">
            {getPreviewText()}
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
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={handleCloseModal}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Dialogue Configuration</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
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

            <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="nodeName" className="text-sm font-medium text-gray-700">
                  Name
                </Label>
                <Input
                  id="nodeName"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter node name..."
                  className="w-full border-gray-200 focus:border-green-500 focus:ring-green-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stageMessage" className="text-sm font-medium text-gray-700">
                  Stage Message / Instructions
                </Label>
                <Textarea
                  id="stageMessage"
                  value={editedStageMessage}
                  onChange={(e) => setEditedStageMessage(e.target.value)}
                  placeholder="Enter instructions for the AI agent at this stage..."
                  rows={8}
                  className="w-full border-gray-200 focus:border-green-500 focus:ring-green-500 resize-none"
                />
                <p className="text-xs text-gray-500">
                  Describe what the agent should do at this stage, questions to ask, and how to respond.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTurns" className="text-sm font-medium text-gray-700">
                  Max Conversation Turns (Optional)
                </Label>
                <Input
                  id="maxTurns"
                  type="number"
                  value={editedMaxTurns}
                  onChange={(e) => setEditedMaxTurns(e.target.value)}
                  placeholder="e.g., 5"
                  className="w-full border-gray-200 focus:border-green-500 focus:ring-green-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default memo(DialogueNode);
