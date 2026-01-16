import { memo, useState } from "react";
import { PhoneIncoming, PhoneOutgoing, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CallDirectionNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const CallDirectionNode = ({ id, data, isConnectable, onDelete, onUpdate }: CallDirectionNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedDirection, setEditedDirection] = useState(data.direction || "inbound");

  const isInbound = data.direction === "inbound";

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedDirection(data.direction || "inbound");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(id, {
        ...data,
        direction: editedDirection,
      });
    }
    setIsEditModalOpen(false);
  };

  return (
    <>
      <div
        className={`border-2 rounded-xl shadow-lg min-w-[200px] relative ${
          isInbound
            ? "bg-blue-50 border-blue-400"
            : "bg-purple-50 border-purple-400"
        }`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isInbound ? (
                <PhoneIncoming className="w-5 h-5 text-blue-600" />
              ) : (
                <PhoneOutgoing className="w-5 h-5 text-purple-600" />
              )}
              <span
                className={`font-semibold ${
                  isInbound ? "text-blue-900" : "text-purple-900"
                }`}
              >
                {data.label || "Start"}
              </span>
            </div>

            {/* Action Buttons - Always visible */}
            <div className="flex items-center gap-1.5 opacity-100">
              <button
                onClick={handleEdit}
                className={`p-1.5 rounded-lg transition-colors ${
                  isInbound
                    ? "hover:bg-blue-200"
                    : "hover:bg-purple-200"
                }`}
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

          <div className="text-xs text-gray-600 bg-white p-2 rounded">
            <span className="font-medium">Direction:</span>{" "}
            <span className="capitalize">{data.direction}</span>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Call Direction</DialogTitle>
            <DialogDescription>
              Change the call direction for this node.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="direction">Call Direction</Label>
              <Select value={editedDirection} onValueChange={(value) => setEditedDirection(value)}>
                <SelectTrigger id="direction">
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground mt-2">
                {editedDirection === "inbound" ? (
                  <div className="flex items-center gap-2">
                    <PhoneIncoming className="w-4 h-4" />
                    <span>Inbound: Customer calls into your system</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <PhoneOutgoing className="w-4 h-4" />
                    <span>Outbound: Your system calls the customer</span>
                  </div>
                )}
              </div>
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

export default memo(CallDirectionNode);
