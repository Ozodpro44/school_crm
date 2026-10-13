import { useMemo, useState } from "react";
import { Loader2, Pencil, Shield, Trash2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/kit/PageHeader";
import { Stat } from "@/components/kit/Stat";
import { StatusPill, type Tone } from "@/components/kit/StatusPill";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { EmptyState, ErrorNotice } from "@/components/kit/States";
import { FilterBar, RefreshButton, SearchField } from "@/components/kit/Toolbar";
import { RowActions } from "@/components/kit/RowActions";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { Field } from "@/components/kit/Field";
import { Pager, usePaging } from "@/components/kit/Pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";
import { useResource } from "@/hooks/useResource";
import { orEmpty } from "@/lib/empty";
import { formatDate, formatNumber, initialsOf } from "@/lib/format";
import { deleteUser, listBranches, listUsers, updateUser, type CRMBranch, type CRMUser } from "@/services/api-client";

interface Bundle { users: CRMUser[]; branches: CRMBranch[] }

const ROLE_TONE: Record<string, Tone> = {
  admin: "accent", branch_admin: "accent", manager: "info", teacher: "healthy", accountant: "warning",
};
const ROLE_LABEL: Record<string, string> = {
  admin: "roleAdmin", manager: "roleManager", teacher: "roleTeacher", accountant: "roleAccountant", branch_admin: "roleBranchAdmin",
};
const ROLES = ["admin", "branch_admin", "manager", "teacher", "accountant"] as const;
const PAGE_SIZE = 25;

export default function Users() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const roleLabel = (r: string) => (ROLE_LABEL[r] ? t(ROLE_LABEL[r]) : r);

  const res = useResource<Bundle>(async () => {
    const [users, branches] = await Promise.allSettled([listUsers(), listBranches()]);
    if (users.status === "rejected") throw users.reason;
    return { users: users.value, branches: branches.status === "fulfilled" ? branches.value : [] };
  }, t("failedToLoadUsers"));

  const users = orEmpty(res.data?.users);
  const branchNames = useMemo(() => new Map((res.data?.branches ?? []).map((b) => [b.id, b.name])), [res.data?.branches]);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [dialog, setDialog] = useState<{ kind: "edit"; user: CRMUser } | { kind: "delete"; user: CRMUser } | null>(null);
  const [seq, setSeq] = useState(0);
  const open = (d: NonNullable<typeof dialog>) => { setSeq((n) => n + 1); setDialog(d); };
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      return !q || (u.fullName ?? "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, roleFilter, search]);
  const paging = usePaging(filtered, PAGE_SIZE, `${roleFilter}|${search}`);
  const count = (role: string) => users.filter((u) => u.role === role).length;

  const columns: Column<CRMUser>[] = [
    {
      key: "user",
      header: t("user"),
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {initialsOf(u.fullName || u.email)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{u.fullName || "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: "role", header: t("role"), cell: (u) => <StatusPill tone={ROLE_TONE[u.role] ?? "neutral"} dot={false}>{roleLabel(u.role)}</StatusPill> },
    {
      key: "branch",
      header: t("branches"),
      showFrom: "md",
      cell: (u) =>
        u.branchId ? (
          <span className="text-foreground">{branchNames.get(u.branchId) ?? <span className="font-mono text-xs text-muted-foreground" title={u.branchId}>{u.branchId.slice(0, 8)}…</span>}</span>
        ) : (
          <span className="text-muted-foreground">{t("noBranch")}</span>
        ),
    },
    { key: "created", header: t("created"), showFrom: "lg", cell: (u) => <span className="tnum text-muted-foreground">{formatDate(u.createdAt, language)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">{t("actions")}</span>,
      align: "right",
      className: "w-12",
      cell: (u) => (
        <RowActions
          actions={[
            { label: t("edit"), icon: Pencil, onSelect: () => open({ kind: "edit", user: u }) },
            { label: t("delete"), icon: Trash2, destructive: true, separated: true, onSelect: () => open({ kind: "delete", user: u }) },
          ]}
        />
      ),
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title={t("usersTitle")}
        description={t("crmUsersAcrossBranches")}
        actions={<RefreshButton onClick={() => void res.reload()} busy={res.fetching} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label={t("statTotal")} value={formatNumber(users.length, language)} icon={UsersIcon} loading={res.loading} />
        <Stat label={t("statAdmins")} value={count("admin")} icon={Shield} loading={res.loading} />
        <Stat label={t("statManagers")} value={count("manager")} loading={res.loading} />
        <Stat label={t("statTeachers")} value={count("teacher")} loading={res.loading} />
        <Stat label={t("statAccountants")} value={count("accountant")} loading={res.loading} />
      </div>

      {res.error && <ErrorNotice message={res.error} onRetry={() => void res.reload()} />}

      <FilterBar>
        <SearchField value={search} onChange={setSearch} placeholder={t("searchByNameOrEmail")} />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="sm:w-52"><SelectValue placeholder={t("allRoles")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allRoles")}</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={paging.slice}
        rowKey={(u) => u.id}
        loading={res.loading}
        empty={<EmptyState icon={UsersIcon} title={search || roleFilter !== "all" ? t("noResultsForFilters") : t("noUsersFound")} />}
        footer={<Pager page={paging.page} pages={paging.pages} total={filtered.length} onPage={paging.setPage} />}
      />

      <EditUserDialog
        key={`user-${seq}`}
        open={dialog?.kind === "edit"}
        user={dialog?.kind === "edit" ? dialog.user : null}
        busy={busy}
        t={t}
        onClose={() => setDialog(null)}
        onSubmit={async (v) => {
          if (dialog?.kind !== "edit") return;
          setBusy(true);
          try {
            const updated = await updateUser(dialog.user.id, {
              full_name: v.fullName, email: v.email, ...(v.password ? { password: v.password } : {}),
            });
            // The update response may omit fields the list has (e.g. branch); merge, don't replace.
            res.setData((d) => (d ? { ...d, users: d.users.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)) } : d));
            toast.success(t("userUpdated"));
            setDialog(null);
          } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : t("failedToUpdateUser"));
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("deleteUser")}
        description={tf(t("deleteUserConfirm"), { name: dialog?.kind === "delete" ? dialog.user.fullName || dialog.user.email : "" })}
        confirmLabel={t("delete")}
        busy={busy}
        onConfirm={async () => {
          if (dialog?.kind !== "delete") return;
          setBusy(true);
          try {
            await deleteUser(dialog.user.id);
            res.setData((d) => (d ? { ...d, users: d.users.filter((u) => u.id !== dialog.user.id) } : d));
            toast.success(t("userDeleted"));
            setDialog(null);
          } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : t("failedToDeleteUser"));
          } finally {
            setBusy(false);
          }
        }}
      />
    </DashboardLayout>
  );
}

function EditUserDialog({
  open, user, busy, t, onClose, onSubmit,
}: {
  open: boolean; user: CRMUser | null; busy: boolean; t: (k: string) => string;
  onClose: () => void; onSubmit: (v: { fullName: string; email: string; password: string }) => void;
}) {
  const [v, setV] = useState({ fullName: user?.fullName ?? "", email: user?.email ?? "", password: "" });

  const submit = () => {
    if (!v.fullName.trim() || !v.email.trim()) return void toast.error(t("nameEmailRequired"));
    if (v.password && v.password.length < 8) return void toast.error(t("passwordTooShort"));
    onSubmit({ fullName: v.fullName.trim(), email: v.email.trim(), password: v.password });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("editUser")}</DialogTitle>
          <DialogDescription>{t("editUserNotice")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("fullName")}>
            <Input value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} autoFocus />
          </Field>
          <Field label={t("email")}>
            <Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </Field>
          <Field label={t("newPasswordOptional")}>
            <Input
              type="password"
              autoComplete="new-password"
              value={v.password}
              onChange={(e) => setV({ ...v, password: e.target.value })}
              placeholder={t("leaveBlankToKeepPassword")}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
