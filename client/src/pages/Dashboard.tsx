import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCall } from "@/hooks/useCall";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { LogOut, History, Phone, Settings, Users } from "lucide-react";
import CallControls from "@/components/CallControls";
import CallStatusDisplay from "@/components/CallStatus";
import ChatWindow from "@/components/ChatWindow";
import CallVisualizer from "@/components/CallVisualizer";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { status, isMuted, duration, startCall, endCall, toggleMute } = useCall();
  const { messages, clearMessages } = useSocket();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleStartCall = async () => {
    try {
      await startCall(); // Start call (no phone number = AI-only call)
      toast({
        title: "Call started",
        description: "You're now connected to the AI assistant",
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
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
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
              <div className="space-y-8">
                <CallVisualizer status={status} />
                <CallStatusDisplay status={status} duration={duration} />
                <CallControls
                  status={status}
                  isMuted={isMuted}
                  onStartCall={handleStartCall}
                  onEndCall={handleEndCall}
                  onToggleMute={toggleMute}
                />
              </div>
            </motion.div>

            {/* Chat Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl overflow-hidden shadow-elevated"
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
            className="mt-6 grid sm:grid-cols-2 gap-4"
          >
            <Link to="/bulk-dialer">
              <div className="glass rounded-xl p-6 hover:bg-secondary/50 transition-colors cursor-pointer">
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
            <Link to="/history">
              <div className="glass rounded-xl p-6 hover:bg-secondary/50 transition-colors cursor-pointer">
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
