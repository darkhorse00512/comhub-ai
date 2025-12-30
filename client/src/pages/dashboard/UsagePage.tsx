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
  DollarSign,
} from "lucide-react";

const UsagePage = () => {
  // Mock data - in production this would come from API
  const stats = {
    totalCalls: 156,
    totalMinutes: 423,
    inboundCalls: 89,
    outboundCalls: 67,
    avgCallDuration: "2:43",
    monthlySpend: "$42.50",
  };

  const recentUsage = [
    { date: "Today", calls: 12, minutes: 34 },
    { date: "Yesterday", calls: 18, minutes: 52 },
    { date: "Dec 28", calls: 15, minutes: 41 },
    { date: "Dec 27", calls: 22, minutes: 68 },
    { date: "Dec 26", calls: 9, minutes: 28 },
  ];

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
                    {stats.totalCalls}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <Phone className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-4 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-green-500">+12%</span>
                <span className="text-muted-foreground">vs last month</span>
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
                    {stats.totalMinutes}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Clock className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-4 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-green-500">+8%</span>
                <span className="text-muted-foreground">vs last month</span>
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
                  <p className="text-sm text-muted-foreground">Monthly Spend</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {stats.monthlySpend}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10">
                  <DollarSign className="w-6 h-6 text-green-500" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-4 text-sm">
                <span className="text-muted-foreground">Based on current usage</span>
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
                  <div className="flex h-3 rounded-full overflow-hidden bg-secondary">
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
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Daily call summary</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentUsage.map((day, index) => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{day.date}</p>
                        <p className="text-sm text-muted-foreground">
                          {day.calls} calls
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{day.minutes} min</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Additional Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Key performance indicators for your calls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="text-center p-4 rounded-xl bg-secondary/30">
                <p className="text-sm text-muted-foreground mb-2">
                  Avg. Call Duration
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {stats.avgCallDuration}
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-secondary/30">
                <p className="text-sm text-muted-foreground mb-2">
                  Successful Calls
                </p>
                <p className="text-2xl font-bold text-green-500">94%</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-secondary/30">
                <p className="text-sm text-muted-foreground mb-2">
                  AI Response Rate
                </p>
                <p className="text-2xl font-bold text-blue-500">98%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default UsagePage;
