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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

const users: AdminUser[] = [
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

export default function Users() {
  const [searchQuery, setSearchQuery] = useState("");
  const [userData, setUserData] = useState(users);

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
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
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
        <Button className="gap-2">
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
                          <DropdownMenuItem>Edit User</DropdownMenuItem>
                          <DropdownMenuItem>Reset Password</DropdownMenuItem>
                          <DropdownMenuItem>View Audit Log</DropdownMenuItem>
                          <DropdownMenuItem className="text-status-critical">
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
    </DashboardLayout>
  );
}
