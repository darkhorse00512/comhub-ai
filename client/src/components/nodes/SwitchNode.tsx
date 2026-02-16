import { memo, useState } from "react";
import { Copy, Pencil, Trash2, ToggleLeft, ChevronRight, Plus, Minus, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface SwitchNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const SwitchNode = ({ id, data, onClone, onDelete, onUpdate }: SwitchNodeProps) => {
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedSwitchField, setEditedSwitchField] = useState(data.switchField || "");
  const [editedCases, setEditedCases] = useState<Array<{value: string, label: string}>>(
    data.cases || [{ value: "", label: "" }]
  );
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
    setEditedSwitchField(data.switchField || "");
    setEditedCases(data.cases || [{ value: "", label: "" }]);
    setIsEditModalOpen(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editedName.trim()) {
      newErrors.label = "Name is required";
    }

    if (!editedSwitchField.trim()) {
      newErrors.switchField = "Switch field name is required";
    }

    const validCases = editedCases.filter(c => c.value.trim());
    if (validCases.length < 2) {
      newErrors.cases = "At least 2 cases with values are required";
    }

    // Check for duplicate case values
    const values = validCases.map(c => c.value.trim());
    const duplicates = values.filter((v, i) => values.indexOf(v) !== i);
    if (duplicates.length > 0) {
      newErrors.cases = `Duplicate case values found: ${[...new Set(duplicates)].join(", ")}`;
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
        switchField: editedSwitchField,
        cases: editedCases.filter(c => c.value || c.label),
      });
    }
    setIsEditModalOpen(false);
    setErrors({});
  };

  const handleCancel = () => {
    setEditedName(data.label || "");
    setEditedSwitchField(data.switchField || "");
    setEditedCases(data.cases || [{ value: "", label: "" }]);
    setIsEditModalOpen(false);
  };

  const addCase = () => {
    setEditedCases([...editedCases, { value: "", label: "" }]);
  };

  const removeCase = (index: number) => {
    setEditedCases(editedCases.filter((_, i) => i !== index));
  };

  const updateCase = (index: number, field: "value" | "label", value: string) => {
    const newCases = [...editedCases];
    newCases[index][field] = value;
    setEditedCases(newCases);
  };

  // Get preview
  const getCasesPreview = () => {
    const cases = data.cases || [];
    if (cases.length === 0) return "No cases defined";
    return `${cases.length} case${cases.length > 1 ? "s" : ""}: ${cases.map((c: any) => c.label || c.value).join(", ")}`;
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-auto">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-100">
            <ToggleLeft className="w-4 h-4 text-pink-700" />
            <span className="text-sm font-medium text-pink-700">Switch</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-help ml-1 text-pink-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium mb-1">{nodeDescriptions.switch.tooltip}</p>
                  {nodeDescriptions.switch.examples && (
                    <div className="text-xs opacity-90 mt-2">
                      <strong>Examples:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {nodeDescriptions.switch.examples.map((ex, i) => (
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
            {data.label || "Switch Node"}
          </h3>

          {/* Preview - Enhanced */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm min-h-[50px]">
            {data.switchField ? (
              <>
                <div className="text-xs text-gray-600 mb-2">
                  Switch on: <span className="font-mono font-semibold text-pink-700">{data.switchField}</span>
                </div>
                {(data.cases || []).length > 0 ? (
                  <div className="space-y-1">
                    {(data.cases || []).slice(0, 3).map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-6 h-6 rounded bg-pink-100 text-pink-700 flex items-center justify-center font-semibold text-[10px]">
                          {c.value}
                        </span>
                        <ChevronRight className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-700">{c.label || c.value}</span>
                      </div>
                    ))}
                    {(data.cases || []).length > 3 && (
                      <div className="text-xs text-gray-500 italic">
                        +{(data.cases || []).length - 3} more cases
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400 text-xs">No cases defined</span>
                )}
              </>
            ) : (
              <span className="text-gray-400">No switch field configured</span>
            )}
          </div>
        </div>

        {/* Cases as transitions */}
        <div className="px-4 pb-3 space-y-2">
          {(data.cases || []).slice(0, 3).map((c: any, i: number) => (
            <div key={i} className="flex items-center justify-between bg-pink-50 rounded-lg px-3 py-2 border border-pink-200">
              <span className="text-sm font-medium text-pink-700">{c.label || c.value || `Case ${i + 1}`}</span>
              <ChevronRight className="w-4 h-4 text-pink-500" />
            </div>
          ))}
          {(data.cases || []).length > 3 && (
            <div className="text-xs text-gray-500 text-center">
              +{(data.cases || []).length - 3} more cases
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Switch Node Configuration</DialogTitle>
            <DialogDescription>
              Configure multiple branches based on different values of a field.
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
              <Label htmlFor="switchField">Switch Field</Label>
              <Input
                id="switchField"
                value={editedSwitchField}
                onChange={(e) => {
                  setEditedSwitchField(e.target.value);
                  if (errors.switchField) setErrors({...errors, switchField: ""});
                }}
                placeholder="e.g., user_choice, menu_selection"
                className={errors.switchField ? "border-red-500" : ""}
              />
              {errors.switchField && (
                <p className="text-xs text-red-600 mt-1">{errors.switchField}</p>
              )}
              <p className="text-xs text-muted-foreground">
                The field whose value will determine which case to follow
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Cases</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    addCase();
                    if (errors.cases) setErrors({...errors, cases: ""});
                  }}
                  className="h-8 gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Case
                </Button>
              </div>
              {errors.cases && (
                <p className="text-xs text-red-600">{errors.cases}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Add at least 2 cases with unique values
              </p>

              {editedCases.map((c, i) => (
                <div key={i} className="flex gap-2 items-start p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={c.value}
                      onChange={(e) => updateCase(i, "value", e.target.value)}
                      placeholder="Value to match"
                      className="text-sm"
                    />
                    <Input
                      value={c.label}
                      onChange={(e) => updateCase(i, "label", e.target.value)}
                      placeholder="Display label (optional)"
                      className="text-sm"
                    />
                  </div>
                  {editedCases.length > 1 && (
                    <button
                      onClick={() => removeCase(i)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-pink-600 hover:bg-pink-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(SwitchNode);
