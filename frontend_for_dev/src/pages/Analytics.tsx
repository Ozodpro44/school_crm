import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Activity, Clock, AlertTriangle, RefreshCw, Loader2, Zap,
  AlertCircle, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getLogs, getHealth, type LogEntry, type HealthStatus } from "@/services/api-client";

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildHourlyBuckets(logs: LogEntry[]) {
  const now = new Date();
  const buckets: Record<string, { hour: string; errors: number; warnings: number; total: number }> = {};
  for (let i = 23; i >= 0; i--) {
    const h = new Date(now);
    h.setHours(now.getHours() - i, 0, 0, 0);
    const label = `${String(h.getHours()).padStart(2, "0")}:00`;
    buckets[label] = { hour: label, errors: 0, warnings: 0, total: 0 };
  }
  logs.forEach((log) => {
    const ts = new Date(log.timestamp);
    const diffH = Math.floor((now.getTime() - ts.getTime()) / 3_600_000);
    if (diffH >= 0 && diffH < 24) {
      const label = `${String(ts.getHours()).padStart(2, "0")}:00`;
      if (buckets[label]) {
        buckets[label].total++;
        if (log.level === "ERROR") buckets[label].errors++;
        if (log.level === "WARN")  buckets[label].warnings++;
      }
    }
  });
  return Object.values(buckets);
}

function buildLevelPie(logs: LogEntry[]) {
  const counts = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 };
  logs.forEach((l) => { if (l.level in counts) counts[l.level as keyof typeof counts]++; });
  return [
    { name: "DEBUG", value: counts.DEBUG, color: "hsl(215,20%,55%)"    },
    { name: "INFO",  value: counts.INFO,  color: "hsl(212,90%,58%)"    },
    { name: "WARN",  value: counts.WARN,  color: "hsl(38,90%,50%)"     },
    { name: "ERROR", value: counts.ERROR, color: "hsl(0,68%,50%)"      },
  ].filter((d) => d.value > 0);
}

