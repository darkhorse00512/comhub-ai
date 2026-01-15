import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Copy, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface StandardNodeProps extends NodeProps {
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const StandardNode = ({ id, data, isConnectable, onClone, onDelete, onUpdate }: StandardNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedLabel, setEditedLabel] = useState(data.label || "");
  const [editedNotes, setEditedNotes] = useState(data.notes || "");

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
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(id, {
        ...data,
        label: editedLabel,
        notes: editedNotes,
      });
    }
    setIsEditModalOpen(false);
  };

  // Get color based on node type
  const getColorClasses = () => {
    const type = data.type || "default";
    const colorMap: { [key: string]: string } = {
      scripted: "bg-blue-50 border-blue-400 text-blue-900",
      dialogue: "bg-green-50 border-green-400 text-green-900",
      field_setter: "bg-yellow-50 border-yellow-400 text-yellow-900",
      junction: "bg-purple-50 border-purple-400 text-purple-900",
      switch: "bg-pink-50 border-pink-400 text-pink-900",
      function: "bg-orange-50 border-orange-400 text-orange-900",
      call_transfer: "bg-teal-50 border-teal-400 text-teal-900",
      time_limit: "bg-red-50 border-red-400 text-red-900",
      reconfigure: "bg-indigo-50 border-indigo-400 text-indigo-900",
      fallback: "bg-gray-50 border-gray-400 text-gray-900",
    };
    return colorMap[type] || "bg-white border-gray-400 text-gray-900";
  };

  return (
    <>
      <div className={`border-2 rounded-xl shadow-lg min-w-[200px] ${getColorClasses()} relative group`}>
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
          className="w-3 h-3 !bg-blue-500"
        />

        {/* Node Content */}
        <div className="p-4">
          {/* Header with Action Buttons */}
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">{data.label}</span>

            {/* Action Buttons - Always visible */}
            <div className="flex items-center gap-1.5 opacity-100">
              <button
                onClick={handleClone}
                className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                title="Clone"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={handleEdit}
                className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg hover:bg-red-100 transition-colors text-red-600"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notes/Description if available */}
          {data.notes && (
            <div className="text-xs opacity-70 mt-1 line-clamp-2">
              {data.notes}
            </div>
          )}
        </div>

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          className="w-3 h-3 !bg-green-500"
        />
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Node</DialogTitle>
            <DialogDescription>
              Update the node label and add optional notes.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="label">Node Label</Label>
              <Input
                id="label"
                value={editedLabel}
                onChange={(e) => setEditedLabel(e.target.value)}
                placeholder="Enter node label..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                placeholder="Add notes or description..."
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(StandardNode);
