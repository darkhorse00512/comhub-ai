import { memo, useState } from "react";
import { Copy, Pencil, Trash2, GitBranch, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface JunctionNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const JunctionNode = ({ id, data, onClone, onDelete, onUpdate }: JunctionNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedFieldName, setEditedFieldName] = useState(data.left?.field_name || "");
  const [editedOperator, setEditedOperator] = useState(data.operator || "==");
  const [editedLiteralValue, setEditedLiteralValue] = useState(data.right?.literal || "");

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

  const handleSaveEdit = () => {
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
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100">
            <GitBranch className="w-4 h-4 text-blue-700" />
            <span className="text-sm font-medium text-blue-700">Junction</span>
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

          {/* Condition Preview */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 min-h-[40px] font-mono">
            {getConditionDisplay()}
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
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Enter node name..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fieldName">Field Name (Left Side)</Label>
              <Input
                id="fieldName"
                value={editedFieldName}
                onChange={(e) => setEditedFieldName(e.target.value)}
                placeholder="e.g., leaping_call_direction, customer_type"
              />
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
                  onChange={(e) => setEditedLiteralValue(e.target.value)}
                  placeholder="e.g., outbound, true, 5"
                />
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
