import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2, Clock, TrendingUp, Users, XCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/kit/PageHeader";
import { Stat } from "@/components/kit/Stat";
import { StatusPill } from "@/components/kit/StatusPill";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { EmptyState, ErrorNotice } from "@/components/kit/States";
import { RefreshButton } from "@/components/kit/Toolbar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";
import { useResource } from "@/hooks/useResource";
import { useInterval } from "@/hooks/useInterval";
import { formatDate, formatMoney, formatNumber, formatUptime, localeOf, PLATFORM_CURRENCY } from "@/lib/format";
import { subStatusTone, SUB_STATUS_LABEL_KEY } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  getHealth, getPlatformStats, listSubscriptions,
  type AdminSubscription, type HealthStatus, type PlatformStats,
} from "@/services/api-client";

interface Snapshot {
  stats: PlatformStats | null;
  health: HealthStatus | null;
  subs: AdminSubscription[];
  failed: string[];
}

const HEALTHY = new Set(["ok", "healthy", "up", "connected"]);

export default function Dashboard() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [auto, setAuto] = useState(false);

  const fetchSnapshot = useCallback(async (): Promise<Snapshot> => {
    const [stats, health, subs] = await Promise.allSettled([getPlatformStats(), getHealth(), listSubscriptions()]);
    const failed: string[] = [];
    if (stats.status === "rejected") failed.push(t("statsSection"));
    if (health.status === "rejected") failed.push(t("healthStatus"));
    if (subs.status === "rejected") failed.push(t("recentSubscriptions"));
    // Every request failing is a hard error (usually: API down / session expired).
    if (failed.length === 3) {
      const reason = (stats as PromiseRejectedResult).reason;
      throw reason instanceof Error ? reason : new Error(t("failedToLoadData"));
    }
    return {
      stats: stats.status === "fulfilled" ? stats.value : null,
      health: health.status === "fulfilled" ? health.value : null,
      subs: subs.status === "fulfilled" ? subs.value : [],
      failed,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const snap = useResource<Snapshot>(fetchSnapshot, t("failedToLoadData"));
  useInterval(() => void snap.reload(), 30_000, auto);

  const data = snap.data;
  const stats = data?.stats ?? null;
  const loading = snap.loading;

  const recent = useMemo(
    () => [...(data?.subs ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
    [data?.subs],
  );

  const today = new Date().toLocaleDateString(localeOf(language), {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const cards = [
    { key: "users", label: t("statTotalUsers"), value: stats ? formatNumber(stats.totalUsers, language) : "—", icon: Users, to: "/users" },
    { key: "mrr", label: `${t("statMRR")} (${PLATFORM_CURRENCY})`, value: stats ? formatNumber(stats.mrr, language) : "—", icon: TrendingUp, to: "/subscriptions" },
    { key: "active", label: t("statActiveSubs"), value: stats?.activeSubscriptions ?? "—", icon: CheckCircle2, to: "/subscriptions?status=active" },
    { key: "trial", label: t("statTrialSubs"), value: stats?.trialSubscriptions ?? "—", icon: Clock, to: "/subscriptions?status=trial" },
    { key: "pending", label: t("statPending"), value: stats?.pendingSubscriptions ?? "—", icon: AlertTriangle, to: "/subscriptions?status=pending_payment" },
    { key: "expired", label: t("statExpired"), value: stats?.expiredSubscriptions ?? "—", icon: XCircle, to: "/subscriptions?status=expired" },
  ];

  const columns: Column<AdminSubscription>[] = [
    {
      key: "user",
      header: t("user"),
      cell: (s) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{s.userFullName || s.userEmail}</p>
          <p className="truncate text-xs text-muted-foreground">{s.userEmail}</p>
        </div>
      ),
    },
    { key: "plan", header: t("plan"), cell: (s) => s.planName, showFrom: "sm" },
    {
      key: "status",
      header: t("status"),
      cell: (s) => <StatusPill tone={subStatusTone(s.status)}>{t(SUB_STATUS_LABEL_KEY[s.status] ?? s.status)}</StatusPill>,
    },
    {
      key: "price",
      header: t("price"),
      align: "right",
      showFrom: "md",
      cell: (s) =>
        s.planPrice > 0 ? (
          <span className="tnum">
            {formatMoney(s.planPrice, PLATFORM_CURRENCY, language)}
            <span className="text-xs text-muted-foreground"> / {s.billingPeriod}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{t("free")}</span>
        ),
    },
    { key: "date", header: t("date"), showFrom: "lg", cell: (s) => <span className="text-muted-foreground">{formatDate(s.createdAt, language)}</span> },
  ];

  const h = data?.health;
  const healthy = h ? HEALTHY.has((h.status || "").toLowerCase()) : false;
  const dbHealthy = h?.database ? HEALTHY.has((h.database.status || "").toLowerCase()) : false;

  return (
    <DashboardLayout>
      <PageHeader
        title={t("platformOverview")}
        description={today}
        actions={
          <>
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5">
              <Switch id="dash-auto" checked={auto} onCheckedChange={setAuto} />
              <Label htmlFor="dash-auto" className="cursor-pointer text-[13px] font-normal text-muted-foreground">
                {t("autoRefresh")}
              </Label>
            </div>
            <RefreshButton onClick={() => void snap.reload()} busy={snap.fetching} />
          </>
        }
      />

      {snap.error && <ErrorNotice message={snap.error} onRetry={() => void snap.reload()} />}
      {!snap.error && data && data.failed.length > 0 && (
        <ErrorNotice message={tf(t("partialLoadFailed"), { parts: data.failed.join(", ") })} onRetry={() => void snap.reload()} />
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(({ key, label, value, icon, to }) => (
          <Stat key={key} label={label} value={value} icon={icon} loading={loading} onClick={() => navigate(to)} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 2xl:grid-cols-3">
        <section className="2xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{t("recentSubscriptions")}</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/subscriptions")}>
              {t("viewAll")}
            </Button>
          </div>
          <DataTable
            columns={columns}
            rows={recent}
            rowKey={(s) => s.id}
            loading={loading}
            empty={<EmptyState icon={Activity} title={t("noSubscriptionsFound")} />}
          />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{t("healthStatus")}</h2>
          <div className="rounded-xl border bg-card p-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">{t("checkingHealth")}</p>
            ) : !h ? (
              <p className="text-sm text-muted-foreground">{t("healthDataUnavailable")}</p>
            ) : (
              <dl className="space-y-3 text-sm">
                <Row label={t("status")}>
                  <StatusPill tone={healthy ? "healthy" : "critical"}>{h.status || "unknown"}</StatusPill>
                </Row>
                <Row label={t("response")}>
                  <span
                    className={cn(
                      "tnum font-mono font-medium",
                      h.responseTime < 200 ? "text-status-healthy" : h.responseTime < 500 ? "text-status-warning" : "text-status-critical",
                    )}
                  >
                    {h.responseTime} ms
                  </span>
                </Row>
                {h.uptime_seconds != null && (
                  <Row label={t("uptime")}>
                    <span className="tnum font-mono">{formatUptime(h.uptime_seconds)}</span>
                  </Row>
                )}
                {h.database && (
                  <Row label={t("database")}>
                    <span className="flex flex-col items-end gap-1">
                      <StatusPill tone={dbHealthy ? "healthy" : "critical"}>{h.database.status}</StatusPill>
                      <span className="tnum text-xs text-muted-foreground">
                        {tf(t("connectionsLabel"), { open: h.database.open_connections, max: h.database.max_open_connections })}
                      </span>
                    </span>
                  </Row>
                )}
              </dl>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}
