import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  CheckCircle2, Clock, XCircle, AlertTriangle, Search, Plus,
  MoreVertical, Edit, Trash2, RefreshCw, Loader2, AlertCircle,
  Gift, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  listSubscriptions, createSubscription, updateSubscription, deleteSubscription,
  grantTrial, listPlans, getPlatformStats,
  type AdminSubscription, type SubscriptionPlan,
} from "@/services/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";

// Must match the backend's actual enum exactly (subscriptions.status check
// constraint) — "pending" here previously didn't exist server-side at all
// (the real value is "pending_payment"), and "past_due" was missing.
const STATUS_OPTIONS = ["active", "trial", "pending_payment", "past_due", "expired", "cancelled", "paused"];

function statusBadgeClass(status: string) {
  const s = status?.toLowerCase();
  if (s === "active")    return "badge-active";
  if (s === "trial")     return "badge-trial";
  if (s === "expired")   return "badge-expired";
  if (s === "pending_payment") return "badge-pending";
  if (s === "past_due")  return "badge-pending";
  if (s === "cancelled") return "badge-cancelled";
  if (s === "paused")    return "badge-paused";
  return "badge-cancelled";
}

function statusIcon(status: string) {
  const s = status?.toLowerCase();
  if (s === "active") return CheckCircle2;
  if (s === "trial")  return Clock;
  if (s === "expired" || s === "cancelled") return XCircle;
  return AlertTriangle;
}

