import { memo, useState } from "react";
import { Copy, Pencil, Trash2, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FunctionNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const FunctionNode = ({ id, data, onClone, onDelete, onUpdate }: FunctionNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedFunctionName, setEditedFunctionName] = useState(data.functionName || "");
  const [editedFunctionType, setEditedFunctionType] = useState(data.functionType || "api_call");
  const [editedUrl, setEditedUrl] = useState(data.url || "");
  const [editedMethod, setEditedMethod] = useState(data.method || "POST");
  const [editedParameters, setEditedParameters] = useState(data.parameters || "");

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
    setEditedFunctionName(data.functionName || "");
    setEditedFunctionType(data.functionType || "api_call");
    setEditedUrl(data.url || "");
    setEditedMethod(data.method || "POST");
    setEditedParameters(data.parameters || "");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(id, {
        ...data,
        label: editedName,
        functionName: editedFunctionName,
        functionType: editedFunctionType,
        url: editedUrl,
        method: editedMethod,
        parameters: editedParameters,
      });
    }
    setIsEditModalOpen(false);
  };

  const handleCancel = () => {
    setEditedName(data.label || "");
    setEditedFunctionName(data.functionName || "");
    setEditedFunctionType(data.functionType || "api_call");
    setEditedUrl(data.url || "");
    setEditedMethod(data.method || "POST");
    setEditedParameters(data.parameters || "");
    setIsEditModalOpen(false);
  };

  // Get preview
  const getPreviewText = () => {
    if (data.functionName) {
      return data.functionName;
    }
    if (data.url) {
      return `${data.method || "POST"} ${data.url}`;
    }
    return "No function configured";
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-100">
            <Zap className="w-4 h-4 text-orange-700" />
            <span className="text-sm font-medium text-orange-700">Function</span>
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
            {data.label || "Function Node"}
          </h3>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 min-h-[40px] font-mono truncate">
            {getPreviewText()}
          </div>
        </div>

        {/* Transition */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2 border border-orange-200">
            <span className="text-sm font-medium text-orange-700">Next Stage</span>
            <ChevronRight className="w-4 h-4 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Function Node Configuration</DialogTitle>
            <DialogDescription>
              Configure an API call or function to execute at this stage.
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
              <Label htmlFor="functionName">Function Name</Label>
              <Input
                id="functionName"
                value={editedFunctionName}
                onChange={(e) => setEditedFunctionName(e.target.value)}
                placeholder="e.g., export_call_data"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="functionType">Function Type</Label>
              <Select value={editedFunctionType} onValueChange={setEditedFunctionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_call">API Call</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="internal">Internal Function</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editedFunctionType === "api_call" && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="method">Method</Label>
                    <Select value={editedMethod} onValueChange={setEditedMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 grid gap-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      value={editedUrl}
                      onChange={(e) => setEditedUrl(e.target.value)}
                      placeholder="https://api.example.com/endpoint"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="parameters">Parameters (JSON)</Label>
                  <Textarea
                    id="parameters"
                    value={editedParameters}
                    onChange={(e) => setEditedParameters(e.target.value)}
                    placeholder='{"key": "value"}'
                    className="min-h-[100px] resize-none font-mono text-sm"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-orange-600 hover:bg-orange-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(FunctionNode);
