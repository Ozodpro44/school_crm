import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  AlertTriangle,
  CheckCircle2,
  Search,
  Clock,
  Building2,
  AlertCircle,
  RefreshCw,
  Plus,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  MessageSquare,
  Loader2,
  Zap,
  ArrowUpRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { apiClient } from "@/services/api-client";

type IncidentStatus = "open" | "investigating" | "resolved";
type IncidentSeverity = "low" | "medium" | "high" | "critical";
type IncidentSource = "auto" | "manual";

interface TimelineEvent {
  time: string;
  action: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  source: IncidentSource;
  module?: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEvent[];
}

const STORAGE_KEY = "dev_manual_incidents";

function loadManualIncidents(): Incident[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveManualIncidents(incidents: Incident[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
}

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type RawLog = { id?: string; _id?: string; level?: string; message?: string; timestamp?: string; module?: string; service?: string; metadata?: Record<string, string> };

function logToIncident(log: RawLog): Incident {
  const level = (log.level || "INFO").toUpperCase();
  const severity: IncidentSeverity = level === "ERROR" ? "high" : "medium";
  const ts = log.timestamp
    ? new Date(log.timestamp).toISOString()
    : new Date().toISOString();

  let description = "";
  if (log.metadata && typeof log.metadata === "object") {
    const entries = Object.entries(log.metadata)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
    if (entries) description = entries;
  }
  if (!description) description = log.message || "";

  // Use stable id from log if available
  const id = log.id || log._id
    ? `AUTO-${log.id || log._id}`
    : `AUTO-${ts.replace(/[^0-9]/g, "").slice(0, 14)}-${(log.message || "").slice(0, 8).replace(/\W/g, "")}`;

  return {
    id,
    title: (log.message || "Unknown error").slice(0, 120),
    description,
    status: "open",
    severity,
    source: "auto",
    module: log.module || log.service || undefined,
    createdAt: ts,
    updatedAt: ts,
    timeline: [
      {
        time: formatTs(ts),
        action: `Auto-detected from logs [${level}]${log.module ? ` — ${log.module}` : ""}`,
      },
    ],
  };
}

const statusConfig: Record<
  IncidentStatus,
  { icon: typeof AlertCircle; label: string; badge: string; ring: string }
> = {
  open: {
    icon: AlertCircle,
    label: "Open",
    badge: "badge-critical",
    ring: "bg-status-critical/15 text-status-critical",
  },
  investigating: {
    icon: Search,
    label: "Investigating",
    badge: "badge-warning",
    ring: "bg-status-warning/15 text-status-warning",
  },
  resolved: {
    icon: CheckCircle2,
    label: "Resolved",
    badge: "badge-healthy",
    ring: "bg-status-healthy/15 text-status-healthy",
  },
};

const severityConfig: Record<IncidentSeverity, { className: string; label: string }> = {
  low: { className: "bg-status-info/15 text-status-info", label: "Low" },
  medium: { className: "badge-warning", label: "Medium" },
  high: { className: "bg-orange-500/15 text-orange-400", label: "High" },
  critical: { className: "badge-critical", label: "Critical" },
};

export default function Incidents() {
  const [autoIncidents, setAutoIncidents] = useState<Incident[]>([]);
  const [manualIncidents, setManualIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedSource, setSelectedSource] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [noteText, setNoteText] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "medium" as IncidentSeverity,
    module: "",
  });

  // ── Data loading ─────────────────────────────────────────────────────────────

  const fetchAutoIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const logs = await apiClient.getLogs(300);
      const arr = Array.isArray(logs) ? logs : [];
      const relevant = (arr as RawLog[]).filter((l) => {
        const lvl = (l.level || "").toUpperCase();
        return lvl === "ERROR" || lvl === "WARN";
      });
      // Deduplicate by stable id
      const seen = new Set<string>();
      const deduped: Incident[] = [];
      for (const log of relevant) {
        const inc = logToIncident(log);
        if (!seen.has(inc.id)) {
          seen.add(inc.id);
          deduped.push(inc);
        }
      }
      setAutoIncidents(deduped);
    } catch {
      setAutoIncidents([]);
      toast.error("Could not load logs from backend");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutoIncidents();
    setManualIncidents(loadManualIncidents());
  }, [fetchAutoIncidents]);

  // ── Derived state ─────────────────────────────────────────────────────────────

  // Auto incidents that have been promoted appear in manualIncidents with the same id
  const promotedAutoIds = new Set(manualIncidents.map((m) => m.id));
  const visibleAuto = autoIncidents.filter((a) => !promotedAutoIds.has(a.id));

  const allIncidents: Incident[] = [
    ...visibleAuto,
    ...manualIncidents,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = allIncidents.filter((i) => {
    if (selectedStatus !== "all" && i.status !== selectedStatus) return false;
    if (selectedSource !== "all" && i.source !== selectedSource) return false;
    const q = searchQuery.toLowerCase();
    if (
      q &&
      !i.title.toLowerCase().includes(q) &&
      !i.description.toLowerCase().includes(q) &&
      !(i.module || "").toLowerCase().includes(q)
    )
      return false;
    return true;
  });

  const openCount = allIncidents.filter((i) => i.status === "open").length;
  const investigatingCount = allIncidents.filter((i) => i.status === "investigating").length;
  const resolvedCount = allIncidents.filter((i) => i.status === "resolved").length;

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const saveManual = (list: Incident[]) => {
    setManualIncidents(list);
    saveManualIncidents(list);
  };

  const generateId = () =>
    `INC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString(36).toUpperCase()}`;

  const resetForm = () =>
    setForm({ title: "", description: "", severity: "medium", module: "" });

  const handleCreate = () => {
    if (!form.title.trim()) return;
    const ts = new Date().toISOString();
    const incident: Incident = {
      id: generateId(),
      title: form.title.trim(),
      description: form.description.trim(),
      status: "open",
      severity: form.severity,
      source: "manual",
      module: form.module.trim() || undefined,
      createdAt: ts,
      updatedAt: ts,
      timeline: [{ time: formatTs(ts), action: "Incident reported manually" }],
    };
    saveManual([incident, ...manualIncidents]);
    setIsCreateOpen(false);
    resetForm();
    toast.success("Incident created");
  };

  const handleEdit = () => {
    if (!selectedIncident) return;
    const ts = new Date().toISOString();
    const updated = manualIncidents.map((i) =>
      i.id !== selectedIncident.id
        ? i
        : {
            ...i,
            title: form.title.trim(),
            description: form.description.trim(),
            severity: form.severity,
            module: form.module.trim() || undefined,
            updatedAt: ts,
            timeline: [
              ...i.timeline,
              { time: formatTs(ts), action: "Incident details updated" },
            ],
          }
    );
    saveManual(updated);
    setIsEditOpen(false);
    setSelectedIncident(null);
    toast.success("Incident updated");
  };

  const handleDelete = () => {
    if (!selectedIncident) return;
    saveManual(manualIncidents.filter((i) => i.id !== selectedIncident.id));
    setIsDeleteOpen(false);
    setSelectedIncident(null);
    toast.success("Incident deleted");
  };

  const handleUpdateStatus = (incident: Incident, newStatus: IncidentStatus) => {
    const ts = new Date().toISOString();
    const action =
      newStatus === "resolved"
        ? "Marked as resolved"
        : newStatus === "investigating"
        ? "Investigation started"
        : "Incident reopened";

    const updated: Incident = {
      ...incident,
      status: newStatus,
      updatedAt: ts,
      timeline: [...incident.timeline, { time: formatTs(ts), action }],
    };

    if (incident.source === "manual") {
      saveManual(manualIncidents.map((i) => (i.id === incident.id ? updated : i)));
    } else {
      // Promote auto → manual with new status
      setAutoIncidents((prev) => prev.filter((i) => i.id !== incident.id));
      saveManual([{ ...updated, source: "manual" }, ...manualIncidents]);
    }
    toast.success(`Status → ${newStatus}`);
  };

  const handlePromoteAndEdit = () => {
    if (!selectedIncident) return;
    const ts = new Date().toISOString();
    const promoted: Incident = {
      ...selectedIncident,
      source: "manual",
      updatedAt: ts,
      timeline: [
        ...selectedIncident.timeline,
        { time: formatTs(ts), action: "Promoted from auto-detection to manual tracking" },
      ],
    };
    setAutoIncidents((prev) => prev.filter((i) => i.id !== selectedIncident.id));
    saveManual([promoted, ...manualIncidents]);
    setSelectedIncident(promoted);
    setForm({
      title: promoted.title,
      description: promoted.description,
      severity: promoted.severity,
      module: promoted.module || "",
    });
    setIsPromoteOpen(false);
    setIsEditOpen(true);
    toast.success("Incident promoted — you can now edit it");
  };

  const handleAddNote = () => {
    if (!selectedIncident || !noteText.trim()) return;
    const ts = new Date().toISOString();
    const updated: Incident = {
      ...selectedIncident,
      updatedAt: ts,
      timeline: [
        ...selectedIncident.timeline,
        { time: formatTs(ts), action: noteText.trim() },
      ],
    };

    if (selectedIncident.source === "manual") {
      saveManual(manualIncidents.map((i) => (i.id === selectedIncident.id ? updated : i)));
    } else {
      // Promote auto → manual with note
      setAutoIncidents((prev) => prev.filter((i) => i.id !== selectedIncident.id));
      saveManual([{ ...updated, source: "manual" }, ...manualIncidents]);
    }
    setIsNoteOpen(false);
    setNoteText("");
    setSelectedIncident(null);
    toast.success("Note added");
  };

  // ── UI helpers ────────────────────────────────────────────────────────────────

  const openView = (i: Incident) => { setSelectedIncident(i); setIsViewOpen(true); };

  const openEdit = (i: Incident) => {
    if (i.source === "auto") {
      setSelectedIncident(i);
      setIsPromoteOpen(true);
      return;
    }
    setSelectedIncident(i);
    setForm({ title: i.title, description: i.description, severity: i.severity, module: i.module || "" });
    setIsEditOpen(true);
  };

  const openDelete = (i: Incident) => {
    if (i.source === "auto") {
      toast.error("Auto incidents can't be deleted. Mark as Resolved or promote to manual first.");
      return;
    }
    setSelectedIncident(i);
    setIsDeleteOpen(true);
  };

  const openNote = (i: Incident) => { setSelectedIncident(i); setIsNoteOpen(true); };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Incidents & Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-detected from logs + manually tracked incidents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={fetchAutoIncidents}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button
            className="gap-2"
            onClick={() => { resetForm(); setIsCreateOpen(true); }}
          >
            <Plus className="w-4 h-4" />
            Report Incident
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-critical/15 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-status-critical" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{openCount}</p>
              <p className="text-sm text-muted-foreground">Open</p>
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
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "…" : visibleAuto.length}</p>
              <p className="text-sm text-muted-foreground">Auto-detected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, description, module..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full md:w-44 bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="w-full md:w-44 bg-background">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="auto">Auto-detected</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-lg p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-status-healthy opacity-30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            {allIncidents.length === 0
              ? "No incidents detected. Logs look clean!"
              : "No incidents match your filters."}
          </p>
          {allIncidents.length === 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              ERROR and WARN log entries will automatically appear here.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((incident) => {
            const { icon: StatusIcon, ring, badge } = statusConfig[incident.status];
            const isExpanded = expandedId === incident.id;
            const isAuto = incident.source === "auto";

            return (
              <div key={incident.id} className="glass-card rounded-lg overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Status icon */}
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", ring)}>
                      <StatusIcon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Badge row */}
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{incident.id}</span>
                        <span className={cn("badge-status capitalize", badge)}>
                          {statusConfig[incident.status].label}
                        </span>
                        <span className={cn("badge-status capitalize", severityConfig[incident.severity].className)}>
                          {severityConfig[incident.severity].label}
                        </span>
                        {isAuto ? (
                          <span className="badge-status bg-primary/15 text-primary flex items-center gap-1 text-xs">
                            <Zap className="w-3 h-3" /> auto
                          </span>
                        ) : (
                          <span className="badge-status bg-accent text-accent-foreground text-xs">manual</span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-foreground mb-1 leading-snug">{incident.title}</h3>

                      {/* Description */}
                      {incident.description && incident.description !== incident.title && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-1">{incident.description}</p>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                        {incident.module && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {incident.module}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTs(incident.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => openView(incident)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {isAuto ? (
                          <DropdownMenuItem onClick={() => openEdit(incident)}>
                            <ArrowUpRight className="w-4 h-4 mr-2" />
                            Promote &amp; Edit
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => openEdit(incident)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => openNote(incident)}>
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Add Note
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {incident.status !== "investigating" && (
                          <DropdownMenuItem onClick={() => handleUpdateStatus(incident, "investigating")}>
                            <Search className="w-4 h-4 mr-2" />
                            Mark Investigating
                          </DropdownMenuItem>
                        )}
                        {incident.status !== "resolved" && (
                          <DropdownMenuItem onClick={() => handleUpdateStatus(incident, "resolved")}>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Mark Resolved
                          </DropdownMenuItem>
                        )}
                        {incident.status === "resolved" && (
                          <DropdownMenuItem onClick={() => handleUpdateStatus(incident, "open")}>
                            <AlertCircle className="w-4 h-4 mr-2" />
                            Reopen
                          </DropdownMenuItem>
                        )}
                        {!isAuto && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-status-critical"
                              onClick={() => openDelete(incident)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Timeline toggle */}
                  <div className="mt-3">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : incident.id)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <Clock className="w-3 h-3" />
                      {isExpanded ? "Hide" : "Show"} timeline ({incident.timeline.length} event
                      {incident.timeline.length !== 1 ? "s" : ""})
                    </button>
                  </div>
                </div>

                {/* Timeline body */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-border">
                    <div className="space-y-2">
                      {incident.timeline.map((event, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="w-32 text-xs text-muted-foreground font-mono flex-shrink-0">
                            {event.time}
                          </div>
                          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                          <p className="text-sm text-foreground">{event.action}</p>
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

      {/* ── Create Modal ──────────────────────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Report New Incident</DialogTitle>
            <DialogDescription>Manually track an incident or system issue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Brief description of the issue"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="What happened, impact, steps to reproduce..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm({ ...form, severity: v as IncidentSeverity })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Module / Service</Label>
                <Input
                  placeholder="e.g. auth, payments"
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.title.trim()}>
              Create Incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Modal ────────────────────────────────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Incident</DialogTitle>
            <DialogDescription>Update incident details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm({ ...form, severity: v as IncidentSeverity })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Module / Service</Label>
                <Input
                  placeholder="e.g. auth, payments"
                  value={form.module}
                  onChange={(e) => setForm({ ...form, module: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!form.title.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Modal ────────────────────────────────────────────────────────── */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Incident Details</DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">{selectedIncident.id}</span>
                <span className={cn("badge-status capitalize", statusConfig[selectedIncident.status].badge)}>
                  {statusConfig[selectedIncident.status].label}
                </span>
                <span className={cn("badge-status capitalize", severityConfig[selectedIncident.severity].className)}>
                  {severityConfig[selectedIncident.severity].label}
                </span>
                {selectedIncident.source === "auto" && (
                  <span className="badge-status bg-primary/15 text-primary flex items-center gap-1 text-xs">
                    <Zap className="w-3 h-3" /> auto
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">{selectedIncident.title}</h3>
                {selectedIncident.description && selectedIncident.description !== selectedIncident.title && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedIncident.description}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Created</p>
                  <p className="font-medium text-foreground">{formatTs(selectedIncident.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Updated</p>
                  <p className="font-medium text-foreground">{formatTs(selectedIncident.updatedAt)}</p>
                </div>
                {selectedIncident.module && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Module</p>
                    <p className="font-medium text-foreground">{selectedIncident.module}</p>
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-3">
                <h4 className="text-sm font-medium text-foreground mb-2">Timeline</h4>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {selectedIncident.timeline.map((event, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-32 text-xs text-muted-foreground font-mono flex-shrink-0">{event.time}</div>
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <p className="text-sm text-foreground">{event.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
            {selectedIncident?.source === "manual" && (
              <Button onClick={() => { setIsViewOpen(false); openEdit(selectedIncident!); }}>
                Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Note Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add an update to the incident timeline.
              {selectedIncident?.source === "auto" && (
                <span className="block mt-1 text-primary text-xs">
                  This will promote the auto incident to manual tracking.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Your update, finding, or action taken..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsNoteOpen(false); setNoteText(""); }}>
              Cancel
            </Button>
            <Button onClick={handleAddNote} disabled={!noteText.trim()}>
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Promote Confirm ─────────────────────────────────────────────────────── */}
      <AlertDialog open={isPromoteOpen} onOpenChange={setIsPromoteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote to Manual Incident?</AlertDialogTitle>
            <AlertDialogDescription>
              Auto-detected incidents are read-only. Promoting moves it to manual tracking so you can edit details, add context, and manage its lifecycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePromoteAndEdit}>
              Promote &amp; Edit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Confirm ──────────────────────────────────────────────────────── */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Incident</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{selectedIncident?.title}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-status-critical hover:bg-status-critical/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
