import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Shield,
  User,
  Plus,
  Search,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
  Key,
  Mail,
  Edit,
  Trash2,
  Eye,
  RotateCcw,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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

type UserRole = "super_admin" | "developer" | "support";
type UserStatus = "active" | "disabled" | "pending";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLogin: string;
  createdAt: string;
  mfaEnabled: boolean;
}

const initialUsers: AdminUser[] = [
  {
    id: "1",
    name: "Alex Petrov",
    email: "alex@wonderkids.ru",
    role: "super_admin",
    status: "active",
    lastLogin: "5 min ago",
    createdAt: "2023-01-15",
    mfaEnabled: true,
  },
  {
    id: "2",
    name: "Maria Ivanova",
    email: "maria@wonderkids.ru",
    role: "developer",
    status: "active",
    lastLogin: "2 hours ago",
    createdAt: "2023-03-20",
    mfaEnabled: true,
  },
  {
    id: "3",
    name: "Dmitry Sokolov",
    email: "dmitry@wonderkids.ru",
    role: "developer",
    status: "active",
    lastLogin: "1 day ago",
    createdAt: "2023-06-10",
    mfaEnabled: false,
  },
  {
    id: "4",
    name: "Elena Kozlova",
    email: "elena@wonderkids.ru",
    role: "support",
    status: "active",
    lastLogin: "30 min ago",
    createdAt: "2023-09-05",
    mfaEnabled: true,
  },
  {
    id: "5",
    name: "Ivan Novikov",
    email: "ivan@wonderkids.ru",
    role: "support",
    status: "disabled",
    lastLogin: "2 weeks ago",
    createdAt: "2023-08-15",
    mfaEnabled: false,
  },
];

const roleConfig: Record<UserRole, { label: string; color: string; icon: typeof Shield }> = {
  super_admin: { label: "Super Admin", color: "bg-primary/15 text-primary", icon: Shield },
  developer: { label: "Developer", color: "bg-status-info/15 text-status-info", icon: Key },
  support: { label: "Support", color: "bg-status-healthy/15 text-status-healthy", icon: User },
};

const statusConfig: Record<UserStatus, { color: string; icon: typeof CheckCircle2 }> = {
  active: { color: "badge-healthy", icon: CheckCircle2 },
  disabled: { color: "badge-critical", icon: XCircle },
  pending: { color: "badge-warning", icon: Clock },
};

const auditLogs = [
  { time: "2024-01-14 14:32", action: "Updated subscription settings" },
  { time: "2024-01-14 12:15", action: "Added new branch: Sochi Campus" },
  { time: "2024-01-13 09:45", action: "Reset password for user: teacher@school.ru" },
  { time: "2024-01-12 16:20", action: "Modified RLS policies on students table" },
  { time: "2024-01-12 11:00", action: "Deployed new edge function: send-notification" },
];