function buildModuleActivity(logs: LogEntry[]) {
  const counts: Record<string, number> = {};
  logs.forEach((l) => {
    const m = l.module || "unknown";
    counts[m] = (counts[m] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([module, count]) => ({ module, count }));
}

const CHART_STYLE = {
  backgroundColor: "hsl(220,20%,8%)",
  border: "1px solid hsl(220,18%,14%)",
  borderRadius: "8px",
  fontSize: "11px",
  color: "hsl(210,18%,90%)",
};

export default function Analytics() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, logsRes] = await Promise.allSettled([
        getHealth(),
        getLogs({ limit: 500 }),
      ]);
      if (healthRes.status === "fulfilled") setHealth(healthRes.value);
      if (logsRes.status === "fulfilled")  setLogs(logsRes.value);
      setLastRefresh(new Date());
    } catch {
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived
  const errorLogs  = logs.filter((l) => l.level === "ERROR");
  const warnLogs   = logs.filter((l) => l.level === "WARN");
  const totalLogs  = logs.length;
  const errorRate  = totalLogs > 0 ? ((errorLogs.length / totalLogs) * 100).toFixed(1) : "0.0";

  const hourlyData    = buildHourlyBuckets(logs);
  const levelPieData  = buildLevelPie(logs);
  const moduleData    = buildModuleActivity(logs);
  const maxModule     = moduleData[0]?.count || 1;

  const lastErrors = [...errorLogs].reverse().slice(0, 10);

  const healthOk = health && (health.status === "ok" || health.status === "healthy" || health.status === "up");

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">API performance and log analytics</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={fetchData}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? "Loading…" : `Refreshed ${lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <Activity className="w-5 h-5 text-primary" />
            <span className="text-xs text-status-healthy flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" /> live
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground font-mono">{loading ? "—" : totalLogs.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Log entries</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <Clock className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground">/health</span>
          </div>
          <p className={cn(
            "text-2xl font-bold font-mono",
            !health ? "text-foreground" :
            health.responseTime < 200 ? "text-status-healthy" :
            health.responseTime < 500 ? "text-status-warning" : "text-status-critical"
          )}>
            {loading ? "—" : health ? `${health.responseTime}ms` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Response time</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <AlertTriangle className="w-5 h-5 text-status-warning" />
            {!loading && (
              parseFloat(errorRate) > 5
                ? <span className="text-xs text-status-critical flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" />high</span>
                : <span className="text-xs text-status-healthy flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3" />low</span>
            )}
          </div>
          <p className={cn(
            "text-2xl font-bold font-mono",
            parseFloat(errorRate) > 5 ? "text-status-critical" : "text-status-healthy"
          )}>
            {loading ? "—" : `${errorRate}%`}
          </p>
          <p className="text-xs text-muted-foreground">Error rate</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <Zap className="w-5 h-5 text-status-healthy" />
            <span className={cn(
              "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
              healthOk
                ? "bg-status-healthy/15 text-status-healthy"
                : "bg-status-critical/15 text-status-critical"
            )}>
              {loading ? "…" : health?.status || "—"}
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground font-mono">
            {loading ? "—" : health?.version || (healthOk ? "99.9%" : "degraded")}
          </p>
          <p className="text-xs text-muted-foreground">Version / Status</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Error Rate Chart */}
        <div className="xl:col-span-2 glass-card rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Errors by Hour (Last 24h)</h3>
          {loading ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(0,68%,50%)"  stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(0,68%,50%)"  stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="warnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(38,90%,50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(38,90%,50%)" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,18%,14%)" />
                  <XAxis dataKey="hour" stroke="hsl(215,14%,46%)" fontSize={10} tickLine={false} />
                  <YAxis stroke="hsl(215,14%,46%)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={CHART_STYLE} />
                  <Area type="monotone" dataKey="errors"   name="Errors"   stroke="hsl(0,68%,50%)"  strokeWidth={2} fill="url(#errGrad)"  />
                  <Area type="monotone" dataKey="warnings" name="Warnings" stroke="hsl(38,90%,50%)" strokeWidth={2} fill="url(#warnGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Level Distribution Pie */}
        <div className="glass-card rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Log Level Distribution</h3>
          {loading ? (
            <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
            </div>
          ) : levelPieData.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Zap className="w-8 h-8 opacity-30" />
              <p className="text-xs">No log data</p>
            </div>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={levelPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value">
                      {levelPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1.5">
                {levelPieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-mono font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Module Activity + Health + Recent Errors */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Top Modules Bar Chart */}
        <div className="xl:col-span-2 glass-card rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Module Activity (Top 10)</h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
            </div>
          ) : moduleData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Activity className="w-8 h-8 opacity-30" />
              <p className="text-xs">No module data</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moduleData} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,18%,14%)" horizontal={false} />
                  <XAxis type="number" stroke="hsl(215,14%,46%)" fontSize={10} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="module"
                    stroke="hsl(215,14%,46%)"
                    fontSize={10}
                    tickLine={false}
                    width={80}
                    tick={{ fontFamily: "JetBrains Mono, monospace" }}
                  />
                  <Tooltip contentStyle={CHART_STYLE} />
                  <Bar dataKey="count" name="Log Count" fill="hsl(152,76%,48%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Health + Recent Errors */}
        <div className="space-y-4">
          {/* Health Metrics */}
          <div className="glass-card rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Health Metrics</h3>
            {health ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn("font-semibold font-mono", healthOk ? "text-status-healthy" : "text-status-critical")}>
                    {health.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Response</span>
                  <span className={cn(
                    "font-mono",
                    health.responseTime < 200 ? "text-status-healthy" :
                    health.responseTime < 500 ? "text-status-warning" : "text-status-critical"
                  )}>
                    {health.responseTime}ms
                  </span>
                </div>
                {health.uptime != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Uptime</span>
                    <span className="font-mono text-foreground">
                      {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m
                    </span>
                  </div>
                )}
                {health.version && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version</span>
                    <span className="font-mono text-foreground">{health.version}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Health data unavailable</p>
            )}
          </div>

          {/* Recent Errors */}
          <div className="glass-card rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-status-critical" />
              <h3 className="text-sm font-semibold text-foreground">Recent Errors</h3>
              <span className="ml-auto text-xs text-muted-foreground">{errorLogs.length} total</span>
            </div>
            {lastErrors.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No errors found</div>
            ) : (
              <div className="divide-y divide-border max-h-64 overflow-y-auto scrollbar-thin">
                {lastErrors.map((log) => (
                  <div key={log.id} className="px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <code className="text-[10px] font-mono text-primary">{log.module}</code>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(log.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
