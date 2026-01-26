import { memo } from "react";
import { PhoneIncoming, PhoneOutgoing, Trash2, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { nodeDescriptions } from "@/data/nodeDescriptions";

interface CallDirectionNodeProps {
  id: string;
  data: any;
  isConnectable?: boolean;
  onDelete?: (nodeId: string) => void;
}

const CallDirectionNode = ({ id, data, isConnectable, onDelete }: CallDirectionNodeProps) => {
  const isInbound = data.direction === "inbound";

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(id);
  };

  return (
    <div
      className={`border-2 rounded-xl shadow-lg min-w-[200px] relative ${
        isInbound
          ? "bg-blue-50 border-blue-400"
          : "bg-purple-50 border-purple-400"
      }`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className={`w-4 h-4 opacity-60 hover:opacity-100 cursor-help ml-1 ${isInbound ? "text-blue-600" : "text-purple-600"}`} />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-medium">{nodeDescriptions.call_direction?.tooltip || "Defines whether this workflow is for inbound or outbound calls."}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Action Buttons - Delete only */}
          <div className="flex items-center gap-1.5 opacity-100">
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg hover:bg-red-100 transition-colors text-red-600"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-600 bg-white p-2 rounded">
          <span className="font-medium">Direction:</span>{" "}
          <span className="capitalize">{data.direction}</span>
        </div>
      </div>
    </div>
  );
};

export default memo(CallDirectionNode);
