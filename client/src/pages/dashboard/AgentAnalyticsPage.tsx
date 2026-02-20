import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format, subDays, differenceInSeconds } from "date-fns";
import {
  BarChart3,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, AgentCallHistoryItem } from "@/services/api";
import AgentLayout from "@/components/agent/AgentLayout";

interface DailyStats {
  date: string;
  total: number;
  inbound: number;
  outbound: number;
  successful: number;
  failed: number;
}

const AgentAnalyticsPage = () => {
  return (
    <AgentLayout>
      {(agent) => <AnalyticsContent agentId={agent.id} agentName={agent.name} />}
    </AgentLayout>
  );
};

const AnalyticsContent = ({ agentId, agentName }: { agentId: string; agentName: string }) => {
  const [calls, setCalls] = useState<AgentCallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalls();
  }, [agentId]);

  const fetchCalls = async () => {
    setLoading(true);
    const result = await api.getAgentCallHistory(agentId);
    if (result.data) {
      setCalls(result.data);
    }
    setLoading(false);
  };

  // Calculate stats
  const totalCalls = calls.length;
  const inboundCalls = calls.filter((c) => c.direction === "inbound").length;
  const outboundCalls = calls.filter((c) => c.direction === "outbound").length;
  const successfulCalls = calls.filter((c) => c.status === "ended").length;
  const failedCalls = calls.filter((c) => c.status === "failed").length;
  const activeCalls = calls.filter((c) => c.status === "active").length;
  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;
  const totalMessages = calls.reduce((sum, c) => sum + c.messageCount, 0);
  const avgMessages = totalCalls > 0 ? Math.round(totalMessages / totalCalls) : 0;

  // Average duration (only for ended calls)
  const endedCalls = calls.filter((c) => c.endedAt);
  const totalDuration = endedCalls.reduce((sum, c) => {
    return sum + differenceInSeconds(new Date(c.endedAt!), new Date(c.startedAt));
  }, 0);
  const avgDuration = endedCalls.length > 0 ? Math.round(totalDuration / endedCalls.length) : 0;
  const avgMinutes = Math.floor(avgDuration / 60);
  const avgSeconds = avgDuration % 60;

  // Daily stats for last 7 days
  const dailyStats: DailyStats[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = subDays(new Date(), i);
    const dayStr = format(day, "yyyy-MM-dd");
    const dayCalls = calls.filter((c) => format(new Date(c.startedAt), "yyyy-MM-dd") === dayStr);
    dailyStats.push({
      date: format(day, "EEE, MMM d"),
      total: dayCalls.length,
      inbound: dayCalls.filter((c) => c.direction === "inbound").length,
      outbound: dayCalls.filter((c) => c.direction === "outbound").length,
      successful: dayCalls.filter((c) => c.status === "ended").length,
      failed: dayCalls.filter((c) => c.status === "failed").length,
    });
  }

  const maxDailyCalls = Math.max(...dailyStats.map((d) => d.total), 1);

  // Collected data field frequency
  const fieldFrequency: Record<string, number> = {};
  calls.forEach((call) => {
    if (call.collectedData) {
      Object.keys(call.collectedData).forEach((key) => {
        fieldFrequency[key] = (fieldFrequency[key] || 0) + 1;
      });
    }
  });
  const topFields = Object.entries(fieldFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              Analytics
            </h2>
            <p className="text-muted-foreground mt-1">
              Performance metrics for {agentName}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCalls}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalCalls}</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{successRate}%</p>
                  <p className="text-xs text-muted-foreground">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {avgMinutes}:{avgSeconds.toString().padStart(2, "0")}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{avgMessages}</p>
                  <p className="text-xs text-muted-foreground">Avg Messages/Call</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Direction Breakdown + Status Breakdown */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Call Direction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PhoneIncoming className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Inbound</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${totalCalls > 0 ? (inboundCalls / totalCalls) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{inboundCalls}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PhoneOutgoing className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Outbound</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${totalCalls > 0 ? (outboundCalls / totalCalls) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{outboundCalls}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Call Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Successful</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{successfulCalls}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm">Failed</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${totalCalls > 0 ? (failedCalls / totalCalls) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{failedCalls}</span>
                  </div>
                </div>
                {activeCalls > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-500 animate-pulse" />
                      <span className="text-sm">Active</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(activeCalls / totalCalls) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{activeCalls}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Activity Chart */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Daily Activity (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalCalls === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No call data yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dailyStats.map((day) => (
                  <div key={day.date} className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">{day.date}</span>
                    <div className="flex-1 flex items-center gap-1">
                      {day.inbound > 0 && (
                        <div
                          className="h-6 bg-blue-500 rounded-sm transition-all"
                          style={{ width: `${(day.inbound / maxDailyCalls) * 100}%`, minWidth: day.inbound > 0 ? "8px" : "0" }}
                          title={`${day.inbound} inbound`}
                        />
                      )}
                      {day.outbound > 0 && (
                        <div
                          className="h-6 bg-green-500 rounded-sm transition-all"
                          style={{ width: `${(day.outbound / maxDailyCalls) * 100}%`, minWidth: day.outbound > 0 ? "8px" : "0" }}
                          title={`${day.outbound} outbound`}
                        />
                      )}
                      {day.total === 0 && (
                        <div className="h-6 bg-secondary/50 rounded-sm w-1" />
                      )}
                    </div>
                    <span className="text-xs font-medium w-6 text-right">{day.total}</span>
                  </div>
                ))}
                <div className="flex items-center gap-4 pt-2 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-3 h-3 bg-blue-500 rounded-sm" />
                    Inbound
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-3 h-3 bg-green-500 rounded-sm" />
                    Outbound
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collected Data Fields */}
        {topFields.length > 0 && (
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Most Collected Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topFields.map(([field, count]) => (
                  <div key={field} className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono text-xs">
                      {field}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {count} call{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
};

export default AgentAnalyticsPage;
