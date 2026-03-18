import { memo, useState } from "react";
import { Copy, Pencil, Trash2, Database, ChevronRight, HelpCircle, AlertCircle, Plus, X } from "lucide-react";
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
import type { WorkflowField } from "@/components/FieldsPanel";

interface FieldAssignment {
  fieldName: string;
  value: any;
  valueType: string;
}

interface FieldSetterNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
  workflowFields?: WorkflowField[];
}

/** Migrate legacy single-field data to assignments array */
function getAssignments(data: any): FieldAssignment[] {
  if (Array.isArray(data.assignments) && data.assignments.length > 0) {
    return data.assignments;
  }
  // Legacy: single fieldName/value/valueType
  if (data.fieldName) {
    return [{ fieldName: data.fieldName, value: data.value ?? "", valueType: data.valueType || "text" }];
  }
  return [];
}

const FieldSetterNode = ({ id, data, onClone, onDelete, onUpdate, workflowFields = [] }: FieldSetterNodeProps) => {
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedAssignments, setEditedAssignments] = useState<FieldAssignment[]>([]);
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
    setEditedAssignments(getAssignments(data).map((a) => ({ ...a })));
    setErrors({});
    setIsEditModalOpen(true);
  };

  // --- Assignment helpers ---
  const addAssignment = () => {
    setEditedAssignments([...editedAssignments, { fieldName: "", value: "", valueType: "text" }]);
  };

  const removeAssignment = (index: number) => {
    setEditedAssignments(editedAssignments.filter((_, i) => i !== index));
  };

  const updateAssignmentField = (index: number, fieldName: string) => {
    const updated = [...editedAssignments];
    updated[index] = { ...updated[index], fieldName };
    // Auto-set type from workflow field definition
    const field = workflowFields.find((f) => f.name === fieldName);
    if (field) {
      updated[index].valueType = field.type;
      if (field.type === "boolean") {
        updated[index].value = "true";
      } else if (field.type !== updated[index].valueType) {
        updated[index].value = "";
      }
    }
    setEditedAssignments(updated);
    if (errors[`field_${index}`]) {
      const newErrors = { ...errors };
      delete newErrors[`field_${index}`];
      setErrors(newErrors);
    }
  };

  const updateAssignmentValue = (index: number, value: any) => {
    const updated = [...editedAssignments];
    updated[index] = { ...updated[index], value };
    setEditedAssignments(updated);
    if (errors[`value_${index}`]) {
      const newErrors = { ...errors };
      delete newErrors[`value_${index}`];
      setErrors(newErrors);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!editedName.trim()) newErrors.label = "Name is required";
    if (editedAssignments.length === 0) newErrors.assignments = "Add at least one field assignment";
    editedAssignments.forEach((a, i) => {
      if (!a.fieldName.trim()) newErrors[`field_${i}`] = "Select a field";
      if (a.valueType === "number" && isNaN(Number(a.value))) newErrors[`value_${i}`] = "Must be a number";
    });
    // Check for duplicate field names
    const seen = new Set<string>();
    editedAssignments.forEach((a, i) => {
      if (a.fieldName && seen.has(a.fieldName)) {
        newErrors[`field_${i}`] = "Duplicate field";
      }
      seen.add(a.fieldName);
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveEdit = () => {
    if (!validateForm()) {
      toast({ title: "Validation Error", description: "Please fix the errors before saving", variant: "destructive" });
      return;
    }
    if (onUpdate) {
      // Save both new format (assignments) and legacy fields for backward compat
      const first = editedAssignments[0];
      onUpdate(id, {
        ...data,
        label: editedName,
        assignments: editedAssignments,
        // Legacy compat: keep first assignment as top-level fields
        fieldName: first?.fieldName || "",
        value: first?.value ?? "",
        valueType: first?.valueType || "text",
      });
    }
    setIsEditModalOpen(false);
    setErrors({});
  };

  const handleCancel = () => {
    setIsEditModalOpen(false);
    setErrors({});
  };

  // Display data
  const assignments = getAssignments(data);
  // Fields already used in assignments (for filtering dropdown options)
  const usedFields = (index: number) => {
    return new Set(editedAssignments.filter((_, i) => i !== index).map((a) => a.fieldName));
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-auto">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-100">
            <Database className="w-4 h-4 text-yellow-700" />
            <span className="text-sm font-medium text-yellow-700">Field Setter</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-help ml-1 text-yellow-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium mb-1">{nodeDescriptions.field_setter.tooltip}</p>
                  {nodeDescriptions.field_setter.examples && (
                    <div className="text-xs opacity-90 mt-2">
                      <strong>Examples:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {nodeDescriptions.field_setter.examples.map((ex, i) => (
                          <li key={i}>{ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center gap-0.5">
            <button onClick={handleClone} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700" title="Clone">
              <Copy className="w-4 h-4" />
            </button>
            <button onClick={handleEdit} className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors text-blue-500 hover:text-blue-700" title="Edit">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-500 hover:text-red-700" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Node Content */}
        <div className="px-4 py-3">
          <h3 className="font-semibold text-gray-900 text-base mb-2">
            {data.label || "Field Setter Node"}
          </h3>

          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm min-h-[50px] space-y-1.5">
            {assignments.length > 0 ? (
              assignments.map((a, i) => (
                <div key={i} className="flex items-center gap-2 font-mono text-xs">
                  <Database className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold truncate">
                    {a.fieldName}
                  </span>
                  <span className="text-gray-400">=</span>
                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded truncate">
                    {String(a.value ?? "")}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-gray-400">No field configured</span>
            )}
          </div>
        </div>

        {/* Transition */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between bg-yellow-50 rounded-lg px-3 py-2 border border-yellow-200">
            <span className="text-sm font-medium text-yellow-700">Next Stage</span>
            <ChevronRight className="w-4 h-4 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogTitle>Field Setter Configuration</DialogTitle>
            <DialogDescription>
              Set one or more workflow fields. Fields must be defined in Workflow Fields first.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="nodeName">Name</Label>
              <Input
                id="nodeName"
                value={editedName}
                onChange={(e) => {
                  setEditedName(e.target.value);
                  if (errors.label) setErrors({ ...errors, label: "" });
                }}
                placeholder="Enter node name..."
                className={errors.label ? "border-red-500" : ""}
              />
              {errors.label && <p className="text-xs text-red-400">{errors.label}</p>}
            </div>

            {/* Field assignments */}
            <div className="space-y-3">
              <Label>Field assignments</Label>

              {workflowFields.length === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/10 text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-xs">
                    No fields defined yet. Add fields in <span className="font-semibold">Workflow Fields</span> panel first.
                  </p>
                </div>
              )}

              {editedAssignments.map((assignment, index) => {
                const used = usedFields(index);
                const availableFields = workflowFields.filter((f) => !used.has(f.name));
                return (
                  <div key={index} className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Assignment {index + 1}</span>
                      <button
                        onClick={() => removeAssignment(index)}
                        className="text-red-400 hover:text-red-600 p-0.5 transition-colors"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Field selector */}
                    <div className="space-y-1">
                      <Label className="text-xs">Field</Label>
                      <Select value={assignment.fieldName} onValueChange={(v) => updateAssignmentField(index, v)}>
                        <SelectTrigger className={`h-9 ${errors[`field_${index}`] ? "border-red-500" : ""}`}>
                          <SelectValue placeholder="Select a field..." />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Show current selection + available (unused) fields */}
                          {workflowFields
                            .filter((f) => f.name === assignment.fieldName || !used.has(f.name))
                            .map((field) => (
                              <SelectItem key={field.name} value={field.name}>
                                <span className="flex items-center gap-2">
                                  <span className="font-mono">{field.name}</span>
                                  <span className="text-xs text-muted-foreground">({field.type})</span>
                                </span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {errors[`field_${index}`] && (
                        <p className="text-xs text-red-400">{errors[`field_${index}`]}</p>
                      )}
                    </div>

                    {/* Value input */}
                    <div className="space-y-1">
                      <Label className="text-xs">Value</Label>
                      {assignment.valueType === "boolean" ? (
                        <Select
                          value={String(assignment.value)}
                          onValueChange={(v) => updateAssignmentValue(index, v === "true")}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select value" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">true</SelectItem>
                            <SelectItem value="false">false</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={assignment.valueType === "number" ? "number" : "text"}
                          value={assignment.value ?? ""}
                          onChange={(e) =>
                            updateAssignmentValue(
                              index,
                              assignment.valueType === "number" ? Number(e.target.value) : e.target.value
                            )
                          }
                          placeholder="Enter value..."
                          className={`h-9 ${errors[`value_${index}`] ? "border-red-500" : ""}`}
                        />
                      )}
                      {errors[`value_${index}`] && (
                        <p className="text-xs text-red-400">{errors[`value_${index}`]}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {errors.assignments && editedAssignments.length === 0 && (
                <p className="text-xs text-red-400">{errors.assignments}</p>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={addAssignment}
                className="w-full gap-2"
                disabled={workflowFields.length === 0 || editedAssignments.length >= workflowFields.length}
              >
                <Plus className="w-3.5 h-3.5" />
                Add field
              </Button>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-amber-600 hover:bg-amber-500 text-white">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(FieldSetterNode);
