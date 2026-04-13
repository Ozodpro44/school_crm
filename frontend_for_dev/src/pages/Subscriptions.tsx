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
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  type UserSubscription as BackendSub,
} from "@/services/subscription-api";
import { apiClient } from "@/services/api-client";

type SubscriptionStatus = "active" | "trial" | "expired" | "cancelled";
type SubscriptionPlan = "trial" | "monthly" | "yearly";

interface PaymentHistory {
  date: string;
  amount: number;
  status: "success" | "failed" | "pending";
  method: string;
}

interface Subscription {
  id: string;
  branchName: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  amount: number;
  autoRenew: boolean;
  lastPayment?: string;
  nextBilling?: string;
  paymentHistory: PaymentHistory[];
}

function mapBackendSubscription(
  sub: BackendSub,
  branchMap: Record<string, string>
): Subscription {
  const statusMap: Record<string, SubscriptionStatus> = {
    active: "active",
    paused: "trial",
    cancelled: "cancelled",
    expired: "expired",
  };
  return {
    id: sub.id,
    branchName: branchMap[sub.branchId || ""] || sub.branchId || "Unknown Branch",
    plan: "monthly",
    status: statusMap[sub.status] ?? "active",
    startDate: sub.startDate ? sub.startDate.split("T")[0] : "—",
    endDate: sub.endDate ? sub.endDate.split("T")[0] : "—",
    amount: 0,
    autoRenew: sub.autoRenew,
    nextBilling: sub.renewalDate ? sub.renewalDate.split("T")[0] : undefined,
    paymentHistory: [],
  };
}

const statusConfig: Record<SubscriptionStatus, { icon: typeof CheckCircle2; color: string; bgColor: string }> = {
  active: { icon: CheckCircle2, color: "text-status-healthy", bgColor: "bg-status-healthy/15" },
  trial: { icon: Clock, color: "text-status-info", bgColor: "bg-status-info/15" },
  expired: { icon: XCircle, color: "text-status-critical", bgColor: "bg-status-critical/15" },
  cancelled: { icon: AlertTriangle, color: "text-status-warning", bgColor: "bg-status-warning/15" },
};

const planLabels: Record<SubscriptionPlan, string> = {
  trial: "14-Day Trial",
  monthly: "Monthly",
  yearly: "Yearly",
};

const planPrices: Record<SubscriptionPlan, number> = {
  trial: 0,
  monthly: 25000,
  yearly: 240000,
};

