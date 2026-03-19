import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Loader2,
  Bot,
  User,
  MessageSquare,
  ClipboardList,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, AgentCallHistoryItem } from "@/services/api";
import CallResultsModal from "@/components/CallResultsModal";

interface CallMessageItem {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  audioUrl: string | null;
}

interface AgentCallsSectionProps {
  agentId: string;
}

const formatCallDuration = (startedAt: string, endedAt: string | null): string => {
  if (!endedAt) return "0:00";
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const seconds = Math.floor((end - start) / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
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

const AgentCallsSection = ({ agentId }: AgentCallsSectionProps) => {
  const [calls, setCalls] = useState<AgentCallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<AgentCallHistoryItem | null>(null);
  const [callMessages, setCallMessages] = useState<CallMessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [resultsModalCall, setResultsModalCall] = useState<AgentCallHistoryItem | null>(null);

  const loadCallHistory = async () => {
    setLoading(true);
    const result = await api.getAgentCallHistory(agentId);
    if (result.data) {
      setCalls(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCallHistory();
  }, [agentId]);

  const handleSelectCall = async (call: AgentCallHistoryItem) => {
    setSelectedCall(call);
    setLoadingMessages(true);
    const result = await api.getCallMessages(call.id);
    if (result.data) {
      setCallMessages(result.data);
    }
    setLoadingMessages(false);
  };

  const handleBack = () => {
    setSelectedCall(null);
    setCallMessages([]);
  };

  return (
    <div className="flex-1 overflow-hidden p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-full flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            {selectedCall && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {selectedCall ? "Call Detail" : "Call History"}
              </h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                {selectedCall
                  ? format(new Date(selectedCall.startedAt), "MMM d, yyyy 'at' h:mm a")
                  : `${calls.length} call${calls.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          {!selectedCall && (
            <Button variant="outline" size="sm" onClick={loadCallHistory} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
        </div>

        {/* Content */}
        {selectedCall ? (
          /* Call Detail View */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Call Summary */}
            <div className="rounded-lg border border-border p-4 mb-4 shrink-0 bg-card/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    selectedCall.direction === "inbound"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-green-500/20 text-green-400"
                  }`}>
                    {selectedCall.direction === "inbound" ? (
                      <PhoneIncoming className="w-5 h-5" />
                    ) : (
                      <PhoneOutgoing className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium capitalize">{selectedCall.direction} Call</p>
                    <p className="text-xs text-muted-foreground">
                      Duration: {formatCallDuration(selectedCall.startedAt, selectedCall.endedAt)}
                      {" · "}
                      {selectedCall.messageCount} messages
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedCall.collectedData && Object.keys(selectedCall.collectedData).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                      onClick={() => setResultsModalCall(selectedCall)}
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      Call Results
                    </Button>
                  )}
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    selectedCall.status === "ended"
                      ? "bg-green-500/20 text-green-400"
                      : selectedCall.status === "active"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-secondary text-muted-foreground"
                  }`}>
                    {selectedCall.status === "ended" ? "Completed" : selectedCall.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages */}
            {loadingMessages ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Loading conversation...</span>
                </div>
              </div>
            ) : callMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No messages in this call</p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-2 pb-4">
                  {callMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "ai" && (
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot className="w-4 h-4 text-purple-400" />
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] rounded-xl px-3.5 py-2.5 ${
                          msg.role === "user"
                            ? "bg-blue-500 text-white"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <span
                          className={`text-[10px] mt-1 block ${
                            msg.role === "user" ? "text-blue-100" : "text-muted-foreground"
                          }`}
                        >
                          {format(new Date(msg.timestamp), "h:mm a")}
                        </span>
                      </div>
                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User className="w-4 h-4 text-blue-400" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : (
          /* Call List View */
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Loading call history...</span>
                </div>
              </div>
            ) : calls.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Phone className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <p className="font-medium text-foreground mb-1">No calls yet</p>
                <p className="text-sm text-muted-foreground max-w-[300px]">
                  Start a test call from the Studio to begin recording conversation history
                </p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="space-y-2 pr-2 pb-4">
                  {calls.map((call) => (
                    <div
                      key={call.id}
                      className="group rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all p-4"
                    >
                      <div className="flex items-start justify-between">
                        <button
                          onClick={() => handleSelectCall(call)}
                          className="flex items-center gap-3 text-left flex-1 min-w-0"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            call.direction === "inbound"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-green-500/20 text-green-400"
                          }`}>
                            {call.direction === "inbound" ? (
                              <PhoneIncoming className="w-5 h-5" />
                            ) : (
                              <PhoneOutgoing className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground capitalize">
                              {call.direction} Call
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {getTimeAgo(call.startedAt)} ·{" "}
                              {formatCallDuration(call.startedAt, call.endedAt)} ·{" "}
                              {call.messageCount} msg{call.messageCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </button>
                        <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                            call.status === "ended"
                              ? "bg-green-500/20 text-green-400"
                              : call.status === "active"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-secondary text-muted-foreground"
                          }`}>
                            {call.status === "ended" ? "Completed" : call.status}
                          </span>
                          {call.collectedData && Object.keys(call.collectedData).length > 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setResultsModalCall(call); }}
                              className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-0.5 transition-colors"
                            >
                              <ClipboardList className="w-3 h-3" />
                              {Object.keys(call.collectedData).length} results
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </motion.div>

      {/* Call Results Modal */}
      {resultsModalCall?.collectedData && (
        <CallResultsModal
          isOpen={!!resultsModalCall}
          onClose={() => setResultsModalCall(null)}
          data={resultsModalCall.collectedData}
          callDirection={resultsModalCall.direction}
          callStatus={resultsModalCall.status}
        />
      )}
    </div>
  );
};

export default AgentCallsSection;
