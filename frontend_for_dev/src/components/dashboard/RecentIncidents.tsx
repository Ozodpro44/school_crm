import { AlertTriangle, CheckCircle2, Clock, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Incident {
  id: string;
  title: string;
  status: "open" | "investigating" | "resolved";
  severity: "low" | "medium" | "high";
  branch?: string;
  timestamp: string;
}

const incidents: Incident[] = [
  {
    id: "INC-001",
    title: "Payment gateway timeout",
    status: "resolved",
    severity: "high",
    branch: "Moscow Central",
    timestamp: "2h ago",
  },
  {
    id: "INC-002",
    title: "Email delivery delay",
    status: "investigating",
    severity: "medium",
    branch: "All Branches",
    timestamp: "4h ago",
  },
  {
    id: "INC-003",
    title: "Slow API response on /students",
    status: "open",
    severity: "low",
    timestamp: "6h ago",
  },
];

const statusConfig = {
  open: { icon: AlertTriangle, color: "text-status-critical", bg: "bg-status-critical/15" },
  investigating: { icon: Search, color: "text-status-warning", bg: "bg-status-warning/15" },
  resolved: { icon: CheckCircle2, color: "text-status-healthy", bg: "bg-status-healthy/15" },
};

export function RecentIncidents() {
  return (
    <div className="glass-card rounded-lg">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Recent Incidents</h2>
        <button className="text-xs text-primary hover:underline">View All</button>
      </div>
      <div className="divide-y divide-border">
        {incidents.map((incident) => {
          const StatusIcon = statusConfig[incident.status].icon;
          return (
            <div key={incident.id} className="p-4 hover:bg-accent/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  statusConfig[incident.status].bg
                )}>
                  <StatusIcon className={cn("w-4 h-4", statusConfig[incident.status].color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{incident.id}</span>
                    <span className={cn(
                      "badge-status capitalize",
                      incident.status === "resolved" && "badge-healthy",
                      incident.status === "investigating" && "badge-warning",
                      incident.status === "open" && "badge-critical"
                    )}>
                      {incident.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{incident.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {incident.branch && <span>{incident.branch}</span>}
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
    </div>
  );
}
