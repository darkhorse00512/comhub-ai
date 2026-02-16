import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCall } from "@/hooks/useCall";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { LogOut, History, Phone, Settings, Users, PhoneIncoming, Copy, Check, Loader2 } from "lucide-react";
import CallControls from "@/components/CallControls";
import CallStatusDisplay from "@/components/CallStatus";
import ChatWindow from "@/components/ChatWindow";
import CallVisualizer from "@/components/CallVisualizer";
import { Link } from "react-router-dom";
import { api } from "@/services/api";

const TWILIO_PHONE_NUMBER = "+4915888656842";

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { status, isMuted, duration, startCall, endCall, toggleMute } = useCall();
  const { messages, clearMessages } = useSocket();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [copied, setCopied] = useState(false);
  const [callMode, setCallMode] = useState<"outbound" | "inbound">("outbound");
  const [isTestingInbound, setIsTestingInbound] = useState(false);

  const copyPhoneNumber = async () => {
    try {
      // Try clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(TWILIO_PHONE_NUMBER);
      } else {
        // Fallback for non-HTTPS or older browsers
        const textArea = document.createElement("textarea");
        textArea.value = TWILIO_PHONE_NUMBER;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Phone number copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
      toast({
        title: "Failed to copy",
        description: "Please copy the number manually",
        variant: "destructive",
      });
    }
  };

  const handleTestInboundCall = async (withPhoneCall: boolean = false) => {
    setIsTestingInbound(true);
    try {
      // Format phone number if provided
      let formattedNumber: string | undefined;
      if (withPhoneCall && testPhoneNumber.trim()) {
        formattedNumber = testPhoneNumber.trim();
        if (!formattedNumber.startsWith("+")) {
          formattedNumber = "+" + formattedNumber;
        }
      }

      const result = await api.testInboundCall(formattedNumber);
      if (result.error) {
        toast({
          title: "Test failed",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Test successful!",
          description: result.data?.message || "Check call history to see the result.",
        });
        // Navigate to history after a short delay
        if (!withPhoneCall) {
          setTimeout(() => navigate("/history"), 2000);
        }
      }
    } catch (error) {
      toast({
        title: "Test failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsTestingInbound(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleStartCall = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter a phone number to call",
        variant: "destructive",
      });
      return;
    }

    // Format phone number - add + if not present
    let formattedNumber = phoneNumber.trim();
    if (!formattedNumber.startsWith("+")) {
      formattedNumber = "+" + formattedNumber;
    }

    try {
      await startCall(formattedNumber);
      toast({
        title: "Call started",
        description: `Calling ${formattedNumber}...`,
      });
    } catch (error) {
      toast({
        title: "Failed to start call",
        description: error instanceof Error ? error.message : "Please check your connection and try again",
        variant: "destructive",
      });
    }
  };

  const handleEndCall = async () => {
    try {
      await endCall();
      clearMessages();
      toast({
        title: "Call ended",
        description: "Your call has been disconnected",
      });
    } catch (error) {
      toast({
        title: "Error ending call",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
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
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <Phone className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">ComHub AI</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/bulk-dialer" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Bulk Dialer</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/history" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">History</span>
              </Link>
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold text-foreground mb-2">
              AI Voice Assistant
            </h1>
            <p className="text-muted-foreground">
              Click the button below to start a conversation or use Bulk Dialer for multiple calls
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Call Panel */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-8 shadow-elevated"
            >
              <div className="space-y-6">
                {/* Call Mode Selection */}
                {status === "idle" && (
                  <div className="flex gap-2 p-1 bg-secondary rounded-lg">
                    <button
                      onClick={() => setCallMode("outbound")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${
                        callMode === "outbound"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Phone className="w-4 h-4" />
                      <span className="text-sm font-medium">Outbound</span>
                    </button>
                    <button
                      onClick={() => setCallMode("inbound")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${
                        callMode === "inbound"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <PhoneIncoming className="w-4 h-4" />
                      <span className="text-sm font-medium">Inbound Test</span>
                    </button>
                  </div>
                )}

                {/* Outbound Call Input */}
                {status === "idle" && callMode === "outbound" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Phone Number to Call
                    </label>
                    <Input
                      type="tel"
                      placeholder="e.g. +4915888656842"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="text-lg"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter phone number with country code (e.g. +49 for Germany)
                    </p>
                  </div>
                )}

                {/* Inbound Call Test Instructions */}
                {status === "idle" && callMode === "inbound" && (
                  <div className="space-y-4">
                    {/* Quick Test from Website */}
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <PhoneIncoming className="w-5 h-5 text-green-500" />
                        <span className="font-medium text-foreground">Quick Test (Simulated)</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Simulate a full conversation: AI greeting → User message → AI response
                      </p>
                      <Button
                        onClick={() => handleTestInboundCall(false)}
                        disabled={isTestingInbound}
                        className="w-full bg-green-500 hover:bg-green-600 text-white"
                      >
                        {isTestingInbound ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <PhoneIncoming className="w-4 h-4 mr-2" />
                            Run Quick Test
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Full Test - Call My Phone */}
                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Phone className="w-5 h-5 text-blue-500" />
                        <span className="font-medium text-foreground">Full Test (Call My Phone)</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        AI will call your phone, say greeting, and listen for your response:
                      </p>
                      <div className="space-y-3">
                        <Input
                          type="tel"
                          placeholder="Your phone: +491234567890"
                          value={testPhoneNumber}
                          onChange={(e) => setTestPhoneNumber(e.target.value)}
                          className="text-base"
                        />
                        <Button
                          onClick={() => handleTestInboundCall(true)}
                          disabled={isTestingInbound || !testPhoneNumber.trim()}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          {isTestingInbound ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Calling...
                            </>
                          ) : (
                            <>
                              <Phone className="w-4 h-4 mr-2" />
                              Call My Phone
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Manual Test - Call Twilio Number */}
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <PhoneIncoming className="w-5 h-5 text-primary" />
                        <span className="font-medium text-foreground">Manual Test (Call Us)</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Or call this number directly from your phone:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-3 bg-background rounded-lg text-lg font-mono text-foreground select-all">
                          {TWILIO_PHONE_NUMBER}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={copyPhoneNumber}
                          className="shrink-0"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">What happens:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>AI generates a greeting and speaks it</li>
                        <li>AI listens for your response (full test only)</li>
                        <li>AI generates and speaks a response</li>
                        <li>All audio saved to Supabase, viewable in History</li>
                      </ol>
                    </div>
                  </div>
                )}

                <CallVisualizer status={status} />
                <CallStatusDisplay status={status} duration={duration} />
                {callMode === "outbound" && (
                  <CallControls
                    status={status}
                    isMuted={isMuted}
                    onStartCall={handleStartCall}
                    onEndCall={handleEndCall}
                    onToggleMute={toggleMute}
                  />
                )}
              </div>
            </motion.div>

            {/* Chat Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl overflow-auto shadow-elevated"
            >
              <div className="px-6 py-4 border-b border-border/50">
                <h2 className="text-lg font-semibold text-foreground">
                  Conversation
                </h2>
                <p className="text-sm text-muted-foreground">
                  Real-time AI responses
                </p>
              </div>
              <ChatWindow messages={messages} />
            </motion.div>
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 grid sm:grid-cols-3 gap-4"
          >
            <Link to="/bulk-dialer">
              <div className="glass rounded-xl p-6 hover:bg-secondary/50 transition-colors cursor-pointer h-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Bulk Dialer</h3>
                    <p className="text-sm text-muted-foreground">
                      Call multiple numbers with AI
                    </p>
                  </div>
                </div>
              </div>
            </Link>
            <div
              onClick={() => setCallMode("inbound")}
              className="glass rounded-xl p-6 hover:bg-secondary/50 transition-colors cursor-pointer h-full"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <PhoneIncoming className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Test Inbound</h3>
                  <p className="text-sm text-muted-foreground">
                    Test AI with incoming calls
                  </p>
                </div>
              </div>
            </div>
            <Link to="/history">
              <div className="glass rounded-xl p-6 hover:bg-secondary/50 transition-colors cursor-pointer h-full">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <History className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Call History</h3>
                    <p className="text-sm text-muted-foreground">
                      View past conversations and transcripts
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
