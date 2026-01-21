import { memo, useState } from "react";
import { Copy, Pencil, Trash2, Clock, ChevronRight, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TimeLimitNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const TimeLimitNode = ({ id, data, onClone, onDelete, onUpdate }: TimeLimitNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedMaxDuration, setEditedMaxDuration] = useState(data.maxDuration || "");
  const [editedWarningAt, setEditedWarningAt] = useState(data.warningAt || "");
  const [editedTimeoutAction, setEditedTimeoutAction] = useState(data.timeoutAction || "end");

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
    setEditedMaxDuration(data.maxDuration || "");
    setEditedWarningAt(data.warningAt || "");
    setEditedTimeoutAction(data.timeoutAction || "end");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(id, {
        ...data,
        label: editedName,
        maxDuration: editedMaxDuration,
        warningAt: editedWarningAt,
        timeoutAction: editedTimeoutAction,
      });
    }
    setIsEditModalOpen(false);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
  };

  // Get preview
  const getPreviewText = () => {
    if (data.maxDuration) {
      return `Max: ${data.maxDuration}s${data.warningAt ? `, Warning at ${data.warningAt}s` : ""}`;
    }
    return "No time limit configured";
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-100">
            <Clock className="w-4 h-4 text-red-700" />
            <span className="text-sm font-medium text-red-700">Time Limit</span>
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
            {data.label || "Time Limit Node"}
          </h3>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 min-h-[40px]">
            {getPreviewText()}
          </div>
        </div>

        {/* Transition */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2 border border-red-200">
            <span className="text-sm font-medium text-red-700">Next Stage</span>
            <ChevronRight className="w-4 h-4 text-red-500" />
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
              <h2 className="text-lg font-semibold text-gray-900">Time Limit Configuration</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
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
                  className="w-full border-gray-200 focus:border-red-500 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxDuration" className="text-sm font-medium text-gray-700">
                  Max Duration (seconds)
                </Label>
                <Input
                  id="maxDuration"
                  type="number"
                  value={editedMaxDuration}
                  onChange={(e) => setEditedMaxDuration(e.target.value)}
                  placeholder="e.g., 300"
                  className="w-full border-gray-200 focus:border-red-500 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="warningAt" className="text-sm font-medium text-gray-700">
                  Warning At (seconds before end)
                </Label>
                <Input
                  id="warningAt"
                  type="number"
                  value={editedWarningAt}
                  onChange={(e) => setEditedWarningAt(e.target.value)}
                  placeholder="e.g., 30"
                  className="w-full border-gray-200 focus:border-red-500 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeoutAction" className="text-sm font-medium text-gray-700">
                  On Timeout
                </Label>
                <Select value={editedTimeoutAction} onValueChange={setEditedTimeoutAction}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="end">End Call</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="repeat">Repeat</SelectItem>
                    <SelectItem value="continue">Continue to Next</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default memo(TimeLimitNode);
