import { useState, useCallback } from "react";
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
} from "lucide-react";

export interface WorkflowField {
  name: string;
  type: "text" | "number" | "boolean";
}

interface FieldsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  fields: WorkflowField[];
  onFieldsChange: (fields: WorkflowField[]) => void;
}

const FieldsPanel = ({ isOpen, onClose, fields, onFieldsChange }: FieldsPanelProps) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", type: "text" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", type: "text" });
  const [addError, setAddError] = useState("");

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

  const validateFieldName = (name: string): string => {
    if (!name.trim()) return "Field name is required";
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return "Must start with letter or _, only letters, numbers, underscores";
    }
    return "";
  };

  const startEdit = useCallback((index: number) => {
    const field = fields[index];
    setEditingIndex(index);
    setEditForm({ name: field.name, type: field.type });
  }, [fields]);

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditForm({ name: "", type: "text" });
  }, []);

  const saveEdit = useCallback((index: number) => {
    const error = validateFieldName(editForm.name);
    if (error) return;

    const duplicate = fields.find(
      (f, i) => f.name === editForm.name && i !== index
    );
    if (duplicate) return;

    const updated = [...fields];
    updated[index] = { name: editForm.name, type: editForm.type as WorkflowField["type"] };
    onFieldsChange(updated);
    setEditingIndex(null);
  }, [editForm, fields, onFieldsChange]);

  const handleDelete = useCallback((index: number) => {
    const updated = fields.filter((_, i) => i !== index);
    onFieldsChange(updated);
  }, [fields, onFieldsChange]);

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

    onFieldsChange([...fields, { name: addForm.name, type: addForm.type as WorkflowField["type"] }]);
    setAddForm({ name: "", type: "text" });
    setAddError("");
    setShowAddForm(false);
  }, [addForm, fields, onFieldsChange]);

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
              Define variables that can be set and used throughout your workflow. Field Setter, Junction, and Switch nodes will reference these fields.
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
                      setAddForm({ name: "", type: "text" });
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

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Type</label>
                  <Select
                    value={addForm.type}
                    onValueChange={(v) => {
                      setAddForm({ ...addForm, type: v });
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

            {/* Fields List */}
            {fields.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Fields
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {fields.length}
                  </span>
                </div>

                {fields.map((field, index) => (
                  <div
                    key={`${field.name}-${index}`}
                    className="group rounded-xl border border-border/40 bg-card/50 hover:border-border/70 hover:bg-card transition-all"
                  >
                    {editingIndex === index ? (
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
                              if (e.key === "Enter") saveEdit(index);
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block">Type</label>
                          <Select
                            value={editForm.type}
                            onValueChange={(v) => {
                              setEditForm({ ...editForm, type: v });
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
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            className="h-7 flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                            onClick={() => saveEdit(index)}
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
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => startEdit(index)}
                              className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit field"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(index)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                              title="Delete field"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
                  Define fields here first, then use Field Setter nodes to set their values during calls.
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
                  <span className="text-violet-400 font-bold shrink-0">1.</span>
                  <span>Define your fields here (name + type)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 font-bold shrink-0">2.</span>
                  <span><span className="text-foreground/70 font-medium">Field Setter</span> nodes set values for these fields during calls</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 font-bold shrink-0">3.</span>
                  <span><span className="text-foreground/70 font-medium">Junction</span> and <span className="text-foreground/70 font-medium">Switch</span> nodes can check field values for branching</span>
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
