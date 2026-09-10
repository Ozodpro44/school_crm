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
      else setError(subsRes.reason instanceof Error ? subsRes.reason.message : "Failed to load subscriptions");
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
      toast.error("User ID and plan are required");
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
      toast.success("Subscription created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create subscription");
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
      const updated = await updateSubscription(selected.id, {
        status: editForm.status,
        planId: editForm.planId || undefined,
        endDate: editForm.endDate || undefined,
        renewalDate: editForm.renewalDate || undefined,
        notes: editForm.notes || undefined,
        clearNotes: notesWasCleared,
        autoRenew: editForm.autoRenew,
      });
      setSubs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditOpen(false);
      toast.success("Subscription updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
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
      toast.success("Subscription deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
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
      toast.success(`Trial granted for ${trialDays} days`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to grant trial");
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
          <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage tenant subscriptions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={loadData} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            New Subscription
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-3 mb-5">
        {[
          { label: "Active",     value: "active",          count: countByStatus("active"),          cls: "badge-active"    },
          { label: "Trial",      value: "trial",           count: countByStatus("trial"),            cls: "badge-trial"     },
          { label: "Pending",    value: "pending_payment", count: countByStatus("pending_payment"),  cls: "badge-pending"   },
          { label: "Past Due",   value: "past_due",        count: countByStatus("past_due"),         cls: "badge-pending"   },
          { label: "Expired",    value: "expired",         count: countByStatus("expired"),          cls: "badge-expired"   },
          { label: "Cancelled",  value: "cancelled",       count: countByStatus("cancelled"),        cls: "badge-cancelled" },
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
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 bg-background text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-44 bg-background h-8 text-sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-full md:w-48 bg-background h-8 text-sm">
              <SelectValue placeholder="All plans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
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
            <span className="text-sm">No subscriptions found</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Price</th>
                  <th className="text-left px-4 py-3 font-medium">Start</th>
                  <th className="text-left px-4 py-3 font-medium">End</th>
                  <th className="text-center px-4 py-3 font-medium">Auto-renew</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
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
                        {sub.planPrice > 0 ? `$${sub.planPrice}` : "Free"}
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
                              toast.error(e instanceof Error ? e.message : "Failed to update");
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
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openTrial(sub)}>
                              <Gift className="w-4 h-4 mr-2" />
                              Grant Trial
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-status-critical" onClick={() => openDelete(sub)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
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
            <DialogTitle>New Subscription</DialogTitle>
            <DialogDescription>Create a subscription for a user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>User ID</Label>
              <Input
                placeholder="User UUID"
                value={createForm.userId}
                onChange={(e) => setCreateForm({ ...createForm, userId: e.target.value })}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={createForm.planId} onValueChange={(v) => setCreateForm({ ...createForm, planId: v })}>
                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
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
              <Label>Status</Label>
              <Select value={createForm.status} onValueChange={(v) => setCreateForm({ ...createForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Auto-renew</p>
                <p className="text-xs text-muted-foreground">Automatically renew on expiry</p>
              </div>
              <Switch
                checked={createForm.autoRenew}
                onCheckedChange={(v) => setCreateForm({ ...createForm, autoRenew: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>Update subscription for {selected?.userFullName || selected?.userEmail}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={editForm.planId} onValueChange={(v) => setEditForm({ ...editForm, planId: v })}>
                <SelectTrigger><SelectValue placeholder="Keep current plan" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — ${p.price}/{p.billingPeriod}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Renewal Date</Label>
                <Input
                  type="date"
                  value={editForm.renewalDate}
                  onChange={(e) => setEditForm({ ...editForm, renewalDate: e.target.value })}
                  className="bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Auto-renew</p>
              <Switch
                checked={editForm.autoRenew}
                onCheckedChange={(v) => setEditForm({ ...editForm, autoRenew: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Trial Dialog */}
      <Dialog open={trialOpen} onOpenChange={setTrialOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Grant Trial</DialogTitle>
            <DialogDescription>
              Grant a trial period to {selected?.userFullName || selected?.userEmail}. This will end
              any of their active, trial, paused, or pending-payment subscriptions first — including
              a currently paid plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Trial Days</Label>
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
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={trialNotes}
                onChange={(e) => setTrialNotes(e.target.value)}
                placeholder="Reason for trial..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialOpen(false)}>Cancel</Button>
            <Button onClick={handleGrantTrial} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Gift className="w-4 h-4 mr-2" />
              Grant Trial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete subscription for {selected?.userFullName || selected?.userEmail}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-status-critical hover:bg-status-critical/90"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
