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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";
import { useNavigate } from "react-router-dom";

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
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "blue" },
    { label: "Total Agents", value: stats.totalAgents, icon: Bot, color: "purple" },
    { label: "Total Calls", value: stats.totalCalls, icon: Phone, color: "green" },
    { label: "Active Calls", value: stats.activeCalls, icon: Activity, color: "amber" },
    { label: "Phone Numbers", value: stats.totalPhoneNumbers, icon: PhoneCall, color: "teal" },
    { label: "Feedback", value: stats.totalFeedback, icon: MessageSquare, color: "rose" },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    teal: "bg-teal-100 text-teal-700",
    rose: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[c.color]?.split(" ")[0]}`}>
                <c.icon className={`w-5 h-5 ${colorMap[c.color]?.split(" ")[1]}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="calls">Calls</TabsTrigger>
          <TabsTrigger value="phones">Phones</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
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
      </Tabs>
    </motion.div>
  );
};

export default AdminPage;
