import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Search, Trash2, Edit, RefreshCw, Loader2, AlertCircle, Users as UsersIcon,
  Shield, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { listUsers, updateUser, deleteUser, type CRMUser } from "@/services/api-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";

const ROLE_CONFIG: Record<string, { labelKey: string; cls: string }> = {
  admin:        { labelKey: "roleAdmin",       cls: "bg-primary/15 text-primary border border-primary/25"                        },
  manager:      { labelKey: "roleManager",     cls: "bg-status-info/15 text-status-info border border-status-info/25"            },
  teacher:      { labelKey: "roleTeacher",     cls: "bg-status-healthy/15 text-status-healthy border border-status-healthy/25"   },
  accountant:   { labelKey: "roleAccountant",  cls: "bg-amber-500/15 text-amber-400 border border-amber-500/25"                  },
  branch_admin: { labelKey: "roleBranchAdmin", cls: "bg-violet-500/15 text-violet-400 border border-violet-500/25"               },
};

function getRoleCfg(role: string, t: (key: string) => string) {
  const cfg = ROLE_CONFIG[role];
  return cfg ? { label: t(cfg.labelKey), cls: cfg.cls } : { label: role, cls: "bg-muted text-muted-foreground border border-border" };
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

const ROLES = ["all", "admin", "manager", "teacher", "accountant", "branch_admin"];

export default function Users() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [users, setUsers] = useState<CRMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<CRMUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: "", email: "", password: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedToLoadUsers"));
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

  const openEdit = (user: CRMUser) => {
    setSelected(user);
    setEditForm({ fullName: user.fullName, email: user.email, password: "" });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!selected) return;
    if (!editForm.fullName.trim() || !editForm.email.trim()) {
      toast.error(t("nameEmailRequired"));
      return;
    }
    setSaving(true);
    try {
      const updated = await updateUser(selected.id, {
        full_name: editForm.fullName,
        email: editForm.email,
        ...(editForm.password ? { password: editForm.password } : {}),
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditOpen(false);
      toast.success(t("userUpdated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToUpdateUser"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteUser(selected.id);
      setUsers((prev) => prev.filter((u) => u.id !== selected.id));
      setDeleteOpen(false);
      toast.success(t("userDeleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToDeleteUser"));
    } finally {
      setDeleting(false);
    }
  };

  const statCards = [
    { label: t("statTotal"),       value: users.length,               icon: UsersIcon, cls: "text-primary",        bg: "bg-primary/15"           },
    { label: t("statAdmins"),      value: countByRole("admin"),       icon: Shield,    cls: "text-primary",        bg: "bg-primary/15"           },
    { label: t("statManagers"),    value: countByRole("manager"),     icon: User,      cls: "text-status-info",    bg: "bg-status-info/15"       },
    { label: t("statTeachers"),    value: countByRole("teacher"),     icon: User,      cls: "text-status-healthy", bg: "bg-status-healthy/15"    },
    { label: t("statAccountants"), value: countByRole("accountant"),  icon: User,      cls: "text-amber-400",      bg: "bg-amber-500/15"         },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("usersTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("crmUsersAcrossBranches")}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {t("refresh")}
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
              placeholder={t("searchByNameOrEmail")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 bg-background text-sm"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full md:w-44 bg-background h-8 text-sm">
              <SelectValue placeholder={t("allRoles")} />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r === "all" ? t("allRoles") : getRoleCfg(r, t).label}
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
            <span className="text-sm">{t("noUsersFound")}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-3 font-medium">{t("user")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("email")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("role")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("branchId")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("created")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((user) => {
                  const { label, cls } = getRoleCfg(user.role, t);
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
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(user)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-status-critical hover:text-status-critical"
                            onClick={() => { setSelected(user); setDeleteOpen(true); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("editUser")}</DialogTitle>
            <DialogDescription>
              {t("editUserNotice")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("fullName")}</Label>
              <Input
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("email")}</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("newPasswordOptional")}</Label>
              <Input
                type="password"
                placeholder={t("leaveBlankToKeepPassword")}
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteUser")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tf(t("deleteUserConfirm"), { name: selected?.fullName || selected?.email || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-status-critical hover:bg-status-critical/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
