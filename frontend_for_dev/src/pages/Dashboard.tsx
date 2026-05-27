import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Calendar, RefreshCw, Users, TrendingUp, CheckCircle2, Clock,
  AlertTriangle, XCircle, FileText, CreditCard, Layers, Building2,
  CreditCard as PayCard, UserCheck, Activity, Zap, ExternalLink,
  Loader2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  getPlatformStats, getHealth, listSubscriptions,
  type PlatformStats, type HealthStatus, type AdminSubscription,
} from "@/services/api-client";

const QUICK_LINKS = [
  { label: "Logs",            href: "/logs",           icon: FileText,  desc: "View application logs"       },
  { label: "Subscriptions",   href: "/subscriptions",  icon: CreditCard, desc: "Manage billing"             },
  { label: "Plans",           href: "/plans",          icon: Layers,    desc: "Subscription plans"          },
  { label: "Payment Types",   href: "/payment-types",  icon: PayCard,   desc: "Payment methods"             },
  { label: "Users",           href: "/users",          icon: UserCheck, desc: "CRM users"                   },
  { label: "Branches",        href: "/branches",       icon: Building2, desc: "School branches"             },
];

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function formatUptime(seconds?: number) {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const ok = s === "ok" || s === "healthy" || s === "up";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full",
      ok ? "bg-status-healthy/15 text-status-healthy" : "bg-status-critical/15 text-status-critical"
    )}>
      <span className={ok ? "pulse-dot" : "pulse-dot-error"} />
      {status || "unknown"}
    </span>
  );
}

function subStatusClass(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "active")    return "badge-active";
  if (s === "trial")     return "badge-trial";
  if (s === "expired")   return "badge-expired";
  if (s === "pending" || s === "pending_payment") return "badge-pending";
  if (s === "cancelled") return "badge-cancelled";
  if (s === "paused")    return "badge-paused";
  return "badge-cancelled";
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [recentSubs, setRecentSubs] = useState<AdminSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [time, setTime] = useState(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, healthRes, subsRes] = await Promise.allSettled([
        getPlatformStats(),
        getHealth(),
        listSubscriptions(),
      ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (healthRes.status === "fulfilled") setHealth(healthRes.value);
      if (subsRes.status === "fulfilled") {
        const sorted = [...subsRes.value].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setRecentSubs(sorted.slice(0, 8));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load data";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(fetchAll, 30_000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, fetchAll]);

  const statCards = [
    { label: "Total Users",    value: stats?.totalUsers ?? "—",          icon: Users,        color: "text-primary",          bg: "bg-primary/15"             },
    { label: "MRR",            value: stats ? formatUSD(stats.mrr) : "—", icon: TrendingUp,  color: "text-status-healthy",   bg: "bg-status-healthy/15"      },
    { label: "Active Subs",    value: stats?.activeSubscriptions ?? "—", icon: CheckCircle2, color: "text-status-healthy",   bg: "bg-status-healthy/15"      },
    { label: "Trial Subs",     value: stats?.trialSubscriptions ?? "—",  icon: Clock,        color: "text-status-info",      bg: "bg-status-info/15"         },
    { label: "Pending",        value: stats?.pendingSubscriptions ?? "—",icon: AlertTriangle,color: "text-status-warning",   bg: "bg-status-warning/15"      },
    { label: "Expired",        value: stats?.expiredSubscriptions ?? "—",icon: XCircle,      color: "text-status-critical",  bg: "bg-status-critical/15"     },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Overview</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Calendar className="w-4 h-4" />
            <span className="font-mono">
              {time.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              {" — "}
              {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-2", autoRefresh && "border-primary/50 text-primary")}
            onClick={() => setAutoRefresh((v) => !v)}
          >
            <Activity className="w-4 h-4" />
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh"}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchAll} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-lg border border-status-critical/30 bg-status-critical/10 text-status-critical">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-6 animate-fade-in">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="stat-card">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bg)}>
                <Icon className={cn("w-4 h-4", color)} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground font-mono">{loading ? "—" : String(value)}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Health Row */}
        <div className="glass-card rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Health Status</h2>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking health...
            </div>
          ) : health ? (
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <StatusBadge status={health.status} />
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Response:</span>
                <span className={cn(
                  "font-mono font-semibold",
                  health.responseTime < 200 ? "text-status-healthy" :
                  health.responseTime < 500 ? "text-status-warning" : "text-status-critical"
                )}>
                  {health.responseTime}ms
                </span>
              </div>
              {health.uptime != null && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Uptime:</span>
                  <span className="font-mono font-semibold text-foreground">{formatUptime(health.uptime)}</span>
                </div>
              )}
              {health.version && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="font-mono text-foreground">{health.version}</span>
                </div>
              )}
              {health.services && Object.entries(health.services).map(([svc, st]) => (
                <div key={svc} className="flex items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground capitalize">{svc}:</span>
                  <StatusBadge status={st} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Health data unavailable</p>
          )}
        </div>

        {/* Recent Subscriptions */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Recent Subscriptions</h2>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/subscriptions")}>
              View all <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : recentSubs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No subscriptions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left px-4 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium">Plan</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Price</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentSubs.map((sub) => (
                    <tr key={sub.id} className="hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{sub.userFullName || sub.userEmail}</p>
                        <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-foreground">{sub.planName}</td>
                      <td className="px-4 py-3">
                        <span className={subStatusClass(sub.status)}>{sub.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {sub.planPrice > 0 ? `$${sub.planPrice.toLocaleString()}` : "Free"}
                        <span className="text-xs text-muted-foreground">/{sub.billingPeriod}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                        {new Date(sub.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Quick Links</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {QUICK_LINKS.map(({ label, href, icon: Icon, desc }) => (
              <button
                key={label}
                onClick={() => navigate(href)}
                className="flex flex-col items-start gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-accent/30 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
