import { memo, useState } from "react";
import { Copy, Pencil, Trash2, ToggleLeft, ChevronRight, X, Check, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SwitchNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const SwitchNode = ({ id, data, onClone, onDelete, onUpdate }: SwitchNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedSwitchField, setEditedSwitchField] = useState(data.switchField || "");
  const [editedCases, setEditedCases] = useState<Array<{value: string, label: string}>>(
    data.cases || [{ value: "", label: "" }]
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
    setEditedSwitchField(data.switchField || "");
    setEditedCases(data.cases || [{ value: "", label: "" }]);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(id, {
        ...data,
        label: editedName,
        switchField: editedSwitchField,
        cases: editedCases.filter(c => c.value || c.label),
      });
    }
    setIsEditModalOpen(false);
  };

  const handleCloseModal = () => {
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
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-100">
            <ToggleLeft className="w-4 h-4 text-pink-700" />
            <span className="text-sm font-medium text-pink-700">Switch</span>
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

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 min-h-[40px]">
            {getCasesPreview()}
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
              <h2 className="text-lg font-semibold text-gray-900">Switch Configuration</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="bg-pink-600 hover:bg-pink-700 text-white gap-1.5"
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

            <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="nodeName" className="text-sm font-medium text-gray-700">
                  Name
                </Label>
                <Input
                  id="nodeName"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter node name..."
                  className="w-full border-gray-200 focus:border-pink-500 focus:ring-pink-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="switchField" className="text-sm font-medium text-gray-700">
                  Switch Field
                </Label>
                <Input
                  id="switchField"
                  value={editedSwitchField}
                  onChange={(e) => setEditedSwitchField(e.target.value)}
                  placeholder="e.g., user_choice, intent"
                  className="w-full border-gray-200 focus:border-pink-500 focus:ring-pink-500"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Cases</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addCase}
                    className="h-8 gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Case
                  </Button>
                </div>

                {editedCases.map((c, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={c.value}
                        onChange={(e) => updateCase(i, "value", e.target.value)}
                        placeholder="Value"
                        className="w-full text-sm"
                      />
                      <Input
                        value={c.label}
                        onChange={(e) => updateCase(i, "label", e.target.value)}
                        placeholder="Label (optional)"
                        className="w-full text-sm"
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
          </div>
        </div>
      )}
    </>
  );
};

export default memo(SwitchNode);
