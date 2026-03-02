import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  MoreVertical,
  Pencil,
  Trash2,
  Phone,
  Copy,
  Check,
  Loader2,
  UserPlus,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";

type GroupRole = "superadmin" | "admin" | "editor" | "viewer";

interface Group {
  id: string;
  name: string;
  description?: string;
  sip_password: string;
  created_at: string;
  phone_count?: number;
  user_role: GroupRole;
}

interface GroupMember {
  id: string;
  user_id: string;
  email: string;
  name?: string;
  role: GroupRole;
  invited_by?: string;
  created_at: string;
}

const ROLE_COLORS: Record<GroupRole, string> = {
  superadmin: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  admin: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  editor: "bg-green-500/20 text-green-400 border-green-500/30",
  viewer: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const ROLE_LABELS: Record<GroupRole, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const GroupsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [membersGroup, setMembersGroup] = useState<Group | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await api.getGroups();
      if (response.error) {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      } else {
        setGroups(response.data || []);
      }
    } catch {
      toast({ title: "Error", description: "Failed to fetch groups", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopied(id);
      toast({ title: "Copied!", description: "Password copied to clipboard" });
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !formData.name.trim()) return;
    setSaving(true);
    try {
      const response = await api.updateGroup(editingGroup.id, {
        name: formData.name,
        description: formData.description,
      });
      if (response.error) {
        toast({ title: "Update Failed", description: response.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Group updated successfully" });
        setEditingGroup(null);
        setFormData({ name: "", description: "" });
        await fetchGroups();
      }
    } catch {
      toast({ title: "Error", description: "Failed to update group", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      const response = await api.deleteGroup(id);
      if (response.error) {
        toast({ title: "Delete Failed", description: response.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Group deleted successfully" });
        setGroups(groups.filter((g) => g.id !== id));
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete group", variant: "destructive" });
    } finally {
      setDeleteConfirm(null);
    }
  };

  const openEditDialog = (group: Group) => {
    setEditingGroup(group);
    setFormData({ name: group.name, description: group.description || "" });
  };

  const canEdit = (role: GroupRole) => ["superadmin", "admin"].includes(role);
  const canDelete = (role: GroupRole) => role === "superadmin";
  const canManageMembers = (role: GroupRole) => ["superadmin", "admin"].includes(role);

  return (
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground mb-2">Groups</h1>
        <p className="text-muted-foreground">
          Manage your groups and their settings
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Groups</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /> : groups.length}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Assigned Numbers</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    ) : (
                      groups.reduce((acc, g) => acc + (g.phone_count || 0), 0)
                    )}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-green-500/10">
                  <Phone className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Groups List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle>Your Groups</CardTitle>
            <CardDescription>Groups you are a member of</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading groups...</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-foreground mb-2">No groups yet</h3>
                <p className="text-sm text-muted-foreground">
                  You haven't been added to any groups yet. Contact your platform administrator.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{group.name}</h3>
                            <Badge variant="outline" className={ROLE_COLORS[group.user_role]}>
                              {ROLE_LABELS[group.user_role]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {group.description || "No description"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canManageMembers(group.user_role) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMembersGroup(group)}
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            Members
                          </Button>
                        )}
                        {(canEdit(group.user_role) || canDelete(group.user_role)) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEdit(group.user_role) && (
                                <DropdownMenuItem onClick={() => openEditDialog(group)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {canDelete(group.user_role) && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteConfirm(group.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {group.phone_count || 0} phone numbers
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        Created {new Date(group.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* SIP Password */}
                    <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">
                            SIP Password (use for SoftPhone configuration)
                          </p>
                          <p className="font-mono text-sm text-foreground break-all">
                            {group.sip_password}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 ml-2"
                          onClick={() => copyToClipboard(group.sip_password, group.id)}
                        >
                          {copied === group.id ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={(open) => !open && setEditingGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>Update the group details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Group Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Sales Team"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Describe the purpose of this group..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <Button onClick={handleUpdateGroup} className="w-full" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this group. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteGroup(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Members Dialog */}
      {membersGroup && (
        <GroupMembersDialog
          group={membersGroup}
          currentUserId={user?.id || ""}
          onClose={() => setMembersGroup(null)}
        />
      )}
    </div>
  );
};

// ===== Group Members Dialog =====
const GroupMembersDialog = ({
  group,
  currentUserId,
  onClose,
}: {
  group: Group;
  currentUserId: string;
  onClose: () => void;
}) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<GroupRole>("viewer");
  const [adding, setAdding] = useState(false);

  const isSuperadmin = group.user_role === "superadmin";

  useEffect(() => {
    fetchMembers();
  }, [group.id]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response = await api.getGroupMembers(group.id);
      if (response.data) {
        setMembers(response.data);
      }
    } catch {
      toast({ title: "Error", description: "Failed to fetch members", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!addEmail.trim()) return;
    setAdding(true);
    try {
      const response = await api.addGroupMember(group.id, addEmail.trim(), addRole);
      if (response.error) {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Member added successfully" });
        setAddEmail("");
        setAddRole("viewer");
        await fetchMembers();
      }
    } catch {
      toast({ title: "Error", description: "Failed to add member", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const response = await api.updateGroupMemberRole(group.id, userId, newRole);
      if (response.error) {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      } else {
        setMembers((prev) =>
          prev.map((m) => (m.user_id === userId ? { ...m, role: newRole as GroupRole } : m))
        );
        toast({ title: "Success", description: "Role updated" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update role", variant: "destructive" });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const response = await api.removeGroupMember(group.id, userId);
      if (response.error) {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      } else {
        setMembers((prev) => prev.filter((m) => m.user_id !== userId));
        toast({ title: "Success", description: "Member removed" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to remove member", variant: "destructive" });
    }
  };

  const canEditMember = (memberRole: GroupRole) => {
    if (memberRole === "superadmin" && !isSuperadmin) return false;
    return true;
  };

  const availableRoles: GroupRole[] = isSuperadmin
    ? ["superadmin", "admin", "editor", "viewer"]
    : ["admin", "editor", "viewer"];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Members — {group.name}</DialogTitle>
          <DialogDescription>Manage group members and their roles</DialogDescription>
        </DialogHeader>

        {/* Add Member Form */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label htmlFor="add-email" className="text-xs text-muted-foreground">
              Email
            </Label>
            <Input
              id="add-email"
              placeholder="user@example.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
            />
          </div>
          <div className="w-36">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Select value={addRole} onValueChange={(v) => setAddRole(v as GroupRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAddMember} disabled={adding || !addEmail.trim()}>
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          </Button>
        </div>

        {/* Members Table */}
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-muted-foreground mx-auto animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isCurrentUser = member.user_id === currentUserId;
                const editable = canEditMember(member.role) && !isCurrentUser;

                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <span className="text-sm">{member.email}</span>
                        {isCurrentUser && (
                          <span className="text-xs text-muted-foreground ml-2">(you)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {editable ? (
                        <Select
                          value={member.role}
                          onValueChange={(v) => handleRoleChange(member.user_id, v)}
                        >
                          <SelectTrigger className="w-36 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={ROLE_COLORS[member.role]}>
                          {ROLE_LABELS[member.role]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {editable && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveMember(member.user_id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No members yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GroupsPage;
