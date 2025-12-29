import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  Upload,
  Download,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  PhoneCall,
  PhoneOff,
  Loader2,
  FileText,
  Plus,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, type BulkCallJob } from "@/services/api";

const statusConfig: Record<string, { color: string; bg: string; icon: any }> = {
  pending: { color: "text-muted-foreground", bg: "bg-muted", icon: Clock },
  calling: { color: "text-warning", bg: "bg-warning/10", icon: PhoneCall },
  answered: { color: "text-primary", bg: "bg-primary/10", icon: Phone },
  completed: { color: "text-success", bg: "bg-success/10", icon: CheckCircle },
  failed: { color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
  no_answer: { color: "text-muted-foreground", bg: "bg-muted", icon: PhoneOff },
  busy: { color: "text-warning", bg: "bg-warning/10", icon: PhoneOff },
};

const BulkDialer = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConnected, subscribeToBulkJob } = useSocket();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const [phoneNumbers, setPhoneNumbers] = useState<string>("");
  const [parsedNumbers, setParsedNumbers] = useState<string[]>([]);
  const [currentJob, setCurrentJob] = useState<BulkCallJob | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Parse phone numbers when input changes
  useEffect(() => {
    const numbers = phoneNumbers
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
      .filter((n) => {
        const cleaned = n.replace(/\D/g, "");
        return cleaned.length >= 10 && cleaned.length <= 15;
      });
    setParsedNumbers([...new Set(numbers)]); // Remove duplicates
  }, [phoneNumbers]);

  // Subscribe to Socket.IO updates for the job
  useEffect(() => {
    if (currentJob && isConnected && (currentJob.status === "pending" || currentJob.status === "in_progress")) {
      // Unsubscribe from previous job if any
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      // Subscribe to real-time updates
      unsubscribeRef.current = subscribeToBulkJob(currentJob.id, (data) => {
        setCurrentJob((prev) => prev ? { ...prev, ...data.job } : null);
      });

      // Also poll as fallback (less frequently)
      const interval = setInterval(async () => {
        const result = await api.getBulkCallJobStatus(currentJob.id);
        if (result.data) {
          setCurrentJob(result.data);
          if (result.data.status === "completed" || result.data.status === "cancelled") {
            clearInterval(interval);
          }
        }
      }, 5000); // Reduced polling frequency since we have Socket.IO
      setPollInterval(interval);

      return () => {
        clearInterval(interval);
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    }
  }, [currentJob?.id, currentJob?.status, isConnected, subscribeToBulkJob]);

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/[\n\r]+/).filter((line) => line.trim());

      // Try to extract phone numbers from CSV
      const numbers: string[] = [];
      for (const line of lines) {
        // Skip header rows
        if (line.toLowerCase().includes("phone") || line.toLowerCase().includes("number")) {
          continue;
        }

        // Extract numbers from line
        const parts = line.split(",");
        for (const part of parts) {
          const cleaned = part.trim().replace(/['"]/g, "");
          const digits = cleaned.replace(/\D/g, "");
          if (digits.length >= 10 && digits.length <= 15) {
            numbers.push(cleaned);
          }
        }
      }

      if (numbers.length > 0) {
        setPhoneNumbers((prev) => (prev ? prev + "\n" : "") + numbers.join("\n"));
        toast({
          title: "Numbers imported",
          description: `Imported ${numbers.length} phone numbers from CSV`,
        });
      } else {
        toast({
          title: "No valid numbers found",
          description: "The CSV file doesn't contain valid phone numbers",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleExportCSV = () => {
    if (!currentJob?.results) return;

    const csvContent = [
      "Phone Number,Status,Duration,Error",
      ...currentJob.results.map(
        (r) => `"${r.phoneNumber}","${r.status}","${r.duration}","${r.error || ""}"`
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk-call-results-${currentJob.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Results exported",
      description: "Call results have been downloaded as CSV",
    });
  };

  const handleCreateJob = async () => {
    if (parsedNumbers.length === 0) {
      toast({
        title: "No valid numbers",
        description: "Please enter valid phone numbers to call",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const result = await api.createBulkCallJob(parsedNumbers);
      if (result.error) {
        throw new Error(result.error);
      }
      setCurrentJob(result.data);
      toast({
        title: "Job created",
        description: `Created bulk call job with ${parsedNumbers.length} numbers`,
      });
    } catch (error) {
      toast({
        title: "Failed to create job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartJob = async () => {
    if (!currentJob) return;

    setIsStarting(true);
    try {
      const result = await api.startBulkCallJob(currentJob.id);
      if (result.error) {
        throw new Error(result.error);
      }
      setCurrentJob((prev) => prev ? { ...prev, status: "in_progress" } : null);
      toast({
        title: "Job started",
        description: "Bulk calling has started",
      });
    } catch (error) {
      toast({
        title: "Failed to start job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancelJob = async () => {
    if (!currentJob) return;

    try {
      const result = await api.cancelBulkCallJob(currentJob.id);
      if (result.error) {
        throw new Error(result.error);
      }
      setCurrentJob((prev) => prev ? { ...prev, status: "cancelled" } : null);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      toast({
        title: "Job cancelled",
        description: "Bulk calling has been stopped",
      });
    } catch (error) {
      toast({
        title: "Failed to cancel job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleReset = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setCurrentJob(null);
    setPhoneNumbers("");
    setParsedNumbers([]);
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  }, [pollInterval]);

  const progress = currentJob
    ? ((currentJob.completedCalls + currentJob.failedCalls) / currentJob.totalCalls) * 100
    : 0;

  if (authLoading) {
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
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[150px]" />
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
              <h1 className="text-xl font-bold text-foreground">Bulk Dialer</h1>
              <p className="text-sm text-muted-foreground">
                Call multiple numbers with AI
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection status indicator */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${isConnected ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="hidden sm:inline">{isConnected ? 'Live' : 'Offline'}</span>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.txt"
              className="hidden"
              onChange={handleImportCSV}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={!!currentJob}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            {currentJob?.results && currentJob.results.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export Results
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass rounded-2xl p-6 shadow-elevated"
          >
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Phone Numbers
            </h2>

            {!currentJob ? (
              <>
                <Textarea
                  value={phoneNumbers}
                  onChange={(e) => setPhoneNumbers(e.target.value)}
                  placeholder="Enter phone numbers (one per line, or comma-separated)&#10;&#10;Example:&#10;+1 555-123-4567&#10;+1 555-234-5678&#10;+1 555-345-6789"
                  className="min-h-[300px] font-mono text-sm"
                />
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {parsedNumbers.length} valid number{parsedNumbers.length !== 1 ? "s" : ""} detected
                  </p>
                  <Button
                    onClick={handleCreateJob}
                    disabled={parsedNumbers.length === 0 || isCreating}
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Job
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {/* Job Status */}
                <div className="p-4 rounded-xl bg-secondary">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      Job Status
                    </span>
                    <Badge
                      variant={
                        currentJob.status === "completed"
                          ? "default"
                          : currentJob.status === "in_progress"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {currentJob.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>{currentJob.completedCalls + currentJob.failedCalls} / {currentJob.totalCalls}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-success/10 text-center">
                    <p className="text-2xl font-bold text-success">
                      {currentJob.completedCalls}
                    </p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/10 text-center">
                    <p className="text-2xl font-bold text-destructive">
                      {currentJob.failedCalls}
                    </p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10 text-center">
                    <p className="text-2xl font-bold text-primary">
                      {currentJob.activeCalls || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  {currentJob.status === "pending" && (
                    <Button
                      className="flex-1"
                      onClick={handleStartJob}
                      disabled={isStarting}
                    >
                      {isStarting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start Calling
                        </>
                      )}
                    </Button>
                  )}
                  {currentJob.status === "in_progress" && (
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={handleCancelJob}
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                  )}
                  {(currentJob.status === "completed" || currentJob.status === "cancelled") && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={handleReset}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      New Job
                    </Button>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          {/* Results Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-2xl overflow-hidden shadow-elevated"
          >
            <div className="px-6 py-4 border-b border-border/50">
              <h2 className="text-lg font-semibold text-foreground">
                Call Progress
              </h2>
              <p className="text-sm text-muted-foreground">
                Real-time call status
              </p>
            </div>

            <div className="max-h-[500px] overflow-y-auto">
              {currentJob?.results && currentJob.results.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {currentJob.results.map((result, index) => {
                    const config = statusConfig[result.status] || statusConfig.pending;
                    const StatusIcon = config.icon;

                    return (
                      <motion.div
                        key={result.phoneNumber}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="px-6 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${config.bg}`}>
                            <StatusIcon className={`w-4 h-4 ${config.color}`} />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {result.phoneNumber}
                            </p>
                            {result.error && (
                              <p className="text-xs text-destructive">
                                {result.error}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={config.color}>
                            {result.status.replace("_", " ")}
                          </Badge>
                          {result.duration > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {result.duration}s
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">
                    {currentJob
                      ? "Waiting for calls to start..."
                      : "Enter phone numbers to begin"}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default BulkDialer;
