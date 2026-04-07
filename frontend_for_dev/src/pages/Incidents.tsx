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
  branch?: string;
  createdAt: string;
  updatedAt: string;
  affectedUsers?: number;
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

function logToIncident(log: any, index: number): Incident {
  const level = (log.level || "info").toUpperCase();
  const severity: IncidentSeverity = level === "ERROR" ? "high" : "medium";
  const ts = log.timestamp ? new Date(log.timestamp).toISOString() : new Date().toISOString();
  const time = ts.slice(11, 16);
  return {
    id: `AUTO-${String(index + 1).padStart(3, "0")}`,
    title: log.message?.slice(0, 80) || "Unknown error",
    description: log.details || log.message || "",
    status: "open",
    severity,
    source: "auto",
    branch: log.branch,
    createdAt: ts,
    updatedAt: ts,
    timeline: [{ time, action: `Auto-detected from logs (${level})` }],
  };
}

const statusConfig: Record<IncidentStatus, { icon: typeof AlertCircle; label: string; className: string }> = {
  open: { icon: AlertCircle, label: "Open", className: "badge-critical" },
  investigating: { icon: Search, label: "Investigating", className: "badge-warning" },
  resolved: { icon: CheckCircle2, label: "Resolved", className: "badge-healthy" },
};

const severityColors: Record<IncidentSeverity, string> = {
  low: "bg-status-info/15 text-status-info",
  medium: "badge-warning",
  high: "bg-orange-500/15 text-orange-400",
  critical: "badge-critical",
};

