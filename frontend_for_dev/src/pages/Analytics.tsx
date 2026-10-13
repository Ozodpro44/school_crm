import { useMemo } from "react";
import { Activity, Clock, Gauge, ShieldAlert } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/kit/PageHeader";
import { Stat } from "@/components/kit/Stat";
import { StatusPill } from "@/components/kit/StatusPill";
import { EmptyState, ErrorNotice } from "@/components/kit/States";
import { RefreshButton } from "@/components/kit/Toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";
import { useResource } from "@/hooks/useResource";
import { orEmpty } from "@/lib/empty";
import { formatDateTime, formatUptime, localeOf } from "@/lib/format";
import { getHealth, getLogs, type HealthStatus, type LogEntry } from "@/services/api-client";

interface Snapshot { logs: LogEntry[]; health: HealthStatus | null; failed: boolean }

const SAMPLE = 500;
const C = {
  error: "hsl(var(--status-critical))",
  warn: "hsl(var(--status-warning))",
  info: "hsl(var(--status-info))",
  debug: "hsl(var(--muted-foreground))",
  primary: "hsl(var(--chart-1))",
  grid: "hsl(var(--chart-grid))",
  axis: "hsl(var(--muted-foreground))",
};

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
};

function hourlyBuckets(logs: LogEntry[]) {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  // Index buckets by absolute hour so a log from 24h ago can't land in the current hour's bucket.
  const buckets = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(start.getTime() - (23 - i) * 3_600_000);
    return { key: d.getTime(), hour: `${String(d.getHours()).padStart(2, "0")}:00`, errors: 0, warnings: 0 };
  });
  for (const log of logs) {
    const ts = new Date(log.timestamp);
    ts.setMinutes(0, 0, 0);
    const b = buckets.find((x) => x.key === ts.getTime());
    if (!b) continue;
    if (log.level === "ERROR") b.errors++;
    else if (log.level === "WARN") b.warnings++;
  }
  return buckets;
}

