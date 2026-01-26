import { memo, useState } from "react";
import { Copy, Pencil, Trash2, Clock, ChevronRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface TimeLimitNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const TimeLimitNode = ({ id, data, onClone, onDelete, onUpdate }: TimeLimitNodeProps) => {
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedMaxDuration, setEditedMaxDuration] = useState(data.maxDuration || "");
  const [editedWarningAt, setEditedWarningAt] = useState(data.warningAt || "");
  const [editedTimeoutAction, setEditedTimeoutAction] = useState(data.timeoutAction || "end");
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
    setEditedMaxDuration(data.maxDuration || "");
    setEditedWarningAt(data.warningAt || "");
    setEditedTimeoutAction(data.timeoutAction || "end");
    setIsEditModalOpen(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editedName.trim()) {
      newErrors.label = "Name is required";
    }

    if (!editedMaxDuration || isNaN(Number(editedMaxDuration)) || Number(editedMaxDuration) <= 0) {
      newErrors.maxDuration = "Max duration must be a positive number";
    }

    if (editedWarningAt && (isNaN(Number(editedWarningAt)) || Number(editedWarningAt) < 0)) {
      newErrors.warningAt = "Warning time must be a non-negative number";
    }

    if (editedWarningAt && editedMaxDuration && Number(editedWarningAt) >= Number(editedMaxDuration)) {
      newErrors.warningAt = "Warning time must be less than max duration";
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
        maxDuration: editedMaxDuration,
        warningAt: editedWarningAt,
        timeoutAction: editedTimeoutAction,
      });
    }
    setIsEditModalOpen(false);
    setErrors({});
  };

  const handleCancel = () => {
    setEditedName(data.label || "");
    setEditedMaxDuration(data.maxDuration || "");
    setEditedWarningAt(data.warningAt || "");
    setEditedTimeoutAction(data.timeoutAction || "end");
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-help ml-1 text-red-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium mb-1">{nodeDescriptions.time_limit?.tooltip || "Set a maximum duration for this stage with optional warnings."}</p>
                  {nodeDescriptions.time_limit?.examples && (
                    <div className="text-xs opacity-90 mt-2">
                      <strong>Examples:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {nodeDescriptions.time_limit.examples.map((ex, i) => (
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
            {data.label || "Time Limit Node"}
          </h3>

          {/* Preview - Enhanced */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm min-h-[70px]">
            {data.maxDuration ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-red-600" />
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-semibold">
                    {data.maxDuration}s max
                  </span>
                </div>
                {data.warningAt && (
                  <div className="text-xs text-gray-600 mb-1">
                    <span className="font-semibold">Warning at:</span> {data.warningAt}s
                  </div>
                )}
                <div className="text-xs text-gray-600">
                  <span className="font-semibold">Action:</span> {data.timeoutAction || 'end'}
                </div>
              </>
            ) : (
              <span className="text-gray-400">No time limit configured</span>
            )}
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
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Time Limit Configuration</DialogTitle>
            <DialogDescription>
              Set a maximum duration for this stage and define what happens when time runs out.
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
              <Label htmlFor="maxDuration">Max Duration (seconds)</Label>
              <Input
                id="maxDuration"
                type="number"
                value={editedMaxDuration}
                onChange={(e) => {
                  setEditedMaxDuration(e.target.value);
                  if (errors.maxDuration) setErrors({...errors, maxDuration: ""});
                }}
                placeholder="e.g., 300"
                className={errors.maxDuration ? "border-red-500" : ""}
              />
              {errors.maxDuration && (
                <p className="text-xs text-red-600 mt-1">{errors.maxDuration}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="warningAt">Warning At (seconds before end)</Label>
              <Input
                id="warningAt"
                type="number"
                value={editedWarningAt}
                onChange={(e) => {
                  setEditedWarningAt(e.target.value);
                  if (errors.warningAt) setErrors({...errors, warningAt: ""});
                }}
                placeholder="e.g., 30"
                className={errors.warningAt ? "border-red-500" : ""}
              />
              {errors.warningAt && (
                <p className="text-xs text-red-600 mt-1">{errors.warningAt}</p>
              )}
              <p className="text-xs text-muted-foreground">
                The agent will warn the user when this many seconds remain.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="timeoutAction">On Timeout</Label>
              <Select value={editedTimeoutAction} onValueChange={setEditedTimeoutAction}>
                <SelectTrigger>
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

export default memo(TimeLimitNode);
