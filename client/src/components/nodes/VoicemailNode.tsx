import { memo, useState } from "react";
import { Copy, Pencil, Trash2, Voicemail, ChevronRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

interface VoicemailNodeData {
  label: string;
  greetingMessage: string;
  maxDuration: number;
  beepSound: boolean;
  transcribe: boolean;
  notifyEmail?: string;
  notifyPhone?: string;
  saveRecording: boolean;
}

interface VoicemailNodeProps {
  id: string;
  data: VoicemailNodeData;
  isConnectable?: boolean;
  onClone?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onUpdate?: (nodeId: string, data: any) => void;
}

const VoicemailNode = ({ id, data, onClone, onDelete, onUpdate }: VoicemailNodeProps) => {
  const { toast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedData, setEditedData] = useState({
    label: data.label || "Voicemail",
    greetingMessage: data.greetingMessage || "Please leave a message after the beep.",
    maxDuration: data.maxDuration || 120,
    beepSound: data.beepSound ?? true,
    transcribe: data.transcribe ?? true,
    notifyEmail: data.notifyEmail || "",
    notifyPhone: data.notifyPhone || "",
    saveRecording: data.saveRecording ?? true,
  });
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
    setEditedData({
      label: data.label || "Voicemail",
      greetingMessage: data.greetingMessage || "Please leave a message after the beep.",
      maxDuration: data.maxDuration || 120,
      beepSound: data.beepSound ?? true,
      transcribe: data.transcribe ?? true,
      notifyEmail: data.notifyEmail || "",
      notifyPhone: data.notifyPhone || "",
      saveRecording: data.saveRecording ?? true,
    });
    setIsEditModalOpen(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editedData.label.trim()) {
      newErrors.label = "Name is required";
    }

    if (!editedData.greetingMessage.trim()) {
      newErrors.greetingMessage = "Greeting message is required";
    }

    if (editedData.maxDuration < 10 || editedData.maxDuration > 300) {
      newErrors.maxDuration = "Duration must be between 10 and 300 seconds";
    }

    if (editedData.notifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editedData.notifyEmail)) {
      newErrors.notifyEmail = "Invalid email format";
    }

    if (editedData.notifyPhone && !/^\+?\d{10,15}$/.test(editedData.notifyPhone.replace(/[\s()-]/g, ""))) {
      newErrors.notifyPhone = "Invalid phone format (use +1234567890)";
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
        ...editedData,
      });
    }
    setIsEditModalOpen(false);
    setErrors({});
  };

  const handleCancel = () => {
    setEditedData({
      label: data.label || "Voicemail",
      greetingMessage: data.greetingMessage || "Please leave a message after the beep.",
      maxDuration: data.maxDuration || 120,
      beepSound: data.beepSound ?? true,
      transcribe: data.transcribe ?? true,
      notifyEmail: data.notifyEmail || "",
      notifyPhone: data.notifyPhone || "",
      saveRecording: data.saveRecording ?? true,
    });
    setIsEditModalOpen(false);
    setErrors({});
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 min-w-[280px] max-w-[320px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          {/* Type Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50">
            <Voicemail className="w-4 h-4 text-amber-700" />
            <span className="text-sm font-medium text-amber-700">Voicemail</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 cursor-help ml-1 text-amber-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium mb-1">{nodeDescriptions.voicemail.tooltip}</p>
                  {nodeDescriptions.voicemail.examples && (
                    <div className="text-xs opacity-90 mt-2">
                      <strong>Examples:</strong>
                      <ul className="list-disc pl-4 mt-1 space-y-0.5">
                        {nodeDescriptions.voicemail.examples.map((ex, i) => (
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
          <h3 className="font-semibold text-gray-900 text-base mb-2">
            {data.label || "Voicemail"}
          </h3>

          {/* Preview - Enhanced */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm min-h-[60px]">
            <div className="flex items-center gap-2 mb-1.5">
              <Voicemail className="w-4 h-4 text-amber-600" />
              <span className="font-semibold text-amber-700">Record Message</span>
            </div>
            <p className="text-gray-700 text-xs line-clamp-1 mb-1.5">
              {data.greetingMessage || "Please leave a message after the beep."}
            </p>
            <div className="flex flex-wrap gap-1 text-xs text-gray-500">
              <span className="px-1.5 py-0.5 bg-gray-200 rounded">Max: {data.maxDuration || 120}s</span>
              {data.transcribe && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Transcribe</span>}
              {data.notifyEmail && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Email notify</span>}
              {data.saveRecording && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Save</span>}
            </div>
          </div>
        </div>

        {/* Transition */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
            <span className="text-sm font-medium text-amber-700">After Recording</span>
            <ChevronRight className="w-4 h-4 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Voicemail Configuration</DialogTitle>
            <DialogDescription>
              Configure voicemail capture for when customers need to leave a message.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="label">Name</Label>
              <Input
                id="label"
                value={editedData.label}
                onChange={(e) => {
                  setEditedData({...editedData, label: e.target.value});
                  if (errors.label) setErrors({...errors, label: ""});
                }}
                placeholder="e.g., After Hours Voicemail"
                className={errors.label ? "border-red-500" : ""}
              />
              {errors.label && (
                <p className="text-xs text-red-600 mt-1">{errors.label}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="greeting">Greeting Message</Label>
              <Textarea
                id="greeting"
                value={editedData.greetingMessage}
                onChange={(e) => {
                  setEditedData({...editedData, greetingMessage: e.target.value});
                  if (errors.greetingMessage) setErrors({...errors, greetingMessage: ""});
                }}
                placeholder="Message to play before recording starts..."
                rows={3}
                className={errors.greetingMessage ? "border-red-500" : ""}
              />
              {errors.greetingMessage && (
                <p className="text-xs text-red-600 mt-1">{errors.greetingMessage}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="duration">Max Recording Duration (seconds)</Label>
              <Input
                id="duration"
                type="number"
                value={editedData.maxDuration}
                onChange={(e) => {
                  setEditedData({...editedData, maxDuration: Number(e.target.value)});
                  if (errors.maxDuration) setErrors({...errors, maxDuration: ""});
                }}
                min="10"
                max="300"
                placeholder="120"
                className={errors.maxDuration ? "border-red-500" : ""}
              />
              {errors.maxDuration && (
                <p className="text-xs text-red-600 mt-1">{errors.maxDuration}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Recommended: 60-120 seconds
              </p>
            </div>

            <div className="space-y-3 border-t pt-3">
              <Label>Recording Options</Label>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="beep"
                  checked={editedData.beepSound}
                  onCheckedChange={(checked) => setEditedData({...editedData, beepSound: !!checked})}
                />
                <Label htmlFor="beep" className="cursor-pointer font-normal text-sm">
                  Play beep sound before recording
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="transcribe"
                  checked={editedData.transcribe}
                  onCheckedChange={(checked) => setEditedData({...editedData, transcribe: !!checked})}
                />
                <Label htmlFor="transcribe" className="cursor-pointer font-normal text-sm">
                  Transcribe voicemail to text automatically
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="save"
                  checked={editedData.saveRecording}
                  onCheckedChange={(checked) => setEditedData({...editedData, saveRecording: !!checked})}
                />
                <Label htmlFor="save" className="cursor-pointer font-normal text-sm">
                  Save recording for playback
                </Label>
              </div>
            </div>

            <div className="space-y-3 border-t pt-3">
              <Label>Notifications</Label>

              <div className="grid gap-2">
                <Label htmlFor="email" className="text-sm font-normal">Notify via Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editedData.notifyEmail}
                  onChange={(e) => {
                    setEditedData({...editedData, notifyEmail: e.target.value});
                    if (errors.notifyEmail) setErrors({...errors, notifyEmail: ""});
                  }}
                  placeholder="email@example.com"
                  className={errors.notifyEmail ? "border-red-500" : ""}
                />
                {errors.notifyEmail && (
                  <p className="text-xs text-red-600 mt-1">{errors.notifyEmail}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone" className="text-sm font-normal">Notify via SMS</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={editedData.notifyPhone}
                  onChange={(e) => {
                    setEditedData({...editedData, notifyPhone: e.target.value});
                    if (errors.notifyPhone) setErrors({...errors, notifyPhone: ""});
                  }}
                  placeholder="+1234567890"
                  className={errors.notifyPhone ? "border-red-500" : ""}
                />
                {errors.notifyPhone && (
                  <p className="text-xs text-red-600 mt-1">{errors.notifyPhone}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-amber-600 hover:bg-amber-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(VoicemailNode);
