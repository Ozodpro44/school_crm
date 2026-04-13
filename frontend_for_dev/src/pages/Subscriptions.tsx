import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import {
  getUserSubscriptions,
  updateUserSubscription,
  deleteUserSubscription,
  getAllSubscriptionPlans,
  getPlatformStats,
  type AdminSubscriptionView,
  type SubscriptionPlan,
} from "@/services/subscription-api";

// ─── Internal display type ────────────────────────────────────────────────────

type DisplayStatus = "active" | "trial" | "expired" | "cancelled" | "paused" | "pending" | "past_due";

interface PaymentHistory {
  date: string;
  amount: number;
  status: "success" | "failed" | "pending";
  method: string;
}

interface Subscription {
  id: string;
  userFullName: string;
  userEmail: string;
  planId: string;
  planName: string;
  planPrice: number;
  billingPeriod: string;
  status: DisplayStatus;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  nextBilling?: string;
  paymentHistory: PaymentHistory[];
}

function normalizeStatus(raw: string): DisplayStatus {
  const map: Record<string, DisplayStatus> = {
    active: "active",
    trial: "trial",
    paused: "paused",
    cancelled: "cancelled",
    expired: "expired",
    pending_payment: "pending",
    past_due: "past_due",
  };
  return map[raw] ?? "active";
}

function mapView(sub: AdminSubscriptionView): Subscription {
  return {
    id: sub.id,
    userFullName: sub.userFullName || sub.userEmail,
    userEmail: sub.userEmail,
    planId: sub.planId,
    planName: sub.planName,
    planPrice: sub.planPrice,
    billingPeriod: sub.billingPeriod,
    status: normalizeStatus(sub.status),
    startDate: sub.startDate ? sub.startDate.split("T")[0] : "—",
    endDate: sub.endDate ? sub.endDate.split("T")[0] : "—",
    autoRenew: sub.autoRenew,
    nextBilling: sub.renewalDate ? sub.renewalDate.split("T")[0] : undefined,
    paymentHistory: [],
  };
}

// ─── Status UI config ─────────────────────────────────────────────────────────

