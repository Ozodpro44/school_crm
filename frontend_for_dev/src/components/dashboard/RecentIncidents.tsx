import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/services/api-client";

interface DisplayIncident {
  id: string;
  title: string;
  status: "open" | "investigating" | "resolved";
  module: string;
  timestamp: string;
}

const statusConfig = {
  open: { icon: AlertTriangle, color: "text-status-critical", bg: "bg-status-critical/15" },
  investigating: { icon: Search, color: "text-status-warning", bg: "bg-status-warning/15" },
  resolved: { icon: CheckCircle2, color: "text-status-healthy", bg: "bg-status-healthy/15" },
};

type RawLog = { level?: string; message?: string; module?: string; service?: string; timestamp?: string };

function logToIncident(log: RawLog, index: number): DisplayIncident {
  const level = (log.level || "info").toUpperCase();
  const status: DisplayIncident["status"] =
    level === "ERROR" ? "open" : level === "WARN" ? "investigating" : "resolved";

  return {
    id: `LOG-${String(index + 1).padStart(3, "0")}`,
    title: log.message || "Unknown event",
    status,
    module: log.module || log.service || "system",
    timestamp: log.timestamp
      ? new Date(log.timestamp).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
  };
}

export function RecentIncidents() {
  const [incidents, setIncidents] = useState<DisplayIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getLogs(50)
      .then((logs) => {
        const arr: RawLog[] = Array.isArray(logs) ? (logs as RawLog[]) : [];
        const filtered = arr
          .filter((log) => {
            const level = (log.level || "info").toUpperCase();
            return level === "ERROR" || level === "WARN";
          })
          .slice(0, 5)
          .map(logToIncident);
        setIncidents(filtered);
      })
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="glass-card rounded-lg">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Recent Incidents</h2>
        <button className="text-xs text-primary hover:underline">View All</button>
      </div>

      {loading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : incidents.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <CheckCircle2 className="w-8 h-8 text-status-healthy" />
          <span>No recent incidents</span>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {incidents.map((incident) => {
            const StatusIcon = statusConfig[incident.status].icon;
            return (
              <div key={incident.id} className="p-4 hover:bg-accent/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      statusConfig[incident.status].bg
                    )}
                  >
                    <StatusIcon className={cn("w-4 h-4", statusConfig[incident.status].color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{incident.id}</span>
                      <span
                        className={cn(
                          "badge-status capitalize",
                          incident.status === "resolved" && "badge-healthy",
                          incident.status === "investigating" && "badge-warning",
                          incident.status === "open" && "badge-critical"
                        )}
                      >
                        {incident.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{incident.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{incident.module}</span>
                      <span>•</span>
                      <Clock className="w-3 h-3" />
                      <span>{incident.timestamp}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
