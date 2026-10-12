import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Download, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/kit/PageHeader";
import { StatusPill, type Tone } from "@/components/kit/StatusPill";
import { EmptyState, ErrorNotice, RowsSkeleton } from "@/components/kit/States";
import { RefreshButton, SearchField } from "@/components/kit/Toolbar";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";
import { useResource } from "@/hooks/useResource";
import { orEmpty } from "@/lib/empty";
import { useInterval } from "@/hooks/useInterval";
import { copyText } from "@/lib/clipboard";
import { localeOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import { clearLogs, getLogs, type LogEntry } from "@/services/api-client";

type Level = "ALL" | "DEBUG" | "INFO" | "WARN" | "ERROR";
const LEVELS: Level[] = ["ALL", "DEBUG", "INFO", "WARN", "ERROR"];
const LEVEL_TONE: Record<string, Tone> = { DEBUG: "neutral", INFO: "info", WARN: "warning", ERROR: "critical" };
const LIMITS = [50, 100, 200, 500];

export default function Logs() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const [level, setLevel] = useState<Level>("ALL");
  const [limit, setLimit] = useState(200);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [auto, setAuto] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const res = useResource<LogEntry[]>(
    () => getLogs({ limit, level: level !== "ALL" ? level : undefined, module: moduleFilter !== "all" ? moduleFilter : undefined }),
    t("failedToFetchLogs"),
  );
  // Re-query when a server-side filter changes (reload is stable, the fetcher is read via ref).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; } // the hook already loads on mount
    void res.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, level, moduleFilter]);
  useInterval(() => void res.reload(), 5000, auto);

  // Module list comes from an unfiltered fetch so picking a module never empties the dropdown.
  const modules = useResource<string[]>(
    async () => Array.from(new Set((await getLogs({ limit: 500 })).map((l) => l.module).filter(Boolean))).sort(),
    t("failedToFetchLogs"),
  );

  const logs = orEmpty(res.data);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? logs.filter((l) => l.message.toLowerCase().includes(q) || l.module.toLowerCase().includes(q)) : logs;
  }, [logs, search]);

  const counts = useMemo(() => {
    const c: Record<Level, number> = { ALL: logs.length, DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 };
    for (const l of logs) c[l.level]++;
    return c;
  }, [logs]);

  const copy = async (log: LogEntry) => {
    const text = `[${log.timestamp}] [${log.level}] [${log.module}] ${log.message}${log.metadata ? "\n" + JSON.stringify(log.metadata, null, 2) : ""}`;
    if (await copyText(text)) toast.success(t("copiedToClipboard"));
    else toast.error(t("copyFailed"));
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("downloadedLogsJson"));
  };

  const doClear = async () => {
    setClearing(true);
    try {
      await clearLogs();
      res.setData([]);
      setClearOpen(false);
      toast.success(t("logsCleared"));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t("failedToClearLogs"));
    } finally {
      setClearing(false);
    }
  };

  const time = (iso: string) => new Date(iso).toLocaleTimeString(localeOf(language), { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const day = (iso: string) => new Date(iso).toLocaleDateString(localeOf(language), { day: "2-digit", month: "short" });

  return (
    <DashboardLayout>
      <PageHeader
        title={t("logViewer")}
        description={t("realTimeLogsFromBackend")}
        actions={
          <>
            <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5">
              <Switch id="logs-auto" checked={auto} onCheckedChange={setAuto} />
              <Label htmlFor="logs-auto" className="cursor-pointer text-[13px] font-normal text-muted-foreground">{t("autoRefresh")}</Label>
            </div>
            <Button variant="outline" className="gap-2" onClick={download} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{t("downloadJson")}</span>
            </Button>
            <RefreshButton onClick={() => void res.reload()} busy={res.fetching} />
            <Button variant="outline" className="gap-2 text-status-critical hover:text-status-critical" onClick={() => setClearOpen(true)}>
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t("clear")}</span>
            </Button>
          </>
        }
      />

      {res.error && <ErrorNotice message={res.error} onRetry={() => void res.reload()} />}

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("level")}>
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              aria-pressed={level === l}
              className={cn(
                "rounded-full border px-3 py-1 text-[13px] transition-colors",
                level === l ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {l === "ALL" ? t("levelAll") : l}
              {level === "ALL" && <span className="tnum ml-1.5 opacity-70">{counts[l]}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="sm:w-52"><SelectValue placeholder={t("module")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allModules")}</SelectItem>
              {(modules.data ?? []).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{LIMITS.map((n) => <SelectItem key={n} value={String(n)}>{n} {t("entries")}</SelectItem>)}</SelectContent>
          </Select>
          <SearchField value={search} onChange={setSearch} placeholder={t("searchMessageOrModule")} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {res.loading ? (
          <RowsSkeleton rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title={logs.length === 0 ? t("noLogEntriesYet") : t("noLogsMatchFilters")} />
        ) : (
          <ul className="max-h-[calc(100vh-22rem)] min-h-[16rem] divide-y overflow-y-auto scrollbar-thin">
            {filtered.map((log) => {
              const hasMeta = !!log.metadata && Object.keys(log.metadata).length > 0;
              const isOpen = expanded === log.id;
              return (
                <li key={log.id} className="group">
                  <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/40">
                    <div className="tnum w-20 shrink-0 pt-0.5 font-mono text-xs leading-4 text-muted-foreground">
                      {time(log.timestamp)}
                      <br />
                      <span className="opacity-60">{day(log.timestamp)}</span>
                    </div>
                    <div className="w-16 shrink-0 pt-px">
                      <StatusPill tone={LEVEL_TONE[log.level] ?? "neutral"} dot={false} className="px-1.5 font-mono text-[10px]">{log.level}</StatusPill>
                    </div>
                    <span className="hidden w-28 shrink-0 truncate pt-0.5 font-mono text-xs text-muted-foreground md:block" title={log.module}>{log.module}</span>
                    <button
                      className={cn("min-w-0 flex-1 text-left text-sm text-foreground", isOpen ? "whitespace-pre-wrap break-words" : "truncate", !hasMeta && "cursor-default")}
                      onClick={() => hasMeta && setExpanded(isOpen ? null : log.id)}
                      aria-expanded={hasMeta ? isOpen : undefined}
                      title={hasMeta ? t("expandRow") : undefined}
                    >
                      {log.message}
                    </button>
                    <div className="flex w-14 shrink-0 items-center justify-end gap-0.5">
                      {hasMeta && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(isOpen ? null : log.id)} aria-label={t("expandRow")}>
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 focus-visible:opacity-100 group-hover:opacity-100" onClick={() => void copy(log)} aria-label={t("copyEntry")}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {isOpen && log.metadata && (
                    <pre className="mx-4 mb-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs text-foreground">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!res.loading && filtered.length > 0 && (
          <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            {tf(t("showingOfEntries"), { shown: filtered.length, total: logs.length })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={t("clearAllLogs")}
        description={t("clearAllLogsConfirm")}
        confirmLabel={t("clearAllLogs")}
        busy={clearing}
        onConfirm={doClear}
      />
    </DashboardLayout>
  );
}
