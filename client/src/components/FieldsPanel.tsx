import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Database,
  Hash,
  Type,
  ToggleLeft,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
  Info,
  GitBranch,
  ArrowRightLeft,
} from "lucide-react";
import { Node } from "@/components/FlowCanvas";

interface FieldsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  onUpdateNode?: (nodeId: string, newData: any) => void;
  onDeleteNode?: (nodeId: string) => void;
  onAddFieldNode?: (fieldName: string, valueType: string, defaultValue: string) => void;
}

interface FieldInfo {
  name: string;
  type: "text" | "number" | "boolean";
  nodeId: string;
  nodeLabel: string;
  defaultValue?: string;
  source: "field_setter" | "junction" | "switch";
}

const FieldsPanel = ({ isOpen, onClose, nodes, onUpdateNode, onDeleteNode, onAddFieldNode }: FieldsPanelProps) => {
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", type: "text", value: "" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", type: "text", value: "" });
  const [addError, setAddError] = useState("");

  // Extract fields from nodes
  useEffect(() => {
    const extractedFields: FieldInfo[] = [];

    const seenFieldNames = new Set<string>();
    nodes.forEach((node) => {
      if (node.type === "field_setter") {
        const fieldName = node.data?.fieldName;
        if (fieldName && !seenFieldNames.has(fieldName)) {
          seenFieldNames.add(fieldName);
          extractedFields.push({
            name: fieldName,
            type: node.data?.valueType || "text",
            nodeId: node.id,
            nodeLabel: node.data?.label || "Field Setter",
            defaultValue: node.data?.value || "",
            source: "field_setter",
          });
        }
      }
    });

    nodes.forEach((node) => {
      if (node.type === "junction") {
        const conditionField = node.data?.left?.field_name || node.data?.conditionField;
        if (conditionField && !extractedFields.find((f) => f.name === conditionField)) {
          extractedFields.push({
            name: conditionField,
            type: "text",
            nodeId: node.id,
            nodeLabel: node.data?.label || "Junction",
            defaultValue: "",
            source: "junction",
          });
        }
      }
    });

    nodes.forEach((node) => {
      if (node.type === "switch") {
        const switchField = node.data?.switchField;
        if (switchField && !extractedFields.find((f) => f.name === switchField)) {
          extractedFields.push({
            name: switchField,
            type: "text",
            nodeId: node.id,
            nodeLabel: node.data?.label || "Switch",
            defaultValue: "",
            source: "switch",
          });
        }
      }
    });

    setFields(extractedFields);
  }, [nodes]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "number":
        return <Hash className="w-3.5 h-3.5" />;
      case "boolean":
        return <ToggleLeft className="w-3.5 h-3.5" />;
      default:
        return <Type className="w-3.5 h-3.5" />;
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "junction":
        return <GitBranch className="w-3 h-3" />;
      case "switch":
        return <ArrowRightLeft className="w-3 h-3" />;
      default:
        return <Database className="w-3 h-3" />;
    }
  };

  const getTypeBadgeClasses = (type: string) => {
    switch (type) {
      case "number":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "boolean":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default:
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    }
  };

  const getSourceBadgeClasses = (source: string) => {
    switch (source) {
      case "junction":
        return "bg-amber-500/15 text-amber-400 border-amber-500/25";
      case "switch":
        return "bg-pink-500/15 text-pink-400 border-pink-500/25";
      default:
        return "bg-violet-500/15 text-violet-400 border-violet-500/25";
    }
  };

  const validateFieldName = (name: string): string => {
    if (!name.trim()) return "Field name is required";
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return "Must start with letter or _, only letters, numbers, underscores";
    }
    return "";
  };

  const startEdit = useCallback((field: FieldInfo) => {
    setEditingId(field.nodeId);
    setEditForm({
      name: field.name,
      type: field.type,
      value: field.defaultValue || "",
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm({ name: "", type: "text", value: "" });
  }, []);

  const saveEdit = useCallback((field: FieldInfo) => {
    const error = validateFieldName(editForm.name);
    if (error) return;

    const duplicate = fields.find(
      (f) => f.name === editForm.name && f.nodeId !== field.nodeId
    );
    if (duplicate) return;

    if (onUpdateNode) {
      onUpdateNode(field.nodeId, {
        fieldName: editForm.name,
        valueType: editForm.type,
        value: editForm.value,
      });
    }
    setEditingId(null);
  }, [editForm, fields, onUpdateNode]);

  const handleDelete = useCallback((field: FieldInfo) => {
    if (onDeleteNode && field.source === "field_setter") {
      onDeleteNode(field.nodeId);
    }
  }, [onDeleteNode]);

  const handleAdd = useCallback(() => {
    const error = validateFieldName(addForm.name);
    if (error) {
      setAddError(error);
      return;
    }

    const duplicate = fields.find((f) => f.name === addForm.name);
    if (duplicate) {
      setAddError("A field with this name already exists");
      return;
    }

    if (onAddFieldNode) {
      onAddFieldNode(addForm.name, addForm.type, addForm.value);
    }
    setAddForm({ name: "", type: "text", value: "" });
    setAddError("");
    setShowAddForm(false);
  }, [addForm, fields, onAddFieldNode]);

  const fieldSetterFields = fields.filter((f) => f.source === "field_setter");
  const referencedFields = fields.filter((f) => f.source !== "field_setter");

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50 shrink-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2.5 text-foreground">
              <div className="p-1.5 rounded-lg bg-violet-500/15">
                <Database className="w-5 h-5 text-violet-400" />
              </div>
              Workflow Fields
            </SheetTitle>
            <SheetDescription className="text-muted-foreground text-xs mt-1">
              Manage variables collected and used throughout your workflow.
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Scrollable content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4 space-y-4">
            {/* Add Field Button / Form */}
            {!showAddForm ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed border-border/60 hover:border-violet-500/50 hover:bg-violet-500/5 text-muted-foreground hover:text-violet-400 transition-colors"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Field
              </Button>
            ) : (
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-violet-400">New Field</span>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setAddForm({ name: "", type: "text", value: "" });
                      setAddError("");
                    }}
                    className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Field Name</label>
                  <Input
                    value={addForm.name}
                    onChange={(e) => {
                      setAddForm({ ...addForm, name: e.target.value });
                      setAddError("");
                    }}
                    placeholder="e.g. customer_name, order_id"
                    className="h-9 text-sm bg-background/50 border-border/50 font-mono"
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    autoFocus
                  />
                  {addError && (
                    <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {addError}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Type</label>
                    <Select
                      value={addForm.type}
                      onValueChange={(v) => {
                        setAddForm({ ...addForm, type: v, value: v === "boolean" ? "true" : "" });
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Default Value</label>
                    {addForm.type === "boolean" ? (
                      <Select
                        value={addForm.value || "true"}
                        onValueChange={(v) => setAddForm({ ...addForm, value: v })}
                      >
                        <SelectTrigger className="h-9 text-sm bg-background/50 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">true</SelectItem>
                          <SelectItem value="false">false</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={addForm.type === "number" ? "number" : "text"}
                        value={addForm.value}
                        onChange={(e) => setAddForm({ ...addForm, value: e.target.value })}
                        placeholder={addForm.type === "number" ? "0" : "value"}
                        className="h-9 text-sm bg-background/50 border-border/50"
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                      />
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full h-8 bg-violet-600 hover:bg-violet-500 text-white"
                  onClick={handleAdd}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Field
                </Button>
              </div>
            )}

            {/* Defined Fields (from field_setter nodes) */}
            {fieldSetterFields.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Defined Fields
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {fieldSetterFields.length}
                  </span>
                </div>

                {fieldSetterFields.map((field) => (
                  <div
                    key={field.nodeId}
                    className="group rounded-xl border border-border/40 bg-card/50 hover:border-border/70 hover:bg-card transition-all"
                  >
                    {editingId === field.nodeId ? (
                      /* Edit Mode */
                      <div className="p-3.5 space-y-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block">Field Name</label>
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="h-8 text-sm bg-background/50 border-border/50 font-mono"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(field);
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1.5 block">Type</label>
                            <Select
                              value={editForm.type}
                              onValueChange={(v) => {
                                setEditForm({ ...editForm, type: v, value: v === "boolean" ? "true" : editForm.value });
                              }}
                            >
                              <SelectTrigger className="h-8 text-sm bg-background/50 border-border/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="boolean">Boolean</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1.5 block">Value</label>
                            {editForm.type === "boolean" ? (
                              <Select
                                value={editForm.value || "true"}
                                onValueChange={(v) => setEditForm({ ...editForm, value: v })}
                              >
                                <SelectTrigger className="h-8 text-sm bg-background/50 border-border/50">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="true">true</SelectItem>
                                  <SelectItem value="false">false</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type={editForm.type === "number" ? "number" : "text"}
                                value={editForm.value}
                                onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                                className="h-8 text-sm bg-background/50 border-border/50"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit(field);
                                  if (e.key === "Escape") cancelEdit();
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            className="h-7 flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                            onClick={() => saveEdit(field)}
                          >
                            <Check className="w-3 h-3 mr-1" /> Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 flex-1 text-xs"
                            onClick={cancelEdit}
                          >
                            <X className="w-3 h-3 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`p-1.5 rounded-lg border ${getTypeBadgeClasses(field.type)}`}>
                              {getTypeIcon(field.type)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-mono font-semibold text-sm text-foreground block truncate">
                                {field.name}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${getTypeBadgeClasses(field.type)}`}>
                                  {getTypeIcon(field.type)}
                                  {field.type}
                                </span>
                                {field.defaultValue && (
                                  <span className="text-[10px] text-muted-foreground">
                                    = <code className="px-1 py-0.5 rounded bg-muted/50 text-foreground/70">{field.defaultValue}</code>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => startEdit(field)}
                              className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit field"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(field)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                              title="Delete field node"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
                          {getSourceIcon(field.source)}
                          <span>
                            Defined in <span className="font-medium text-foreground/70">{field.nodeLabel}</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Referenced Fields (from junction/switch - read-only) */}
            {referencedFields.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Referenced Fields
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {referencedFields.length}
                  </span>
                </div>

                {referencedFields.map((field, index) => (
                  <div
                    key={`${field.nodeId}-${index}`}
                    className="rounded-xl border border-border/30 bg-card/30 p-3.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg border ${getSourceBadgeClasses(field.source)}`}>
                        {getSourceIcon(field.source)}
                      </div>
                      <div className="min-w-0">
                        <span className="font-mono font-semibold text-sm text-foreground/80 block truncate">
                          {field.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                          <span>
                            Used in <span className="font-medium text-foreground/60">{field.nodeLabel}</span>
                          </span>
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] ${getSourceBadgeClasses(field.source)}`}>
                            {field.source === "junction" ? "Condition" : "Switch"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {fields.length === 0 && !showAddForm && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Database className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">No Fields Yet</h3>
                <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed mb-4">
                  Fields store data during calls. Add a field here or use Field Setter nodes on the canvas.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-dashed"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Your First Field
                </Button>
              </div>
            )}

            {/* Help section */}
            <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">How fields work</span>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
                <li className="flex items-start gap-2">
                  <Database className="w-3 h-3 mt-0.5 text-violet-400 shrink-0" />
                  <span><span className="text-foreground/70 font-medium">Field Setter</span> nodes store data during calls</span>
                </li>
                <li className="flex items-start gap-2">
                  <GitBranch className="w-3 h-3 mt-0.5 text-amber-400 shrink-0" />
                  <span><span className="text-foreground/70 font-medium">Junction</span> nodes check field values for conditions</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRightLeft className="w-3 h-3 mt-0.5 text-pink-400 shrink-0" />
                  <span><span className="text-foreground/70 font-medium">Switch</span> nodes branch based on field values</span>
                </li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default FieldsPanel;
