import { memo, useState } from "react";
import { Copy, Pencil, Trash2, FileCode, MessageSquare, Database, GitBranch, ToggleLeft, Zap, Phone, Clock, Wrench, AlertCircle, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StandardNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

// Node type configurations with descriptions and fields
const nodeTypeConfigs: Record<string, {
  icon: any;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "textarea" | "select" | "number" | "array";
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
    required?: boolean;
  }>;
}> = {
  scripted: {
    icon: FileCode,
    description: "Deliver a specific script or message to the caller. The agent will say exactly what you specify.",
    fields: [
      { key: "script", label: "Script Text", type: "textarea", placeholder: "Enter the exact script the agent should say...", required: true },
      { key: "waitForResponse", label: "Wait for Response", type: "select", options: [
        { value: "yes", label: "Yes - Wait for caller response" },
        { value: "no", label: "No - Continue immediately" }
      ]},
      { key: "tone", label: "Tone", type: "select", options: [
        { value: "professional", label: "Professional" },
        { value: "friendly", label: "Friendly" },
        { value: "empathetic", label: "Empathetic" },
        { value: "urgent", label: "Urgent" }
      ]}
    ]
  },
  dialogue: {
    icon: MessageSquare,
    description: "Enable natural conversation on a specific topic. The agent will engage dynamically while staying on topic.",
    fields: [
      { key: "topic", label: "Conversation Topic", type: "text", placeholder: "e.g., Collect customer feedback", required: true },
      { key: "objective", label: "Objective", type: "textarea", placeholder: "What should the agent accomplish in this dialogue?" },
      { key: "guidelines", label: "Guidelines", type: "textarea", placeholder: "Any specific guidelines or boundaries for the conversation..." },
      { key: "maxTurns", label: "Max Conversation Turns", type: "number", placeholder: "5" }
    ]
  },
  field_setter: {
    icon: Database,
    description: "Collect and store specific information from the caller (name, email, phone, etc.).",
    fields: [
      { key: "fieldName", label: "Field Name", type: "text", placeholder: "e.g., customer_name", required: true },
      { key: "fieldType", label: "Field Type", type: "select", options: [
        { value: "text", label: "Text" },
        { value: "email", label: "Email" },
        { value: "phone", label: "Phone Number" },
        { value: "number", label: "Number" },
        { value: "date", label: "Date" },
        { value: "choice", label: "Multiple Choice" }
      ], required: true },
      { key: "prompt", label: "Prompt Question", type: "textarea", placeholder: "What question should the agent ask to collect this information?" },
      { key: "validation", label: "Validation Message", type: "text", placeholder: "Message if validation fails" },
      { key: "required", label: "Required Field", type: "select", options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" }
      ]}
    ]
  },
  junction: {
    icon: GitBranch,
    description: "Create a decision point based on conditions. Route the call to different paths based on criteria.",
    fields: [
      { key: "conditionType", label: "Condition Type", type: "select", options: [
        { value: "field_value", label: "Based on Field Value" },
        { value: "intent", label: "Based on Caller Intent" },
        { value: "sentiment", label: "Based on Sentiment" },
        { value: "keyword", label: "Based on Keywords" }
      ], required: true },
      { key: "conditionField", label: "Field/Value to Check", type: "text", placeholder: "e.g., customer_type" },
      { key: "conditions", label: "Conditions (JSON)", type: "textarea", placeholder: '[\n  {"value": "vip", "output": "vip_path"},\n  {"value": "regular", "output": "regular_path"}\n]' }
    ]
  },
  switch: {
    icon: ToggleLeft,
    description: "Route the call based on user's choice from multiple options presented to them.",
    fields: [
      { key: "prompt", label: "Menu Prompt", type: "textarea", placeholder: "What would you like to do today? Press 1 for sales, 2 for support...", required: true },
      { key: "options", label: "Options (one per line)", type: "textarea", placeholder: "1. Sales\n2. Support\n3. Billing\n4. Other" },
      { key: "timeout", label: "Timeout (seconds)", type: "number", placeholder: "10" },
      { key: "repeatOnInvalid", label: "Repeat on Invalid Input", type: "select", options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" }
      ]}
    ]
  },
  function: {
    icon: Zap,
    description: "Execute a custom function or API call during the conversation.",
    fields: [
      { key: "functionName", label: "Function Name", type: "text", placeholder: "e.g., lookupCustomer", required: true },
      { key: "functionType", label: "Function Type", type: "select", options: [
        { value: "api_call", label: "API Call" },
        { value: "database_query", label: "Database Query" },
        { value: "calculation", label: "Calculation" },
        { value: "integration", label: "Third-party Integration" }
      ]},
      { key: "endpoint", label: "API Endpoint / Query", type: "text", placeholder: "https://api.example.com/lookup" },
      { key: "parameters", label: "Parameters (JSON)", type: "textarea", placeholder: '{\n  "customerId": "{{customer_id}}"\n}' },
      { key: "storeResultAs", label: "Store Result As", type: "text", placeholder: "lookup_result" }
    ]
  },
  call_transfer: {
    icon: Phone,
    description: "Transfer the call to another number, department, or agent.",
    fields: [
      { key: "transferType", label: "Transfer Type", type: "select", options: [
        { value: "cold", label: "Cold Transfer (immediate)" },
        { value: "warm", label: "Warm Transfer (with introduction)" },
        { value: "conference", label: "Conference Call" }
      ], required: true },
      { key: "destination", label: "Transfer Destination", type: "text", placeholder: "+1234567890 or extension", required: true },
      { key: "departmentName", label: "Department Name", type: "text", placeholder: "e.g., Sales Team" },
      { key: "introMessage", label: "Introduction Message", type: "textarea", placeholder: "Message to say before transferring (for warm transfer)" },
      { key: "failureAction", label: "If Transfer Fails", type: "select", options: [
        { value: "voicemail", label: "Go to Voicemail" },
        { value: "callback", label: "Offer Callback" },
        { value: "retry", label: "Retry Transfer" },
        { value: "continue", label: "Continue Flow" }
      ]}
    ]
  },
  time_limit: {
    icon: Clock,
    description: "Set time constraints for actions or the entire call.",
    fields: [
      { key: "limitType", label: "Limit Type", type: "select", options: [
        { value: "response_timeout", label: "Response Timeout" },
        { value: "call_duration", label: "Total Call Duration" },
        { value: "silence_timeout", label: "Silence Timeout" }
      ], required: true },
      { key: "duration", label: "Duration (seconds)", type: "number", placeholder: "30", required: true },
      { key: "warningAt", label: "Warning At (seconds before)", type: "number", placeholder: "10" },
      { key: "warningMessage", label: "Warning Message", type: "text", placeholder: "You have 10 seconds remaining" },
      { key: "timeoutAction", label: "On Timeout", type: "select", options: [
        { value: "end_call", label: "End Call" },
        { value: "transfer", label: "Transfer" },
        { value: "repeat", label: "Repeat Prompt" },
        { value: "continue", label: "Continue to Next Node" }
      ]}
    ]
  },
  reconfigure: {
    icon: Wrench,
    description: "Change agent settings or behavior during the call.",
    fields: [
      { key: "setting", label: "Setting to Change", type: "select", options: [
        { value: "voice", label: "Agent Voice" },
        { value: "language", label: "Language" },
        { value: "speed", label: "Speech Speed" },
        { value: "personality", label: "Personality/Tone" },
        { value: "context", label: "Context/Instructions" }
      ], required: true },
      { key: "newValue", label: "New Value", type: "text", placeholder: "Enter new value", required: true },
      { key: "reason", label: "Reason for Change", type: "textarea", placeholder: "Why is this change being made?" }
    ]
  },
  fallback: {
    icon: AlertCircle,
    description: "Handle unexpected situations, errors, or when the agent doesn't understand.",
    fields: [
      { key: "triggerCondition", label: "Trigger Condition", type: "select", options: [
        { value: "not_understood", label: "Agent Doesn't Understand" },
        { value: "repeated_failure", label: "Repeated Failures" },
        { value: "error", label: "System Error" },
        { value: "timeout", label: "Timeout" },
        { value: "explicit_request", label: "User Requests Help" }
      ], required: true },
      { key: "maxRetries", label: "Max Retries Before Fallback", type: "number", placeholder: "3" },
      { key: "fallbackMessage", label: "Fallback Message", type: "textarea", placeholder: "I'm sorry, I didn't quite catch that. Let me connect you with a human agent.", required: true },
      { key: "fallbackAction", label: "Fallback Action", type: "select", options: [
        { value: "transfer_human", label: "Transfer to Human" },
        { value: "end_call", label: "End Call Politely" },
        { value: "retry_node", label: "Retry Previous Node" },
        { value: "collect_callback", label: "Collect Callback Info" }
      ]}
    ]
  }
};

