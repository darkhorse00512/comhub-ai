import { memo, useState } from "react";
import { Copy, Pencil, Trash2, Phone, ChevronRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { nodeDescriptions } from "@/data/nodeDescriptions";

interface CallTransferNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const CallTransferNode = ({ id, data, onClone, onDelete, onUpdate }: CallTransferNodeProps) => {
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedTransferTo, setEditedTransferTo] = useState(data.transferTo || "");
  const [editedTransferMessage, setEditedTransferMessage] = useState(data.transferMessage || "");
  const [editedWaitMusic, setEditedWaitMusic] = useState(data.waitMusic || false);
  const [editedTransferType, setEditedTransferType] = useState(data.transferType || "cold");
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editedName.trim()) {
      newErrors.label = "Name is required";
    }

    if (!editedTransferTo.trim()) {
      newErrors.transferTo = "Transfer destination is required";
    } else {
      const phoneRegex = /^(?:\+\d{1,15}|ext:\d+)$/;
      if (!phoneRegex.test(editedTransferTo.trim())) {
        newErrors.transferTo = "Use format +1234567890 or ext:123";
      }
    }

    if (!editedTransferMessage.trim()) {
      newErrors.transferMessage = "Transfer message is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveEdit = () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving",
        variant: "destructive"
      });
      return;
    }

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
    setErrors({});
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-help ml-1 text-teal-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium mb-1">{nodeDescriptions.call_transfer?.tooltip || "Transfer the call to another number or extension."}</p>
                  {nodeDescriptions.call_transfer?.examples && (
                    <div className="text-xs opacity-90 mt-2">
                      <strong>Examples:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {nodeDescriptions.call_transfer.examples.map((ex, i) => (
                          <li key={i}>{ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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

          {/* Preview - Enhanced */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm min-h-[70px]">
            {data.transferTo ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-teal-600" />
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs font-semibold">
                    {data.transferTo}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mb-1">
                  <span className="font-semibold">Type:</span> {data.transferType || 'cold'}
                </div>
                {data.transferMessage && (
                  <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">
                    {data.transferMessage}
                  </p>
                )}
                {data.waitMusic && (
                  <div className="text-xs text-teal-600 mt-1">
                    Music: On
                  </div>
                )}
              </>
            ) : (
              <span className="text-gray-400">No transfer destination set</span>
            )}
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
                onChange={(e) => {
                  setEditedName(e.target.value);
                  if (errors.label) setErrors({...errors, label: ""});
                }}
                placeholder="Enter node name..."
                className={errors.label ? "border-red-500" : ""}
              />
              {errors.label && (
                <p className="text-xs text-red-600 mt-1">{errors.label}</p>
              )}
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
                onChange={(e) => {
                  setEditedTransferTo(e.target.value);
                  if (errors.transferTo) setErrors({...errors, transferTo: ""});
                }}
                placeholder="+1234567890 or ext:123"
                className={errors.transferTo ? "border-red-500" : ""}
              />
              {errors.transferTo && (
                <p className="text-xs text-red-600 mt-1">{errors.transferTo}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Phone: +1234567890 or Extension: ext:123
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transferMessage">Transfer Message (before transfer)</Label>
              <Textarea
                id="transferMessage"
                value={editedTransferMessage}
                onChange={(e) => {
                  setEditedTransferMessage(e.target.value);
                  if (errors.transferMessage) setErrors({...errors, transferMessage: ""});
                }}
                placeholder="Message to say before transferring..."
                className={`min-h-[80px] resize-none ${errors.transferMessage ? "border-red-500" : ""}`}
              />
              {errors.transferMessage && (
                <p className="text-xs text-red-600 mt-1">{errors.transferMessage}</p>
              )}
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
