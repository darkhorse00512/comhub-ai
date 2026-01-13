import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Settings } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const AgentSetupNode = ({ data, isConnectable }: NodeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [systemMessage, setSystemMessage] = useState(
    data.systemMessage || "You are a helpful AI assistant for phone conversations."
  );

  const handleSave = () => {
    data.systemMessage = systemMessage;
    setIsEditing(false);
  };

  return (
    <div className="bg-pink-50 border-2 border-pink-400 rounded-xl shadow-lg min-w-[300px]">
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-3 h-3 !bg-pink-500"
      />

      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-5 h-5 text-pink-600" />
          <span className="font-semibold text-pink-900">Agent Setup</span>
        </div>

        {!isEditing ? (
          <div
            className="text-sm text-gray-700 bg-white p-3 rounded-lg cursor-pointer hover:bg-gray-50"
            onClick={() => setIsEditing(true)}
          >
            <div className="font-medium mb-1">System Message:</div>
            <div className="text-xs line-clamp-3">{systemMessage}</div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700">
              System Message:
            </label>
            <Textarea
              value={systemMessage}
              onChange={(e) => setSystemMessage(e.target.value)}
              rows={4}
              className="text-sm"
              placeholder="Enter system message..."
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                className="flex-1 bg-pink-600 hover:bg-pink-700"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSystemMessage(data.systemMessage);
                  setIsEditing(false);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-3 h-3 !bg-pink-500"
      />
    </div>
  );
};

export default memo(AgentSetupNode);
