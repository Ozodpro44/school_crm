import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Activity,
  TrendingUp,
  Clock,
  AlertTriangle,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { apiClient } from "@/services/api-client";
import { toast } from "sonner";

interface LogEntry {
  id: string;
  level: string;
  message: string;
  module: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

interface HealthData {
  status: string;
  uptime?: number;
  responseTime?: number;
  activeConnections?: number;
  memoryUsage?: number;
  version?: string;
}

interface HourlyBucket {
  time: string;
  errors: number;
  total: number;
}

const ERROR_COLORS: Record<string, string> = {
  "500": "hsl(0, 72%, 40%)",
  "401": "hsl(0, 72%, 51%)",
  "404": "hsl(280, 65%, 60%)",
  "400": "hsl(38, 92%, 50%)",
  "Other": "hsl(215, 20%, 55%)",
};

export default function Analytics() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [healthData, logsData] = await Promise.allSettled([
        apiClient.healthCheck(),
        apiClient.getLogs(500),
      ]);

      if (healthData.status === "fulfilled") {
        // healthCheck() now injects a client-measured responseTime (ms)
        setHealth(healthData.value as HealthData);
      }
      if (logsData.status === "fulfilled") {
        setLogs(Array.isArray(logsData.value) ? logsData.value as LogEntry[] : []);
      }
      setLastRefresh(new Date());
    } catch {
      toast.error("Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute error rate from logs
  const errorLogs = logs.filter((l) => l.level === "ERROR");
  const warnLogs = logs.filter((l) => l.level === "WARN");
  const totalLogs = logs.length;
  const errorRate = totalLogs > 0 ? ((errorLogs.length / totalLogs) * 100).toFixed(1) : "0.0";

  // Build hourly buckets from logs for the area chart (last 12 hours)
  const hourlyData: Record<string, HourlyBucket> = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const h = new Date(now);
    h.setHours(now.getHours() - i, 0, 0, 0);
    const label = `${String(h.getHours()).padStart(2, "0")}:00`;
    hourlyData[label] = { time: label, errors: 0, total: 0 };
  }

  logs.forEach((log) => {
    const ts = new Date(log.timestamp);
    const diffH = Math.floor((now.getTime() - ts.getTime()) / (1000 * 60 * 60));
    if (diffH >= 0 && diffH < 12) {
      const label = `${String(ts.getHours()).padStart(2, "0")}:00`;
      if (hourlyData[label]) {
        hourlyData[label].total++;
        if (log.level === "ERROR") hourlyData[label].errors++;
      }
    }
  });
  const requestsData = Object.values(hourlyData);

  // Error distribution by module
  const moduleCounts: Record<string, number> = {};
  errorLogs.forEach((l) => {
    const mod = l.module || "Unknown";
    moduleCounts[mod] = (moduleCounts[mod] || 0) + 1;
  });
  const topModules = Object.entries(moduleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const pieColors = [
    "hsl(0, 72%, 51%)",
    "hsl(38, 92%, 50%)",
    "hsl(280, 65%, 60%)",
    "hsl(0, 72%, 40%)",
    "hsl(215, 20%, 55%)",
  ];
  const pieData = topModules.map(([name, value], i) => ({
    name,
    value,
    color: pieColors[i % pieColors.length],
  }));

  // Top endpoints from logs
  const endpointCounts: Record<string, { total: number; errors: number }> = {};
  logs.forEach((l) => {
    const ep = l.metadata?.endpoint || l.module || "unknown";
    if (!endpointCounts[ep]) endpointCounts[ep] = { total: 0, errors: 0 };
    endpointCounts[ep].total++;
    if (l.level === "ERROR") endpointCounts[ep].errors++;
  });
  const topEndpoints = Object.entries(endpointCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([endpoint, counts]) => ({
      endpoint,
      requests: counts.total,
      errorRate: counts.total > 0 ? +((counts.errors / counts.total) * 100).toFixed(1) : 0,
    }));

  const maxRequests = topEndpoints.reduce((m, e) => Math.max(m, e.requests), 1);

  const uptimePercent = health?.status === "ok" || health?.status === "healthy"
    ? "99.9%"
    : health?.status
    ? "degraded"
    : "—";

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Tahlili</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ishlash ko'rsatkichlari va API foydalanish statistikasi
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-primary text-sm"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          {loading ? "Refreshing..." : `Refreshed ${lastRefresh.toLocaleTimeString()}`}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="flex items-center gap-1 text-xs text-status-healthy">
              <TrendingUp className="w-3 h-3" /> live
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{loading ? "—" : totalLogs.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Log Entries (500 latest)</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground">/health</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {loading ? "—" : health?.responseTime != null ? `${health.responseTime}ms` : "—"}
          </p>
          <p className="text-sm text-muted-foreground">Javob vaqti (Response Time)</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-status-warning" />
            {!loading && parseFloat(errorRate) > 5 && (
              <span className="flex items-center gap-1 text-xs text-status-critical">
                <ArrowUpRight className="w-3 h-3" /> high
              </span>
            )}
            {!loading && parseFloat(errorRate) <= 5 && (
              <span className="flex items-center gap-1 text-xs text-status-healthy">
                <ArrowDownRight className="w-3 h-3" /> low
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground">{loading ? "—" : `${errorRate}%`}</p>
          <p className="text-sm text-muted-foreground">Error Rate</p>
        </div>
        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <Zap className="w-5 h-5 text-status-healthy" />
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              health?.status === "ok" || health?.status === "healthy"
                ? "bg-status-healthy/15 text-status-healthy"
                : "bg-status-critical/15 text-status-critical"
            )}>
              {loading ? "..." : health?.status || "unknown"}
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{loading ? "—" : uptimePercent}</p>
          <p className="text-sm text-muted-foreground">Uptime</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Log Activity Over Time */}
        <div className="xl:col-span-2 glass-card rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-4">Log Activity (Last 12h)</h3>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={requestsData}>
                  <defs>
                    <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(187, 85%, 53%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(187, 85%, 53%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="errorsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 16%)" />
                  <XAxis dataKey="time" stroke="hsl(215, 20%, 55%)" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(215, 20%, 55%)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222, 47%, 10%)",
                      border: "1px solid hsl(222, 47%, 16%)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area type="monotone" dataKey="total" name="Total" stroke="hsl(187, 85%, 53%)" strokeWidth={2} fill="url(#totalGradient)" />
                  <Area type="monotone" dataKey="errors" name="Errors" stroke="hsl(0, 72%, 51%)" strokeWidth={2} fill="url(#errorsGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Error Distribution by Module */}
        <div className="glass-card rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-4">Errors by Module</h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
          ) : pieData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Zap className="w-8 h-8 text-status-healthy opacity-50" />
              <p className="text-sm">No errors found</p>
            </div>
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(222, 47%, 10%)",
                        border: "1px solid hsl(222, 47%, 16%)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground truncate">{item.name}</span>
                    </div>
                    <span className="text-foreground font-medium ml-2">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Log Stats */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass-card rounded-lg p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-status-critical/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-status-critical" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{errorLogs.length}</p>
              <p className="text-sm text-muted-foreground">Errors</p>
            </div>
          </div>
          <div className="glass-card rounded-lg p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-status-warning/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-status-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{warnLogs.length}</p>
              <p className="text-sm text-muted-foreground">Warnings</p>
            </div>
          </div>
          <div className="glass-card rounded-lg p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-status-healthy/15 flex items-center justify-center">
              <Activity className="w-5 h-5 text-status-healthy" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalLogs - errorLogs.length - warnLogs.length}</p>
              <p className="text-sm text-muted-foreground">Info / Debug</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Modules Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Top Log Sources</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Barcha backend modullari — dev va school CRM loglarini o'z ichiga oladi
            </p>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
        ) : topEndpoints.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No log data available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-3 px-4 font-medium">Module / Endpoint</th>
                  <th className="text-right py-3 px-4 font-medium">Log Count</th>
                  <th className="text-right py-3 px-4 font-medium">Error Rate</th>
                  <th className="text-left py-3 px-4 font-medium w-48">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {topEndpoints.map((endpoint) => (
                  <tr key={endpoint.endpoint} className="data-table-row border-b border-border last:border-0">
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm text-foreground">{endpoint.endpoint}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-foreground">{endpoint.requests.toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={cn(
                        endpoint.errorRate > 10 && "text-status-critical",
                        endpoint.errorRate > 5 && endpoint.errorRate <= 10 && "text-status-warning",
                        endpoint.errorRate <= 5 && "text-status-healthy"
                      )}>
                        {endpoint.errorRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(endpoint.requests / maxRequests) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
