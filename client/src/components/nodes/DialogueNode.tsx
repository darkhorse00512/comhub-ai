import { memo, useState, useRef } from "react";
import {
  Copy,
  Pencil,
  Trash2,
  MessageSquare,
  ChevronRight,
  HelpCircle,
  Clock,
  Plus,
  X,
  Check,
  Braces,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { nodeDescriptions } from "@/data/nodeDescriptions";

interface WorkflowField {
  name: string;
  type: "text" | "number" | "boolean";
}

interface DialogueNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
  workflowFields?: WorkflowField[];
}

const DialogueNode = ({
  id,
  data,
  onClone,
  onDelete,
  onUpdate,
  workflowFields = [],
}: DialogueNodeProps) => {
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Edit state
  const [editedName, setEditedName] = useState("");
  const [editedStageMessage, setEditedStageMessage] = useState("");
  const [editedMaxTurns, setEditedMaxTurns] = useState("");
  const [editedExtraInstructions, setEditedExtraInstructions] = useState<
    string[]
  >([]);
  const [editedOverrides, setEditedOverrides] = useState<
    Array<{ key: string; value: string }>
  >([]);
  const [editedFunctions, setEditedFunctions] = useState<
    Array<{ name: string; enabled: boolean }>
  >([]);
  const [editedKnowledgeBases, setEditedKnowledgeBases] = useState<
    Array<{ name: string; enabled: boolean }>
  >([]);
  const [editedModel, setEditedModel] = useState("");
  const [editedTransitions, setEditedTransitions] = useState<
    Array<{ id: string; name: string }>
  >([]);

  // UI state
  const [newFunctionName, setNewFunctionName] = useState("");
  const [newKBName, setNewKBName] = useState("");
  const [editingTransitionId, setEditingTransitionId] = useState<string | null>(
    null
  );
  const [editingTransitionName, setEditingTransitionName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const stageMessageRef = useRef<HTMLTextAreaElement>(null);

  // Insert a field variable tag at the cursor position in the stage message textarea
  const insertFieldTag = (fieldName: string) => {
    const tag = `{{${fieldName}}}`;
    const textarea = stageMessageRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const scrollTop = textarea.scrollTop;
      const newValue =
        editedStageMessage.substring(0, start) +
        tag +
        editedStageMessage.substring(end);
      setEditedStageMessage(newValue);
      if (errors.stageMessage) setErrors({ ...errors, stageMessage: "" });
      // Restore focus, cursor position, and scroll position
      requestAnimationFrame(() => {
        textarea.focus({ preventScroll: true });
        const newPos = start + tag.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.scrollTop = scrollTop;
      });
    } else {
      setEditedStageMessage(editedStageMessage + tag);
    }
  };

  // Color classes per field type
  const fieldTypeStyles: Record<string, string> = {
    text: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300",
    number: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300",
    boolean: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300",
  };

  // Handlers
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
    setEditedStageMessage(data.stageMessage || "");
    setEditedMaxTurns(data.maxTurns || "");
    setEditedExtraInstructions([...(data.extraInstructions || [])]);
    setEditedOverrides(
      (data.stageOverrides || []).map((o: any) => ({ ...o }))
    );
    setEditedFunctions(
      (data.functions || []).map((f: any) => ({ ...f }))
    );
    setEditedKnowledgeBases(
      (data.knowledgeBases || []).map((kb: any) => ({ ...kb }))
    );
    setEditedModel(data.model || "");
    setEditedTransitions(
      (data.transitions || []).map((t: any) => ({ ...t }))
    );
    setErrors({});
    setEditingTransitionId(null);
    setNewFunctionName("");
    setNewKBName("");
    setIsEditModalOpen(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!editedName.trim()) newErrors.label = "Name is required";
    if (!editedStageMessage.trim())
      newErrors.stageMessage = "Stage message is required";
    if (
      editedMaxTurns &&
      (isNaN(Number(editedMaxTurns)) || Number(editedMaxTurns) < 1)
    ) {
      newErrors.maxTurns = "Max turns must be a positive number";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveEdit = () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving",
        variant: "destructive",
      });
      return;
    }

    if (onUpdate) {
      onUpdate(id, {
        ...data,
        label: editedName,
        stageMessage: editedStageMessage,
        maxTurns: editedMaxTurns,
        extraInstructions: editedExtraInstructions.filter((i) => i.trim()),
        stageOverrides: editedOverrides.filter((o) => o.key.trim()),
        functions: editedFunctions,
        knowledgeBases: editedKnowledgeBases,
        model: editedModel,
        transitions: editedTransitions,
      });
    }
    setIsEditModalOpen(false);
    setErrors({});
  };

  const handleCancel = () => {
    setIsEditModalOpen(false);
    setErrors({});
  };

  // --- Extra instructions ---
  const addExtraInstruction = () => {
    setEditedExtraInstructions([...editedExtraInstructions, ""]);
  };
  const updateExtraInstruction = (index: number, value: string) => {
    const updated = [...editedExtraInstructions];
    updated[index] = value;
    setEditedExtraInstructions(updated);
  };
  const removeExtraInstruction = (index: number) => {
    setEditedExtraInstructions(
      editedExtraInstructions.filter((_, i) => i !== index)
    );
  };

  // --- Stage overrides ---
  const addOverride = () => {
    setEditedOverrides([...editedOverrides, { key: "", value: "" }]);
  };
  const updateOverride = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const updated = [...editedOverrides];
    updated[index] = { ...updated[index], [field]: value };
    setEditedOverrides(updated);
  };
  const removeOverride = (index: number) => {
    setEditedOverrides(editedOverrides.filter((_, i) => i !== index));
  };

  // --- Functions ---
  const toggleFunction = (index: number) => {
    const updated = [...editedFunctions];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setEditedFunctions(updated);
  };
  const addFunction = () => {
    if (newFunctionName.trim()) {
      setEditedFunctions([
        ...editedFunctions,
        { name: newFunctionName.trim(), enabled: true },
      ]);
      setNewFunctionName("");
    }
  };
  const removeFunction = (index: number) => {
    setEditedFunctions(editedFunctions.filter((_, i) => i !== index));
  };

  // --- Knowledge bases ---
  const toggleKB = (index: number) => {
    const updated = [...editedKnowledgeBases];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setEditedKnowledgeBases(updated);
  };
  const addKB = () => {
    if (newKBName.trim()) {
      setEditedKnowledgeBases([
        ...editedKnowledgeBases,
        { name: newKBName.trim(), enabled: true },
      ]);
      setNewKBName("");
    }
  };
  const removeKB = (index: number) => {
    setEditedKnowledgeBases(editedKnowledgeBases.filter((_, i) => i !== index));
  };

  // --- Transitions ---
  const addTransition = () => {
    const newId = `t-${Date.now()}`;
    setEditedTransitions([
      ...editedTransitions,
      { id: newId, name: "New Transition" },
    ]);
    setEditingTransitionId(newId);
    setEditingTransitionName("New Transition");
  };
  const startEditTransition = (t: { id: string; name: string }) => {
    setEditingTransitionId(t.id);
    setEditingTransitionName(t.name);
  };
  const saveTransitionEdit = () => {
    if (editingTransitionId && editingTransitionName.trim()) {
      setEditedTransitions(
        editedTransitions.map((t) =>
          t.id === editingTransitionId
            ? { ...t, name: editingTransitionName.trim() }
            : t
        )
      );
    }
    setEditingTransitionId(null);
    setEditingTransitionName("");
  };
  const removeTransition = (tid: string) => {
    setEditedTransitions(editedTransitions.filter((t) => t.id !== tid));
    if (editingTransitionId === tid) {
      setEditingTransitionId(null);
    }
  };

  // Display data
  const transitions: Array<{ id: string; name: string }> =
    data.transitions || [];
  const enabledFunctions = (data.functions || []).filter(
    (f: any) => f.enabled
  );
  const enabledKBs = (data.knowledgeBases || []).filter(
    (kb: any) => kb.enabled
  );

  return (
    <>
      {/* Node Card on Canvas */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-auto">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-100">
            <MessageSquare className="w-4 h-4 text-green-700" />
            <span className="text-sm font-medium text-green-700">
              Dialogue
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-help ml-1 text-green-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium mb-1">
                    {nodeDescriptions.dialogue.tooltip}
                  </p>
                  {nodeDescriptions.dialogue.examples && (
                    <div className="text-xs opacity-90 mt-2">
                      <strong>Examples:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {nodeDescriptions.dialogue.examples.map((ex, i) => (
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

        {/* Content */}
        <div className="px-4 py-3">
          <h3 className="font-semibold text-gray-900 text-base mb-2">
            {data.label || "Dialogue Node"}
          </h3>

          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm min-h-[60px]">
            {data.stageMessage ? (
              <>
                <p className="text-gray-700 text-xs line-clamp-3 leading-relaxed">
                  {data.stageMessage}
                </p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {data.model && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                      {data.model}
                    </span>
                  )}
                  {enabledFunctions.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">
                      {enabledFunctions.length} func
                    </span>
                  )}
                  {enabledKBs.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                      {enabledKBs.length} KB
                    </span>
                  )}
                  {data.maxTurns && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded font-medium flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> {data.maxTurns} turns
                    </span>
                  )}
                </div>
              </>
            ) : (
              <span className="text-gray-400">No instructions configured</span>
            )}
          </div>
        </div>

        {/* Transitions */}
        <div className="px-4 pb-3 space-y-1.5">
          {transitions.length > 0 ? (
            transitions.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-1.5 border border-green-200"
              >
                <span className="text-sm font-medium text-green-700">
                  {t.name}
                </span>
                <ChevronRight className="w-4 h-4 text-green-500" />
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 border border-green-200">
              <span className="text-sm font-medium text-green-700">
                Next Stage
              </span>
              <ChevronRight className="w-4 h-4 text-green-500" />
            </div>
          )}
          {/* Fallback output */}
          <div className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-1.5 border border-orange-200">
            <span className="text-sm font-medium text-orange-600">
              Fallback
            </span>
            <ChevronRight className="w-4 h-4 text-orange-400" />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogTitle>Node configuration</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
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
              {errors.label && (
                <p className="text-xs text-red-600">{errors.label}</p>
              )}
            </div>

            {/* Stage Message */}
            <div className="space-y-2">
              <Label htmlFor="stageMessage">Stage message</Label>
              <Textarea
                id="stageMessage"
                ref={stageMessageRef}
                value={editedStageMessage}
                onChange={(e) => {
                  setEditedStageMessage(e.target.value);
                  if (errors.stageMessage)
                    setErrors({ ...errors, stageMessage: "" });
                }}
                placeholder="Enter instructions for the agent..."
                className={`min-h-[160px] resize-none ${errors.stageMessage ? "border-red-500" : ""}`}
              />
              {errors.stageMessage && (
                <p className="text-xs text-red-600">{errors.stageMessage}</p>
              )}
              {/* Field variable tags */}
              {workflowFields.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Braces className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Click a field to insert into message
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {workflowFields.map((field) => (
                      <button
                        key={field.name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertFieldTag(field.name)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${fieldTypeStyles[field.type] || fieldTypeStyles.text}`}
                        title={`Insert {{${field.name}}} (${field.type})`}
                      >
                        {field.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Extra Instructions */}
            <div className="space-y-3">
              {editedExtraInstructions.map((instruction, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                      Extra instruction {index + 1}
                    </Label>
                    <button
                      onClick={() => removeExtraInstruction(index)}
                      className="text-red-400 hover:text-red-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Textarea
                    value={instruction}
                    onChange={(e) =>
                      updateExtraInstruction(index, e.target.value)
                    }
                    placeholder="Additional instructions..."
                    className="min-h-[80px] resize-none"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addExtraInstruction}
                className="w-full gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Add extra instructions
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="ml-1 text-muted-foreground cursor-help">
                        ⓘ
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        Add supplementary instructions that the agent should
                        follow in this stage
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Button>
            </div>

            {/* Stage Overrides */}
            <div className="space-y-3">
              <Label>Stage overrides</Label>
              {editedOverrides.map((override, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={override.key}
                    onChange={(e) =>
                      updateOverride(index, "key", e.target.value)
                    }
                    placeholder="Setting key"
                    className="flex-1"
                  />
                  <Input
                    value={override.value}
                    onChange={(e) =>
                      updateOverride(index, "value", e.target.value)
                    }
                    placeholder="Value"
                    className="flex-1"
                  />
                  <button
                    onClick={() => removeOverride(index)}
                    className="text-red-400 hover:text-red-600 p-1 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addOverride}
                className="w-full gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Add overrides
              </Button>
            </div>

            {/* Functions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label>Functions</Label>
                <span className="text-xs text-muted-foreground">
                  (click to enable)
                </span>
              </div>
              {editedFunctions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editedFunctions.map((func, index) => (
                    <div
                      key={index}
                      className="group flex items-center gap-0.5"
                    >
                      <button
                        onClick={() => toggleFunction(index)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          func.enabled
                            ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                            : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        }`}
                      >
                        {func.name}
                      </button>
                      <button
                        onClick={() => removeFunction(index)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newFunctionName}
                  onChange={(e) => setNewFunctionName(e.target.value)}
                  placeholder="Function name..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFunction();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addFunction}
                  disabled={!newFunctionName.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Knowledge Bases */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label>Knowledge bases</Label>
                <span className="text-xs text-muted-foreground">
                  (click to enable)
                </span>
              </div>
              {editedKnowledgeBases.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editedKnowledgeBases.map((kb, index) => (
                    <div
                      key={index}
                      className="group flex items-center gap-0.5"
                    >
                      <button
                        onClick={() => toggleKB(index)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          kb.enabled
                            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                            : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        }`}
                      >
                        {kb.name}
                      </button>
                      <button
                        onClick={() => removeKB(index)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newKBName}
                  onChange={(e) => setNewKBName(e.target.value)}
                  placeholder="Knowledge base name..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKB();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addKB}
                  disabled={!newKBName.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={editedModel || "__default__"}
                onValueChange={(v) =>
                  setEditedModel(v === "__default__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Agent's default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Agent's default</SelectItem>
                  <SelectGroup>
                    <SelectLabel>GPT-5.4</SelectLabel>
                    <SelectItem value="gpt-5.4-pro">GPT-5.4 Pro</SelectItem>
                    <SelectItem value="gpt-5.4">GPT-5.4</SelectItem>
                    <SelectItem value="gpt-5.4-mini">GPT-5.4 mini</SelectItem>
                    <SelectItem value="gpt-5.4-nano">GPT-5.4 nano</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>GPT-5.2</SelectLabel>
                    <SelectItem value="gpt-5.2-pro">GPT-5.2 Pro</SelectItem>
                    <SelectItem value="gpt-5.2">GPT-5.2</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>GPT-5.1</SelectLabel>
                    <SelectItem value="gpt-5.1">GPT-5.1</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>GPT-5</SelectLabel>
                    <SelectItem value="gpt-5-pro">GPT-5 Pro</SelectItem>
                    <SelectItem value="gpt-5">GPT-5</SelectItem>
                    <SelectItem value="gpt-5-mini">GPT-5 mini</SelectItem>
                    <SelectItem value="gpt-5-nano">GPT-5 nano</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>GPT-4.1</SelectLabel>
                    <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                    <SelectItem value="gpt-4.1-mini">GPT-4.1 mini</SelectItem>
                    <SelectItem value="gpt-4.1-nano">GPT-4.1 nano</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>GPT-4o</SelectLabel>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o mini</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>GPT-4</SelectLabel>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Reasoning</SelectLabel>
                    <SelectItem value="o4-mini">o4-mini</SelectItem>
                    <SelectItem value="o3">o3</SelectItem>
                    <SelectItem value="o3-mini">o3-mini</SelectItem>
                    <SelectItem value="o1">o1</SelectItem>
                    <SelectItem value="o1-pro">o1 Pro</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Max Turns */}
            <div className="space-y-2">
              <Label htmlFor="maxTurns">
                Max conversation turns (optional)
              </Label>
              <Input
                id="maxTurns"
                type="number"
                value={editedMaxTurns}
                onChange={(e) => {
                  setEditedMaxTurns(e.target.value);
                  if (errors.maxTurns)
                    setErrors({ ...errors, maxTurns: "" });
                }}
                placeholder="Unlimited"
                className={errors.maxTurns ? "border-red-500" : ""}
              />
              {errors.maxTurns && (
                <p className="text-xs text-red-600">{errors.maxTurns}</p>
              )}
            </div>

            {/* Transitions */}
            <div className="space-y-3">
              <Label>Transitions</Label>
              <div className="space-y-2">
                {editedTransitions.map((transition) => (
                  <div
                    key={transition.id}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border"
                  >
                    {editingTransitionId === transition.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editingTransitionName}
                          onChange={(e) =>
                            setEditingTransitionName(e.target.value)
                          }
                          className="h-8 text-sm flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTransitionEdit();
                            if (e.key === "Escape") {
                              setEditingTransitionId(null);
                              setEditingTransitionName("");
                            }
                          }}
                        />
                        <button
                          onClick={saveTransitionEdit}
                          className="p-1.5 text-green-600 hover:text-green-700"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-purple-700">
                          {transition.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditTransition(transition)}
                            className="p-1 text-purple-500 hover:text-purple-700"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeTransition(transition.id)}
                            className="p-1 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-5 h-5 text-purple-500" />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addTransition}
                className="w-full gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(DialogueNode);
