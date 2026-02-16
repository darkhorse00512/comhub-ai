import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart3,
  Phone,
  Clock,
  TrendingUp,
  PhoneIncoming,
  PhoneOutgoing,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";

interface UsageStats {
  totalCalls: number;
  totalMinutes: number;
  inboundCalls: number;
  outboundCalls: number;
  successfulCalls: number;
  failedCalls: number;
  successRate: number;
}

const UsagePage = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UsageStats>({
    totalCalls: 0,
    totalMinutes: 0,
    inboundCalls: 0,
    outboundCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    successRate: 0,
  });

  useEffect(() => {
    fetchUsageStats();
  }, []);

  const fetchUsageStats = async () => {
    setLoading(true);
    try {
      const response = await api.getUsageStatistics();
      if (response.error) {
        toast({
          title: "Error",
          description: response.error,
          variant: "destructive",
        });
      } else if (response.data) {
        // Ensure all fields have default values
        setStats({
          totalCalls: response.data.totalCalls || 0,
          totalMinutes: response.data.totalMinutes || 0,
          inboundCalls: response.data.inboundCalls || 0,
          outboundCalls: response.data.outboundCalls || 0,
          successfulCalls: response.data.successfulCalls || 0,
          failedCalls: response.data.failedCalls || 0,
          successRate: response.data.successRate || 0,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch usage statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const avgCallDuration = stats.totalCalls > 0
    ? Math.floor(stats.totalMinutes / stats.totalCalls)
    : 0;

  const formatDuration = (minutes: number) => {
    const mins = Math.floor(minutes);
    const secs = Math.floor((minutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground mb-2">Usage</h1>
        <p className="text-muted-foreground">
          Monitor your call usage and spending
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    ) : (
                      stats.totalCalls
                    )}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <Phone className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-4 text-sm">
                <span className="text-muted-foreground">All time total</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Minutes</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    ) : (
                      Math.floor(stats.totalMinutes)
                    )}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Clock className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-4 text-sm">
                <span className="text-muted-foreground">
                  Avg {formatDuration(avgCallDuration)} per call
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    ) : (
                      `${(stats.successRate || 0).toFixed(1)}%`
                    )}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-4 text-sm">
                <span className="text-muted-foreground">
                  {stats.successfulCalls} successful, {stats.failedCalls} failed
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Call Breakdown */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle>Call Breakdown</CardTitle>
              <CardDescription>Inbound vs Outbound calls</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading data...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <PhoneIncoming className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Inbound Calls</p>
                        <p className="text-sm text-muted-foreground">Received calls</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">
                        {stats.inboundCalls}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {Math.round((stats.inboundCalls / stats.totalCalls) * 100)}%
                      </p>
                    </div>
                  </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <PhoneOutgoing className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Outbound Calls</p>
                      <p className="text-sm text-muted-foreground">Made calls</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">
                      {stats.outboundCalls}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {Math.round((stats.outboundCalls / stats.totalCalls) * 100)}%
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="pt-2">
                  <div className="flex h-3 rounded-full overflow-auto bg-secondary">
                    <div
                      className="bg-green-500 transition-all"
                      style={{
                        width: `${(stats.inboundCalls / stats.totalCalls) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-blue-500 transition-all"
                      style={{
                        width: `${(stats.outboundCalls / stats.totalCalls) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Inbound
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Outbound
                    </span>
                  </div>
                </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle>Call Success</CardTitle>
              <CardDescription>Successful vs Failed calls</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading data...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Successful</p>
                        <p className="text-sm text-muted-foreground">Completed calls</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">
                        {stats.successfulCalls}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <XCircle className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Failed</p>
                        <p className="text-sm text-muted-foreground">Unsuccessful calls</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">
                        {stats.failedCalls}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="pt-2">
                    <div className="flex h-3 rounded-full overflow-auto bg-secondary">
                      <div
                        className="bg-green-500 transition-all"
                        style={{
                          width: `${stats.totalCalls > 0 ? (stats.successfulCalls / stats.totalCalls) * 100 : 0}%`,
                        }}
                      />
                      <div
                        className="bg-red-500 transition-all"
                        style={{
                          width: `${stats.totalCalls > 0 ? (stats.failedCalls / stats.totalCalls) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Success
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Failed
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

    </div>
  );
};

export default UsagePage;
