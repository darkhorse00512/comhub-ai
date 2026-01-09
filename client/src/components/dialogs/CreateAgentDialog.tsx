import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/services/api";

interface CreateAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (agent: any) => void;
}

interface Group {
  id: string;
  name: string;
}

const CreateAgentDialog = ({ open, onClose, onSuccess }: CreateAgentDialogProps) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    group_id: "",
  });
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (open) {
      fetchGroups();
      // Reset form when dialog opens
      setFormData({
        name: "",
        description: "",
        group_id: "",
      });
      setErrors({});
    }
  }, [open]);

  const fetchGroups = async () => {
    setLoadingGroups(true);
    const response = await api.getGroups();
    if (response.data) {
      setGroups(response.data);
    }
    setLoadingGroups(false);
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = "Agent name is required";
    }

    if (!formData.group_id) {
      newErrors.group_id = "Group is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const response = await api.createAgent({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        group_id: formData.group_id,
      });

      if (response.error) {
        setErrors({ submit: response.error });
      } else if (response.data) {
        onSuccess(response.data);
        onClose();
      }
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : "Failed to create agent" });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      description: "",
      group_id: "",
    });
    setErrors({});
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 bg-background rounded-2xl shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Create New Agent</h2>
          <button
            onClick={handleCancel}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {/* Agent Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Agent Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="Enter Agent Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description
            </label>
            <Textarea
              placeholder="Enter Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Group */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Group <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.group_id}
              onValueChange={(value) => setFormData({ ...formData, group_id: value })}
              disabled={loadingGroups}
            >
              <SelectTrigger className={errors.group_id ? "border-red-500" : ""}>
                <SelectValue placeholder="Select Group" />
              </SelectTrigger>
              <SelectContent>
                {loadingGroups ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Loading groups...
                  </div>
                ) : groups.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No groups available. Create a group first.
                  </div>
                ) : (
                  groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.group_id && (
              <p className="text-sm text-red-500 mt-1">{errors.group_id}</p>
            )}
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || loadingGroups}
              className="bg-green-600 hover:bg-green-700 text-white min-w-[100px]"
            >
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAgentDialog;
