import { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Search, Download, RefreshCw, Trash2, Loader2, AlertCircle,
  Bug, Info, AlertTriangle, Copy, ChevronDown, ChevronRight, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getLogs, clearLogs, type LogEntry } from "@/services/api-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";

type Level = "ALL" | "DEBUG" | "INFO" | "WARN" | "ERROR";

const LEVEL_CONFIG: Record<string, { icon: typeof Info; lineClass: string; badgeClass: string; label: string }> = {
  DEBUG: { icon: Bug,           lineClass: "log-debug", badgeClass: "bg-muted text-muted-foreground",           label: "DEBUG" },
  INFO:  { icon: Info,          lineClass: "log-info",  badgeClass: "bg-status-info/15 text-status-info",       label: "INFO"  },
  WARN:  { icon: AlertTriangle, lineClass: "log-warn",  badgeClass: "bg-status-warning/15 text-status-warning", label: "WARN"  },
  ERROR: { icon: AlertCircle,   lineClass: "log-error", badgeClass: "bg-status-critical/15 text-status-critical",label: "ERROR" },
};

const LIMITS = [50, 100, 200, 500];

export default function Logs() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [level, setLevel] = useState<Level>("ALL");
  const [limit, setLimit] = useState(200);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Module list for the filter dropdown — fetched unfiltered/separately so
  // switching modules doesn't make other modules disappear from the list.
  const [moduleOptions, setModuleOptions] = useState<string[]>([]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The module filter used to be applied only client-side to whatever
      // the `limit`-capped fetch happened to contain, so picking a module
      // could silently show an incomplete (or empty) result even though
      // more matching entries exist beyond the fetch window. The backend
      // supports filtering by module directly — use that instead.
      const data = await getLogs({
        limit,
        level: level !== "ALL" ? level : undefined,
        module: moduleFilter !== "all" ? moduleFilter : undefined,
      });
      setLogs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedToFetchLogs"));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [limit, level, moduleFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    getLogs({ limit: 500 })
      .then((data) => {
        setModuleOptions(Array.from(new Set(data.map((l) => l.module).filter(Boolean))).sort());
      })
      .catch(() => { /* dropdown just stays empty — not critical */ });
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(fetchLogs, 5000);
    } else {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefresh, fetchLogs]);

  const allModules = ["all", ...moduleOptions];

  const filtered = logs.filter((l) => {
    if (search) {
      const q = search.toLowerCase();
      if (!l.message.toLowerCase().includes(q) && !l.module.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts: Record<Level, number> = {
    ALL:   logs.length,
    DEBUG: logs.filter((l) => l.level === "DEBUG").length,
    INFO:  logs.filter((l) => l.level === "INFO").length,
    WARN:  logs.filter((l) => l.level === "WARN").length,
    ERROR: logs.filter((l) => l.level === "ERROR").length,
  };

  const handleCopy = (log: LogEntry) => {
    const text = `[${log.timestamp}] [${log.level}] [${log.module}] ${log.message}${
      log.metadata ? "\n" + JSON.stringify(log.metadata, null, 2) : ""
    }`;
    navigator.clipboard.writeText(text);
    toast.success(t("copiedToClipboard"));
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("downloadedLogsJson"));
  };

  const handleClear = async () => {
    try {
      await clearLogs();
      setLogs([]);
      setClearDialogOpen(false);
      toast.success(t("logsCleared"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToClearLogs"));
      setClearDialogOpen(false);
    }
  };

  const LEVEL_BTNS: Level[] = ["ALL", "DEBUG", "INFO", "WARN", "ERROR"];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("logViewer")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("realTimeLogsFromBackend")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            {t("downloadJson")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-2", autoRefresh && "border-primary/50 text-primary")}
            onClick={() => setAutoRefresh((v) => !v)}
          >
            <Activity className="w-4 h-4" />
            {autoRefresh ? t("autoRefreshOn") : t("autoRefresh")}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchLogs} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {t("refresh")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-status-critical hover:text-status-critical"
            onClick={() => setClearDialogOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            {t("clear")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-4 rounded-lg border border-status-critical/30 bg-status-critical/10 text-status-critical text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Sticky Toolbar */}
      <div className="sticky top-0 z-10 glass-card rounded-lg p-3 mb-4 space-y-3">
        {/* Level filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {LEVEL_BTNS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                level === l
                  ? l === "ALL"   ? "bg-primary text-primary-foreground"
                  : l === "ERROR" ? "bg-status-critical text-white"
                  : l === "WARN"  ? "bg-status-warning text-black"
                  : l === "INFO"  ? "bg-status-info text-white"
                  : "bg-muted text-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {l}
              <span className="opacity-70">({counts[l]})</span>
            </button>
          ))}
        </div>

        {/* Second row: module, limit, search */}
        <div className="flex flex-col md:flex-row gap-2">
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-full md:w-48 bg-background h-8 text-xs">
              <SelectValue placeholder={t("module")} />
            </SelectTrigger>
            <SelectContent>
              {allModules.map((m) => (
                <SelectItem key={m} value={m}>{m === "all" ? t("allModules") : m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="w-full md:w-28 bg-background h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMITS.map((l) => (
                <SelectItem key={l} value={String(l)}>{l} {t("entries")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder={t("searchMessageOrModule")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 bg-background text-xs"
            />
          </div>
        </div>
      </div>

      {/* Log List */}
      <div className="glass-card rounded-lg overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border text-xs text-muted-foreground font-medium">
          <div className="w-36">{t("timestamp")}</div>
          <div className="w-14">{t("level")}</div>
          <div className="w-28">{t("module")}</div>
          <div className="flex-1">{t("message")}</div>
          <div className="w-8" />
        </div>

        <div className="divide-y divide-border max-h-[calc(100vh-380px)] overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="p-10 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm">{t("loadingLogs")}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 flex flex-col items-center gap-3 text-muted-foreground">
              <Info className="w-8 h-8 opacity-30" />
              <span className="text-sm">
                {logs.length === 0 ? t("noLogEntriesYet") : t("noLogsMatchFilters")}
              </span>
            </div>
          ) : (
            filtered.map((log) => {
              const cfg = LEVEL_CONFIG[log.level] ?? LEVEL_CONFIG.INFO;
              const LvlIcon = cfg.icon;
              const isExpanded = expandedId === log.id;
              const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

              return (
                <div key={log.id} className={cn("group", cfg.lineClass)}>
                  <div className="flex items-center gap-4 px-4 py-2 hover:bg-accent/20 transition-colors">
                    <div className="w-36 text-xs text-muted-foreground font-mono flex-shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                      })}
                      <br />
                      <span className="opacity-60">
                        {new Date(log.timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    <div className="w-14 flex-shrink-0">
                      <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded", cfg.badgeClass)}>
                        <LvlIcon className="w-2.5 h-2.5" />
                        {log.level}
                      </span>
                    </div>
                    <div className="w-28 flex-shrink-0">
                      <span className="text-xs font-mono text-primary truncate block">{log.module}</span>
                    </div>
                    <div
                      className={cn("flex-1 text-sm text-foreground truncate", hasMetadata && "cursor-pointer")}
                      onClick={() => hasMetadata && setExpandedId(isExpanded ? null : log.id)}
                    >
                      {log.message}
                    </div>
                    <div className="w-8 flex-shrink-0 flex items-center gap-1">
                      {hasMetadata && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleCopy(log)}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && log.metadata && (
                    <div className="mx-4 mb-2 p-3 bg-accent/30 rounded-lg border-l-2 border-primary">
                      <pre className="text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {tf(t("showingOfEntries"), { shown: filtered.length, total: logs.length })}
          </div>
        )}
      </div>

      {/* Clear Confirm */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clearAllLogs")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("clearAllLogsConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-status-critical hover:bg-status-critical/90">
              {t("clearAllLogs")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
