import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClipboardList, Hash, Type, ToggleLeft, List, FileText } from "lucide-react";

interface CallResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: Record<string, any>;
  callDirection?: string;
  callStatus?: string;
}

const typeIcon = (value: any) => {
  if (typeof value === "boolean") return <ToggleLeft className="w-3.5 h-3.5" />;
  if (typeof value === "number") return <Hash className="w-3.5 h-3.5" />;
  if (Array.isArray(value)) return <List className="w-3.5 h-3.5" />;
  return <Type className="w-3.5 h-3.5" />;
};

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

const CallResultsModal = ({ isOpen, onClose, data, callDirection, callStatus }: CallResultsModalProps) => {
  const entries = Object.entries(data).filter(([key]) => !key.startsWith("_"));
  const summary = data._summary as string | undefined;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-purple-400" />
            Call Results
          </DialogTitle>
          {(callDirection || callStatus) && (
            <p className="text-xs text-muted-foreground mt-1">
              {callDirection && <span className="capitalize">{callDirection} call</span>}
              {callDirection && callStatus && " · "}
              {callStatus && <span className="capitalize">{callStatus === "ended" ? "Completed" : callStatus}</span>}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Summary */}
          {summary && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Summary</span>
              </div>
              <div className="rounded-lg border border-border bg-secondary/50 p-3">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{summary}</p>
              </div>
            </div>
          )}

          {/* Collected Fields */}
          {entries.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Collected Data ({entries.length} fields)
                </span>
              </div>
              <div className="space-y-1">
                {entries.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5"
                  >
                    <div className="text-purple-400 mt-0.5 shrink-0">
                      {typeIcon(value)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground capitalize">
                        {key.replace(/_/g, " ")}
                      </p>
                      <p className="text-sm text-foreground font-medium break-words">
                        {formatValue(value)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ClipboardList className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No data collected in this call</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CallResultsModal;
