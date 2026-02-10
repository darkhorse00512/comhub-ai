import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  History,
  Loader2,
  RotateCcw,
  GitBranch,
  Clock,
  RefreshCw,
  Save,
  Layers,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  onRestore?: (config: any) => void;
}

interface AgentVersion {
  id: string;
  agent_id: string;
  version_number: number;
  name: string;
  node_count: number;
  edge_count: number;
  created_at: string;
}

const HistoryPanel = ({ isOpen, onClose, agentId, onRestore }: HistoryPanelProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getAgentVersions(agentId);
      if (result.error) {
        toast({
          title: "Error loading history",
          description: result.error,
          variant: "destructive",
        });
      } else {
        setVersions(result.data || []);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load version history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [agentId, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen, fetchVersions]);

  const handleRestore = async (version: AgentVersion) => {
    setRestoringId(version.id);
    try {
      const result = await api.restoreAgentVersion(agentId, version.id);
      if (result.error) {
        toast({
          title: "Error restoring version",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Version restored",
          description: `Restored to version ${version.version_number} from ${format(new Date(version.created_at), "MMM d, yyyy h:mm a")}`,
        });
        if (onRestore && result.data?.config) {
          onRestore(result.data.config);
        }
        onClose();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to restore version",
        variant: "destructive",
      });
    } finally {
      setRestoringId(null);
    }
  };

  const getTimeAgo = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(date, "MMM d");
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-purple-500" />
              Agent History
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchVersions}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Each save creates a version snapshot. Click restore to go back to a previous version.
          </p>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500 mb-2" />
              <span className="text-sm text-muted-foreground">Loading history...</span>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                <Save className="w-7 h-7 text-gray-300" />
              </div>
              <p className="font-medium text-gray-700 mb-1">No version history yet</p>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                Version history will appear here after you save your agent for the first time.
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className="group relative rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50/30 transition-all p-4"
                >
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        index === 0
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        v{version.version_number}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900">
                            {index === 0 ? "Latest" : `Version ${version.version_number}`}
                          </p>
                          {index === 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-[11px] text-gray-400">
                            {getTimeAgo(version.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {index > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRestore(version)}
                        disabled={restoringId === version.id}
                      >
                        {restoringId === version.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Restore
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-gray-500 ml-[42px]">
                    <div className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      <span>{version.node_count} nodes</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3" />
                      <span>{version.edge_count} edges</span>
                    </div>
                    <span className="text-gray-300">|</span>
                    <span>{format(new Date(version.created_at), "MMM d, yyyy h:mm a")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {versions.length > 0 && (
          <div className="border-t p-3">
            <p className="text-xs text-center text-muted-foreground">
              {versions.length} version{versions.length !== 1 ? "s" : ""} saved
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default HistoryPanel;
