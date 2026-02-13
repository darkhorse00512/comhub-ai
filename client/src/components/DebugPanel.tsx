import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bug,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Crosshair,
} from "lucide-react";
import { ValidationItem } from "@/utils/workflowValidator";

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  errors: ValidationItem[];
  warnings: ValidationItem[];
  onNavigateToNode: (nodeId: string) => void;
}

const DebugPanel = ({ isOpen, onClose, errors, warnings, onNavigateToNode }: DebugPanelProps) => {
  const hasIssues = errors.length > 0 || warnings.length > 0;
  const passed = errors.length === 0;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bug className={`w-5 h-5 ${passed ? "text-green-500" : "text-red-500"}`} />
              Debug Results
            </SheetTitle>
          </div>

          {/* Summary badge */}
          <div className="mt-3">
            {passed && warnings.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Workflow is valid!</p>
                  <p className="text-xs text-green-600">Ready to deploy.</p>
                </div>
              </div>
            ) : passed && warnings.length > 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800">
                    {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-yellow-600">No errors — can still deploy.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    {errors.length} error{errors.length !== 1 ? "s" : ""}
                    {warnings.length > 0 && `, ${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`}
                  </p>
                  <p className="text-xs text-red-600">Fix all errors before deploying.</p>
                </div>
              </div>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="p-4 space-y-4">
            {/* Errors section */}
            {errors.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2 px-1">
                  Errors ({errors.length})
                </h3>
                <div className="space-y-1.5">
                  {errors.map((item, idx) => (
                    <button
                      key={`error-${idx}`}
                      onClick={() => item.nodeId && onNavigateToNode(item.nodeId)}
                      disabled={!item.nodeId}
                      className={`w-full text-left rounded-lg border border-red-200 bg-red-50/50 hover:bg-red-100/70 transition-colors p-3 group ${
                        !item.nodeId ? "opacity-70 cursor-default" : "cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 leading-snug">{item.message}</p>
                          {item.nodeId && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                                <Crosshair className="w-3 h-3" />
                                {item.nodeLabel}
                              </span>
                              <span className="text-xs text-gray-400">{item.nodeType}</span>
                            </div>
                          )}
                        </div>
                        {item.nodeId && (
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-red-500 mt-0.5 flex-shrink-0 transition-colors" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings section */}
            {warnings.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-2 px-1">
                  Warnings ({warnings.length})
                </h3>
                <div className="space-y-1.5">
                  {warnings.map((item, idx) => (
                    <button
                      key={`warning-${idx}`}
                      onClick={() => item.nodeId && onNavigateToNode(item.nodeId)}
                      disabled={!item.nodeId}
                      className={`w-full text-left rounded-lg border border-yellow-200 bg-yellow-50/50 hover:bg-yellow-100/70 transition-colors p-3 group ${
                        !item.nodeId ? "opacity-70 cursor-default" : "cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 leading-snug">{item.message}</p>
                          {item.nodeId && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                                <Crosshair className="w-3 h-3" />
                                {item.nodeLabel}
                              </span>
                              <span className="text-xs text-gray-400">{item.nodeType}</span>
                            </div>
                          )}
                        </div>
                        {item.nodeId && (
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-yellow-500 mt-0.5 flex-shrink-0 transition-colors" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No issues */}
            {!hasIssues && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mb-3" />
                <p className="text-lg font-semibold text-gray-700">All clear!</p>
                <p className="text-sm text-gray-500 mt-1">Your workflow has no issues.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default DebugPanel;