const StandardNode = ({ id, data, isConnectable, onClone, onDelete, onUpdate }: StandardNodeProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedData, setEditedData] = useState({ ...data });

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
    setEditedData({ ...data });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(id, editedData);
    }
    setIsEditModalOpen(false);
  };

  const handleFieldChange = (key: string, value: any) => {
    setEditedData((prev: any) => ({ ...prev, [key]: value }));
  };

  // Get color based on node type
  const getColorClasses = () => {
    const colorMap: { [key: string]: string } = {
      scripted: "bg-blue-50 border-blue-400 text-blue-900",
      dialogue: "bg-green-50 border-green-400 text-green-900",
      field_setter: "bg-yellow-50 border-yellow-400 text-yellow-900",
      junction: "bg-purple-50 border-purple-400 text-purple-900",
      switch: "bg-pink-50 border-pink-400 text-pink-900",
      function: "bg-orange-50 border-orange-400 text-orange-900",
      call_transfer: "bg-teal-50 border-teal-400 text-teal-900",
      time_limit: "bg-red-50 border-red-400 text-red-900",
      reconfigure: "bg-indigo-50 border-indigo-400 text-indigo-900",
      fallback: "bg-gray-50 border-gray-400 text-gray-900",
    };
    return colorMap[nodeType] || "bg-white border-gray-400 text-gray-900";
  };

  // Get a summary of the node's configuration
  const getNodeSummary = () => {
    switch (nodeType) {
      case "scripted":
        return data.script ? `"${data.script.substring(0, 50)}${data.script.length > 50 ? '...' : ''}"` : "No script set";
      case "dialogue":
        return data.topic || "No topic set";
      case "field_setter":
        return data.fieldName ? `Collect: ${data.fieldName}` : "No field set";
      case "junction":
        return data.conditionType || "No condition set";
      case "switch":
        return data.options ? `${data.options.split('\n').length} options` : "No options set";
      case "function":
        return data.functionName || "No function set";
      case "call_transfer":
        return data.destination || "No destination set";
      case "time_limit":
        return data.duration ? `${data.duration}s timeout` : "No limit set";
      case "reconfigure":
        return data.setting || "No setting selected";
      case "fallback":
        return data.triggerCondition || "No trigger set";
      default:
        return data.notes || "";
    }
  };

  const renderField = (field: typeof config.fields[0]) => {
    const value = editedData[field.key] || "";

    switch (field.type) {
      case "textarea":
        return (
          <div key={field.key} className="grid gap-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.key}
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
              className="resize-none"
            />
          </div>
        );
      case "select":
        return (
          <div key={field.key} className="grid gap-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={value} onValueChange={(v) => handleFieldChange(field.key, v)}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case "number":
        return (
          <div key={field.key} className="grid gap-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.key}
              type="number"
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
          </div>
        );
      default:
        return (
          <div key={field.key} className="grid gap-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.key}
              value={value}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
          </div>
        );
    }
  };

  return (
    <>
      <div className={`border-2 rounded-xl shadow-lg min-w-[220px] max-w-[280px] ${getColorClasses()} relative group`}>
        {/* Node Content */}
        <div className="p-4">
          {/* Header with Icon and Action Buttons */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <IconComponent className="w-4 h-4" />
              <span className="font-semibold text-sm">{data.label}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleClone}
                className="p-1 rounded hover:bg-white/50 transition-colors"
                title="Clone"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleEdit}
                className="p-1 rounded hover:bg-white/50 transition-colors"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDelete}
                className="p-1 rounded hover:bg-red-100 transition-colors text-red-600"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Node Summary */}
          <div className="text-xs opacity-80 line-clamp-2 bg-white/50 rounded p-2">
            {getNodeSummary()}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconComponent className="w-5 h-5" />
              Edit {data.label}
            </DialogTitle>
            <DialogDescription>
              {config.description}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Node Label */}
            <div className="grid gap-2">
              <Label htmlFor="label">Node Label</Label>
              <Input
                id="label"
                value={editedData.label || ""}
                onChange={(e) => handleFieldChange("label", e.target.value)}
                placeholder="Enter node label..."
              />
            </div>

            {/* Type-specific fields */}
            {config.fields.map(renderField)}

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={editedData.notes || ""}
                onChange={(e) => handleFieldChange("notes", e.target.value)}
                placeholder="Add internal notes about this node..."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(StandardNode);
