import { memo, useState } from "react";
import { Copy, Pencil, Trash2, FileCode, ChevronRight } from "lucide-react";
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

interface ScriptedNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const ScriptedNode = ({ id, data, onClone, onDelete, onUpdate }: ScriptedNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedScript, setEditedScript] = useState(data.script || "");

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
    setEditedScript(data.script || "");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(id, {
        ...data,
        label: editedName,
        script: editedScript,
      });
    }
    setIsEditModalOpen(false);
  };

  const handleCancel = () => {
    setEditedName(data.label || "");
    setEditedScript(data.script || "");
    setIsEditModalOpen(false);
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-100">
            <FileCode className="w-4 h-4 text-purple-700" />
            <span className="text-sm font-medium text-purple-700">Scripted</span>
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
            {data.label || "Scripted Node"}
          </h3>

          {/* Script Preview */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 min-h-[40px]">
            {data.script || "No script set"}
          </div>
        </div>

        {/* Transition */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2 border border-purple-200">
            <span className="text-sm font-medium text-purple-700">Next Stage</span>
            <ChevronRight className="w-4 h-4 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Scripted Node Configuration</DialogTitle>
            <DialogDescription>
              Configure the scripted message that the agent will speak at this stage.
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
              <Label htmlFor="nodeScript">Script</Label>
              <Textarea
                id="nodeScript"
                value={editedScript}
                onChange={(e) => setEditedScript(e.target.value)}
                placeholder="Enter the script text the agent will say..."
                className="min-h-[120px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This is the exact text the agent will speak to the caller.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-purple-600 hover:bg-purple-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(ScriptedNode);
