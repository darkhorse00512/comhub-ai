import { useState, useEffect } from "react";
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
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Loader2,
  AlertCircle,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
}

interface CallHistoryItem {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: "ringing" | "active" | "ended" | "failed";
  direction: "inbound" | "outbound";
  callerNumber: string | null;
  calleeNumber: string | null;
}

interface CallMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
}

const HistoryPanel = ({ isOpen, onClose, agentId }: HistoryPanelProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallHistoryItem | null>(null);
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const result = await api.getCallHistory();
      if (result.error) {
        toast({
          title: "Error loading history",
          description: result.error,
          variant: "destructive",
        });
      } else {
        setCalls(result.data || []);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load call history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchMessages = async (callId: string) => {
    setLoadingMessages(true);
    try {
      const result = await api.getCallMessages(callId);
      if (result.error) {
        toast({
          title: "Error loading messages",
          description: result.error,
          variant: "destructive",
        });
      } else {
        setMessages(result.data || []);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load call messages",
        variant: "destructive",
      });
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSelectCall = (call: CallHistoryItem) => {
    setSelectedCall(call);
    fetchMessages(call.id);
  };

  const formatDuration = (startedAt: string, endedAt: string | null): string => {
    if (!endedAt) return "0:00";
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    const seconds = Math.floor((end - start) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ended":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "active":
        return <Phone className="w-4 h-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getDirectionIcon = (direction: string) => {
    return direction === "inbound" ? (
      <PhoneIncoming className="w-4 h-4 text-green-600" />
    ) : (
      <PhoneOutgoing className="w-4 h-4 text-blue-600" />
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[500px] sm:w-[600px] p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-purple-500" />
              Call History
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchHistory}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex h-[calc(100vh-100px)]">
          {/* Call List */}
          <div className="w-1/2 border-r">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : calls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Phone className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">No call history yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Test calls and real calls will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {calls.map((call) => (
                    <button
                      key={call.id}
                      onClick={() => handleSelectCall(call)}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedCall?.id === call.id ? "bg-purple-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getDirectionIcon(call.direction)}
                          <span className="text-sm font-medium capitalize">
                            {call.direction}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(call.status)}
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(call.startedAt, call.endedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(call.startedAt), "MMM d, yyyy h:mm a")}
                      </div>
                      {(call.callerNumber || call.calleeNumber) && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {call.direction === "inbound" ? call.callerNumber : call.calleeNumber}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Call Details */}
          <div className="w-1/2 flex flex-col">
            {!selectedCall ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <ChevronRight className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-muted-foreground">Select a call to view details</p>
              </div>
            ) : (
              <>
                {/* Call Info Header */}
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    {getDirectionIcon(selectedCall.direction)}
                    <span className="font-medium capitalize">{selectedCall.direction} Call</span>
                    {getStatusIcon(selectedCall.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Duration: </span>
                      <span className="font-medium">
                        {formatDuration(selectedCall.startedAt, selectedCall.endedAt)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status: </span>
                      <span className="font-medium capitalize">{selectedCall.status}</span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-1 mb-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Conversation
                    </h4>
                  </div>

                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No messages recorded</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg text-sm ${
                            msg.role === "ai"
                              ? "bg-purple-50 border border-purple-100"
                              : "bg-blue-50 border border-blue-100"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-xs font-semibold uppercase ${
                                msg.role === "ai" ? "text-purple-600" : "text-blue-600"
                              }`}
                            >
                              {msg.role === "ai" ? "AI Agent" : "User"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(msg.timestamp), "h:mm:ss a")}
                            </span>
                          </div>
                          <p className="text-gray-700 leading-relaxed">{msg.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default HistoryPanel;
