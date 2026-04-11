import { useEffect, useState, useCallback } from "react";
import { Wifi, WifiOff, Clock, Cloud, Loader2, RefreshCw } from "lucide-react";
import { apiClient } from "@/services/api-client";

interface HealthSnapshot {
  status: string;
  environment?: string;
  uptime_seconds?: number;
  version?: string;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export function BackendConnectivity() {
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [online, setOnline] = useState<boolean | null>(null); // null = checking
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    setChecking(true);
    const start = performance.now();
    try {
      const data = await apiClient.healthCheck() as HealthSnapshot;
      const elapsed = Math.round(performance.now() - start);
      setResponseTime(elapsed);
      setHealth(data);
      setOnline(true);
    } catch {
      setResponseTime(null);
      setHealth(null);
      setOnline(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [check]);

  const statusColor = online === null || checking
    ? "text-muted-foreground"
    : online
    ? "text-status-healthy"
    : "text-status-critical";

  const statusBg = online === null || checking
    ? "bg-muted/30"
    : online
    ? "bg-status-healthy/10"
    : "bg-status-critical/10";

  return (
    <div className={`glass-card rounded-lg p-4 border ${online === false ? "border-status-critical/30" : "border-border"}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground text-sm">Backend Connectivity</h3>
        <button
          onClick={check}
          disabled={checking}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking..." : "Re-check"}
        </button>
      </div>

      <div className={`flex items-center gap-4 p-3 rounded-lg ${statusBg}`}>
        {/* Status */}
        <div className="flex items-center gap-2">
          {checking ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          ) : online ? (
            <Wifi className={`w-5 h-5 ${statusColor}`} />
          ) : (
            <WifiOff className={`w-5 h-5 ${statusColor}`} />
          )}
          <div>
            <p className={`text-sm font-semibold ${statusColor}`}>
              {checking ? "Checking..." : online ? "Online" : "Offline"}
            </p>
            <p className="text-xs text-muted-foreground">
              {health?.status ?? (online === false ? "Cannot reach backend" : "—")}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-border" />

        {/* Response time */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className={`text-sm font-semibold ${
              responseTime === null ? "text-muted-foreground"
              : responseTime < 100 ? "text-status-healthy"
              : responseTime < 400 ? "text-status-warning"
              : "text-status-critical"
            }`}>
              {responseTime !== null ? `${responseTime}ms` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Response time</p>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-border" />

        {/* Environment */}
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold text-foreground capitalize">
              {health?.environment ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">Environment</p>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-border" />

        {/* Uptime */}
        <div>
          <p className="text-sm font-semibold text-foreground">
            {health?.uptime_seconds !== undefined ? formatUptime(health.uptime_seconds) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Uptime</p>
        </div>
      </div>
    </div>
  );
}
