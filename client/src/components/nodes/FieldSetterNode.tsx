import { memo, useState } from "react";
import { Copy, Pencil, Trash2, Database, ChevronRight, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FieldSetterNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const FieldSetterNode = ({ id, data, onClone, onDelete, onUpdate }: FieldSetterNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedFieldName, setEditedFieldName] = useState(data.fieldName || "");
  const [editedValue, setEditedValue] = useState(data.value || "");
  const [editedValueType, setEditedValueType] = useState(data.valueType || "text");

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

  const handleSaveEdit = () => {
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
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
  };

  // Get preview text
  const getPreviewText = () => {
    if (data.fieldName) {
      const valueDisplay = data.value !== undefined ? ` = ${data.value}` : "";
      return `${data.fieldName}${valueDisplay}`;
    }
    return "No field configured";
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-100">
            <Database className="w-4 h-4 text-yellow-700" />
            <span className="text-sm font-medium text-yellow-700">Field Setter</span>
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

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 min-h-[40px] font-mono">
            {getPreviewText()}
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
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={handleCloseModal}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Field Setter Configuration</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Save
                </Button>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="nodeName" className="text-sm font-medium text-gray-700">
                  Name
                </Label>
                <Input
                  id="nodeName"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter node name..."
                  className="w-full border-gray-200 focus:border-yellow-500 focus:ring-yellow-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fieldName" className="text-sm font-medium text-gray-700">
                  Field Name
                </Label>
                <Input
                  id="fieldName"
                  value={editedFieldName}
                  onChange={(e) => setEditedFieldName(e.target.value)}
                  placeholder="e.g., should_export, customer_type"
                  className="w-full border-gray-200 focus:border-yellow-500 focus:ring-yellow-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="valueType" className="text-sm font-medium text-gray-700">
                  Value Type
                </Label>
                <Select value={editedValueType} onValueChange={setEditedValueType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="boolean">Boolean (true/false)</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="value" className="text-sm font-medium text-gray-700">
                  Value
                </Label>
                {editedValueType === "boolean" ? (
                  <Select value={String(editedValue)} onValueChange={(v) => setEditedValue(v === "true")}>
                    <SelectTrigger className="w-full">
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
                    onChange={(e) => setEditedValue(editedValueType === "number" ? Number(e.target.value) : e.target.value)}
                    placeholder="Enter value..."
                    className="w-full border-gray-200 focus:border-yellow-500 focus:ring-yellow-500"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default memo(FieldSetterNode);
