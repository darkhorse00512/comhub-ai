import { memo, useState } from "react";
import { Copy, Pencil, Trash2, FileCode, MessageSquare, Database, GitBranch, ToggleLeft, Zap, Phone, Clock, Wrench, AlertCircle, ChevronRight, X, Check, Voicemail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface StandardNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

// Node type configurations
const nodeTypeConfigs: Record<string, {
  icon: any;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  scripted: {
    icon: FileCode,
    label: "Scripted",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    borderColor: "border-purple-300",
  },
  dialogue: {
    icon: MessageSquare,
    label: "Dialogue",
    color: "text-green-700",
    bgColor: "bg-green-100",
    borderColor: "border-green-300",
  },
  field_setter: {
    icon: Database,
    label: "Field Setter",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    borderColor: "border-yellow-300",
  },
  junction: {
    icon: GitBranch,
    label: "Junction",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-300",
  },
  switch: {
    icon: ToggleLeft,
    label: "Switch",
    color: "text-pink-700",
    bgColor: "bg-pink-100",
    borderColor: "border-pink-300",
  },
  function: {
    icon: Zap,
    label: "Function",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    borderColor: "border-orange-300",
  },
  call_transfer: {
    icon: Phone,
    label: "Call Transfer",
    color: "text-teal-700",
    bgColor: "bg-teal-100",
    borderColor: "border-teal-300",
  },
  time_limit: {
    icon: Clock,
    label: "Time Limit",
    color: "text-red-700",
    bgColor: "bg-red-100",
    borderColor: "border-red-300",
  },
  reconfigure: {
    icon: Wrench,
    label: "Reconfigure",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
    borderColor: "border-indigo-300",
  },
  fallback: {
    icon: AlertCircle,
    label: "Fallback",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-300",
  },
  voicemail: {
    icon: Voicemail,
    label: "Voicemail",
    color: "text-cyan-700",
    bgColor: "bg-cyan-100",
    borderColor: "border-cyan-300",
  },
};

const StandardNode = ({ id, data, onClone, onDelete, onUpdate }: StandardNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(data.label || "");
  const [editedScript, setEditedScript] = useState(data.script || "");

  const nodeType = data.type || "scripted";
  const config = nodeTypeConfigs[nodeType] || nodeTypeConfigs.scripted;
  const IconComponent = config.icon;

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
    setEditedScript(data.script || "");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(id, {
        ...data,
        label: editedName,
        script: editedScript,
      });
    }
    setIsEditModalOpen(false);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
  };

  // Get the content to display based on node type
  const getNodeContent = () => {
    switch (nodeType) {
      case "scripted":
        return data.script || data.content || "No script set";
      case "dialogue":
        return data.stageMessage || data.topic || data.objective || "No dialogue configured";
      case "field_setter":
        return data.fieldName ? `Collect: ${data.fieldName}` : "No field configured";
      case "junction":
        const fieldName = data.left?.field_name || data.conditionField || "";
        const operator = data.operator || "==";
        const value = data.right?.literal || "";
        return fieldName ? `${fieldName} ${operator} ${value}` : "No condition set";
      case "switch":
        return data.switchField || data.prompt || "No switch field set";
      case "function":
        return data.functionName || "No function configured";
      case "call_transfer":
        return data.transferTo || data.destination || "No destination set";
      case "time_limit":
        const duration = data.maxDuration || data.duration;
        return duration ? `${duration}s timeout` : "No limit set";
      case "reconfigure":
        return data.setting ? `${data.setting}: ${data.newValue || ''}` : "No setting configured";
      case "fallback":
        return data.fallbackMessage || "No fallback message";
      case "voicemail":
        return data.greetingMessage || "No greeting set";
      default:
        return data.script || data.content || "";
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-auto">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${config.bgColor}`}>
            <IconComponent className={`w-4 h-4 ${config.color}`} />
            <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
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
            {data.label || "Untitled Node"}
          </h3>

          {/* Content Preview */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 min-h-[40px]">
            {getNodeContent()}
          </div>
        </div>

        {/* Transition/Next Stage */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2 border border-purple-200">
            <span className="text-sm font-medium text-purple-700">Next Stage</span>
            <ChevronRight className="w-4 h-4 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Edit Modal - Simple overlay design matching the screenshot */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={handleCloseModal}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20" />

          {/* Modal */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Node Configuration</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
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

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="nodeName" className="text-sm font-medium text-gray-700">
                  Name
                </Label>
                <Input
                  id="nodeName"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter node name..."
                  className="w-full border-gray-200 focus:border-purple-500 focus:ring-purple-500"
                />
              </div>

              {/* Script Field */}
              <div className="space-y-2">
                <Label htmlFor="nodeScript" className="text-sm font-medium text-gray-700">
                  Script
                </Label>
                <Textarea
                  id="nodeScript"
                  value={editedScript}
                  onChange={(e) => setEditedScript(e.target.value)}
                  placeholder="Enter the script text..."
                  rows={5}
                  className="w-full border-gray-200 focus:border-purple-500 focus:ring-purple-500 resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default memo(StandardNode);
