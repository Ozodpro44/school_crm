import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  AlertTriangle,
  CheckCircle2,
  Search,
  Clock,
  Building2,
  Filter,
  AlertCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type IncidentStatus = "open" | "investigating" | "resolved";
type IncidentType = "api" | "payment" | "email" | "database" | "redis";

interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  type: IncidentType;
  severity: "low" | "medium" | "high" | "critical";
  branch?: string;
  createdAt: string;
  updatedAt: string;
  affectedUsers?: number;
  timeline: { time: string; action: string }[];
}

const incidents: Incident[] = [
  {
    id: "INC-2024-001",
    title: "Payment Gateway Timeout",
    description: "Sberbank payment gateway experiencing intermittent timeouts causing transaction failures",
    status: "resolved",
    type: "payment",
    severity: "high",
    branch: "Moscow Central",
    createdAt: "2024-01-14 10:15:00",
    updatedAt: "2024-01-14 12:30:00",
    affectedUsers: 23,
    timeline: [
      { time: "10:15", action: "Incident detected - Multiple payment failures" },
      { time: "10:22", action: "Investigation started" },
      { time: "11:00", action: "Root cause identified - Gateway rate limiting" },
      { time: "12:30", action: "Resolved - Increased timeout threshold" },
    ],
  },
  {
    id: "INC-2024-002",
    title: "Email Delivery Delays",
    description: "SMTP relay experiencing high latency, notification emails delayed by 15-30 minutes",
    status: "investigating",
    type: "email",
    severity: "medium",
    createdAt: "2024-01-14 13:45:00",
    updatedAt: "2024-01-14 14:20:00",
    affectedUsers: 156,
    timeline: [
      { time: "13:45", action: "Monitoring alert triggered" },
      { time: "14:00", action: "Investigation started" },
      { time: "14:20", action: "Checking SMTP server configuration" },
    ],
  },
  {
    id: "INC-2024-003",
    title: "Slow API Response on /students",
    description: "GET /api/v1/students endpoint responding slower than 2s threshold",
    status: "open",
    type: "api",
    severity: "low",
    createdAt: "2024-01-14 14:30:00",
    updatedAt: "2024-01-14 14:30:00",
    timeline: [
      { time: "14:30", action: "Automated alert - Response time > 2000ms" },
    ],
  },
  {
    id: "INC-2024-004",
    title: "Redis Memory Warning",
    description: "Redis cache memory usage exceeded 80% threshold",
    status: "resolved",
    type: "redis",
    severity: "medium",
    createdAt: "2024-01-13 22:00:00",
    updatedAt: "2024-01-13 23:30:00",
    timeline: [
      { time: "22:00", action: "Memory threshold alert triggered" },
      { time: "22:15", action: "Cache eviction policy reviewed" },
      { time: "23:30", action: "Resolved - Cleared stale sessions" },
    ],
  },
  {
    id: "INC-2024-005",
    title: "Database Connection Pool Exhausted",
    description: "PostgreSQL connection pool reached maximum capacity during peak hours",
    status: "resolved",
    type: "database",
    severity: "critical",
    branch: "All Branches",
    createdAt: "2024-01-12 09:00:00",
    updatedAt: "2024-01-12 09:45:00",
    affectedUsers: 420,
    timeline: [
      { time: "09:00", action: "Connection errors detected" },
      { time: "09:05", action: "Incident escalated to critical" },
      { time: "09:15", action: "Pool size increased temporarily" },
      { time: "09:45", action: "Resolved - Optimized connection handling" },
    ],
  },
];

const statusConfig: Record<IncidentStatus, { icon: typeof AlertCircle; label: string; className: string }> = {
  open: { icon: AlertCircle, label: "Open", className: "badge-critical" },
  investigating: { icon: Search, label: "Investigating", className: "badge-warning" },
  resolved: { icon: CheckCircle2, label: "Resolved", className: "badge-healthy" },
};

const severityColors = {
  low: "bg-status-info/15 text-status-info",
  medium: "badge-warning",
  high: "bg-orange-500/15 text-orange-400",
  critical: "badge-critical",
};

export default function Incidents() {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);

  const filteredIncidents = incidents.filter((incident) => {
    const matchesStatus = selectedStatus === "all" || incident.status === selectedStatus;
    const matchesSearch = incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          incident.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const openCount = incidents.filter((i) => i.status === "open").length;
  const investigatingCount = incidents.filter((i) => i.status === "investigating").length;
  const resolvedCount = incidents.filter((i) => i.status === "resolved").length;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Incidents & Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and manage system incidents
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-critical/15 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-status-critical" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{openCount}</p>
              <p className="text-sm text-muted-foreground">Open Incidents</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-warning/15 flex items-center justify-center">
              <Search className="w-5 h-5 text-status-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{investigatingCount}</p>
              <p className="text-sm text-muted-foreground">Investigating</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-healthy/15 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-status-healthy" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{resolvedCount}</p>
              <p className="text-sm text-muted-foreground">Resolved (7 days)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full md:w-40 bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        {filteredIncidents.map((incident) => {
          const StatusIcon = statusConfig[incident.status].icon;
          const isExpanded = expandedIncident === incident.id;

          return (
            <div key={incident.id} className="glass-card rounded-lg overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => setExpandedIncident(isExpanded ? null : incident.id)}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    incident.status === "open" && "bg-status-critical/15",
                    incident.status === "investigating" && "bg-status-warning/15",
                    incident.status === "resolved" && "bg-status-healthy/15"
                  )}>
                    <StatusIcon className={cn(
                      "w-5 h-5",
                      incident.status === "open" && "text-status-critical",
                      incident.status === "investigating" && "text-status-warning",
                      incident.status === "resolved" && "text-status-healthy"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{incident.id}</span>
                      <span className={cn("badge-status capitalize", statusConfig[incident.status].className)}>
                        {incident.status}
                      </span>
                      <span className={cn("badge-status capitalize", severityColors[incident.severity])}>
                        {incident.severity}
                      </span>
                      <span className="badge-status bg-accent text-accent-foreground capitalize">
                        {incident.type}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{incident.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">{incident.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {incident.branch && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {incident.branch}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Created: {incident.createdAt}
                      </span>
                      {incident.affectedUsers && (
                        <span>{incident.affectedUsers} users affected</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-border">
                  <h4 className="text-sm font-medium text-foreground mb-3">Timeline</h4>
                  <div className="space-y-3">
                    {incident.timeline.map((event, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="w-12 text-xs text-muted-foreground font-mono">{event.time}</div>
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                        <p className="text-sm text-foreground flex-1">{event.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