export default function Subscriptions() {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [subscriptionData, setSubscriptionData] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [branchesResult, subsResult] = await Promise.allSettled([
          apiClient.getBranches(),
          getUserSubscriptions(),
        ]);

        const branchMap: Record<string, string> = {};
        if (branchesResult.status === "fulfilled") {
          for (const b of branchesResult.value) {
            if (b.id) branchMap[b.id] = b.name;
          }
        }

        if (subsResult.status === "fulfilled" && subsResult.value.length > 0) {
          setSubscriptionData(
            subsResult.value.map((s) => mapBackendSubscription(s, branchMap))
          );
        }
      } catch {
        // No data from backend — page stays empty
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Modal states
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isRenewDialogOpen, setIsRenewDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    plan: "monthly" as SubscriptionPlan,
    autoRenew: true,
  });

  const filteredSubscriptions = subscriptionData.filter((sub) =>
    selectedStatus === "all" || sub.status === selectedStatus
  );

  const toggleAutoRenew = (id: string) => {
    setSubscriptionData((prev) =>
      prev.map((sub) => {
        if (sub.id !== id) return sub;
        const newVal = !sub.autoRenew;
        updateUserSubscription(id, { autoRenew: newVal }).catch(console.error);
        return { ...sub, autoRenew: newVal };
      })
    );
    toast.success("Auto-renew setting updated");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("uz-UZ", {
      style: "currency",
      currency: "UZS",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleChangePlan = () => {
    if (!selectedSubscription) return;
    const now = new Date();
    const endDate = formData.plan === "yearly" 
      ? new Date(now.setFullYear(now.getFullYear() + 1))
      : new Date(now.setMonth(now.getMonth() + 1));
    
    setSubscriptionData((prev) =>
      prev.map((sub) =>
        sub.id === selectedSubscription.id
          ? { 
              ...sub, 
              plan: formData.plan,
              amount: planPrices[formData.plan],
              autoRenew: formData.autoRenew,
              status: formData.plan === "trial" ? "trial" : "active",
              endDate: endDate.toISOString().split("T")[0],
            }
          : sub
      )
    );
    setIsEditModalOpen(false);
    setSelectedSubscription(null);
    toast.success("Subscription plan updated");
  };

  const handleRenewSubscription = () => {
    if (!selectedSubscription) return;
    const now = new Date();
    const endDate = selectedSubscription.plan === "yearly"
      ? new Date(now.setFullYear(now.getFullYear() + 1))
      : new Date(now.setMonth(now.getMonth() + 1));

    updateUserSubscription(selectedSubscription.id, { status: "active" }).catch(console.error);
    setSubscriptionData((prev) =>
      prev.map((sub) =>
        sub.id === selectedSubscription.id
          ? {
              ...sub,
              status: "active",
              startDate: new Date().toISOString().split("T")[0],
              endDate: endDate.toISOString().split("T")[0],
              lastPayment: new Date().toISOString().split("T")[0],
              nextBilling: endDate.toISOString().split("T")[0],
              paymentHistory: [
                { date: new Date().toISOString().split("T")[0], amount: sub.amount, status: "success", method: "Card" },
                ...sub.paymentHistory,
              ],
            }
          : sub
      )
    );
    setIsRenewDialogOpen(false);
    setSelectedSubscription(null);
    toast.success("Subscription renewed successfully");
  };

  const handleCancelSubscription = () => {
    if (!selectedSubscription) return;
    updateUserSubscription(selectedSubscription.id, { status: "cancelled" }).catch(console.error);
    setSubscriptionData((prev) =>
      prev.map((sub) =>
        sub.id === selectedSubscription.id
          ? { ...sub, status: "cancelled", autoRenew: false }
          : sub
      )
    );
    setIsCancelDialogOpen(false);
    setSelectedSubscription(null);
    toast.success("Subscription cancelled");
  };

  const openViewModal = (sub: Subscription) => {
    setSelectedSubscription(sub);
    setIsViewModalOpen(true);
  };

  const openEditModal = (sub: Subscription) => {
    setSelectedSubscription(sub);
    setFormData({ plan: sub.plan, autoRenew: sub.autoRenew });
    setIsEditModalOpen(true);
  };

  const openHistoryModal = (sub: Subscription) => {
    setSelectedSubscription(sub);
    setIsHistoryModalOpen(true);
  };

  const openRenewDialog = (sub: Subscription) => {
    setSelectedSubscription(sub);
    setIsRenewDialogOpen(true);
  };

  const openCancelDialog = (sub: Subscription) => {
    setSelectedSubscription(sub);
    setIsCancelDialogOpen(true);
  };

  const activeCount = subscriptionData.filter((s) => s.status === "active").length;
  const trialCount = subscriptionData.filter((s) => s.status === "trial").length;
  const expiredCount = subscriptionData.filter((s) => s.status === "expired").length;
  const mrr = subscriptionData
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + (s.plan === "yearly" ? s.amount / 12 : s.amount), 0);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscriptions & Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage branch subscriptions and payment status
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
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading subscriptions...</div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {subscriptionData.length === 0
              ? "No subscription data available from backend"
              : "No subscriptions match the selected filter"}
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left py-3 px-4 font-medium">Branch</th>
                <th className="text-left py-3 px-4 font-medium">Plan</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-left py-3 px-4 font-medium">Period</th>
                <th className="text-right py-3 px-4 font-medium">Amount</th>
                <th className="text-left py-3 px-4 font-medium">Next Billing</th>
                <th className="text-center py-3 px-4 font-medium">Auto Renew</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubscriptions.map((sub) => {
                const StatusIcon = statusConfig[sub.status].icon;
                return (
                  <tr key={sub.id} className="data-table-row border-b border-border last:border-0">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium text-foreground">{sub.branchName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge-status bg-accent text-accent-foreground">
                        {planLabels[sub.plan]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "badge-status capitalize flex items-center gap-1 w-fit",
                        statusConfig[sub.status].bgColor,
                        statusConfig[sub.status].color
                      )}>
                        <StatusIcon className="w-3 h-3" />
                        {sub.status}
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
                        {sub.amount > 0 ? formatCurrency(sub.amount) : "Free"}
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

      {/* View Subscription Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subscription Details</DialogTitle>
            <DialogDescription>
              Full subscription information for this branch.
            </DialogDescription>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedSubscription.branchName}</h3>
                  <span className={cn(
                    "badge-status capitalize",
                    statusConfig[selectedSubscription.status].bgColor,
                    statusConfig[selectedSubscription.status].color
                  )}>
                    {selectedSubscription.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="font-medium text-foreground">{planLabels[selectedSubscription.plan]}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="font-medium text-foreground">
                    {selectedSubscription.amount > 0 ? formatCurrency(selectedSubscription.amount) : "Free"}
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
                  <p className="text-xs text-muted-foreground">Last Payment</p>
                  <p className="font-medium text-foreground">{selectedSubscription.lastPayment || "—"}</p>
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
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setIsViewModalOpen(false);
              if (selectedSubscription) openEditModal(selectedSubscription);
            }}>
              Change Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Change Plan Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              Update the subscription plan for {selectedSubscription?.branchName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="plan">Subscription Plan</Label>
              <Select 
                value={formData.plan} 
                onValueChange={(val) => setFormData({ ...formData, plan: val as SubscriptionPlan })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">14-Day Trial (Free)</SelectItem>
                  <SelectItem value="monthly">Monthly ({formatCurrency(25000)}/month)</SelectItem>
                  <SelectItem value="yearly">Yearly ({formatCurrency(240000)}/year)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Auto Renew</p>
                <p className="text-sm text-muted-foreground">Automatically renew subscription</p>
              </div>
              <Switch
                checked={formData.autoRenew}
                onCheckedChange={(checked) => setFormData({ ...formData, autoRenew: checked })}
              />
            </div>
            {formData.plan !== "trial" && (
              <div className="p-3 bg-accent/30 rounded-lg">
                <p className="text-sm text-foreground">
                  New billing amount: <span className="font-semibold">{formatCurrency(planPrices[formData.plan])}</span>
                  {formData.plan === "yearly" && (
                    <span className="text-status-healthy ml-2">(Save 20%)</span>
                  )}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePlan}>
              Update Plan
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
              Payment records for {selectedSubscription?.branchName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-80 overflow-y-auto">
            {selectedSubscription?.paymentHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No payment history</p>
            ) : (
              selectedSubscription?.paymentHistory.map((payment, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      payment.status === "success" && "bg-status-healthy/15",
                      payment.status === "failed" && "bg-status-critical/15",
                      payment.status === "pending" && "bg-status-warning/15"
                    )}>
                      {payment.status === "success" && <CheckCircle2 className="w-4 h-4 text-status-healthy" />}
                      {payment.status === "failed" && <XCircle className="w-4 h-4 text-status-critical" />}
                      {payment.status === "pending" && <Clock className="w-4 h-4 text-status-warning" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-muted-foreground">{payment.date} • {payment.method}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "badge-status capitalize",
                    payment.status === "success" && "badge-healthy",
                    payment.status === "failed" && "badge-critical",
                    payment.status === "pending" && "badge-warning"
                  )}>
                    {payment.status}
                  </span>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renew Subscription Dialog */}
      <AlertDialog open={isRenewDialogOpen} onOpenChange={setIsRenewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renew Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Renew the subscription for {selectedSubscription?.branchName}? 
              This will charge {selectedSubscription && formatCurrency(selectedSubscription.amount)} for the {selectedSubscription?.plan} plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenewSubscription}>
              Renew Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the subscription for {selectedSubscription?.branchName}? 
              The branch will lose access to premium features at the end of the billing period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelSubscription} className="bg-status-critical hover:bg-status-critical/90">
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
