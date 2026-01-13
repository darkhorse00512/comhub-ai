import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { PhoneIncoming, PhoneOutgoing } from "lucide-react";

const CallDirectionNode = ({ data, isConnectable }: NodeProps) => {
  const isInbound = data.direction === "inbound";

  return (
    <div
      className={`border-2 rounded-xl shadow-lg min-w-[200px] ${
        isInbound
          ? "bg-blue-50 border-blue-400"
          : "bg-purple-50 border-purple-400"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className={`w-3 h-3 ${isInbound ? "!bg-blue-500" : "!bg-purple-500"}`}
      />

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {isInbound ? (
            <PhoneIncoming className="w-5 h-5 text-blue-600" />
          ) : (
            <PhoneOutgoing className="w-5 h-5 text-purple-600" />
          )}
          <span
            className={`font-semibold ${
              isInbound ? "text-blue-900" : "text-purple-900"
            }`}
          >
            {data.label || "Start"}
          </span>
        </div>

        <div className="text-xs text-gray-600 bg-white p-2 rounded">
          <span className="font-medium">Direction:</span>{" "}
          <span className="capitalize">{data.direction}</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className={`w-3 h-3 ${isInbound ? "!bg-blue-500" : "!bg-purple-500"}`}
      />
    </div>
  );
};

export default memo(CallDirectionNode);
