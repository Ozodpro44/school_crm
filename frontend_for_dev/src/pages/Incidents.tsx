import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  AlertCircle, RefreshCw, Loader2, ChevronDown, ChevronRight,
  Clock, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getLogs, type LogEntry } from "@/services/api-client";

interface Incident {
  module: string;
  count: number;
  lastSeen: string;
  exampleMessage: string;
  errors: LogEntry[];
}

type Severity = "high" | "medium" | "low";

function getSeverity(count: number): Severity {
  if (count >= 10) return "high";
  if (count >= 5)  return "medium";
  return "low";
}

const SEVERITY_CONFIG: Record<Severity, { label: string; cls: string; dotCls: string }> = {
  high:   { label: "High",   cls: "bg-status-critical/15 text-status-critical border-status-critical/25", dotCls: "pulse-dot-error" },
  medium: { label: "Medium", cls: "bg-status-warning/15 text-status-warning border-status-warning/25",    dotCls: "pulse-dot-warn"  },
  low:    { label: "Low",    cls: "bg-status-info/15 text-status-info border-status-info/25",              dotCls: ""               },
};

function groupByModule(errors: LogEntry[]): Incident[] {
  const map = new Map<string, LogEntry[]>();
  for (const log of errors) {
    const m = log.module || "unknown";
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(log);
  }
  return Array.from(map.entries())
    .map(([module, logs]) => {
      const sorted = [...logs].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      return {
        module,
        count: logs.length,
        lastSeen: sorted[0]?.timestamp ?? "",
        exampleMessage: sorted[0]?.message ?? "",
        errors: sorted,
      };
    })
    .sort((a, b) => b.count - a.count);
}

function fmtTs(ts: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function relTime(ts: string) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const logs = await getLogs({ level: "ERROR", limit: 200 });
      setIncidents(groupByModule(logs));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load error logs";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalErrors = incidents.reduce((sum, i) => sum + i.count, 0);
  const affectedModules = incidents.length;
  const highSev = incidents.filter((i) => getSeverity(i.count) === "high").length;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Incidents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Error logs grouped by module into incidents
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 mb-5">
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-card">
          <AlertCircle className="w-4 h-4 text-status-critical" />
          <span className="font-mono font-bold text-foreground">{loading ? "—" : totalErrors}</span>
          <span className="text-sm text-muted-foreground">Total Errors</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-card">
          <Shield className="w-4 h-4 text-status-warning" />
          <span className="font-mono font-bold text-foreground">{loading ? "—" : affectedModules}</span>
          <span className="text-sm text-muted-foreground">Affected Modules</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-status-critical/20 bg-status-critical/10">
          <span className="pulse-dot-error" />
          <span className="font-mono font-bold text-status-critical">{loading ? "—" : highSev}</span>
          <span className="text-sm text-status-critical">High Severity</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-4 rounded-lg border border-status-critical/30 bg-status-critical/10 text-status-critical text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : incidents.length === 0 ? (
        <div className="glass-card rounded-lg p-16 flex flex-col items-center gap-3 text-muted-foreground">
          <Shield className="w-10 h-10 opacity-30 text-status-healthy" />
          <p className="text-sm font-medium">No error incidents detected</p>
          <p className="text-xs">ERROR log entries will automatically appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => {
            const sev = getSeverity(incident.count);
            const { label, cls, dotCls } = SEVERITY_CONFIG[sev];
            const isExpanded = expandedModule === incident.module;

            return (
              <div key={incident.module} className="glass-card rounded-lg overflow-hidden">
                {/* Incident Header */}
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      sev === "high"   ? "bg-status-critical/15" :
                      sev === "medium" ? "bg-status-warning/15" : "bg-status-info/15"
                    )}>
                      <AlertCircle className={cn(
                        "w-5 h-5",
                        sev === "high"   ? "text-status-critical" :
                        sev === "medium" ? "text-status-warning" : "text-status-info"
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <code className="text-sm font-mono font-semibold text-primary">{incident.module}</code>
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                          cls
                        )}>
                          {dotCls && <span className={dotCls} />}
                          {label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {incident.count} error{incident.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mb-2 line-clamp-2">{incident.exampleMessage}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Last seen: {fmtTs(incident.lastSeen)}
                        <span className="text-muted-foreground/50">·</span>
                        {relTime(incident.lastSeen)}
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedModule(isExpanded ? null : incident.module)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-1"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {incident.errors.length}
                    </button>
                  </div>
                </div>

                {/* Expanded Error List */}
                {isExpanded && (
                  <div className="border-t border-border">
                    <div className="max-h-72 overflow-y-auto scrollbar-thin divide-y divide-border">
                      {incident.errors.map((log) => (
                        <div key={log.id} className="px-4 py-2.5 log-error">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-mono text-muted-foreground">
                              {fmtTs(log.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground">{log.message}</p>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <pre className="text-[10px] font-mono text-muted-foreground mt-1 overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
