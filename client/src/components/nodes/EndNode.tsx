import { memo, useState } from "react";
import { Copy, Pencil, Trash2, FlagTriangleRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { nodeDescriptions } from "@/data/nodeDescriptions";

interface EndNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const EndNode = ({ id, data, onClone, onDelete, onUpdate }: EndNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedMessage, setEditedMessage] = useState(data.endMessage || "");
  const [editedExtractFields, setEditedExtractFields] = useState(
    data.extractFields || ""
  );

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
    setEditedMessage(data.endMessage || "");
    setEditedExtractFields(data.extractFields || "");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(id, {
        ...data,
        label: editedName,
        endMessage: editedMessage,
        extractFields: editedExtractFields,
      });
    }
    setIsEditModalOpen(false);
  };

  const handleCancel = () => {
    setEditedName(data.label || "");
    setEditedMessage(data.endMessage || "");
    setEditedExtractFields(data.extractFields || "");
    setIsEditModalOpen(false);
  };

  // Parse extract fields for preview
  const fieldList = (data.extractFields || "")
    .split(",")
    .map((f: string) => f.trim())
    .filter(Boolean);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-auto">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-100">
            <FlagTriangleRight className="w-4 h-4 text-red-700" />
            <span className="text-sm font-medium text-red-700">End</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-help ml-1 text-red-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium mb-1">
                    {nodeDescriptions.end_call?.tooltip || "Ends the workflow and optionally extracts collected field values."}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

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
          <h3 className="font-semibold text-gray-900 text-base mb-2">
            {data.label || "End Call"}
          </h3>

          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm min-h-[50px]">
            {data.endMessage ? (
              <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed mb-2">
                {data.endMessage}
              </p>
            ) : (
              <p className="text-xs text-gray-400 mb-2">No closing message</p>
            )}

            {fieldList.length > 0 && (
              <div className="border-t border-gray-200 pt-2 mt-1">
                <p className="text-xs font-medium text-gray-600 mb-1">Extract Fields:</p>
                <div className="flex flex-wrap gap-1">
                  {fieldList.map((f: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs font-medium border border-red-200"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>End Node Configuration</DialogTitle>
            <DialogDescription>
              Configure the workflow end point. Optionally specify a closing message and which fields to extract as output.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nodeName">Name</Label>
              <Input
                id="nodeName"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="e.g. End Call"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="endMessage">Closing Message (optional)</Label>
              <Textarea
                id="endMessage"
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                placeholder="Thank you for calling. Goodbye!"
                className="min-h-[80px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Message the agent speaks before ending the call.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="extractFields">Extract Fields (comma-separated)</Label>
              <Input
                id="extractFields"
                value={editedExtractFields}
                onChange={(e) => setEditedExtractFields(e.target.value)}
                placeholder="customer_name, order_id, issue_type"
              />
              <p className="text-xs text-muted-foreground">
                List field names to include in the call result output. These should match fields set by Field Setter nodes or collected during dialogue.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-red-600 hover:bg-red-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(EndNode);
