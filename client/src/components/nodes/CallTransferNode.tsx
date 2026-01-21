import { memo, useState } from "react";
import { Copy, Pencil, Trash2, Phone, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CallTransferNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const CallTransferNode = ({ id, data, onClone, onDelete, onUpdate }: CallTransferNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedTransferTo, setEditedTransferTo] = useState(data.transferTo || "");
  const [editedTransferMessage, setEditedTransferMessage] = useState(data.transferMessage || "");
  const [editedWaitMusic, setEditedWaitMusic] = useState(data.waitMusic || false);
  const [editedTransferType, setEditedTransferType] = useState(data.transferType || "cold");

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
    setEditedTransferTo(data.transferTo || "");
    setEditedTransferMessage(data.transferMessage || "");
    setEditedWaitMusic(data.waitMusic || false);
    setEditedTransferType(data.transferType || "cold");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(id, {
        ...data,
        label: editedName,
        transferTo: editedTransferTo,
        transferMessage: editedTransferMessage,
        waitMusic: editedWaitMusic,
        transferType: editedTransferType,
      });
    }
    setIsEditModalOpen(false);
  };

  const handleCancel = () => {
    setEditedName(data.label || "");
    setEditedTransferTo(data.transferTo || "");
    setEditedTransferMessage(data.transferMessage || "");
    setEditedWaitMusic(data.waitMusic || false);
    setEditedTransferType(data.transferType || "cold");
    setIsEditModalOpen(false);
  };

  // Get preview
  const getPreviewText = () => {
    if (data.transferTo) {
      return `Transfer to: ${data.transferTo}`;
    }
    return "No transfer destination set";
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-100">
            <Phone className="w-4 h-4 text-teal-700" />
            <span className="text-sm font-medium text-teal-700">Call Transfer</span>
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
            {data.label || "Call Transfer Node"}
          </h3>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 min-h-[40px]">
            {getPreviewText()}
          </div>
        </div>

        {/* Transition */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between bg-teal-50 rounded-lg px-3 py-2 border border-teal-200">
            <span className="text-sm font-medium text-teal-700">Next Stage</span>
            <ChevronRight className="w-4 h-4 text-teal-500" />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Call Transfer Configuration</DialogTitle>
            <DialogDescription>
              Configure how the call should be transferred to another number or extension.
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
              <Label htmlFor="transferType">Transfer Type</Label>
              <Select value={editedTransferType} onValueChange={setEditedTransferType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cold">Cold Transfer</SelectItem>
                  <SelectItem value="warm">Warm Transfer</SelectItem>
                  <SelectItem value="blind">Blind Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transferTo">Transfer To (Phone/Extension)</Label>
              <Input
                id="transferTo"
                value={editedTransferTo}
                onChange={(e) => setEditedTransferTo(e.target.value)}
                placeholder="+1234567890 or ext:123"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transferMessage">Transfer Message (before transfer)</Label>
              <Textarea
                id="transferMessage"
                value={editedTransferMessage}
                onChange={(e) => setEditedTransferMessage(e.target.value)}
                placeholder="Message to say before transferring..."
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="waitMusic"
                checked={editedWaitMusic}
                onCheckedChange={(checked) => setEditedWaitMusic(!!checked)}
              />
              <Label htmlFor="waitMusic" className="cursor-pointer">
                Play hold music while transferring
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-teal-600 hover:bg-teal-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(CallTransferNode);