export default function Users() {
  const [searchQuery, setSearchQuery] = useState("");
  const [userData, setUserData] = useState(initialUsers);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "developer" as UserRole,
    mfaEnabled: false,
  });

  const filteredUsers = userData.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUserStatus = (id: string) => {
    setUserData((prev) =>
      prev.map((user) =>
        user.id === id
          ? { ...user, status: user.status === "active" ? "disabled" : "active" }
          : user
      )
    );
    toast.success("User status updated");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const handleAddUser = () => {
    const newUser: AdminUser = {
      id: Date.now().toString(),
      name: formData.name,
      email: formData.email,
      role: formData.role,
      status: "pending",
      lastLogin: "Never",
      createdAt: new Date().toISOString().split("T")[0],
      mfaEnabled: formData.mfaEnabled,
    };
    setUserData((prev) => [...prev, newUser]);
    setIsAddModalOpen(false);
    setFormData({ name: "", email: "", role: "developer", mfaEnabled: false });
    toast.success("Admin user created successfully");
  };

  const handleEditUser = () => {
    if (!selectedUser) return;
    setUserData((prev) =>
      prev.map((user) =>
        user.id === selectedUser.id
          ? { ...user, name: formData.name, email: formData.email, role: formData.role, mfaEnabled: formData.mfaEnabled }
          : user
      )
    );
    setIsEditModalOpen(false);
    setSelectedUser(null);
    toast.success("User updated successfully");
  };

  const handleDeleteUser = () => {
    if (!selectedUser) return;
    setUserData((prev) => prev.filter((user) => user.id !== selectedUser.id));
    setIsDeleteDialogOpen(false);
    setSelectedUser(null);
    toast.success("User deleted successfully");
  };

  const handleResetPassword = () => {
    setIsResetPasswordOpen(false);
    setSelectedUser(null);
    toast.success("Password reset email sent");
  };

  const openEditModal = (user: AdminUser) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
    });
    setIsEditModalOpen(true);
  };

  const openViewModal = (user: AdminUser) => {
    setSelectedUser(user);
    setIsViewModalOpen(true);
  };

  const openDeleteDialog = (user: AdminUser) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const openResetPassword = (user: AdminUser) => {
    setSelectedUser(user);
    setIsResetPasswordOpen(true);
  };

  const openAuditLog = (user: AdminUser) => {
    setSelectedUser(user);
    setIsAuditLogOpen(true);
  };

  const superAdminCount = userData.filter((u) => u.role === "super_admin").length;
  const developerCount = userData.filter((u) => u.role === "developer").length;
  const supportCount = userData.filter((u) => u.role === "support").length;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users & Admins</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage system administrators and their permissions
          </p>
        </div>
        <Button className="gap-2" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Add Admin
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
              <p className="text-2xl font-bold text-foreground">{superAdminCount}</p>
              <p className="text-sm text-muted-foreground">Super Admins</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-info/15 flex items-center justify-center">
              <Key className="w-5 h-5 text-status-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{developerCount}</p>
              <p className="text-sm text-muted-foreground">Developers</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-healthy/15 flex items-center justify-center">
              <User className="w-5 h-5 text-status-healthy" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{supportCount}</p>
              <p className="text-sm text-muted-foreground">Support</p>
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
      <div className="glass-card rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left py-3 px-4 font-medium">User</th>
                <th className="text-left py-3 px-4 font-medium">Role</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-left py-3 px-4 font-medium">Last Login</th>
                <th className="text-center py-3 px-4 font-medium">MFA</th>
                <th className="text-center py-3 px-4 font-medium">Enabled</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const RoleIcon = roleConfig[user.role].icon;
                const StatusIcon = statusConfig[user.status].icon;
                return (
                  <tr key={user.id} className="data-table-row border-b border-border last:border-0">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          <AvatarFallback className="bg-accent text-foreground text-xs">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "badge-status flex items-center gap-1 w-fit",
                        roleConfig[user.role].color
                      )}>
                        <RoleIcon className="w-3 h-3" />
                        {roleConfig[user.role].label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "badge-status capitalize flex items-center gap-1 w-fit",
                        statusConfig[user.status].color
                      )}>
                        <StatusIcon className="w-3 h-3" />
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {user.lastLogin}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {user.mfaEnabled ? (
                        <CheckCircle2 className="w-4 h-4 text-status-healthy mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Switch
                        checked={user.status === "active"}
                        onCheckedChange={() => toggleUserStatus(user.id)}
                        disabled={user.role === "super_admin"}
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openViewModal(user)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditModal(user)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openResetPassword(user)}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAuditLog(user)}>
                            <FileText className="w-4 h-4 mr-2" />
                            View Audit Log
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-status-critical"
                            onClick={() => openDeleteDialog(user)}
                            disabled={user.role === "super_admin"}
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
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Admin</DialogTitle>
            <DialogDescription>
              Create a new administrator account for the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@wonderkids.ru"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val as UserRole })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Require MFA</p>
                <p className="text-sm text-muted-foreground">Enforce 2FA for this user</p>
              </div>
              <Switch
                checked={formData.mfaEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, mfaEnabled: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={!formData.name || !formData.email}>
              Create Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email Address</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val as UserRole })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Require MFA</p>
                <p className="text-sm text-muted-foreground">Enforce 2FA for this user</p>
              </div>
              <Switch
                checked={formData.mfaEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, mfaEnabled: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser}>
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
            <DialogDescription>
              Detailed information about this administrator.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="bg-accent text-foreground text-lg">
                    {getInitials(selectedUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedUser.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p className="font-medium text-foreground">{roleConfig[selectedUser.role].label}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium text-foreground capitalize">{selectedUser.status}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium text-foreground">{selectedUser.createdAt}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Last Login</p>
                  <p className="font-medium text-foreground">{selectedUser.lastLogin}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">MFA Enabled</p>
                  <p className="font-medium text-foreground">{selectedUser.mfaEnabled ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setIsViewModalOpen(false);
              if (selectedUser) openEditModal(selectedUser);
            }}>
              Edit User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUser?.name}? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-status-critical hover:bg-status-critical/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <AlertDialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Send a password reset email to {selectedUser?.email}? They will receive instructions to create a new password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>
              Send Reset Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Audit Log Modal */}
      <Dialog open={isAuditLogOpen} onOpenChange={setIsAuditLogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit Log</DialogTitle>
            <DialogDescription>
              Recent actions performed by {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-80 overflow-y-auto">
            {auditLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{log.action}</p>
                  <p className="text-xs text-muted-foreground">{log.time}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAuditLogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
