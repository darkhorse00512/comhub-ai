import { memo, useState } from "react";
import { Copy, Pencil, Trash2, GitBranch, ChevronRight, HelpCircle, Check, X } from "lucide-react";
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

interface JunctionNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
  workflowFields?: WorkflowField[];
}

const JunctionNode = ({ id, data, onClone, onDelete, onUpdate, workflowFields = [] }: JunctionNodeProps) => {
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedFieldName, setEditedFieldName] = useState(data.left?.field_name || "");
  const [editedOperator, setEditedOperator] = useState(data.operator || "==");
  const [editedLiteralValue, setEditedLiteralValue] = useState(data.right?.literal || "");
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
    setEditedFieldName(data.left?.field_name || "");
    setEditedOperator(data.operator || "==");
    setEditedLiteralValue(data.right?.literal || "");
    setIsEditModalOpen(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editedName.trim()) {
      newErrors.label = "Name is required";
    }

    if (!editedFieldName.trim()) {
      newErrors.fieldName = "Field name is required";
    }

    if (!['is_null', 'is_not_null'].includes(editedOperator) && !editedLiteralValue.trim()) {
      newErrors.literalValue = "Compare value is required for this operator";
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
        left: { field_name: editedFieldName },
        operator: editedOperator,
        right: { type: "text", literal: editedLiteralValue },
      });
    }
    setIsEditModalOpen(false);
    setErrors({});
  };

  const handleCancel = () => {
    setEditedName(data.label || "");
    setEditedFieldName(data.left?.field_name || "");
    setEditedOperator(data.operator || "==");
    setEditedLiteralValue(data.right?.literal || "");
    setIsEditModalOpen(false);
  };

  // Get condition display
  const getConditionDisplay = () => {
    const fieldName = data.left?.field_name || "field";
    const op = data.operator || "==";
    const value = data.right?.literal;

    if (op === "is_not_null") {
      return `${fieldName} is not null`;
    }
    if (op === "is_null") {
      return `${fieldName} is null`;
    }
    return `${fieldName} ${op} "${value || "?"}"`;
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-auto">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100">
            <GitBranch className="w-4 h-4 text-blue-700" />
            <span className="text-sm font-medium text-blue-700">Junction</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-help ml-1 text-blue-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium mb-1">{nodeDescriptions.junction.tooltip}</p>
                  {nodeDescriptions.junction.examples && (
                    <div className="text-xs opacity-90 mt-2">
                      <strong>Examples:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {nodeDescriptions.junction.examples.map((ex, i) => (
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
            {data.label || "Junction Node"}
          </h3>

          {/* Condition Preview - Enhanced */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm min-h-[60px]">
            <div className="flex items-center gap-2 mb-2 font-mono text-xs flex-wrap">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">
                {data.left?.field_name || 'field'}
              </span>
              <span className="text-gray-500">{data.operator || '=='}</span>
              {!['is_null', 'is_not_null'].includes(data.operator) && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold">
                  "{data.right?.literal || 'value'}"
                </span>
              )}
            </div>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-1">
                <Check className="w-3 h-3" /> True
              </span>
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded flex items-center gap-1">
                <X className="w-3 h-3" /> False
              </span>
            </div>
          </div>
        </div>

        {/* Transitions - True/False */}
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 border border-green-200">
            <span className="text-sm font-medium text-green-700">True</span>
            <ChevronRight className="w-4 h-4 text-green-500" />
          </div>
          <div className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2 border border-red-200">
            <span className="text-sm font-medium text-red-700">False</span>
            <ChevronRight className="w-4 h-4 text-red-500" />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Junction Node Configuration</DialogTitle>
            <DialogDescription>
              Define a condition to branch the workflow based on field values.
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
              <Label>Field Name (Left Side)</Label>
              {workflowFields.length > 0 ? (
                <Select
                  value={editedFieldName}
                  onValueChange={(v) => {
                    setEditedFieldName(v);
                    if (errors.fieldName) setErrors({...errors, fieldName: ""});
                  }}
                >
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
                <Input
                  value={editedFieldName}
                  onChange={(e) => {
                    setEditedFieldName(e.target.value);
                    if (errors.fieldName) setErrors({...errors, fieldName: ""});
                  }}
                  placeholder="Define fields in Workflow Fields first"
                  className={errors.fieldName ? "border-red-500" : ""}
                />
              )}
              {errors.fieldName && (
                <p className="text-xs text-red-600 mt-1">{errors.fieldName}</p>
              )}
              <p className="text-xs text-muted-foreground">
                The field whose value will be checked
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="operator">Operator</Label>
              <Select value={editedOperator} onValueChange={setEditedOperator}>
                <SelectTrigger>
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="==">Equals (==)</SelectItem>
                  <SelectItem value="!=">Not Equals (!=)</SelectItem>
                  <SelectItem value=">">Greater Than (&gt;)</SelectItem>
                  <SelectItem value="<">Less Than (&lt;)</SelectItem>
                  <SelectItem value=">=">Greater or Equal (&gt;=)</SelectItem>
                  <SelectItem value="<=">Less or Equal (&lt;=)</SelectItem>
                  <SelectItem value="is_null">Is Null</SelectItem>
                  <SelectItem value="is_not_null">Is Not Null</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editedOperator !== "is_null" && editedOperator !== "is_not_null" && (
              <div className="grid gap-2">
                <Label htmlFor="literalValue">Compare Value (Right Side)</Label>
                <Input
                  id="literalValue"
                  value={editedLiteralValue}
                  onChange={(e) => {
                    setEditedLiteralValue(e.target.value);
                    if (errors.literalValue) setErrors({...errors, literalValue: ""});
                  }}
                  placeholder="e.g., VIP, true, 100"
                  className={errors.literalValue ? "border-red-500" : ""}
                />
                {errors.literalValue && (
                  <p className="text-xs text-red-600 mt-1">{errors.literalValue}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  The value to compare the field against
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(JunctionNode);
