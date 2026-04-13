import { Fragment, useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Shield,
  User,
  Plus,
  Search,
  MoreVertical,
  Mail,
  Edit,
  Trash2,
  Eye,
  Key,
  Loader2,
  ChevronDown,
  ChevronRight,
  Users as UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiClient } from "@/services/api-client";

interface SystemUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branchId: string;
}

interface AdminWithManagers {
  admin: SystemUser;
  branchId: string | null;
  managers: SystemUser[];
}

const roleConfig: Record<string, { label: string; color: string }> = {
  admin: { label: "School Owner", color: "bg-primary/15 text-primary" },
  manager: { label: "Manager", color: "bg-status-info/15 text-status-info" },
  teacher: { label: "Teacher", color: "bg-status-healthy/15 text-status-healthy" },
  accountant: { label: "Accountant", color: "bg-accent text-accent-foreground" },
  branch_admin: { label: "Branch Admin", color: "bg-primary/10 text-primary" },
};

function getRoleDisplay(role: string) {
  return roleConfig[role] ?? { label: role, color: "bg-accent text-accent-foreground" };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const emptyForm = { fullName: "", email: "", role: "teacher", branchId: "", password: "" };

export default function Users() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [adminGroups, setAdminGroups] = useState<AdminWithManagers[]>([]);
  const [expandedAdmins, setExpandedAdmins] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState(emptyForm);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const [allUsers, branches] = await Promise.all([
        apiClient.getUsers(),
        apiClient.getBranches(),
      ]);
      type RawUser = { id?: string; email?: string; fullName?: string; role?: string; branchId?: string; branch_id?: string };
      const usersArr: SystemUser[] = Array.isArray(allUsers)
        ? (allUsers as RawUser[]).map((u) => ({
            id: u.id ?? "",
            email: u.email ?? "",
            fullName: u.fullName ?? "",
            role: u.role ?? "",
            branchId: u.branchId ?? u.branch_id ?? "",
          }))
        : [];
      type RawBranch = { id?: string; adminId?: string; admin_id?: string };
      const branchesArr: RawBranch[] = Array.isArray(branches) ? (branches as RawBranch[]) : [];

      setUsers(usersArr);

      // Build branchId lookup by admin id once to avoid repeated scans
      const branchByAdminId = new Map<string, string>();
      for (const branch of branchesArr) {
        const adminId = branch?.adminId ?? branch?.admin_id;
        if (adminId && branch?.id) {
          branchByAdminId.set(String(adminId), String(branch.id));
        }
      }

      // Build managers lookup by branch id from already fetched users
      const managersByBranchId = new Map<string, SystemUser[]>();
      for (const user of usersArr) {
        if (user.role !== "manager" || !user.branchId) continue;
        const existing = managersByBranchId.get(user.branchId) ?? [];
        existing.push(user);
        managersByBranchId.set(user.branchId, existing);
      }

      // Build admin → branch → managers grouping in-memory (no N+1 API calls)
      const admins = usersArr.filter((u) => u.role === "admin");
      const groups: AdminWithManagers[] = admins.map((admin) => {
        const branchId = branchByAdminId.get(admin.id) ?? null;
        const managers = branchId ? managersByBranchId.get(branchId) ?? [] : [];
        return { admin, branchId, managers };
      });
      setAdminGroups(groups);
      // Avoid rendering a huge expanded tree on first paint for large datasets
      const defaultExpanded = admins.length <= 5 ? admins.map((a) => a.id) : [];
      setExpandedAdmins(new Set(defaultExpanded));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleExpand = (adminId: string) => {
    setExpandedAdmins((prev) => {
      const next = new Set(prev);
      if (next.has(adminId)) next.delete(adminId);
      else next.add(adminId);
      return next;
    });
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async () => {
    try {
      setSubmitting(true);
      await apiClient.register({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        role: formData.role,
        branchId: formData.branchId,
      });
      toast.success("User created successfully");
      setIsAddModalOpen(false);
      setFormData(emptyForm);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    try {
      setSubmitting(true);
      await apiClient.updateUser(selectedUser.id, {
        fullName: formData.fullName,
        email: formData.email,
        role: formData.role,
        branchId: formData.branchId,
      });
      toast.success("User updated successfully");
      setIsEditModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      setSubmitting(true);
      await apiClient.deleteUser(selectedUser.id);
      toast.success("User deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (user: SystemUser) => {
    setSelectedUser(user);
    setFormData({
      fullName: user.fullName || "",
      email: user.email || "",
      role: user.role || "teacher",
      branchId: user.branchId || "",
      password: "",
    });
    setIsEditModalOpen(true);
  };

  const openViewModal = (user: SystemUser) => {
    setSelectedUser(user);
    setIsViewModalOpen(true);
  };

  const openDeleteDialog = (user: SystemUser) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const roleCount = (role: string) => users.filter((u) => u.role === role).length;
  const managerCount = adminGroups.reduce((sum, g) => sum + g.managers.length, 0);

  const filteredGroups = adminGroups.filter((g) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      g.admin.fullName?.toLowerCase().includes(q) ||
      g.admin.email?.toLowerCase().includes(q) ||
      g.managers.some(
        (m) => m.fullName?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
      )
    );
  });

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users & Admins</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage system users and their permissions
          </p>
        </div>
        <Button className="gap-2" onClick={() => { setFormData(emptyForm); setIsAddModalOpen(true); }}>
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{roleCount("admin")}</p>
              <p className="text-sm text-muted-foreground">School Owners</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-info/15 flex items-center justify-center">
              <Key className="w-5 h-5 text-status-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{managerCount}</p>
              <p className="text-sm text-muted-foreground">Managers</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-healthy/15 flex items-center justify-center">
              <UsersIcon className="w-5 h-5 text-status-healthy" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card rounded-lg p-4 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background"
          />
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-3 px-4 font-medium">User</th>
                  <th className="text-left py-3 px-4 font-medium">Role</th>
                  <th className="text-left py-3 px-4 font-medium">Branch ID</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground text-sm">
                      {searchQuery ? "No users match your search." : "No school owners found."}
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map((group) => {
                    const isExpanded = expandedAdmins.has(group.admin.id);
                    return (
                      <Fragment key={group.admin.id}>
                        {/* Admin row */}
                        <tr
                          className="data-table-row border-b border-border bg-accent/20 cursor-pointer"
                          onClick={() => toggleExpand(group.admin.id)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <button className="text-muted-foreground">
                                {isExpanded
                                  ? <ChevronDown className="w-4 h-4" />
                                  : <ChevronRight className="w-4 h-4" />}
                              </button>
                              <Avatar className="w-9 h-9">
                                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                                  {getInitials(group.admin.fullName || group.admin.email || "?")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-foreground">{group.admin.fullName || "—"}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {group.admin.email}
                                </p>
                              </div>
                              {group.managers.length > 0 && (
                                <span className="ml-2 text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
                                  {group.managers.length} manager{group.managers.length !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="badge-status bg-primary/15 text-primary">School Owner</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-muted-foreground font-mono">
                              {group.branchId || "—"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openViewModal(group.admin)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditModal(group.admin)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit User
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-status-critical"
                                  onClick={() => openDeleteDialog(group.admin)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                        {/* Manager rows (nested) */}
                        {isExpanded && group.managers.map((manager) => {
                          const { label, color } = getRoleDisplay(manager.role);
                          return (
                            <tr key={manager.id} className="data-table-row border-b border-border last:border-0">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3 pl-10">
                                  <div className="w-px h-6 bg-border" />
                                  <Avatar className="w-8 h-8">
                                    <AvatarFallback className="bg-accent text-foreground text-xs">
                                      {getInitials(manager.fullName || manager.email || "?")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-foreground text-sm">{manager.fullName || "—"}</p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Mail className="w-3 h-3" />
                                      {manager.email}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`badge-status ${color}`}>{label}</span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-sm text-muted-foreground font-mono">
                                  {group.branchId || "—"}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openViewModal(manager)}>
                                      <Eye className="w-4 h-4 mr-2" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openEditModal(manager)}>
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit User
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-status-critical"
                                      onClick={() => openDeleteDialog(manager)}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete User
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account in the system.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                placeholder="John Doe"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">School Owner (Admin)</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch ID (optional — auto-assigned for managers)</Label>
              <Input
                placeholder="branch-uuid"
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={!formData.fullName || !formData.email || !formData.password || submitting}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information and role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">School Owner (Admin)</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch ID</Label>
              <Input
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Detailed information about this user.</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="bg-accent text-foreground text-lg">
                    {getInitials(selectedUser.fullName || selectedUser.email || "?")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedUser.fullName || "—"}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="font-medium text-foreground">{getRoleDisplay(selectedUser.role).label}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Branch ID</p>
                  <p className="font-mono text-sm text-foreground">{selectedUser.branchId || "—"}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-xs text-muted-foreground">User ID</p>
                  <p className="font-mono text-sm text-foreground">{selectedUser.id}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setIsViewModalOpen(false);
                if (selectedUser) openEditModal(selectedUser);
              }}
            >
              Edit User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUser?.fullName || selectedUser?.email}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={submitting}
              className="bg-status-critical hover:bg-status-critical/90"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
