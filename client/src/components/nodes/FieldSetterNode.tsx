import { memo, useState } from "react";
import { Copy, Pencil, Trash2, Database, ChevronRight, HelpCircle, AlertCircle } from "lucide-react";
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

interface FieldSetterNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
  workflowFields?: WorkflowField[];
}

const FieldSetterNode = ({ id, data, onClone, onDelete, onUpdate, workflowFields = [] }: FieldSetterNodeProps) => {
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedFieldName, setEditedFieldName] = useState(data.fieldName || "");
  const [editedValue, setEditedValue] = useState(data.value || "");
  const [editedValueType, setEditedValueType] = useState(data.valueType || "text");
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
    setEditedFieldName(data.fieldName || "");
    setEditedValue(data.value || "");
    setEditedValueType(data.valueType || "text");
    setIsEditModalOpen(true);
  };

  const handleFieldSelection = (fieldName: string) => {
    setEditedFieldName(fieldName);
    if (errors.fieldName) setErrors({ ...errors, fieldName: "" });
    // Auto-set the value type from the workflow field definition
    const field = workflowFields.find((f) => f.name === fieldName);
    if (field) {
      setEditedValueType(field.type);
      // Reset value when type changes
      if (field.type === "boolean") {
        setEditedValue("true");
      } else if (field.type !== editedValueType) {
        setEditedValue("");
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editedName.trim()) {
      newErrors.label = "Name is required";
    }

    if (!editedFieldName.trim()) {
      newErrors.fieldName = "Please select a field";
    }

    if (editedValueType === 'number' && isNaN(Number(editedValue))) {
      newErrors.value = "Value must be a valid number";
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
        fieldName: editedFieldName,
        value: editedValue,
        valueType: editedValueType,
      });
    }
    setIsEditModalOpen(false);
    setErrors({});
  };

  const handleCancel = () => {
    setEditedName(data.label || "");
    setEditedFieldName(data.fieldName || "");
    setEditedValue(data.value || "");
    setEditedValueType(data.valueType || "text");
    setIsEditModalOpen(false);
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-auto">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
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
            {data.label || "Field Setter Node"}
          </h3>

          {/* Preview - Enhanced */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm min-h-[50px]">
            {data.fieldName ? (
              <>
                <div className="flex items-center gap-2 font-mono text-xs mb-1.5">
                  <Database className="w-4 h-4 text-yellow-600" />
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">
                    {data.fieldName}
                  </span>
                  <span className="text-gray-400">←</span>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                    {String(data.value || '')}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Type: <span className="font-medium">{data.valueType || 'text'}</span>
                </div>
              </>
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Field Setter Configuration</DialogTitle>
            <DialogDescription>
              Select a workflow field and set its value. Fields must be defined in Workflow Fields first.
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
              <Label>Field Name</Label>
              {workflowFields.length > 0 ? (
                <Select value={editedFieldName} onValueChange={handleFieldSelection}>
                  <SelectTrigger className={errors.fieldName ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select a field..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workflowFields.map((field) => (
                      <SelectItem key={field.name} value={field.name}>
                        <span className="flex items-center gap-2">
                          <span className="font-mono">{field.name}</span>
                          <span className="text-xs text-muted-foreground">({field.type})</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 text-amber-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="text-xs">
                    No fields defined yet. Add fields in <span className="font-semibold">Workflow Fields</span> panel first.
                  </p>
                </div>
              )}
              {errors.fieldName && (
                <p className="text-xs text-red-600 mt-1">{errors.fieldName}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="valueType">Value Type</Label>
              <Select value={editedValueType} disabled>
                <SelectTrigger className="opacity-60">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="boolean">Boolean (true/false)</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Type is determined by the field definition in Workflow Fields
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="value">Value</Label>
              {editedValueType === "boolean" ? (
                <Select value={String(editedValue)} onValueChange={(v) => setEditedValue(v === "true")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select value" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">true</SelectItem>
                    <SelectItem value="false">false</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="value"
                  type={editedValueType === "number" ? "number" : "text"}
                  value={editedValue}
                  onChange={(e) => {
                    setEditedValue(editedValueType === "number" ? Number(e.target.value) : e.target.value);
                    if (errors.value) setErrors({...errors, value: ""});
                  }}
                  placeholder="Enter value..."
                  className={errors.value ? "border-red-500" : ""}
                />
              )}
              {errors.value && (
                <p className="text-xs text-red-600 mt-1">{errors.value}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-yellow-600 hover:bg-yellow-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(FieldSetterNode);
