import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Bot,
  Phone,
  Activity,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  PhoneCall,
  Eye,
  EyeOff,
  Volume2,
  Save,
  Check,
  Plus,
  Pencil,
  ImagePlus,
  Play,
  Pause,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

// ===== Types =====
interface AdminUser {
  id: string;
  email: string;
  createdAt: string;
  is_admin: boolean;
  agentCount: number;
  callCount: number;
}

interface AdminStats {
  totalUsers: number;
  totalAgents: number;
  totalCalls: number;
  activeCalls: number;
  totalPhoneNumbers: number;
  totalFeedback: number;
}

// ===== Pagination Component =====
const Pagination = ({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

// ===== Overview Tab =====
const OverviewTab = ({ stats, loading }: { stats: AdminStats | null; loading: boolean }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!stats) return null;

  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, iconBg: "bg-blue-500/10", iconColor: "text-blue-500" },
    { label: "Total Agents", value: stats.totalAgents, icon: Bot, iconBg: "bg-purple-500/10", iconColor: "text-purple-500" },
    { label: "Total Calls", value: stats.totalCalls, icon: Phone, iconBg: "bg-green-500/10", iconColor: "text-green-500" },
    { label: "Active Calls", value: stats.activeCalls, icon: Activity, iconBg: "bg-amber-500/10", iconColor: "text-amber-500" },
    { label: "Phone Numbers", value: stats.totalPhoneNumbers, icon: PhoneCall, iconBg: "bg-teal-500/10", iconColor: "text-teal-500" },
    { label: "Feedback", value: stats.totalFeedback, icon: MessageSquare, iconBg: "bg-rose-500/10", iconColor: "text-rose-500" },
  ];

  // Bar chart data
  const barData = [
    { name: "Users", value: stats.totalUsers, fill: "hsl(217, 91%, 60%)" },
    { name: "Agents", value: stats.totalAgents, fill: "hsl(271, 91%, 65%)" },
    { name: "Calls", value: stats.totalCalls, fill: "hsl(142, 71%, 45%)" },
    { name: "Active", value: stats.activeCalls, fill: "hsl(38, 92%, 50%)" },
    { name: "Phones", value: stats.totalPhoneNumbers, fill: "hsl(172, 66%, 50%)" },
    { name: "Feedback", value: stats.totalFeedback, fill: "hsl(350, 89%, 60%)" },
  ];

  const barChartConfig: ChartConfig = {
    value: { label: "Count" },
  };

  // Distribution donut data
  const distributionData = [
    { name: "Users", value: stats.totalUsers, fill: "hsl(217, 91%, 60%)" },
    { name: "Agents", value: stats.totalAgents, fill: "hsl(271, 91%, 65%)" },
    { name: "Phone Numbers", value: stats.totalPhoneNumbers, fill: "hsl(172, 66%, 50%)" },
    { name: "Feedback", value: stats.totalFeedback, fill: "hsl(350, 89%, 60%)" },
  ].filter((d) => d.value > 0);

  const distributionConfig: ChartConfig = {
    Users: { label: "Users", color: "hsl(217, 91%, 60%)" },
    Agents: { label: "Agents", color: "hsl(271, 91%, 65%)" },
    "Phone Numbers": { label: "Phone Numbers", color: "hsl(172, 66%, 50%)" },
    Feedback: { label: "Feedback", color: "hsl(350, 89%, 60%)" },
  };

  // Call activity donut
  const callActivityData = [
    { name: "Active", value: stats.activeCalls || 0, fill: "hsl(38, 92%, 50%)" },
    { name: "Completed", value: Math.max(0, stats.totalCalls - stats.activeCalls), fill: "hsl(142, 71%, 45%)" },
  ].filter((d) => d.value > 0);

  const callActivityConfig: ChartConfig = {
    Active: { label: "Active Calls", color: "hsl(38, 92%, 50%)" },
    Completed: { label: "Completed", color: "hsl(142, 71%, 45%)" },
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${c.iconBg}`}>
                  <c.icon className={`w-5 h-5 ${c.iconColor}`} />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">{c.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Bar Chart - Platform Metrics */}
        <Card className="bg-card/50 backdrop-blur border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Platform Metrics</CardTitle>
            <CardDescription>Overview of key platform statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barChartConfig} className="h-[300px] w-full">
              <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Donut Chart - Resource Distribution */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Resource Distribution</CardTitle>
            <CardDescription>Users, Agents, Phones & Feedback</CardDescription>
          </CardHeader>
          <CardContent>
            {distributionData.length > 0 ? (
              <ChartContainer config={distributionConfig} className="h-[300px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie
                    data={distributionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    strokeWidth={0}
                  />
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                No data to display
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Call Activity Donut */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Call Activity</CardTitle>
            <CardDescription>Active vs Completed calls</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.totalCalls > 0 ? (
              <ChartContainer config={callActivityConfig} className="h-[250px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie
                    data={callActivityData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {callActivityData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                No calls recorded yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Summary Cards */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Quick Summary</CardTitle>
            <CardDescription>Key ratios and insights</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Bot className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Agents per User</p>
                  <p className="text-sm text-muted-foreground">Average agents created</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stats.totalUsers > 0 ? (stats.totalAgents / stats.totalUsers).toFixed(1) : "0"}
              </p>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Phone className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Calls per User</p>
                  <p className="text-sm text-muted-foreground">Average calls made</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stats.totalUsers > 0 ? (stats.totalCalls / stats.totalUsers).toFixed(1) : "0"}
              </p>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Activity className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Active Rate</p>
                  <p className="text-sm text-muted-foreground">Currently active calls</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stats.totalCalls > 0
                  ? `${((stats.activeCalls / stats.totalCalls) * 100).toFixed(1)}%`
                  : "0%"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ===== Users Tab =====
const UsersTab = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const limit = 20;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const result = await api.getAdminUsers(page, limit, search);
    if (result.data) {
      setUsers(result.data.users);
      setTotalUsers(result.data.total);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleSearch = () => { setPage(1); setSearch(searchInput); };

  const handleToggleAdmin = async (user: AdminUser) => {
    const result = await api.toggleUserAdmin(user.id);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Admin status updated", description: `${user.email} is ${result.data?.is_admin ? "now" : "no longer"} an admin.` });
      loadUsers();
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog) return;
    setDeleting(true);
    const result = await api.deleteUserAdmin(deleteDialog.id);
    setDeleting(false);
    setDeleteDialog(null);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "User deleted", description: `${deleteDialog.email} has been removed.` });
      loadUsers();
    }
  };

  const totalPages = Math.ceil(totalUsers / limit);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">User Management</CardTitle>
            <CardDescription>{totalUsers} user{totalUsers !== 1 ? "s" : ""} registered</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadUsers}>
            <RefreshCw className="w-4 h-4 mr-1.5" />Refresh
          </Button>
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Search by email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-sm"
          />
          <Button variant="secondary" size="sm" onClick={handleSearch}>
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No users found.</div>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-center">Agents</TableHead>
                    <TableHead className="text-center">Calls</TableHead>
                    <TableHead className="text-center">Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(u.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-center">{u.agentCount}</TableCell>
                      <TableCell className="text-center">{u.callCount}</TableCell>
                      <TableCell className="text-center">
                        {u.is_admin ? (
                          <Badge variant="default" className="bg-purple-600">Admin</Badge>
                        ) : (
                          <Badge variant="secondary">User</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleToggleAdmin(u)} title={u.is_admin ? "Remove admin" : "Make admin"}>
                            {u.is_admin ? <ShieldOff className="w-4 h-4 text-amber-600" /> : <Shield className="w-4 h-4 text-purple-600" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteDialog(u)} title="Delete user">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </CardContent>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteDialog?.email}</strong>? This will permanently remove their account and all associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              {deleting ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// ===== Agents Tab =====
const AgentsTab = () => {
  const { toast } = useToast();
  const [agents, setAgents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const limit = 20;

  const loadAgents = useCallback(async () => {
    setLoading(true);
    const result = await api.getAdminAgents(page, limit, search);
    if (result.data) {
      setAgents(result.data.agents);
      setTotal(result.data.total);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleSearch = () => { setPage(1); setSearch(searchInput); };

  const handleDeleteAgent = async () => {
    if (!deleteDialog) return;
    setDeleting(true);
    const result = await api.deleteAdminAgent(deleteDialog.id);
    setDeleting(false);
    setDeleteDialog(null);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Agent deleted", description: `${deleteDialog.name} has been removed.` });
      loadAgents();
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Agent Management</CardTitle>
            <CardDescription>{total} agent{total !== 1 ? "s" : ""} total</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadAgents}>
            <RefreshCw className="w-4 h-4 mr-1.5" />Refresh
          </Button>
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Search by name or owner email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-sm"
          />
          <Button variant="secondary" size="sm" onClick={handleSearch}>
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No agents found.</div>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.ownerEmail}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {a.description || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(a.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDeleteDialog(a)} title="Delete agent">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </CardContent>

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Agent
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete agent <strong>{deleteDialog?.name}</strong> (owned by {deleteDialog?.ownerEmail})? This will permanently remove the agent and all its version history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteAgent} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              {deleting ? "Deleting..." : "Delete Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// ===== Calls Tab =====
const CallsTab = () => {
  const [calls, setCalls] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const loadCalls = useCallback(async () => {
    setLoading(true);
    const result = await api.getAdminCalls(page, limit, statusFilter, directionFilter);
    if (result.data) {
      setCalls(result.data.calls);
      setTotal(result.data.total);
    }
    setLoading(false);
  }, [page, statusFilter, directionFilter]);

  useEffect(() => { loadCalls(); }, [loadCalls]);

  const totalPages = Math.ceil(total / limit);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-green-600";
      case "ended": return "bg-gray-500";
      case "failed": return "bg-red-600";
      case "ringing": return "bg-amber-500";
      default: return "bg-gray-400";
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Call Sessions</CardTitle>
            <CardDescription>{total} call{total !== 1 ? "s" : ""} total</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadCalls}>
            <RefreshCw className="w-4 h-4 mr-1.5" />Refresh
          </Button>
        </div>
        <div className="flex gap-3 mt-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="ringing">Ringing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={directionFilter} onValueChange={(v) => { setDirectionFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Direction</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No calls found.</div>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Caller</TableHead>
                    <TableHead>Callee</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{c.userEmail}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {c.direction || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusColor(c.status)} text-white text-xs`}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.callerNumber || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.calleeNumber || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.startedAt ? format(new Date(c.startedAt), "MMM d, HH:mm") : "-"}
                      </TableCell>
                      <TableCell className="text-sm">{formatDuration(c.duration)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

// ===== Phone Numbers Tab =====
const PhoneNumbersTab = () => {
  const [phones, setPhones] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const loadPhones = useCallback(async () => {
    setLoading(true);
    const result = await api.getAdminPhoneNumbers(page, limit);
    if (result.data) {
      setPhones(result.data.phoneNumbers);
      setTotal(result.data.total);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { loadPhones(); }, [loadPhones]);

  const totalPages = Math.ceil(total / limit);

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Phone Numbers</CardTitle>
            <CardDescription>{total} phone number{total !== 1 ? "s" : ""} total</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadPhones}>
            <RefreshCw className="w-4 h-4 mr-1.5" />Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : phones.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No phone numbers found.</div>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phones.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium font-mono">{p.phoneNumber}</TableCell>
                      <TableCell className="text-sm">{p.country || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={p.type === "purchased" ? "default" : "outline"} className="text-xs">
                          {p.type || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.ownerEmail}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "active" ? "default" : "secondary"} className="text-xs">
                          {p.status || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.createdAt ? format(new Date(p.createdAt), "MMM d, yyyy") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

// ===== Feedback Tab =====
const FeedbackTab = () => {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [viewDialog, setViewDialog] = useState<any | null>(null);
  const limit = 20;

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    const result = await api.getAdminFeedback(page, limit, typeFilter, statusFilter);
    if (result.data) {
      setFeedback(result.data.feedback);
      setTotal(result.data.total);
    }
    setLoading(false);
  }, [page, typeFilter, statusFilter]);

  useEffect(() => { loadFeedback(); }, [loadFeedback]);

  const handleStatusChange = async (feedbackId: string, newStatus: string) => {
    const result = await api.updateAdminFeedbackStatus(feedbackId, newStatus);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Status updated" });
      loadFeedback();
    }
  };

  const totalPages = Math.ceil(total / limit);

  const typeColor = (t: string) => {
    switch (t) {
      case "bug": return "bg-red-600 text-white";
      case "feature": return "bg-blue-600 text-white";
      case "improvement": return "bg-purple-600 text-white";
      case "question": return "bg-amber-500 text-white";
      default: return "";
    }
  };

  const fbStatusColor = (s: string) => {
    switch (s) {
      case "new": return "bg-blue-600 text-white";
      case "reviewed": return "bg-amber-500 text-white";
      case "resolved": return "bg-green-600 text-white";
      default: return "";
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Feedback Management</CardTitle>
            <CardDescription>{total} feedback item{total !== 1 ? "s" : ""} total</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadFeedback}>
            <RefreshCw className="w-4 h-4 mr-1.5" />Refresh
          </Button>
        </div>
        <div className="flex gap-3 mt-2">
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="feature">Feature</SelectItem>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="improvement">Improvement</SelectItem>
              <SelectItem value="question">Question</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : feedback.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No feedback found.</div>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedback.map((f: any) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-sm">{f.userEmail}</TableCell>
                      <TableCell>
                        <Badge className={`${typeColor(f.type)} text-xs`}>{f.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{f.subject}</TableCell>
                      <TableCell>
                        <Select value={f.status} onValueChange={(v) => handleStatusChange(f.id, v)}>
                          <SelectTrigger className="h-7 w-[110px]">
                            <Badge className={`${fbStatusColor(f.status)} text-xs`}>{f.status}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="reviewed">Reviewed</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {f.createdAt ? format(new Date(f.createdAt), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setViewDialog(f)} title="View message">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </CardContent>

      <Dialog open={!!viewDialog} onOpenChange={() => setViewDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              {viewDialog?.subject}
            </DialogTitle>
            <DialogDescription>
              From {viewDialog?.userEmail} &middot; {viewDialog?.createdAt ? format(new Date(viewDialog.createdAt), "MMM d, yyyy HH:mm") : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div className="flex gap-2">
              <Badge className={`${typeColor(viewDialog?.type)} text-xs`}>{viewDialog?.type}</Badge>
              <Badge className={`${fbStatusColor(viewDialog?.status)} text-xs`}>{viewDialog?.status}</Badge>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
              {viewDialog?.message}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// ===== Voice Tab (Voice Models CRUD) =====
interface VoiceModel {
  id: string;
  name: string;
  elevenlabs_voice_id: string;
  elevenlabs_api_key: string;
  model: string;
  image_url: string | null;
  preview_audio_url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

const VoiceTab = () => {
  const { toast } = useToast();

  // --- Voice Models state ---
  const [models, setModels] = useState<VoiceModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelDialog, setModelDialog] = useState<{ mode: "add" | "edit"; model?: VoiceModel } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<VoiceModel | null>(null);
  const [modelSaving, setModelSaving] = useState(false);
  const [playingModelId, setPlayingModelId] = useState<string | null>(null);
  const [audioElRef] = useState<{ current: HTMLAudioElement | null }>({ current: null });

  // --- Model form state ---
  const [formName, setFormName] = useState("");
  const [formVoiceId, setFormVoiceId] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formShowApiKey, setFormShowApiKey] = useState(false);
  const [formModel, setFormModel] = useState("eleven_multilingual_v2");
  const [formDescription, setFormDescription] = useState("");
  const [formImage, setFormImage] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [formAudio, setFormAudio] = useState<File | null>(null);
  const [formAudioName, setFormAudioName] = useState<string | null>(null);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    const result = await api.getVoiceModels();
    if (result.data) {
      setModels(result.data);
    }
    setModelsLoading(false);
  }, []);

  useEffect(() => { loadModels(); }, [loadModels]);

  const openAddDialog = () => {
    setFormName("");
    setFormVoiceId("");
    setFormApiKey("");
    setFormShowApiKey(false);
    setFormModel("eleven_multilingual_v2");
    setFormDescription("");
    setFormImage(null);
    setFormImagePreview(null);
    setFormAudio(null);
    setFormAudioName(null);
    setModelDialog({ mode: "add" });
  };

  const openEditDialog = (model: VoiceModel) => {
    setFormName(model.name);
    setFormVoiceId(model.elevenlabs_voice_id);
    setFormApiKey(model.elevenlabs_api_key);
    setFormShowApiKey(false);
    setFormModel(model.model);
    setFormDescription(model.description || "");
    setFormImage(null);
    setFormImagePreview(model.image_url);
    setFormAudio(null);
    setFormAudioName(model.preview_audio_url ? "Current audio uploaded" : null);
    setModelDialog({ mode: "edit", model });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormImage(file);
      const reader = new FileReader();
      reader.onload = () => setFormImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormAudio(file);
      setFormAudioName(file.name);
    }
  };

  const handlePlayPreview = (modelId: string, audioUrl: string) => {
    // If clicking the same model that's playing, pause it
    if (playingModelId === modelId && audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
      setPlayingModelId(null);
      return;
    }
    // Stop any currently playing audio
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    const audio = new Audio(audioUrl);
    audio.onended = () => {
      setPlayingModelId(null);
      audioElRef.current = null;
    };
    audio.play();
    audioElRef.current = audio;
    setPlayingModelId(modelId);
  };

  const handleSaveModel = async () => {
    if (!formName.trim() || !formVoiceId.trim()) {
      toast({ title: "Missing fields", description: "Name and Voice ID are required.", variant: "destructive" });
      return;
    }
    if (modelDialog?.mode === "add" && !formApiKey.trim()) {
      toast({ title: "Missing fields", description: "API key is required for new voice models.", variant: "destructive" });
      return;
    }

    setModelSaving(true);
    const formData = new FormData();
    formData.append("name", formName.trim());
    formData.append("elevenlabs_voice_id", formVoiceId.trim());
    if (formApiKey.trim()) formData.append("elevenlabs_api_key", formApiKey.trim());
    formData.append("model", formModel);
    if (formDescription.trim()) formData.append("description", formDescription.trim());
    if (formImage) formData.append("image", formImage);
    if (formAudio) formData.append("preview_audio", formAudio);

    const result = modelDialog?.mode === "add"
      ? await api.createVoiceModel(formData)
      : await api.updateVoiceModel(modelDialog!.model!.id, formData);

    setModelSaving(false);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
      toast({ title: modelDialog?.mode === "add" ? "Voice model created" : "Voice model updated" });
      setModelDialog(null);
      loadModels();
    }
  };

  const handleDeleteModel = async () => {
    if (!deleteDialog) return;
    setModelSaving(true);
    const result = await api.deleteVoiceModel(deleteDialog.id);
    setModelSaving(false);
    if (result.error) {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Voice model deleted" });
      setDeleteDialog(null);
      loadModels();
    }
  };

  return (
    <div className="space-y-6">
      {/* Voice Models */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Volume2 className="w-5 h-5 text-primary" />
                Voice Models
              </CardTitle>
              <CardDescription>
                Manage voice models available to agents on the platform
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadModels}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button size="sm" onClick={openAddDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Voice Model
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {modelsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : models.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Volume2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No voice models yet. Click "Add Voice Model" to create one.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {models.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-border bg-background/50 overflow-hidden hover:border-primary/30 transition-colors"
                >
                  {/* Image */}
                  <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
                    {m.image_url ? (
                      <img
                        src={m.image_url}
                        alt={m.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Volume2 className="w-10 h-10 text-muted-foreground/30" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm text-foreground">{m.name}</h4>
                      <div className="flex gap-1 shrink-0">
                        {m.preview_audio_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handlePlayPreview(m.id, m.preview_audio_url!)}
                            title={playingModelId === m.id ? "Pause preview" : "Play preview"}
                          >
                            {playingModelId === m.id ? (
                              <Pause className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(m)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteDialog(m)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {m.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>
                    )}
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/60">Voice ID:</span>
                        <span className="font-mono truncate">{m.elevenlabs_voice_id}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/60">API Key:</span>
                        <span className="font-mono">{m.elevenlabs_api_key}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/60">Model:</span>
                        <span>{m.model}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={!!modelDialog} onOpenChange={(open) => !open && setModelDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{modelDialog?.mode === "add" ? "Add Voice Model" : "Edit Voice Model"}</DialogTitle>
            <DialogDescription>
              {modelDialog?.mode === "add"
                ? "Create a new voice model with ElevenLabs credentials"
                : "Update voice model settings"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Image upload */}
            <div className="space-y-2">
              <Label>Model Image</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                  {formImagePreview ? (
                    <img src={formImagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImagePlus className="w-6 h-6 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageSelect}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, or GIF. Max 5MB.</p>
                </div>
              </div>
            </div>

            {/* Audio preview upload */}
            <div className="space-y-2">
              <Label>Voice Preview Audio</Label>
              <Input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
                onChange={handleAudioSelect}
                className="text-sm"
              />
              {formAudioName && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="w-3 h-3" /> {formAudioName}
                </p>
              )}
              <p className="text-xs text-muted-foreground">MP3, WAV, or M4A. Max 15MB. Used as voice preview for users.</p>
            </div>

            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Rachel - Professional"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ElevenLabs Voice ID *</Label>
                <Input
                  placeholder="Voice ID from ElevenLabs"
                  value={formVoiceId}
                  onChange={(e) => setFormVoiceId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={formModel} onValueChange={setFormModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eleven_multilingual_v2">Multilingual v2</SelectItem>
                    <SelectItem value="eleven_turbo_v2">Turbo v2</SelectItem>
                    <SelectItem value="eleven_turbo_v2_5">Turbo v2.5</SelectItem>
                    <SelectItem value="eleven_monolingual_v1">Monolingual v1</SelectItem>
                    <SelectItem value="eleven_flash_v2_5">Flash v2.5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>ElevenLabs API Key *</Label>
              <div className="relative">
                <Input
                  type={formShowApiKey ? "text" : "password"}
                  placeholder={modelDialog?.mode === "edit" ? "Leave blank to keep current key" : "Enter API key"}
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setFormShowApiKey(!formShowApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {formShowApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description of this voice model..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModelDialog(null)}>Cancel</Button>
            <Button onClick={handleSaveModel} disabled={modelSaving} className="gap-2">
              {modelSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {modelSaving ? "Saving..." : modelDialog?.mode === "add" ? "Create" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Voice Model</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteDialog?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteModel} disabled={modelSaving} className="gap-2">
              {modelSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {modelSaving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ===== Main AdminPage =====
const AdminPage = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const result = await api.getAdminStats();
    if (result.data) setStats(result.data);
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }
    loadStats();
  }, [isAdmin, navigate, loadStats]);

  if (!isAdmin) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage users, agents, calls, and platform data</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="calls">Calls</TabsTrigger>
          <TabsTrigger value="phones">Phones</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab stats={stats} loading={statsLoading} />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>

        <TabsContent value="agents">
          <AgentsTab />
        </TabsContent>

        <TabsContent value="calls">
          <CallsTab />
        </TabsContent>

        <TabsContent value="phones">
          <PhoneNumbersTab />
        </TabsContent>

        <TabsContent value="feedback">
          <FeedbackTab />
        </TabsContent>

        <TabsContent value="voice">
          <VoiceTab />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default AdminPage;