const statusConfig: Record<DisplayStatus, { icon: typeof CheckCircle2; color: string; bgColor: string; label: string }> = {
  active:   { icon: CheckCircle2,  color: "text-status-healthy",   bgColor: "bg-status-healthy/15",  label: "Active" },
  trial:    { icon: Clock,         color: "text-status-info",      bgColor: "bg-status-info/15",     label: "Trial" },
  expired:  { icon: XCircle,       color: "text-status-critical",  bgColor: "bg-status-critical/15", label: "Expired" },
  cancelled:{ icon: AlertTriangle, color: "text-status-warning",   bgColor: "bg-status-warning/15",  label: "Cancelled" },
  paused:   { icon: Clock,         color: "text-status-warning",   bgColor: "bg-status-warning/15",  label: "Paused" },
  pending:  { icon: Clock,         color: "text-status-info",      bgColor: "bg-status-info/15",     label: "Pending Payment" },
  past_due: { icon: AlertTriangle, color: "text-status-critical",  bgColor: "bg-status-critical/15", label: "Past Due" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Subscriptions() {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [subscriptionData, setSubscriptionData] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [mrr, setMrr] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [subsResult, plansResult, statsResult] = await Promise.allSettled([
          getUserSubscriptions(),
          getAllSubscriptionPlans(),
          getPlatformStats(),
        ]);
        if (subsResult.status === "rejected") {
          const msg = subsResult.reason instanceof Error ? subsResult.reason.message : "Obunalarni yuklashda xatolik";
          setLoadError(msg);
        } else {
          setSubscriptionData(subsResult.value.map(mapView));
        }
        if (plansResult.status === "fulfilled") {
          setPlans(plansResult.value.filter((p) => p.status === "active"));
        }
        if (statsResult.status === "fulfilled") {
          setMrr(statsResult.value.mrr);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ─── Modal states ───────────────────────────────────────────────────────────

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isRenewDialogOpen, setIsRenewDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [editPlanId, setEditPlanId] = useState("");
  const [editAutoRenew, setEditAutoRenew] = useState(true);
  const [saving, setSaving] = useState(false);

  // ─── Derived counts ─────────────────────────────────────────────────────────

  const activeCount = subscriptionData.filter((s) => s.status === "active").length;
  const trialCount  = subscriptionData.filter((s) => s.status === "trial").length;
  const expiredCount= subscriptionData.filter((s) => s.status === "expired").length;

  const filteredSubscriptions = subscriptionData.filter(
    (sub) => selectedStatus === "all" || sub.status === selectedStatus
  );

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("uz-UZ", { style: "currency", currency: "UZS", maximumFractionDigits: 0 }).format(value);

  const openViewModal = (sub: Subscription) => { setSelectedSubscription(sub); setIsViewModalOpen(true); };
  const openEditModal = (sub: Subscription) => {
    setSelectedSubscription(sub);
    setEditPlanId(sub.planId);
    setEditAutoRenew(sub.autoRenew);
    setIsEditModalOpen(true);
  };
  const openHistoryModal = (sub: Subscription) => { setSelectedSubscription(sub); setIsHistoryModalOpen(true); };
  const openRenewDialog  = (sub: Subscription) => { setSelectedSubscription(sub); setIsRenewDialogOpen(true); };
  const openCancelDialog = (sub: Subscription) => { setSelectedSubscription(sub); setIsCancelDialogOpen(true); };
  const openDeleteDialog = (sub: Subscription) => { setSelectedSubscription(sub); setIsDeleteDialogOpen(true); };

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const toggleAutoRenew = (id: string) => {
    setSubscriptionData((prev) =>
      prev.map((sub) => {
        if (sub.id !== id) return sub;
        const newVal = !sub.autoRenew;
        updateUserSubscription(id, { autoRenew: newVal }).catch(console.error);
        return { ...sub, autoRenew: newVal };
      })
    );
    toast.success("Auto-renew updated");
  };

  const handleChangePlan = async () => {
    if (!selectedSubscription) return;
    setSaving(true);
    try {
      const updated = await updateUserSubscription(selectedSubscription.id, {
        planId: editPlanId,
        autoRenew: editAutoRenew,
      });
      setSubscriptionData((prev) =>
        prev.map((sub) => (sub.id === selectedSubscription.id ? mapView(updated) : sub))
      );
      setIsEditModalOpen(false);
      toast.success("Subscription plan updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update plan");
    } finally {
      setSaving(false);
    }
  };

  const handleRenewSubscription = async () => {
    if (!selectedSubscription) return;
    setSaving(true);
    try {
      const updated = await updateUserSubscription(selectedSubscription.id, { status: "active" });
      setSubscriptionData((prev) =>
        prev.map((sub) => (sub.id === selectedSubscription.id ? mapView(updated) : sub))
      );
      setIsRenewDialogOpen(false);
      toast.success("Subscription renewed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to renew");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!selectedSubscription) return;
    setSaving(true);
    try {
      const updated = await updateUserSubscription(selectedSubscription.id, { status: "cancelled" });
      setSubscriptionData((prev) =>
        prev.map((sub) => (sub.id === selectedSubscription.id ? mapView(updated) : sub))
      );
      setIsCancelDialogOpen(false);
      toast.success("Subscription cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubscription = async () => {
    if (!selectedSubscription) return;
    setSaving(true);
    try {
      await deleteUserSubscription(selectedSubscription.id);
      setSubscriptionData((prev) => prev.filter((sub) => sub.id !== selectedSubscription.id));
      setIsDeleteDialogOpen(false);
      toast.success("Subscription deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscriptions & Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage tenant subscriptions and payment status
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-healthy/15 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-status-healthy" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-info/15 flex items-center justify-center">
              <Clock className="w-5 h-5 text-status-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{trialCount}</p>
              <p className="text-sm text-muted-foreground">In Trial</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-critical/15 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-status-critical" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{expiredCount}</p>
              <p className="text-sm text-muted-foreground">Expired</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(mrr)}</p>
              <p className="text-sm text-muted-foreground">MRR</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="glass-card rounded-lg p-4 mb-6">
        <div className="flex items-center gap-4">
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-48 bg-background">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subscriptions</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="pending">Pending Payment</SelectItem>
              <SelectItem value="past_due">Past Due</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Obunalar yuklanmoqda...</div>
        ) : loadError ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-status-critical/15 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-status-critical" />
            </div>
            <p className="font-medium text-foreground mb-1">Server xatosi</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {subscriptionData.length === 0
              ? "Obunalar topilmadi"
              : "Tanlangan filtrga mos obunalar yo'q"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-3 px-4 font-medium">Tenant</th>
                  <th className="text-left py-3 px-4 font-medium">Plan</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Period</th>
                  <th className="text-right py-3 px-4 font-medium">Price</th>
                  <th className="text-left py-3 px-4 font-medium">Next Billing</th>
                  <th className="text-center py-3 px-4 font-medium">Auto Renew</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.map((sub) => {
                  const cfg = statusConfig[sub.status] ?? statusConfig.active;
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={sub.id} className="data-table-row border-b border-border last:border-0">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <span className="font-medium text-foreground">{sub.userFullName}</span>
                            <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="badge-status bg-accent text-accent-foreground">
                          {sub.planName}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "badge-status capitalize flex items-center gap-1 w-fit",
                          cfg.bgColor,
                          cfg.color
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-muted-foreground">
                          <div>{sub.startDate}</div>
                          <div>to {sub.endDate}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-medium text-foreground">
                          {sub.planPrice > 0 ? formatCurrency(sub.planPrice) : "Free"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {sub.nextBilling ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {sub.nextBilling}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Switch
                          checked={sub.autoRenew}
                          onCheckedChange={() => toggleAutoRenew(sub.id)}
                          disabled={sub.status === "expired" || sub.status === "cancelled"}
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
                            <DropdownMenuItem onClick={() => openViewModal(sub)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditModal(sub)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Change Plan
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openHistoryModal(sub)}>
                              <Receipt className="w-4 h-4 mr-2" />
                              Payment History
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {(sub.status === "expired" || sub.status === "cancelled") && (
                              <DropdownMenuItem onClick={() => openRenewDialog(sub)}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Renew Subscription
                              </DropdownMenuItem>
                            )}
                            {sub.status === "active" && (
                              <DropdownMenuItem
                                className="text-status-critical"
                                onClick={() => openCancelDialog(sub)}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Cancel Subscription
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-status-critical"
                              onClick={() => openDeleteDialog(sub)}
                            >
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

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subscription Details</DialogTitle>
            <DialogDescription>Full subscription information for this tenant.</DialogDescription>
          </DialogHeader>
          {selectedSubscription && (() => {
            const cfg = statusConfig[selectedSubscription.status] ?? statusConfig.active;
            return (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{selectedSubscription.userFullName}</h3>
                    <p className="text-sm text-muted-foreground">{selectedSubscription.userEmail}</p>
                    <span className={cn("badge-status capitalize", cfg.bgColor, cfg.color)}>
                      {cfg.label}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Plan</p>
                    <p className="font-medium text-foreground">{selectedSubscription.planName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="font-medium text-foreground">
                      {selectedSubscription.planPrice > 0 ? formatCurrency(selectedSubscription.planPrice) : "Free"}
                      <span className="text-xs text-muted-foreground ml-1">/{selectedSubscription.billingPeriod}</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="font-medium text-foreground">{selectedSubscription.startDate}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">End Date</p>
                    <p className="font-medium text-foreground">{selectedSubscription.endDate}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Next Billing</p>
                    <p className="font-medium text-foreground">{selectedSubscription.nextBilling || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Auto Renew</p>
                    <p className="font-medium text-foreground">{selectedSubscription.autoRenew ? "Yes" : "No"}</p>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>Close</Button>
            <Button onClick={() => { setIsViewModalOpen(false); if (selectedSubscription) openEditModal(selectedSubscription); }}>
              Change Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit / Change Plan Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              Update the plan for {selectedSubscription?.userFullName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="plan">Subscription Plan</Label>
              <Select value={editPlanId} onValueChange={setEditPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.price > 0 ? formatCurrency(p.price) : "Free"}/{p.billingPeriod}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Auto Renew</p>
                <p className="text-sm text-muted-foreground">Automatically renew subscription</p>
              </div>
              <Switch
                checked={editAutoRenew}
                onCheckedChange={setEditAutoRenew}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePlan} disabled={saving}>
              {saving ? "Saving…" : "Update Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Modal */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              Payment records for {selectedSubscription?.userFullName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-80 overflow-y-auto">
            {selectedSubscription?.paymentHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No payment history available</p>
            ) : (
              selectedSubscription?.paymentHistory.map((payment, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      payment.status === "success" && "bg-status-healthy/15",
                      payment.status === "failed"  && "bg-status-critical/15",
                      payment.status === "pending" && "bg-status-warning/15"
                    )}>
                      {payment.status === "success" && <CheckCircle2 className="w-4 h-4 text-status-healthy" />}
                      {payment.status === "failed"  && <XCircle     className="w-4 h-4 text-status-critical" />}
                      {payment.status === "pending" && <Clock        className="w-4 h-4 text-status-warning" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-muted-foreground">{payment.date} • {payment.method}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "badge-status capitalize",
                    payment.status === "success" && "badge-healthy",
                    payment.status === "failed"  && "badge-critical",
                    payment.status === "pending" && "badge-warning"
                  )}>
                    {payment.status}
                  </span>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renew Dialog */}
      <AlertDialog open={isRenewDialogOpen} onOpenChange={setIsRenewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renew Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Set subscription status to active for {selectedSubscription?.userFullName}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenewSubscription} disabled={saving}>
              {saving ? "Renewing…" : "Renew Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Cancel subscription for {selectedSubscription?.userFullName}? Access will be revoked immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={saving}
              className="bg-status-critical hover:bg-status-critical/90"
            >
              {saving ? "Cancelling…" : "Cancel Subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete subscription record for {selectedSubscription?.userFullName}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubscription}
              disabled={saving}
              className="bg-status-critical hover:bg-status-critical/90"
            >
              {saving ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
