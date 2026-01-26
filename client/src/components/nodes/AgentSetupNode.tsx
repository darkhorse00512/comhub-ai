import { memo, useState } from "react";
import { Settings, Pencil, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { nodeDescriptions } from "@/data/nodeDescriptions";

interface AgentSetupNodeProps {
  data: any;
  isConnectable?: boolean;
}

const AgentSetupNode = ({ data, isConnectable }: AgentSetupNodeProps) => {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [systemMessage, setSystemMessage] = useState(
    data.systemMessage || "You are a helpful AI assistant for phone conversations."
  );
  const [tempMessage, setTempMessage] = useState(systemMessage);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpenModal = () => {
    setTempMessage(systemMessage);
    setIsModalOpen(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!tempMessage.trim()) {
      newErrors.systemMessage = "System message is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving",
        variant: "destructive"
      });
      return;
    }

    setSystemMessage(tempMessage);
    data.systemMessage = tempMessage;
    setIsModalOpen(false);
    setErrors({});
  };

  const handleCancel = () => {
    setTempMessage(systemMessage);
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="bg-pink-50 border-2 border-pink-400 rounded-xl shadow-lg min-w-[300px] max-w-[600px] relative">
        {/* NO input handle - only output */}

        <div className="p-4">
          {/* Header with Edit Button */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-pink-600" />
              <span className="font-semibold text-pink-900">Agent Setup</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="w-4 h-4 opacity-60 hover:opacity-100 cursor-help ml-1 text-pink-600" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="font-medium">{nodeDescriptions.agent_setup?.tooltip || "Configure the system message that defines the AI agent's personality and behavior."}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <button
              onClick={handleOpenModal}
              className="p-1.5 rounded-lg hover:bg-pink-200 transition-colors"
              title="Edit Agent Setup"
            >
              <Pencil className="w-4 h-4 text-pink-600" />
            </button>
          </div>

          {/* System Message Display */}
          <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-700 line-clamp-4">
            {systemMessage}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Agent Setup</DialogTitle>
            <DialogDescription>
              Configure the system message for your AI agent. This defines how the agent behaves during conversations.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="systemMessage">System Message</Label>
              <Textarea
                id="systemMessage"
                value={tempMessage}
                onChange={(e) => {
                  setTempMessage(e.target.value);
                  if (errors.systemMessage) setErrors({...errors, systemMessage: ""});
                }}
                placeholder="Enter the system message for your agent..."
                className={`min-h-[200px] resize-none ${errors.systemMessage ? "border-red-500" : ""}`}
              />
              {errors.systemMessage && (
                <p className="text-xs text-red-600 mt-1">{errors.systemMessage}</p>
              )}
              <p className="text-xs text-muted-foreground">
                This message defines your agent's personality, role, and how it should respond to users.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-pink-600 hover:bg-pink-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(AgentSetupNode);
