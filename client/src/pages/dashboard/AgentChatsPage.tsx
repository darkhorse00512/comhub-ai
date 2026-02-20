import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  MessageCircle,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Loader2,
  Bot,
  User,
  RefreshCw,
  Search,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { api, AgentCallHistoryItem } from "@/services/api";
import { useAgentContext } from "@/components/agent/AgentLayout";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
}

const formatDuration = (startedAt: string, endedAt: string | null): string => {
  if (!endedAt) return "Ongoing";
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const seconds = Math.floor((end - start) / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const AgentChatsPage = () => {
  const { agent } = useAgentContext();
  const [calls, setCalls] = useState<AgentCallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCalls();
  }, [agent.id]);

  const fetchCalls = async () => {
    setLoading(true);
    const result = await api.getAgentCallHistory(agent.id);
    if (result.data) {
      const sorted = [...result.data].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
      setCalls(sorted);
      if (sorted.length > 0 && !selectedCallId) {
        handleSelectCall(sorted[0].id);
      }
    }
    setLoading(false);
  };

  const handleSelectCall = async (callId: string) => {
    setSelectedCallId(callId);
    setLoadingMessages(true);
    const result = await api.getCallMessages(callId);
    if (result.data) {
      setMessages(result.data);
    } else {
      setMessages([]);
    }
    setLoadingMessages(false);
  };

  const filteredCalls = calls.filter((call) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      call.direction.toLowerCase().includes(q) ||
      call.status.toLowerCase().includes(q) ||
      format(new Date(call.startedAt), "MMM d, yyyy HH:mm").toLowerCase().includes(q)
    );
  });

  const selectedCall = calls.find((c) => c.id === selectedCallId);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Conversation List */}
      <div className="w-80 border-r border-border flex flex-col bg-card/30">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              Conversations
            </h2>
            <Button variant="ghost" size="icon" onClick={fetchCalls} className="h-8 w-8">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredCalls.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredCalls.map((call) => (
                <button
                  key={call.id}
                  onClick={() => handleSelectCall(call.id)}
                  className={`w-full text-left p-4 hover:bg-secondary/50 transition-colors ${
                    selectedCallId === call.id ? "bg-secondary/80" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      call.direction === "inbound" ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
                    }`}>
                      {call.direction === "inbound" ? (
                        <PhoneIncoming className="w-4 h-4" />
                      ) : (
                        <PhoneOutgoing className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground capitalize">
                          {call.direction}
                        </span>
                        <Badge
                          variant={
                            call.status === "ended" ? "secondary" :
                            call.status === "active" ? "default" :
                            "destructive"
                          }
                          className="text-[10px] px-1.5 py-0"
                        >
                          {call.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{format(new Date(call.startedAt), "MMM d, HH:mm")}</span>
                        <span>-</span>
                        <span>{call.messageCount} msgs</span>
                        <span>-</span>
                        <span>{formatDuration(call.startedAt, call.endedAt)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat View */}
      <div className="flex-1 flex flex-col">
        {selectedCall ? (
          <>
            {/* Chat Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  selectedCall.direction === "inbound" ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
                }`}>
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground capitalize">
                    {selectedCall.direction} Call
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {format(new Date(selectedCall.startedAt), "MMM d, yyyy 'at' HH:mm")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(selectedCall.startedAt, selectedCall.endedAt)}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-6">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No messages in this conversation</p>
                </div>
              ) : (
                <div className="space-y-4 max-w-3xl mx-auto">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={msg.id || i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex gap-3 ${msg.role === "ai" ? "" : "flex-row-reverse"}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === "ai"
                          ? "bg-primary/10 text-primary"
                          : "bg-secondary text-secondary-foreground"
                      }`}>
                        {msg.role === "ai" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        msg.role === "ai"
                          ? "bg-card border border-border"
                          : "bg-primary text-primary-foreground"
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        {msg.timestamp && (
                          <p className={`text-[10px] mt-1 ${
                            msg.role === "ai" ? "text-muted-foreground" : "text-primary-foreground/70"
                          }`}>
                            {format(new Date(msg.timestamp), "HH:mm:ss")}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Collected Data */}
            {selectedCall.collectedData && Object.keys(selectedCall.collectedData).length > 0 && (
              <div className="border-t border-border p-4 bg-card/30">
                <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Collected Data</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedCall.collectedData).map(([key, value]) => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {key}: {String(value)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Select a conversation to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentChatsPage;
