import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Bug,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Crosshair,
  MessageSquare,
  AudioLines,
} from "lucide-react";

interface DebugItem {
  message: string;
  nodeId?: string;
  nodeLabel?: string;
  nodeType?: string;
  severity?: "error" | "warning";
}

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  errors: DebugItem[];
  warnings: DebugItem[];
  onNavigateToNode: (nodeId: string) => void;
  onTest?: (mode: "text" | "audio") => void;
}

const DebugPanel = ({ isOpen, onClose, errors, warnings, onNavigateToNode, onTest }: DebugPanelProps) => {
  const passed = errors.length === 0;
  const hasIssues = errors.length > 0 || warnings.length > 0;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[440px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Bug className={`w-5 h-5 ${passed ? "text-green-500" : "text-red-500"}`} />
            <SheetTitle>
              Debug Results
            </SheetTitle>
          </div>

          {/* Summary badge */}
          <div className="mt-3">
            {passed && warnings.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-300">Workflow is valid!</p>
                  <p className="text-xs text-green-400/70">Ready to deploy.</p>
                </div>
              </div>
            ) : passed && warnings.length > 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-yellow-300">
                    {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-yellow-400/70">No errors — can still deploy.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-300">
                    {errors.length} error{errors.length !== 1 ? "s" : ""}
                    {warnings.length > 0 && `, ${warnings.length} warning${warnings.length !== 1 ? "s" : ""}`}
                  </p>
                  <p className="text-xs text-red-400/70">Fix all errors before deploying.</p>
                </div>
              </div>
            )}
          </div>

          {/* Test buttons - shown when no errors */}
          {passed && onTest && (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => onTest("text")}
              >
                <MessageSquare className="w-4 h-4 mr-1.5" />
                Test Text
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => onTest("audio")}
              >
                <AudioLines className="w-4 h-4 mr-1.5" />
                Test Audio
              </Button>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="p-4 space-y-4">
            {/* Errors section */}
            {errors.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 px-1">
                  Errors ({errors.length})
                </h3>
                <div className="space-y-1.5">
                  {errors.map((item, idx) => (
                    <button
                      key={`error-${idx}`}
                      onClick={() => item.nodeId && onNavigateToNode(item.nodeId)}
                      disabled={!item.nodeId}
                      className={`w-full text-left rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors p-3 group ${
                        !item.nodeId ? "opacity-70 cursor-default" : "cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-snug">{item.message}</p>
                          {item.nodeId && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-medium">
                                <Crosshair className="w-3 h-3" />
                                {item.nodeLabel}
                              </span>
                              <span className="text-xs text-muted-foreground">{item.nodeType}</span>
                            </div>
                          )}
                        </div>
                        {item.nodeId && (
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-red-400 mt-0.5 flex-shrink-0 transition-colors" />
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
                <h3 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2 px-1">
                  Warnings ({warnings.length})
                </h3>
                <div className="space-y-1.5">
                  {warnings.map((item, idx) => (
                    <button
                      key={`warning-${idx}`}
                      onClick={() => item.nodeId && onNavigateToNode(item.nodeId)}
                      disabled={!item.nodeId}
                      className={`w-full text-left rounded-lg border border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors p-3 group ${
                        !item.nodeId ? "opacity-70 cursor-default" : "cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-snug">{item.message}</p>
                          {item.nodeId && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-medium">
                                <Crosshair className="w-3 h-3" />
                                {item.nodeLabel}
                              </span>
                              <span className="text-xs text-muted-foreground">{item.nodeType}</span>
                            </div>
                          )}
                        </div>
                        {item.nodeId && (
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-yellow-400 mt-0.5 flex-shrink-0 transition-colors" />
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
                <p className="text-lg font-semibold text-foreground">All clear!</p>
                <p className="text-sm text-muted-foreground mt-1">Your workflow has no issues.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default DebugPanel;
