import { memo, useState } from "react";
import { PhoneIncoming, PhoneOutgoing, Trash2, HelpCircle, Pencil, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { nodeDescriptions } from "@/data/nodeDescriptions";

interface CallDirectionNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
  existingDirections?: string[];
}

const CallDirectionNode = ({ id, data, onDelete, onUpdate, existingDirections = [] }: CallDirectionNodeProps) => {
  const isInbound = data.direction === "inbound";
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDirection, setEditedDirection] = useState<"inbound" | "outbound">("inbound");

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedName(data.label || "");
    setEditedDirection(data.direction || "inbound");
    setIsEditModalOpen(true);
  };

  const handleSave = () => {
    if (onUpdate) {
      const label = editedDirection === "inbound" ? "Inbound Call" : "Outbound Call";
      onUpdate(id, {
        ...data,
        label: editedName.trim() || label,
        direction: editedDirection,
      });
    }
    setIsEditModalOpen(false);
  };

  // Determine which directions are available for switching
  const otherDirection = isInbound ? "outbound" : "inbound";
  const canSwitchDirection = !existingDirections.includes(otherDirection);

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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className={`w-4 h-4 opacity-60 hover:opacity-100 cursor-help ml-1 ${isInbound ? "text-blue-600" : "text-purple-600"}`} />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="font-medium">{nodeDescriptions.call_direction?.tooltip || "Defines whether this workflow is for inbound or outbound calls."}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                onClick={handleEdit}
                className={`p-1.5 rounded-lg transition-colors ${isInbound ? "hover:bg-blue-200 text-blue-600" : "hover:bg-purple-200 text-purple-600"}`}
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

          <div className={`text-xs p-2 rounded ${isInbound ? "bg-blue-100/50 text-blue-700" : "bg-purple-100/50 text-purple-700"}`}>
            <span className="font-medium">Direction:</span>{" "}
            <span className="capitalize">{data.direction}</span>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Call Type Configuration</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="callTypeName">Name</Label>
              <Input
                id="callTypeName"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder={editedDirection === "inbound" ? "Inbound Call" : "Outbound Call"}
              />
            </div>

            <div className="space-y-2">
              <Label>Direction</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditedDirection("inbound")}
                  disabled={editedDirection !== "inbound" && !canSwitchDirection}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    editedDirection === "inbound"
                      ? "border-blue-500 bg-blue-500/15 text-blue-400"
                      : canSwitchDirection
                        ? "border-border bg-secondary/50 text-muted-foreground hover:border-blue-500/50"
                        : "border-border bg-secondary/30 text-muted-foreground/50 cursor-not-allowed opacity-50"
                  }`}
                >
                  <PhoneIncoming className="w-4 h-4" />
                  <span className="text-sm font-medium">Inbound</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditedDirection("outbound")}
                  disabled={editedDirection !== "outbound" && !canSwitchDirection}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    editedDirection === "outbound"
                      ? "border-purple-500 bg-purple-500/15 text-purple-400"
                      : canSwitchDirection
                        ? "border-border bg-secondary/50 text-muted-foreground hover:border-purple-500/50"
                        : "border-border bg-secondary/30 text-muted-foreground/50 cursor-not-allowed opacity-50"
                  }`}
                >
                  <PhoneOutgoing className="w-4 h-4" />
                  <span className="text-sm font-medium">Outbound</span>
                </button>
              </div>
              {!canSwitchDirection && (
                <p className="text-xs text-muted-foreground">
                  The other direction already has a node. Only one per direction is allowed.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white">
              <Check className="w-4 h-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(CallDirectionNode);
