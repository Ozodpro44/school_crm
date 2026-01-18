import { useState } from "react";
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

type IncidentStatus = "open" | "investigating" | "resolved";
type IncidentType = "api" | "payment" | "email" | "database" | "redis";
type IncidentSeverity = "low" | "medium" | "high" | "critical";

interface TimelineEvent {
  time: string;
  action: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  type: IncidentType;
  severity: IncidentSeverity;
  branch?: string;
  createdAt: string;
  updatedAt: string;
  affectedUsers?: number;
  timeline: TimelineEvent[];
}

const initialIncidents: Incident[] = [
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

const severityColors: Record<IncidentSeverity, string> = {
  low: "bg-status-info/15 text-status-info",
  medium: "badge-warning",
  high: "bg-orange-500/15 text-orange-400",
  critical: "badge-critical",
};

export default function Incidents() {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const [incidentData, setIncidentData] = useState(initialIncidents);
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "api" as IncidentType,
    severity: "medium" as IncidentSeverity,
    branch: "",
  });
  const [noteText, setNoteText] = useState("");

  const filteredIncidents = incidentData.filter((incident) => {
    const matchesStatus = selectedStatus === "all" || incident.status === selectedStatus;
    const matchesSearch = incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          incident.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const generateIncidentId = () => {
    const year = new Date().getFullYear();
    const num = String(incidentData.length + 1).padStart(3, "0");
    return `INC-${year}-${num}`;
  };

  const handleCreateIncident = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace("T", " ").slice(0, 19);
    const time = now.toTimeString().slice(0, 5);
    
    const newIncident: Incident = {
      id: generateIncidentId(),
      title: formData.title,
      description: formData.description,
      status: "open",
      type: formData.type,
      severity: formData.severity,
      branch: formData.branch || undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
      timeline: [{ time, action: "Incident created manually" }],
    };
    
    setIncidentData((prev) => [newIncident, ...prev]);
    setIsCreateModalOpen(false);
    resetForm();
    toast.success("Incident created successfully");
  };

  const handleEditIncident = () => {
    if (!selectedIncident) return;
    setIncidentData((prev) =>
      prev.map((incident) =>
        incident.id === selectedIncident.id
          ? { 
              ...incident, 
              title: formData.title, 
              description: formData.description,
              type: formData.type,
              severity: formData.severity,
              branch: formData.branch || undefined,
              updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
            }
          : incident
      )
    );
    setIsEditModalOpen(false);
    setSelectedIncident(null);
    toast.success("Incident updated successfully");
  };

  const handleDeleteIncident = () => {
    if (!selectedIncident) return;
    setIncidentData((prev) => prev.filter((incident) => incident.id !== selectedIncident.id));
    setIsDeleteDialogOpen(false);
    setSelectedIncident(null);
    toast.success("Incident deleted successfully");
  };

  const handleUpdateStatus = (incident: Incident, newStatus: IncidentStatus) => {
    const time = new Date().toTimeString().slice(0, 5);
    const statusAction = newStatus === "resolved" 
      ? "Incident marked as resolved" 
      : newStatus === "investigating" 
        ? "Investigation started" 
        : "Incident reopened";
    
    setIncidentData((prev) =>
      prev.map((i) =>
        i.id === incident.id
          ? { 
              ...i, 
              status: newStatus,
              updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
              timeline: [...i.timeline, { time, action: statusAction }],
            }
          : i
      )
    );
    toast.success(`Status updated to ${newStatus}`);
  };

  const handleAddNote = () => {
    if (!selectedIncident || !noteText.trim()) return;
    const time = new Date().toTimeString().slice(0, 5);
    
    setIncidentData((prev) =>
      prev.map((incident) =>
        incident.id === selectedIncident.id
          ? { 
              ...incident, 
              timeline: [...incident.timeline, { time, action: noteText }],
              updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
            }
          : incident
      )
    );
    setIsAddNoteModalOpen(false);
    setNoteText("");
    setSelectedIncident(null);
    toast.success("Note added to timeline");
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      type: "api",
      severity: "medium",
      branch: "",
    });
  };

  const openEditModal = (incident: Incident) => {
    setSelectedIncident(incident);
    setFormData({
      title: incident.title,
      description: incident.description,
      type: incident.type,
      severity: incident.severity,
      branch: incident.branch || "",
    });
    setIsEditModalOpen(true);
  };

  const openViewModal = (incident: Incident) => {
    setSelectedIncident(incident);
    setIsViewModalOpen(true);
  };

  const openDeleteDialog = (incident: Incident) => {
    setSelectedIncident(incident);
    setIsDeleteDialogOpen(true);
  };

  const openAddNoteModal = (incident: Incident) => {
    setSelectedIncident(incident);
    setIsAddNoteModalOpen(true);
  };

  const openCount = incidentData.filter((i) => i.status === "open").length;
  const investigatingCount = incidentData.filter((i) => i.status === "investigating").length;
  const resolvedCount = incidentData.filter((i) => i.status === "resolved").length;

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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button className="gap-2" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Report Incident
          </Button>
        </div>
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
              <div className="p-4">
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openViewModal(incident)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditModal(incident)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Incident
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openAddNoteModal(incident)}>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Add Note
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {incident.status !== "investigating" && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(incident, "investigating")}>
                          <Search className="w-4 h-4 mr-2" />
                          Mark as Investigating
                        </DropdownMenuItem>
                      )}
                      {incident.status !== "resolved" && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(incident, "resolved")}>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Mark as Resolved
                        </DropdownMenuItem>
                      )}
                      {incident.status === "resolved" && (
                        <DropdownMenuItem onClick={() => handleUpdateStatus(incident, "open")}>
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Reopen Incident
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-status-critical"
                        onClick={() => openDeleteDialog(incident)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Incident
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="mt-3 flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setExpandedIncident(isExpanded ? null : incident.id)}
                  >
                    {isExpanded ? "Hide Timeline" : "Show Timeline"} ({incident.timeline.length})
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

      {/* Create Incident Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Report New Incident</DialogTitle>
            <DialogDescription>
              Create a new incident report for tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Incident Title</Label>
              <Input
                id="title"
                placeholder="Brief description of the issue"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Detailed description of what happened..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(val) => setFormData({ ...formData, type: val as IncidentType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="database">Database</SelectItem>
                    <SelectItem value="redis">Redis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <Select 
                  value={formData.severity} 
                  onValueChange={(val) => setFormData({ ...formData, severity: val as IncidentSeverity })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Affected Branch (optional)</Label>
              <Input
                id="branch"
                placeholder="e.g., Moscow Central or All Branches"
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateIncident} disabled={!formData.title || !formData.description}>
              Create Incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Incident Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Incident</DialogTitle>
            <DialogDescription>
              Update incident details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Incident Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(val) => setFormData({ ...formData, type: val as IncidentType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="database">Database</SelectItem>
                    <SelectItem value="redis">Redis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-severity">Severity</Label>
                <Select 
                  value={formData.severity} 
                  onValueChange={(val) => setFormData({ ...formData, severity: val as IncidentSeverity })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch">Affected Branch</Label>
              <Input
                id="edit-branch"
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditIncident}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Incident Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Incident Details</DialogTitle>
            <DialogDescription>
              Full information about this incident.
            </DialogDescription>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-muted-foreground">{selectedIncident.id}</span>
                <span className={cn("badge-status capitalize", statusConfig[selectedIncident.status].className)}>
                  {selectedIncident.status}
                </span>
                <span className={cn("badge-status capitalize", severityColors[selectedIncident.severity])}>
                  {selectedIncident.severity}
                </span>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-foreground">{selectedIncident.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selectedIncident.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium text-foreground capitalize">{selectedIncident.type}</p>
                </div>
                {selectedIncident.branch && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Affected Branch</p>
                    <p className="font-medium text-foreground">{selectedIncident.branch}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium text-foreground">{selectedIncident.createdAt}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Last Updated</p>
                  <p className="font-medium text-foreground">{selectedIncident.updatedAt}</p>
                </div>
                {selectedIncident.affectedUsers && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Affected Users</p>
                    <p className="font-medium text-foreground">{selectedIncident.affectedUsers}</p>
                  </div>
                )}
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
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setIsViewModalOpen(false);
              if (selectedIncident) openEditModal(selectedIncident);
            }}>
              Edit Incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Modal */}
      <Dialog open={isAddNoteModalOpen} onOpenChange={setIsAddNoteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a note to the incident timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder="Enter your update or finding..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddNoteModalOpen(false); setNoteText(""); }}>
              Cancel
            </Button>
            <Button onClick={handleAddNote} disabled={!noteText.trim()}>
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Incident</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete incident "{selectedIncident?.id}"? This will remove all timeline data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteIncident} className="bg-status-critical hover:bg-status-critical/90">
              Delete Incident
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