export default function Analytics() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const res = useResource<Snapshot>(async () => {
    const [health, logs] = await Promise.allSettled([getHealth(), getLogs({ limit: SAMPLE })]);
    if (logs.status === "rejected" && health.status === "rejected") throw logs.reason;
    return {
      logs: logs.status === "fulfilled" ? logs.value : [],
      health: health.status === "fulfilled" ? health.value : null,
      failed: logs.status === "rejected",
    };
  }, t("failedToLoadAnalytics"));

  const logs = orEmpty(res.data?.logs);
  const health = res.data?.health ?? null;
  const loading = res.loading;

  const derived = useMemo(() => {
    const errors = logs.filter((l) => l.level === "ERROR");
    const counts = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 };
    const modules = new Map<string, number>();
    for (const l of logs) {
      counts[l.level]++;
      const m = l.module || "unknown";
      modules.set(m, (modules.get(m) ?? 0) + 1);
    }
    return {
      errors,
      errorRate: logs.length ? (errors.length / logs.length) * 100 : 0,
      hourly: hourlyBuckets(logs),
      pie: [
        { name: "DEBUG", value: counts.DEBUG, color: C.debug },
        { name: "INFO", value: counts.INFO, color: C.info },
        { name: "WARN", value: counts.WARN, color: C.warn },
        { name: "ERROR", value: counts.ERROR, color: C.error },
      ].filter((d) => d.value > 0),
      modules: Array.from(modules.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([module, count]) => ({ module, count })),
      // The API returns newest first — the latest errors are the head of the list.
      latestErrors: errors.slice(0, 10),
    };
  }, [logs]);

  const healthy = !!health && ["ok", "healthy", "up"].includes((health.status || "").toLowerCase());
  const rt = health?.responseTime;
  const rtTone = rt == null ? "neutral" : rt < 200 ? "healthy" : rt < 500 ? "warning" : "critical";
  const rateHigh = derived.errorRate > 5;

  return (
    <DashboardLayout>
      <PageHeader
        title={t("analyticsTitle")}
        description={logs.length ? tf(t("basedOnLatestEntries"), { n: logs.length }) : t("apiPerformanceAndLogAnalytics")}
        actions={<RefreshButton onClick={() => void res.reload()} busy={res.fetching} />}
      />

      {res.error && <ErrorNotice message={res.error} onRetry={() => void res.reload()} />}
      {!res.error && res.data?.failed && <ErrorNotice message={t("failedToFetchLogs")} onRetry={() => void res.reload()} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("logEntries")} value={logs.length.toLocaleString(localeOf(language))} icon={Activity} loading={loading} />
        <Stat label={t("responseTimeLabel")} value={rt != null ? `${rt} ms` : "—"} icon={Clock} tone={rtTone} hint="/health" loading={loading} />
        <Stat
          label={t("errorRateLabel")}
          value={`${derived.errorRate.toFixed(1)}%`}
          icon={ShieldAlert}
          tone={logs.length === 0 ? "neutral" : rateHigh ? "critical" : "healthy"}
          hint={logs.length === 0 ? undefined : rateHigh ? t("high") : t("low")}
          loading={loading}
        />
        <Stat
          label={t("uptimeLabel")}
          value={health?.uptime_seconds != null ? formatUptime(health.uptime_seconds) : "—"}
          icon={Gauge}
          hint={health ? <StatusPill tone={healthy ? "healthy" : "critical"}>{health.status}</StatusPill> : undefined}
          loading={loading}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <ChartCard title={t("errorsByHour")} className="xl:col-span-2" loading={loading} height="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={derived.hourly} margin={{ left: -16, right: 8, top: 4 }}>
              <defs>
                <linearGradient id="gErr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.error} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.error} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gWarn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.warn} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.warn} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="hour" stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} interval={3} />
              <YAxis stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: C.grid }} />
              <Area isAnimationActive={false} type="monotone" dataKey="errors" name="ERROR" stroke={C.error} strokeWidth={2} fill="url(#gErr)" />
              <Area isAnimationActive={false} type="monotone" dataKey="warnings" name="WARN" stroke={C.warn} strokeWidth={2} fill="url(#gWarn)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("logLevelDistribution")} loading={loading} height="h-60">
          {derived.pie.length === 0 ? (
            <EmptyState icon={Activity} title={t("noLogData")} className="py-6" />
          ) : (
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie isAnimationActive={false} data={derived.pie} dataKey="value" innerRadius={42} outerRadius={64} paddingAngle={3} stroke="none">
                      {derived.pie.map((e) => <Cell key={e.name} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1.5 text-xs">
                {derived.pie.map((d) => (
                  <li key={d.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="tnum font-mono font-medium text-foreground">{d.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>

        <ChartCard title={t("moduleActivityTop10")} className="xl:col-span-2" loading={loading} height="h-72">
          {derived.modules.length === 0 ? (
            <EmptyState icon={Activity} title={t("noModuleData")} className="py-6" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={derived.modules} layout="vertical" margin={{ left: 4, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
                <XAxis type="number" stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="module" stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} width={96} tick={{ fontFamily: "JetBrains Mono, monospace" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                <Bar isAnimationActive={false} dataKey="count" name="Logs" fill={C.primary} radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <section className="space-y-6">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">{t("healthMetrics")}</h3>
            {loading ? (
              <Skeleton className="h-20" />
            ) : !health ? (
              <p className="text-sm text-muted-foreground">{t("healthDataUnavailable")}</p>
            ) : (
              <dl className="space-y-2 text-sm">
                <Line label={t("status")}><StatusPill tone={healthy ? "healthy" : "critical"}>{health.status}</StatusPill></Line>
                <Line label={t("response")}><span className="tnum font-mono">{health.responseTime} ms</span></Line>
                {health.database && (
                  <Line label={t("database")}>
                    <span className="tnum font-mono">{health.database.open_connections}/{health.database.max_open_connections}</span>
                  </Line>
                )}
              </dl>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">{t("recentErrors")}</h3>
              <span className="text-xs text-muted-foreground">{tf(t("totalCount"), { count: derived.errors.length })}</span>
            </div>
            {derived.latestErrors.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("noErrorsFound")}</p>
            ) : (
              <ul className="max-h-64 divide-y overflow-y-auto scrollbar-thin">
                {derived.latestErrors.map((l) => (
                  <li key={l.id} className="px-4 py-2.5">
                    <p className="mb-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <code className="font-mono text-foreground">{l.module}</code>
                      <span className="tnum">{formatDateTime(l.timestamp, language)}</span>
                    </p>
                    <p className="line-clamp-2 text-xs text-foreground">{l.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function ChartCard({
  title, children, loading, height, className,
}: { title: string; children: React.ReactNode; loading: boolean; height: string; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card p-4 ${className ?? ""}`}>
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      <div className={height}>{loading ? <Skeleton className="h-full w-full" /> : children}</div>
    </section>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
