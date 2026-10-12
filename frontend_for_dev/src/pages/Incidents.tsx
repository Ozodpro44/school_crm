import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Clock, ShieldCheck } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/kit/PageHeader";
import { Stat } from "@/components/kit/Stat";
import { StatusPill, type Tone } from "@/components/kit/StatusPill";
import { EmptyState, ErrorNotice, RowsSkeleton } from "@/components/kit/States";
import { RefreshButton } from "@/components/kit/Toolbar";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";
import { useResource } from "@/hooks/useResource";
import { orEmpty } from "@/lib/empty";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getLogs, type LogEntry } from "@/services/api-client";

interface Incident {
  module: string;
  count: number;
  lastSeen: string;
  example: string;
  errors: LogEntry[];
}

type Severity = "high" | "medium" | "low";

const severityOf = (count: number): Severity => (count >= 10 ? "high" : count >= 5 ? "medium" : "low");
const SEVERITY: Record<Severity, { labelKey: string; tone: Tone; bar: string }> = {
  high: { labelKey: "severityHigh", tone: "critical", bar: "bg-status-critical" },
  medium: { labelKey: "severityMedium", tone: "warning", bar: "bg-status-warning" },
  low: { labelKey: "severityLow", tone: "info", bar: "bg-status-info" },
};

function group(errors: LogEntry[]): Incident[] {
  const map = new Map<string, LogEntry[]>();
  for (const log of errors) {
    const m = log.module || "unknown";
    map.set(m, [...(map.get(m) ?? []), log]);
  }
  return Array.from(map.entries())
    .map(([module, logs]) => {
      const sorted = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return { module, count: logs.length, lastSeen: sorted[0]?.timestamp ?? "", example: sorted[0]?.message ?? "", errors: sorted };
    })
    .sort((a, b) => b.count - a.count);
}

function useRelative(t: (k: string) => string) {
  return (iso: string) => {
    if (!iso) return "—";
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (m < 2) return t("justNow");
    if (m < 60) return tf(t("minutesAgo"), { m });
    const h = Math.floor(m / 60);
    if (h < 24) return tf(t("hoursAgo"), { h });
    return tf(t("daysAgo"), { d: Math.floor(h / 24) });
  };
}

export default function Incidents() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const relative = useRelative(t);
  const [open, setOpen] = useState<string | null>(null);

  const res = useResource<Incident[]>(async () => group(await getLogs({ level: "ERROR", limit: 200 })), t("failedToLoadErrorLogs"));
  const incidents = orEmpty(res.data);

  const totals = useMemo(
    () => ({
      errors: incidents.reduce((n, i) => n + i.count, 0),
      high: incidents.filter((i) => severityOf(i.count) === "high").length,
    }),
    [incidents],
  );

  return (
    <DashboardLayout>
      <PageHeader
        title={t("incidentsTitle")}
        description={t("errorLogsGroupedByModule")}
        actions={<RefreshButton onClick={() => void res.reload()} busy={res.fetching} />}
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label={t("totalErrors")} value={totals.errors} icon={AlertCircle} loading={res.loading} />
        <Stat label={t("affectedModules")} value={incidents.length} loading={res.loading} />
        <Stat label={t("highSeverity")} value={totals.high} tone={totals.high > 0 ? "critical" : "neutral"} loading={res.loading} />
      </div>

      {res.error && <ErrorNotice message={res.error} onRetry={() => void res.reload()} />}

      {res.loading ? (
        <div className="overflow-hidden rounded-xl border bg-card"><RowsSkeleton rows={4} /></div>
      ) : incidents.length === 0 && !res.error ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={ShieldCheck} title={t("noErrorIncidentsDetected")} description={t("errorLogsWillAppearHere")} />
        </div>
      ) : (
        <ul className="space-y-3">
          {incidents.map((incident) => {
            const sev = SEVERITY[severityOf(incident.count)];
            const isOpen = open === incident.module;
            return (
              <li key={incident.module} className="overflow-hidden rounded-xl border bg-card">
                <button
                  className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-muted/40"
                  onClick={() => setOpen(isOpen ? null : incident.module)}
                  aria-expanded={isOpen}
                >
                  <span className={cn("mt-1 h-10 w-1 shrink-0 rounded-full", sev.bar)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <code className="font-mono text-sm font-semibold text-foreground">{incident.module}</code>
                      <StatusPill tone={sev.tone}>{t(sev.labelKey)}</StatusPill>
                      <span className="text-xs text-muted-foreground">{tf(t("incidentErrorCount"), { count: incident.count })}</span>
                    </div>
                    <p className="line-clamp-2 text-sm text-foreground">{incident.example}</p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(incident.lastSeen, language)}
                      <span aria-hidden>·</span>
                      {relative(incident.lastSeen)}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 pt-1 text-xs text-muted-foreground">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="sr-only">{isOpen ? t("hideEvents") : t("showEvents")}</span>
                    <span className="tnum">{incident.errors.length}</span>
                  </span>
                </button>

                {isOpen && (
                  <ul className="max-h-80 divide-y overflow-y-auto border-t scrollbar-thin">
                    {incident.errors.map((log) => (
                      <li key={log.id} className="px-4 py-3">
                        <p className="tnum mb-0.5 font-mono text-xs text-muted-foreground">{formatDateTime(log.timestamp, language)}</p>
                        <p className="text-sm text-foreground">{log.message}</p>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-2.5 font-mono text-[11px] text-muted-foreground">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardLayout>
  );
}