export default function Incidents() {
  const [autoIncidents, setAutoIncidents] = useState<Incident[]>([]);
  const [manualIncidents, setManualIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [noteText, setNoteText] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    severity: "medium" as IncidentSeverity,
    branch: "",
  });

  // Load auto-detected incidents from logs
  const fetchAutoIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const logs = await apiClient.getLogs(200);
      const arr = Array.isArray(logs) ? logs : [];
      const errLogs = arr.filter((l: any) => {
        const lvl = (l.level || "").toUpperCase();
        return lvl === "ERROR" || lvl === "WARN";
      });
      setAutoIncidents(errLogs.map(logToIncident));
    } catch {
      setAutoIncidents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutoIncidents();
    setManualIncidents(loadManualIncidents());
  }, [fetchAutoIncidents]);

  const allIncidents = [...autoIncidents, ...manualIncidents];

  const filtered = allIncidents.filter((i) => {
    const matchStatus = selectedStatus === "all" || i.status === selectedStatus;
    const matchSearch =
      i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const updateManual = (updated: Incident[]) => {
    setManualIncidents(updated);
    saveManualIncidents(updated);
  };

  const generateId = () => `INC-${Date.now()}`;

  const handleCreate = () => {
    const now = new Date();
    const ts = now.toISOString();
    const time = ts.slice(11, 16);
    const newIncident: Incident = {
      id: generateId(),
      title: formData.title,
      description: formData.description,
      status: "open",
      severity: formData.severity,
      source: "manual",
      branch: formData.branch || undefined,
      createdAt: ts,
      updatedAt: ts,
      timeline: [{ time, action: "Incident created manually" }],
    };
    updateManual([newIncident, ...manualIncidents]);
    setIsCreateModalOpen(false);
    resetForm();
    toast.success("Incident created");
  };

  const handleEdit = () => {
    if (!selectedIncident || selectedIncident.source === "auto") return;
    const updated = manualIncidents.map((i) =>
      i.id === selectedIncident.id
        ? {
            ...i,
            title: formData.title,
            description: formData.description,
            severity: formData.severity,
            branch: formData.branch || undefined,
            updatedAt: new Date().toISOString(),
          }
        : i
    );
    updateManual(updated);
    setIsEditModalOpen(false);
    setSelectedIncident(null);
    toast.success("Incident updated");
  };

  const handleDelete = () => {
    if (!selectedIncident || selectedIncident.source === "auto") return;
    updateManual(manualIncidents.filter((i) => i.id !== selectedIncident.id));
    setIsDeleteDialogOpen(false);
    setSelectedIncident(null);
    toast.success("Incident deleted");
  };

  const handleUpdateStatus = (incident: Incident, newStatus: IncidentStatus) => {
    const time = new Date().toISOString().slice(11, 16);
    const action =
      newStatus === "resolved"
        ? "Marked as resolved"
        : newStatus === "investigating"
          ? "Investigation started"
          : "Incident reopened";

    if (incident.source === "manual") {
      updateManual(
        manualIncidents.map((i) =>
          i.id === incident.id
            ? { ...i, status: newStatus, updatedAt: new Date().toISOString(), timeline: [...i.timeline, { time, action }] }
            : i
        )
      );
    } else {
      // For auto incidents, promote to manual with updated status
      const promoted: Incident = { ...incident, source: "manual", status: newStatus, updatedAt: new Date().toISOString(), timeline: [...incident.timeline, { time, action }] };
      setAutoIncidents((prev) => prev.filter((i) => i.id !== incident.id));
      updateManual([promoted, ...manualIncidents]);
    }
    toast.success(`Status updated to ${newStatus}`);
  };

  const handleAddNote = () => {
    if (!selectedIncident || !noteText.trim()) return;
    const time = new Date().toISOString().slice(11, 16);
    const updatedIncident = { ...selectedIncident, timeline: [...selectedIncident.timeline, { time, action: noteText }], updatedAt: new Date().toISOString() };

    if (selectedIncident.source === "manual") {
      updateManual(manualIncidents.map((i) => (i.id === selectedIncident.id ? updatedIncident : i)));
    } else {
      setAutoIncidents((prev) => prev.filter((i) => i.id !== selectedIncident.id));
      updateManual([{ ...updatedIncident, source: "manual" }, ...manualIncidents]);
    }
    setIsAddNoteModalOpen(false);
    setNoteText("");
    setSelectedIncident(null);
    toast.success("Note added");
  };

  const resetForm = () => setFormData({ title: "", description: "", severity: "medium", branch: "" });

  const openEdit = (i: Incident) => {
    if (i.source === "auto") { toast.error("Auto-detected incidents cannot be edited"); return; }
    setSelectedIncident(i);
    setFormData({ title: i.title, description: i.description, severity: i.severity, branch: i.branch || "" });
    setIsEditModalOpen(true);
  };

  const openView = (i: Incident) => { setSelectedIncident(i); setIsViewModalOpen(true); };
  const openDelete = (i: Incident) => { if (i.source === "auto") { toast.error("Auto-detected incidents cannot be deleted"); return; } setSelectedIncident(i); setIsDeleteDialogOpen(true); };
  const openNote = (i: Incident) => { setSelectedIncident(i); setIsAddNoteModalOpen(true); };

  const openCount = allIncidents.filter((i) => i.status === "open").length;
  const investigatingCount = allIncidents.filter((i) => i.status === "investigating").length;
  const resolvedCount = allIncidents.filter((i) => i.status === "resolved").length;

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
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchAutoIncidents} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => { resetForm(); setIsCreateModalOpen(true); }}>
            <Plus className="w-4 h-4" />
            Report Incident
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
      </div>

      {/* Filters */}
      <div className="glass-card rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search incidents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-background" />
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
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-lg p-12 text-center text-muted-foreground">
          No incidents found
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((incident) => {
            const StatusIcon = statusConfig[incident.status].icon;
            const isExpanded = expandedId === incident.id;
            return (
              <div key={incident.id} className="glass-card rounded-lg overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      incident.status === "open" && "bg-status-critical/15",
                      incident.status === "investigating" && "bg-status-warning/15",
                      incident.status === "resolved" && "bg-status-healthy/15"
                    )}>
                      <StatusIcon className={cn("w-5 h-5",
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
                        {incident.source === "auto" && (
                          <span className="badge-status bg-primary/15 text-primary flex items-center gap-1">
                            <Zap className="w-3 h-3" /> auto
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground mb-1 truncate">{incident.title}</h3>
                      {incident.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{incident.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {incident.branch && (
                          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{incident.branch}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(incident.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openView(incident)}>
                          <Eye className="w-4 h-4 mr-2" />View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(incident)}>
                          <Edit className="w-4 h-4 mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openNote(incident)}>
                          <MessageSquare className="w-4 h-4 mr-2" />Add Note
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {incident.status !== "investigating" && (
                          <DropdownMenuItem onClick={() => handleUpdateStatus(incident, "investigating")}>
                            <Search className="w-4 h-4 mr-2" />Mark Investigating
                          </DropdownMenuItem>
                        )}
                        {incident.status !== "resolved" && (
                          <DropdownMenuItem onClick={() => handleUpdateStatus(incident, "resolved")}>
                            <CheckCircle2 className="w-4 h-4 mr-2" />Mark Resolved
                          </DropdownMenuItem>
                        )}
                        {incident.status === "resolved" && (
                          <DropdownMenuItem onClick={() => handleUpdateStatus(incident, "open")}>
                            <AlertCircle className="w-4 h-4 mr-2" />Reopen
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-status-critical" onClick={() => openDelete(incident)}>
                          <Trash2 className="w-4 h-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3">
                    <Button variant="ghost" size="sm" onClick={() => setExpandedId(isExpanded ? null : incident.id)}>
                      {isExpanded ? "Hide" : "Show"} Timeline ({incident.timeline.length})
                    </Button>
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
      )}

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Report New Incident</DialogTitle>
            <DialogDescription>Create a new incident for tracking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="Brief description" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="What happened..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v as IncidentSeverity })}>
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
                <Label>Branch (optional)</Label>
                <Input placeholder="Branch name" value={formData.branch} onChange={(e) => setFormData({ ...formData, branch: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!formData.title}>Create Incident</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Incident</DialogTitle>
            <DialogDescription>Update incident details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v as IncidentSeverity })}>
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
                <Label>Branch</Label>
                <Input value={formData.branch} onChange={(e) => setFormData({ ...formData, branch: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Incident Details</DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-muted-foreground">{selectedIncident.id}</span>
                <span className={cn("badge-status capitalize", statusConfig[selectedIncident.status].className)}>{selectedIncident.status}</span>
                <span className={cn("badge-status capitalize", severityColors[selectedIncident.severity])}>{selectedIncident.severity}</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{selectedIncident.title}</h3>
                {selectedIncident.description && <p className="text-sm text-muted-foreground mt-1">{selectedIncident.description}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Created</p><p className="font-medium text-foreground text-sm">{new Date(selectedIncident.createdAt).toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Updated</p><p className="font-medium text-foreground text-sm">{new Date(selectedIncident.updatedAt).toLocaleString()}</p></div>
                {selectedIncident.branch && <div><p className="text-xs text-muted-foreground">Branch</p><p className="font-medium text-foreground text-sm">{selectedIncident.branch}</p></div>}
              </div>
              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-medium text-foreground mb-3">Timeline</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedIncident.timeline.map((event, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-12 text-xs text-muted-foreground font-mono">{event.time}</div>
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                      <p className="text-sm text-foreground flex-1">{event.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Modal */}
      <Dialog open={isAddNoteModalOpen} onOpenChange={setIsAddNoteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>Add an update to the incident timeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea placeholder="Your update or finding..." value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddNoteModalOpen(false); setNoteText(""); }}>Cancel</Button>
            <Button onClick={handleAddNote} disabled={!noteText.trim()}>Add Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Incident</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{selectedIncident?.title}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-status-critical hover:bg-status-critical/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