export default function Subscriptions() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  // Grant Trial / Delete are gated server-side to RequireDeveloperRole("admin")
  // (see backend_school_crm/internal/handlers/admin_subscription.go) — a
  // "developer"-tier account always gets 403 "insufficient developer role"
  // on these two. Disabling them here surfaces that upfront instead of a
  // raw backend error toast after the click.
  const isAdminDeveloper = user?.role === "admin";
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mrr, setMrr] = useState(0);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [selected, setSelected] = useState<AdminSubscription | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({
    userId: "", planId: "", status: "active", autoRenew: true, notes: "",
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    status: "active", planId: "", endDate: "", renewalDate: "", notes: "", autoRenew: true,
  });

  // Trial form
  const [trialDays, setTrialDays] = useState("14");
  const [trialNotes, setTrialNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subsRes, plansRes, statsRes] = await Promise.allSettled([
        listSubscriptions(), listPlans(), getPlatformStats(),
      ]);
      if (subsRes.status === "fulfilled") setSubs(subsRes.value);
      else setError(subsRes.reason instanceof Error ? subsRes.reason.message : t("failedToLoadData"));
      if (plansRes.status === "fulfilled") setPlans(plansRes.value);
      if (statsRes.status === "fulfilled") setMrr(statsRes.value.mrr);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = subs.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (planFilter !== "all" && s.planId !== planFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.userEmail.toLowerCase().includes(q) && !s.userFullName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const countByStatus = (st: string) => subs.filter((s) => s.status === st).length;

  const handleCreate = async () => {
    if (!createForm.userId || !createForm.planId) {
      toast.error(t("userIdPlanRequired"));
      return;
    }
    setSaving(true);
    try {
      const created = await createSubscription({
        userId: createForm.userId,
        planId: createForm.planId,
        status: createForm.status,
        autoRenew: createForm.autoRenew,
        notes: createForm.notes || undefined,
      });
      setSubs((prev) => [created, ...prev]);
      setCreateOpen(false);
      setCreateForm({ userId: "", planId: "", status: "active", autoRenew: true, notes: "" });
      toast.success(t("subscriptionCreated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToCreateSubscription"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      // Omitting endDate/renewalDate/notes means "leave unchanged" — the
      // backend can't tell that apart from an explicit clear via a plain
      // JSON null, so an emptied notes field needs the explicit clearNotes
      // flag instead. (endDate/renewalDate have no such escape hatch yet —
      // leaving a date blank just leaves the stored date untouched.)
      const notesWasCleared = (selected.notes ?? "") !== "" && editForm.notes.trim() === "";
      // The backend's EndDate/RenewalDate fields are *time.Time, whose JSON
      // unmarshaling requires full RFC3339 — a bare "YYYY-MM-DD" from the
      // <input type="date"> fails to parse ("cannot parse \"\" as \"T\"").
      const toRFC3339 = (d: string) => (d ? `${d}T00:00:00Z` : undefined);
      // Only send a date if the developer actually edited it. The form
      // pre-fills both dates from the current subscription, so re-sending
      // them unchanged used to suppress AdminUpdateSubscription's own
      // "activating with no explicit end_date and the old one is in the
      // past → auto-extend by one billing period" logic on the backend —
      // that path only fires when EndDate is nil in the request. Without
      // this, ticking Status to "active" alone silently left a past
      // end_date in place, so the subscription still read as expired.
      const originalEndDate = selected.endDate ? selected.endDate.split("T")[0] : "";
      const originalRenewalDate = selected.renewalDate ? selected.renewalDate.split("T")[0] : "";
      const updated = await updateSubscription(selected.id, {
        status: editForm.status,
        planId: editForm.planId || undefined,
        endDate: editForm.endDate !== originalEndDate ? toRFC3339(editForm.endDate) : undefined,
        renewalDate: editForm.renewalDate !== originalRenewalDate ? toRFC3339(editForm.renewalDate) : undefined,
        notes: editForm.notes || undefined,
        clearNotes: notesWasCleared,
        autoRenew: editForm.autoRenew,
      });
      setSubs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditOpen(false);
      toast.success(t("subscriptionUpdated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToUpdate"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await deleteSubscription(selected.id);
      setSubs((prev) => prev.filter((s) => s.id !== selected.id));
      setDeleteOpen(false);
      toast.success(t("subscriptionDeleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToDelete"));
    } finally {
      setSaving(false);
    }
  };

  const handleGrantTrial = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await grantTrial(selected.userId, Number(trialDays), trialNotes || undefined);
      await loadData();
      setTrialOpen(false);
      toast.success(tf(t("trialGrantedForDays"), { days: trialDays }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToGrantTrial"));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (sub: AdminSubscription) => {
    setSelected(sub);
    setEditForm({
      status: sub.status,
      planId: sub.planId,
      endDate: sub.endDate ? sub.endDate.split("T")[0] : "",
      renewalDate: sub.renewalDate ? sub.renewalDate.split("T")[0] : "",
      notes: sub.notes ?? "",
      autoRenew: sub.autoRenew,
    });
    setEditOpen(true);
  };

  const openTrial = (sub: AdminSubscription) => {
    setSelected(sub);
    setTrialDays("14");
    setTrialNotes("");
    setTrialOpen(true);
  };

  const openDelete = (sub: AdminSubscription) => {
    setSelected(sub);
    setDeleteOpen(true);
  };

  const uniquePlanIds = Array.from(new Set(subs.map((s) => s.planId)));
  const plansByPlanId = Object.fromEntries(
    plans.map((p) => [p.id, p])
  );

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("subscriptionsTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("manageTenantSubscriptions")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={loadData} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {t("refresh")}
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            {t("newSubscription")}
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: t("statActive"),        value: "active",          count: countByStatus("active"),          cls: "badge-active"    },
          { label: t("statTrial"),         value: "trial",           count: countByStatus("trial"),            cls: "badge-trial"     },
          { label: t("statPendingPayment"),value: "pending_payment", count: countByStatus("pending_payment"),  cls: "badge-pending"   },
          { label: t("statPastDue"),       value: "past_due",        count: countByStatus("past_due"),         cls: "badge-pending"   },
          { label: t("statExpiredSub"),    value: "expired",         count: countByStatus("expired"),          cls: "badge-expired"   },
          { label: t("statCancelled"),     value: "cancelled",       count: countByStatus("cancelled"),        cls: "badge-cancelled" },
        ].map(({ label, value, count, cls }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(statusFilter === value ? "all" : value)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium transition-colors hover:border-primary/40", cls)}
          >
            {label} <span className="font-mono">({count})</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span>MRR:</span>
          <span className="font-mono font-semibold text-status-healthy">
            ${mrr.toLocaleString()}
          </span>
        </div>
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-44 bg-background h-8 text-sm">
              <SelectValue placeholder={t("allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-full md:w-48 bg-background h-8 text-sm">
              <SelectValue placeholder={t("allPlans")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allPlans")}</SelectItem>
              {uniquePlanIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {plansByPlanId[id]?.name ?? id}
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
            <CheckCircle2 className="w-8 h-8 opacity-30" />
            <span className="text-sm">{t("noSubscriptionsFound")}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-3 font-medium">{t("user")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("plan")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("status")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("price")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("start")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("end")}</th>
                  <th className="text-center px-4 py-3 font-medium">{t("autoRenewCol")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((sub) => {
                  const StatusIcon = statusIcon(sub.status);
                  return (
                    <tr key={sub.id} className="hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{sub.userFullName || sub.userEmail}</p>
                        <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-foreground">{sub.planName}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1", statusBadgeClass(sub.status))}>
                          <StatusIcon className="w-2.5 h-2.5" />
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {sub.planPrice > 0 ? `$${sub.planPrice}` : t("free")}
                        <span className="text-xs text-muted-foreground">/{sub.billingPeriod}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {sub.startDate ? new Date(sub.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {sub.endDate ? new Date(sub.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Switch
                          checked={sub.autoRenew}
                          onCheckedChange={async (v) => {
                            try {
                              const updated = await updateSubscription(sub.id, { autoRenew: v });
                              setSubs((prev) => prev.map((s) => s.id === updated.id ? updated : s));
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : t("failedToUpdate"));
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(sub)}>
                              <Edit className="w-4 h-4 mr-2" />
                              {t("edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openTrial(sub)}
                              disabled={!isAdminDeveloper}
                              title={isAdminDeveloper ? undefined : t("adminRoleRequired")}
                            >
                              <Gift className="w-4 h-4 mr-2" />
                              {t("grantTrial")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-status-critical"
                              onClick={() => openDelete(sub)}
                              disabled={!isAdminDeveloper}
                              title={isAdminDeveloper ? undefined : t("adminRoleRequired")}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t("delete")}
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
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("newSubscription")}</DialogTitle>
            <DialogDescription>{t("createSubscriptionFor")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("userId")}</Label>
              <Input
                placeholder={t("userUuidPlaceholder")}
                value={createForm.userId}
                onChange={(e) => setCreateForm({ ...createForm, userId: e.target.value })}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("plan")}</Label>
              <Select value={createForm.planId} onValueChange={(v) => setCreateForm({ ...createForm, planId: v })}>
                <SelectTrigger><SelectValue placeholder={t("selectPlan")} /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — ${p.price}/{p.billingPeriod}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("status")}</Label>
              <Select value={createForm.status} onValueChange={(v) => setCreateForm({ ...createForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("notes")}</Label>
              <Input
                placeholder={t("optionalNotes")}
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t("autoRenewLabel")}</p>
                <p className="text-xs text-muted-foreground">{t("autoRenewDesc")}</p>
              </div>
              <Switch
                checked={createForm.autoRenew}
                onCheckedChange={(v) => setCreateForm({ ...createForm, autoRenew: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editSubscription")}</DialogTitle>
            <DialogDescription>{tf(t("updateSubscriptionFor"), { name: selected?.userFullName || selected?.userEmail || "" })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("status")}</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("plan")}</Label>
              <Select value={editForm.planId} onValueChange={(v) => setEditForm({ ...editForm, planId: v })}>
                <SelectTrigger><SelectValue placeholder={t("keepCurrentPlan")} /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — ${p.price}/{p.billingPeriod}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("endDate")}</Label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("renewalDate")}</Label>
                <Input
                  type="date"
                  value={editForm.renewalDate}
                  onChange={(e) => setEditForm({ ...editForm, renewalDate: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("notes")}</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder={t("optionalNotes")}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{t("autoRenewLabel")}</p>
              <Switch
                checked={editForm.autoRenew}
                onCheckedChange={(v) => setEditForm({ ...editForm, autoRenew: v })}
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

      {/* Grant Trial Dialog */}
      <Dialog open={trialOpen} onOpenChange={setTrialOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("grantTrial")}</DialogTitle>
            <DialogDescription>
              {tf(t("grantTrialFor"), { name: selected?.userFullName || selected?.userEmail || "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("trialDays")}</Label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={trialDays}
                  onChange={(e) => setTrialDays(e.target.value)}
                  className="w-24 bg-background font-mono"
                />
                <span className="text-sm text-muted-foreground">{t("days")}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("notes")} ({t("optional")})</Label>
              <Input
                value={trialNotes}
                onChange={(e) => setTrialNotes(e.target.value)}
                placeholder={t("reasonForTrial")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleGrantTrial} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Gift className="w-4 h-4 mr-2" />
              {t("grantTrial")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteSubscription")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tf(t("permanentlyDeleteSubscriptionFor"), { name: selected?.userFullName || selected?.userEmail || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-status-critical hover:bg-status-critical/90"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
