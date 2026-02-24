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
  Phone,
  Clock,
  PhoneIncoming,
  PhoneOutgoing,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { PieChart, Pie, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

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

      {/* Charts Row */}
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
              ) : stats.totalCalls > 0 ? (
                <div className="space-y-4">
                  <ChartContainer
                    config={{
                      Inbound: { label: "Inbound", color: "hsl(142, 71%, 45%)" },
                      Outbound: { label: "Outbound", color: "hsl(217, 91%, 60%)" },
                    } satisfies ChartConfig}
                    className="h-[220px] w-full"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={[
                          { name: "Inbound", value: stats.inboundCalls, fill: "hsl(142, 71%, 45%)" },
                          { name: "Outbound", value: stats.outboundCalls, fill: "hsl(217, 91%, 60%)" },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        <Cell fill="hsl(142, 71%, 45%)" />
                        <Cell fill="hsl(217, 91%, 60%)" />
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                  </ChartContainer>

                  {/* Detail rows */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <PhoneIncoming className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">{stats.inboundCalls}</p>
                        <p className="text-xs text-muted-foreground">
                          Inbound ({stats.totalCalls > 0 ? Math.round((stats.inboundCalls / stats.totalCalls) * 100) : 0}%)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <PhoneOutgoing className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">{stats.outboundCalls}</p>
                        <p className="text-xs text-muted-foreground">
                          Outbound ({stats.totalCalls > 0 ? Math.round((stats.outboundCalls / stats.totalCalls) * 100) : 0}%)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  No calls recorded yet
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
              ) : stats.totalCalls > 0 ? (
                <div className="space-y-4">
                  <ChartContainer
                    config={{
                      Successful: { label: "Successful", color: "hsl(142, 71%, 45%)" },
                      Failed: { label: "Failed", color: "hsl(0, 84%, 60%)" },
                    } satisfies ChartConfig}
                    className="h-[220px] w-full"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={[
                          { name: "Successful", value: stats.successfulCalls, fill: "hsl(142, 71%, 45%)" },
                          { name: "Failed", value: stats.failedCalls, fill: "hsl(0, 84%, 60%)" },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        <Cell fill="hsl(142, 71%, 45%)" />
                        <Cell fill="hsl(0, 84%, 60%)" />
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                  </ChartContainer>

                  {/* Detail rows */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">{stats.successfulCalls}</p>
                        <p className="text-xs text-muted-foreground">Successful</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <XCircle className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-foreground">{stats.failedCalls}</p>
                        <p className="text-xs text-muted-foreground">Failed</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  No calls recorded yet
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
