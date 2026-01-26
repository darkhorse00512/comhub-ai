import { memo, useState } from "react";
import { Copy, Pencil, Trash2, Zap, ChevronRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface FunctionNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const FunctionNode = ({ id, data, onClone, onDelete, onUpdate }: FunctionNodeProps) => {
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedFunctionName, setEditedFunctionName] = useState(data.functionName || "");
  const [editedFunctionType, setEditedFunctionType] = useState(data.functionType || "api_call");
  const [editedUrl, setEditedUrl] = useState(data.url || "");
  const [editedMethod, setEditedMethod] = useState(data.method || "POST");
  const [editedParameters, setEditedParameters] = useState(data.parameters || "");
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
    setEditedFunctionName(data.functionName || "");
    setEditedFunctionType(data.functionType || "api_call");
    setEditedUrl(data.url || "");
    setEditedMethod(data.method || "POST");
    setEditedParameters(data.parameters || "");
    setIsEditModalOpen(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editedName.trim()) {
      newErrors.label = "Name is required";
    }

    if (!editedFunctionName.trim()) {
      newErrors.functionName = "Function name is required";
    }

    if (editedFunctionType === "api_call") {
      if (!editedUrl.trim()) {
        newErrors.url = "URL is required for API calls";
      } else {
        try {
          new URL(editedUrl);
        } catch {
          newErrors.url = "Please enter a valid URL";
        }
      }
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
        functionName: editedFunctionName,
        functionType: editedFunctionType,
        url: editedUrl,
        method: editedMethod,
        parameters: editedParameters,
      });
    }
    setIsEditModalOpen(false);
    setErrors({});
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-help ml-1 text-orange-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium mb-1">{nodeDescriptions.function?.tooltip || "Execute API calls, webhooks, or internal functions."}</p>
                  {nodeDescriptions.function?.examples && (
                    <div className="text-xs opacity-90 mt-2">
                      <strong>Examples:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {nodeDescriptions.function.examples.map((ex, i) => (
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
            {data.label || "Function Node"}
          </h3>

          {/* Preview - Enhanced */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm min-h-[70px]">
            {data.functionName || data.url ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                    {data.functionType || 'api_call'}
                  </span>
                  {data.method && (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-semibold">
                      {data.method}
                    </span>
                  )}
                </div>
                {data.functionName && (
                  <div className="text-xs text-gray-700 font-mono mb-1">
                    <span className="font-semibold">Name:</span> {data.functionName}
                  </div>
                )}
                {data.url && (
                  <div className="text-xs text-gray-600 truncate">
                    <span className="font-semibold">URL:</span> {data.url}
                  </div>
                )}
              </>
            ) : (
              <span className="text-gray-400">No function configured</span>
            )}
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
              <Label htmlFor="functionName">Function Name</Label>
              <Input
                id="functionName"
                value={editedFunctionName}
                onChange={(e) => {
                  setEditedFunctionName(e.target.value);
                  if (errors.functionName) setErrors({...errors, functionName: ""});
                }}
                placeholder="e.g., export_call_data"
                className={errors.functionName ? "border-red-500" : ""}
              />
              {errors.functionName && (
                <p className="text-xs text-red-600 mt-1">{errors.functionName}</p>
              )}
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
                      onChange={(e) => {
                        setEditedUrl(e.target.value);
                        if (errors.url) setErrors({...errors, url: ""});
                      }}
                      placeholder="https://api.example.com/endpoint"
                      className={errors.url ? "border-red-500" : ""}
                    />
                    {errors.url && (
                      <p className="text-xs text-red-600 mt-1">{errors.url}</p>
                    )}
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
