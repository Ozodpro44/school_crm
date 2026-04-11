import { useEffect, useState } from "react";
import { Server, Database, HardDrive, Clock, Cloud, Gauge, Loader2 } from "lucide-react";
import { StatusCard } from "./StatusCard";
import { apiClient } from "@/services/api-client";

interface HealthData {
  status: string;
  environment: string;
  uptime_seconds: number;
  database: {
    status: string;
    open_connections: number;
    idle_connections: number;
    max_open_connections: number;
  };
  redis: {
    status: string;
    connected: boolean;
  };
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function SystemHealthPanel() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    async function fetchHealth() {
      const start = performance.now();
      try {
        const data = await apiClient.healthCheck() as HealthData;
        const elapsed = Math.round(performance.now() - start);
        setResponseTime(elapsed);
        setHealth(data);
        setOffline(false);
      } catch {
        setOffline(true);
        setResponseTime(null);
      } finally {
        setLoading(false);
      }
    }
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">System Health</h2>
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="metric-card h-20 animate-pulse bg-accent/30 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const dbConnections = health?.database?.open_connections ?? 0;
  const dbMax = health?.database?.max_open_connections ?? 25;
  const redisConnected = health?.redis?.connected ?? false;
  const env = health?.environment ?? "unknown";
  const uptime = health?.uptime_seconds ?? 0;

  const apiStatus = offline ? "critical" : "healthy";
  const dbStatus = offline ? "critical" : (health?.database?.status === "connected" ? "healthy" : "critical");
  const redisStatus = offline ? "warning" : (redisConnected ? "healthy" : "warning");

  const services = [
    {
      title: "API Backend",
      value: offline ? "Offline" : "Online",
      subtitle: offline ? "Cannot connect" : "Golang Gin • Port 8080",
      status: apiStatus as "healthy" | "critical",
      icon: Server,
    },
    {
      title: "PostgreSQL",
      value: offline ? "Unknown" : (health?.database?.status === "connected" ? "Connected" : "Error"),
      subtitle: offline ? "—" : `${dbConnections} / ${dbMax} connections`,
      status: dbStatus as "healthy" | "critical",
      icon: Database,
    },
    {
      title: "Redis Cache",
      value: offline ? "Unknown" : (redisConnected ? "Active" : "Inactive"),
      subtitle: offline ? "—" : (redisConnected ? "Connected" : "Not configured"),
      status: redisStatus as "healthy" | "warning",
      icon: HardDrive,
    },
    {
      title: "Server Uptime",
      value: offline ? "—" : formatUptime(uptime),
      subtitle: offline ? "—" : `${uptime.toLocaleString()}s total`,
      status: (offline ? "critical" : "healthy") as "healthy" | "critical",
      icon: Clock,
    },
    {
      title: "Environment",
      value: offline ? "—" : (env.charAt(0).toUpperCase() + env.slice(1)),
      subtitle: offline ? "—" : `NODE_ENV: ${env}`,
      status: "healthy" as const,
      icon: Cloud,
    },
    {
      title: "Response Time",
      value: responseTime !== null ? `${responseTime}ms` : "—",
      subtitle: responseTime !== null
        ? (responseTime < 100 ? "Excellent latency" : responseTime < 300 ? "Good latency" : "Slow response")
        : "Unreachable",
      status: (responseTime === null || responseTime > 500 ? "critical" : responseTime > 200 ? "warning" : "healthy") as "healthy" | "warning" | "critical",
      icon: Gauge,
    },
  ];

  const allHealthy = !offline && services.every((s) => s.status === "healthy");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">System Health</h2>
        <span className={`badge-status ${offline ? "badge-critical" : allHealthy ? "badge-healthy" : "badge-warning"}`}>
          {offline ? "Backend Offline" : allHealthy ? "All Systems Operational" : "Degraded"}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <StatusCard key={service.title} {...service} />
        ))}
      </div>
    </div>
  );
}
