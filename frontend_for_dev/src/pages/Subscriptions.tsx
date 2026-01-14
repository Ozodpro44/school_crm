import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SubscriptionStatus = "active" | "trial" | "expired" | "cancelled";
type SubscriptionPlan = "trial" | "monthly" | "yearly";

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
}

const subscriptions: Subscription[] = [
  {
    id: "1",
    branchName: "Moscow Central",
    plan: "yearly",
    status: "active",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    amount: 240000,
    autoRenew: true,
    lastPayment: "2024-01-01",
    nextBilling: "2025-01-01",
  },
  {
    id: "2",
    branchName: "Saint Petersburg Main",
    plan: "monthly",
    status: "active",
    startDate: "2024-01-01",
    endDate: "2024-02-01",
    amount: 25000,
    autoRenew: true,
    lastPayment: "2024-01-01",
    nextBilling: "2024-02-01",
  },
  {
    id: "3",
    branchName: "Kazan Academy",
    plan: "monthly",
    status: "expired",
    startDate: "2023-12-01",
    endDate: "2024-01-01",
    amount: 25000,
    autoRenew: false,
    lastPayment: "2023-12-01",
  },
  {
    id: "4",
    branchName: "Sochi Campus",
    plan: "trial",
    status: "trial",
    startDate: "2024-01-07",
    endDate: "2024-01-21",
    amount: 0,
    autoRenew: false,
  },
  {
    id: "5",
    branchName: "Novosibirsk Center",
    plan: "yearly",
    status: "active",
    startDate: "2023-06-15",
    endDate: "2024-06-15",
    amount: 240000,
    autoRenew: true,
    lastPayment: "2023-06-15",
    nextBilling: "2024-06-15",
  },
];

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

export default function Subscriptions() {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [subscriptionData, setSubscriptionData] = useState(subscriptions);

  const filteredSubscriptions = subscriptionData.filter((sub) =>
    selectedStatus === "all" || sub.status === selectedStatus
  );

  const toggleAutoRenew = (id: string) => {
    setSubscriptionData((prev) =>
      prev.map((sub) =>
        sub.id === id ? { ...sub, autoRenew: !sub.autoRenew } : sub
      )
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value);
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
                      <Button variant="ghost" size="sm">
                        Manage
                      </Button>
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
