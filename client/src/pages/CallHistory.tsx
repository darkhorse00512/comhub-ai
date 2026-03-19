import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Clock, Play, Pause, CheckCircle, XCircle, AlertCircle, Loader2, Volume2, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { api, type CallHistoryItem } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import CallResultsModal from "@/components/CallResultsModal";

const formatDuration = (startedAt: string, endedAt: string | null): string => {
  if (!endedAt) return "0:00";
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const seconds = Math.floor((end - start) / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const statusConfig = {
  active: { icon: CheckCircle, color: "text-primary", bg: "bg-primary/10", label: "Active" },
  ended: { icon: CheckCircle, color: "text-success", bg: "bg-success/10", label: "Completed" },
  failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Failed" },
  ringing: { icon: AlertCircle, color: "text-warning", bg: "bg-warning/10", label: "Ringing" },
};

const CallHistory = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallHistoryItem | null>(null);
  const [selectedCallMessages, setSelectedCallMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [resultsModalCall, setResultsModalCall] = useState<CallHistoryItem | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      
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
          setHistory(result.data || []);
        }
      } catch (error) {
        toast({
          title: "Error loading history",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchHistory();
    }
  }, [user, toast]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedCall?.id) return;
      
      setLoadingMessages(true);
      try {
        const result = await api.getCallMessages(selectedCall.id);
        if (result.error) {
          toast({
            title: "Error loading messages",
            description: result.error,
            variant: "destructive",
          });
        } else {
          setSelectedCallMessages(result.data || []);
        }
      } catch (error) {
        toast({
          title: "Error loading messages",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedCall?.id, toast]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-auto pointer-events-none">
        <div className="absolute top-0 right-1/3 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Call History</h1>
              <p className="text-sm text-muted-foreground">
                View your past conversations
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto grid lg:grid-cols-5 gap-6">
          {/* Call list */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 glass rounded-2xl overflow-auto shadow-elevated"
          >
            <div className="p-4 border-b border-border/50">
              <p className="text-sm text-muted-foreground">
                {history.length} {history.length === 1 ? "call" : "calls"}
              </p>
            </div>
            <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
              {history.length === 0 ? (
                <div className="p-8 text-center">
                  <Phone className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No call history yet</p>
                </div>
              ) : (
                history.map((call, index) => {
                  const statusKey = call.status as keyof typeof statusConfig;
                  const statusInfo = statusConfig[statusKey] || statusConfig.ended;
                  const StatusIcon = statusInfo.icon;
                  const duration = formatDuration(call.startedAt, call.endedAt);
                  
                  return (
                    <motion.button
                      key={call.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedCall(call)}
                      className={`w-full p-4 text-left hover:bg-secondary/50 transition-colors ${
                        selectedCall?.id === call.id ? "bg-secondary/50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${statusInfo.bg}`}>
                          <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-foreground">
                              {statusInfo.label}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {duration}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(call.startedAt), "MMM d, yyyy • h:mm a")}
                          </p>
                          {call.calleeNumber && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {call.direction === "outbound" ? "To" : "From"}: {call.calleeNumber || call.callerNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>
          </motion.div>

          {/* Call details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3 glass rounded-2xl overflow-auto shadow-elevated"
          >
            {selectedCall ? (
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`p-3 rounded-xl ${statusConfig[selectedCall.status as keyof typeof statusConfig]?.bg || statusConfig.ended.bg}`}>
                    {(() => {
                      const statusKey = selectedCall.status as keyof typeof statusConfig;
                      const statusInfo = statusConfig[statusKey] || statusConfig.ended;
                      const StatusIcon = statusInfo.icon;
                      return <StatusIcon className={`w-6 h-6 ${statusInfo.color}`} />;
                    })()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground capitalize">
                      {statusConfig[selectedCall.status as keyof typeof statusConfig]?.label || selectedCall.status} Call
                    </h2>
                    <p className="text-muted-foreground">
                      {format(new Date(selectedCall.startedAt), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-secondary">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Duration</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {formatDuration(selectedCall.startedAt, selectedCall.endedAt)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-secondary">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Phone className="w-4 h-4" />
                      <span className="text-sm">Direction</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground capitalize">{selectedCall.direction}</p>
                  </div>
                </div>

                {selectedCall.collectedData && Object.keys(selectedCall.collectedData).length > 0 && (
                  <div className="mb-6">
                    <Button
                      variant="outline"
                      className="gap-2 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                      onClick={() => setResultsModalCall(selectedCall)}
                    >
                      <ClipboardList className="w-4 h-4" />
                      Call Results ({Object.keys(selectedCall.collectedData).length} fields)
                    </Button>
                  </div>
                )}

                {loadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : selectedCallMessages.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">
                      Conversation
                    </h3>
                    <div className="p-4 rounded-xl bg-secondary max-h-[300px] overflow-y-auto space-y-3">
                      {selectedCallMessages.map((msg) => (
                        <div key={msg.id} className={`p-3 rounded-lg ${msg.role === "ai" ? "bg-primary/10" : "bg-background"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase">
                              {msg.role === "ai" ? "AI" : "User"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(msg.timestamp), "h:mm a")}
                            </span>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">
                            {msg.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-secondary text-center">
                    <p className="text-sm text-muted-foreground">No conversation messages available</p>
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  {selectedCall.recordingUrl ? (
                    <>
                      <audio 
                        ref={audioRef} 
                        src={selectedCall.recordingUrl}
                        onEnded={() => setIsPlaying(false)}
                        onPause={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                      />
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          if (audioRef.current) {
                            if (isPlaying) {
                              audioRef.current.pause();
                            } else {
                              audioRef.current.play();
                            }
                          }
                        }}
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            Pause Recording
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Play Recording
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="flex-1 opacity-60"
                      onClick={() => {
                        toast({
                          title: "No recording available",
                          description: "Call recordings are not available for AI-only sessions. Connect Asterisk or Twilio to enable call recording.",
                        });
                      }}
                    >
                      <Volume2 className="w-4 h-4 mr-2" />
                      No Recording
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                    <Phone className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">
                    Select a call to view details
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>

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

export default CallHistory;
