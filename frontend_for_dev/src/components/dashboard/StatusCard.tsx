import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

type StatusType = "healthy" | "warning" | "critical";

interface StatusCardProps {
  title: string;
  value: string;
  subtitle?: string;
  status: StatusType;
  icon: LucideIcon;
}

export function StatusCard({ title, value, subtitle, status, icon: Icon }: StatusCardProps) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          status === "healthy" && "bg-status-healthy/15",
          status === "warning" && "bg-status-warning/15",
          status === "critical" && "bg-status-critical/15"
        )}>
          <Icon className={cn(
            "w-5 h-5",
            status === "healthy" && "text-status-healthy",
            status === "warning" && "text-status-warning",
            status === "critical" && "text-status-critical"
          )} />
        </div>
        <div className={cn(
          "status-indicator",
          status === "healthy" && "status-healthy",
          status === "warning" && "status-warning",
          status === "critical" && "status-critical"
        )} />
      </div>
      <p className="text-muted-foreground text-sm mb-1">{title}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}
