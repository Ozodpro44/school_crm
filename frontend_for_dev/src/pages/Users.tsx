import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Search, Trash2, RefreshCw, Loader2, AlertCircle, Users as UsersIcon,
  Shield, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { listUsers, deleteUser, type CRMUser } from "@/services/api-client";

const ROLE_CONFIG: Record<string, { label: string; cls: string }> = {
  admin:        { label: "Admin",        cls: "bg-primary/15 text-primary border border-primary/25"                        },
  manager:      { label: "Manager",      cls: "bg-status-info/15 text-status-info border border-status-info/25"            },
  teacher:      { label: "Teacher",      cls: "bg-status-healthy/15 text-status-healthy border border-status-healthy/25"   },
  accountant:   { label: "Accountant",   cls: "bg-amber-500/15 text-amber-400 border border-amber-500/25"                  },
  branch_admin: { label: "Branch Admin", cls: "bg-violet-500/15 text-violet-400 border border-violet-500/25"               },
};

function getRoleCfg(role: string) {
  return ROLE_CONFIG[role] ?? { label: role, cls: "bg-muted text-muted-foreground border border-border" };
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

const ROLES = ["all", "admin", "manager", "teacher", "accountant", "branch_admin"];

export default function Users() {
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<CRMUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.fullName.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const countByRole = (role: string) => users.filter((u) => u.role === role).length;

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteUser(selected.id);
      setUsers((prev) => prev.filter((u) => u.id !== selected.id));
      setDeleteOpen(false);
      toast.success("User deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const statCards = [
    { label: "Total",      value: users.length,             icon: UsersIcon, cls: "text-primary",        bg: "bg-primary/15"           },
    { label: "Admins",     value: countByRole("admin"),      icon: Shield,    cls: "text-primary",        bg: "bg-primary/15"           },
    { label: "Managers",   value: countByRole("manager"),    icon: User,      cls: "text-status-info",    bg: "bg-status-info/15"       },
    { label: "Teachers",   value: countByRole("teacher"),    icon: User,      cls: "text-status-healthy", bg: "bg-status-healthy/15"    },
    { label: "Accountants",value: countByRole("accountant"), icon: User,      cls: "text-amber-400",      bg: "bg-amber-500/15"         },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">CRM users across all branches</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap gap-3 mb-5">
        {statCards.map(({ label, value, icon: Icon, cls, bg }) => (
          <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
            <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", bg)}>
              <Icon className={cn("w-3.5 h-3.5", cls)} />
            </div>
            <div>
              <span className="text-sm font-bold text-foreground font-mono">{loading ? "—" : value}</span>
              <span className="text-xs text-muted-foreground ml-1">{label}</span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-4 rounded-lg border border-status-critical/30 bg-status-critical/10 text-status-critical text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="glass-card rounded-lg p-3 mb-4">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 bg-background text-sm"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full md:w-44 bg-background h-8 text-sm">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r === "all" ? "All Roles" : getRoleCfg(r).label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <UsersIcon className="w-8 h-8 opacity-30" />
            <span className="text-sm">No users found</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">Branch ID</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((user) => {
                  const { label, cls } = getRoleCfg(user.role);
                  return (
                    <tr key={user.id} className="hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-accent text-foreground text-xs font-bold">
                              {getInitials(user.fullName || user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{user.fullName || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", cls)}>
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.branchId ? (
                          <code className="text-xs font-mono text-muted-foreground">
                            {user.branchId.slice(0, 8)}…
                          </code>
                        ) : (
                          <span className="text-muted-foreground opacity-40 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-status-critical hover:text-status-critical"
                          onClick={() => { setSelected(user); setDeleteOpen(true); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {selected?.fullName || selected?.email}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-status-critical hover:bg-status-critical/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
