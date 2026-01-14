import { Server, Database, HardDrive, Clock, Cloud, Gauge } from "lucide-react";
import { StatusCard } from "./StatusCard";

const systemServices = [
  {
    title: "API Backend",
    value: "Online",
    subtitle: "Golang Gin • Port 8080",
    status: "healthy" as const,
    icon: Server,
  },
  {
    title: "PostgreSQL",
    value: "Connected",
    subtitle: "5 active connections",
    status: "healthy" as const,
    icon: Database,
  },
  {
    title: "Redis Cache",
    value: "Active",
    subtitle: "Memory: 128MB / 512MB",
    status: "healthy" as const,
    icon: HardDrive,
  },
  {
    title: "Server Uptime",
    value: "99.97%",
    subtitle: "Last restart: 12 days ago",
    status: "healthy" as const,
    icon: Clock,
  },
  {
    title: "Environment",
    value: "Production",
    subtitle: "Last deploy: 2h ago",
    status: "healthy" as const,
    icon: Cloud,
  },
  {
    title: "Response Time",
    value: "45ms",
    subtitle: "Avg. latency",
    status: "healthy" as const,
    icon: Gauge,
  },
];

export function SystemHealthPanel() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">System Health</h2>
        <span className="badge-status badge-healthy">All Systems Operational</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {systemServices.map((service) => (
          <StatusCard key={service.title} {...service} />
        ))}
      </div>
    </div>
  );
}
