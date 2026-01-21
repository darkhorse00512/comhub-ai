import { memo, useState } from "react";
import { Copy, Pencil, Trash2, Wrench, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReconfigureNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const ReconfigureNode = ({ id, data, onClone, onDelete, onUpdate }: ReconfigureNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedSetting, setEditedSetting] = useState(data.setting || "voice");
  const [editedNewValue, setEditedNewValue] = useState(data.newValue || "");

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
    setEditedSetting(data.setting || "voice");
    setEditedNewValue(data.newValue || "");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(id, {
        ...data,
        label: editedName,
        setting: editedSetting,
        newValue: editedNewValue,
      });
    }
    setIsEditModalOpen(false);
  };

  const handleCancel = () => {
    setEditedName(data.label || "");
    setEditedSetting(data.setting || "voice");
    setEditedNewValue(data.newValue || "");
    setIsEditModalOpen(false);
  };

  // Get setting label
  const getSettingLabel = (setting: string) => {
    const labels: Record<string, string> = {
      voice: "Voice",
      speed: "Speed",
      language: "Language",
      prompt: "System Prompt",
    };
    return labels[setting] || setting;
  };

  // Get preview
  const getPreviewText = () => {
    if (data.setting && data.newValue) {
      return `${getSettingLabel(data.setting)}: ${data.newValue}`;
    }
    return "No reconfiguration set";
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-100">
            <Wrench className="w-4 h-4 text-indigo-700" />
            <span className="text-sm font-medium text-indigo-700">Reconfigure</span>
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
            {data.label || "Reconfigure Node"}
          </h3>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 min-h-[40px]">
            {getPreviewText()}
          </div>
        </div>

        {/* Transition */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-200">
            <span className="text-sm font-medium text-indigo-700">Next Stage</span>
            <ChevronRight className="w-4 h-4 text-indigo-500" />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reconfigure Node Configuration</DialogTitle>
            <DialogDescription>
              Change the agent's settings dynamically during the conversation.
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
              <Label htmlFor="setting">Setting to Change</Label>
              <Select value={editedSetting} onValueChange={setEditedSetting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select setting" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voice">Voice</SelectItem>
                  <SelectItem value="speed">Speech Speed</SelectItem>
                  <SelectItem value="language">Language</SelectItem>
                  <SelectItem value="prompt">System Prompt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="newValue">New Value</Label>
              <Input
                id="newValue"
                value={editedNewValue}
                onChange={(e) => setEditedNewValue(e.target.value)}
                placeholder={
                  editedSetting === "voice" ? "e.g., en-US-Neural2-J" :
                  editedSetting === "speed" ? "e.g., 1.2" :
                  editedSetting === "language" ? "e.g., de-DE" :
                  "Enter new value..."
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-indigo-600 hover:bg-indigo-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(ReconfigureNode);
