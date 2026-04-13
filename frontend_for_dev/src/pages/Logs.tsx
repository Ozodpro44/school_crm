import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Search, Download, Clock, AlertCircle, AlertTriangle, Info, Eye, Copy, Trash2, Loader } from "lucide-react";
import { apiClient } from "@/services/api-client";
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

type LogLevel = "INFO" | "WARN" | "ERROR";

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  details?: string;
  stackTrace?: string;
  requestId?: string;
  userId?: string;
  branch?: string;
}

// Mock logs removed - only showing real backend data

const levelConfig: Record<LogLevel, { icon: typeof Info; className: string }> = {
  INFO: { icon: Info, className: "log-info" },
  WARN: { icon: AlertTriangle, className: "log-warning" },
  ERROR: { icon: AlertCircle, className: "log-error" },
};

const modules = ["all", "auth", "payments", "students", "email", "api", "redis"];

export default function Logs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [selectedModule, setSelectedModule] = useState("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [logData, setLogData] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // Fetch logs on mount
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const raw = await apiClient.getDevLogs({ limit: 200 });
      const entries: LogEntry[] = (raw || []).map((log: any, index: number) => {
        let level: LogLevel = 'INFO';
        const upperLevel = (log.level || 'info').toUpperCase();
        if (upperLevel === 'ERROR') level = 'ERROR';
        else if (upperLevel === 'WARN') level = 'WARN';

        return {
          id: log.id || String(index),
          timestamp: log.timestamp || new Date().toISOString(),
          level,
          module: log.module || log.service || 'api',
          message: log.message || '',
          details: log.metadata ? JSON.stringify(log.metadata, null, 2) : undefined,
        };
      });
      setLogData(entries);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch logs';
      setError(message);
      setLogData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logData.filter((log) => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.module.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (log.details?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesLevel = selectedLevel === "all" || log.level === selectedLevel;
    const matchesModule = selectedModule === "all" || log.module === selectedModule;
    return matchesSearch && matchesLevel && matchesModule;
  });

  const openViewModal = (log: LogEntry) => {
    setSelectedLog(log);
    setIsViewModalOpen(true);
  };

  const handleExportLogs = () => {
    const logsJson = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([logsJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exported successfully");
  };

  const handleCopyLog = (log: LogEntry) => {
    const logText = `[${log.timestamp}] [${log.level}] [${log.module}] ${log.message}${log.details ? `\n${log.details}` : ""}${log.stackTrace ? `\n${log.stackTrace}` : ""}`;
    navigator.clipboard.writeText(logText);
    toast.success("Log copied to clipboard");
  };

  const handleClearLogs = async () => {
    try {
      await apiClient.clearDevLogs();
      setLogData([]);
      setIsClearDialogOpen(false);
      toast.success("Logs cleared");
    } catch (err) {
      toast.error("Failed to clear logs");
      setIsClearDialogOpen(false);
    }
  };

  const handleRefreshLogs = () => {
    fetchLogs();
  };

  const errorCount = logData.filter((l) => l.level === "ERROR").length;
  const warnCount = logData.filter((l) => l.level === "WARN").length;
  const infoCount = logData.filter((l) => l.level === "INFO").length;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Logs & Errors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time application logs from the backend
          </p>
          {error && <p className="text-sm text-status-critical mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={handleRefreshLogs}
            disabled={isLoading}
          >
            {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportLogs}>
            <Download className="w-4 h-4" />
            Export Logs
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 text-status-critical hover:text-status-critical"
            onClick={() => setIsClearDialogOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            Clear Logs
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
              <p className="text-2xl font-bold text-foreground">{errorCount}</p>
              <p className="text-sm text-muted-foreground">Errors</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-warning/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-status-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{warnCount}</p>
              <p className="text-sm text-muted-foreground">Warnings</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-info/15 flex items-center justify-center">
              <Info className="w-5 h-5 text-status-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{infoCount}</p>
              <p className="text-sm text-muted-foreground">Info</p>
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
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>
          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger className="w-full md:w-40 bg-background">
              <SelectValue placeholder="Log Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="INFO">INFO</SelectItem>
              <SelectItem value="WARN">WARN</SelectItem>
              <SelectItem value="ERROR">ERROR</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedModule} onValueChange={setSelectedModule}>
            <SelectTrigger className="w-full md:w-40 bg-background">
              <SelectValue placeholder="Module" />
            </SelectTrigger>
            <SelectContent>
              {modules.map((module) => (
                <SelectItem key={module} value={module}>
                  {module === "all" ? "All Modules" : module}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border text-xs text-muted-foreground font-medium">
          <div className="w-44">Timestamp</div>
          <div className="w-16">Level</div>
          <div className="w-24">Module</div>
          <div className="flex-1">Message</div>
          <div className="w-20">Actions</div>
        </div>
        <div className="divide-y divide-border max-h-[600px] overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader className="w-4 h-4 animate-spin" />
              Loading logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {logData.length === 0
                ? "No log entries yet — errors and warnings appear here automatically"
                : "No logs found matching your filters"}
            </div>
          ) : (
            filteredLogs.map((log) => {
              const LevelIcon = levelConfig[log.level].icon;
              const isExpanded = expandedLog === log.id;
              
              return (
                <div key={log.id}>
                  <div className={cn("log-line", levelConfig[log.level].className)}>
                    <div className="flex items-center gap-4">
                      <div className="w-44 text-muted-foreground flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {new Date(log.timestamp).toLocaleString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                      <div className="w-16">
                        <span className={cn(
                          "badge-status flex items-center gap-1",
                          log.level === "INFO" && "bg-status-info/15 text-status-info",
                          log.level === "WARN" && "badge-warning",
                          log.level === "ERROR" && "badge-critical"
                        )}>
                          <LevelIcon className="w-3 h-3" />
                          {log.level}
                        </span>
                      </div>
                      <div className="w-24">
                        <span className="text-primary font-medium">{log.module}</span>
                      </div>
                      <div 
                        className="flex-1 text-foreground cursor-pointer hover:underline"
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                      >
                        {log.message}
                      </div>
                      <div className="w-20 flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => openViewModal(log)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => handleCopyLog(log)}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {isExpanded && log.details && (
                    <div className="px-4 py-3 bg-accent/30 text-sm text-muted-foreground font-mono border-l-2 border-primary ml-4">
                      {log.details}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* View Log Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log Details</DialogTitle>
            <DialogDescription>
              Full log entry information
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  "badge-status flex items-center gap-1",
                  selectedLog.level === "INFO" && "bg-status-info/15 text-status-info",
                  selectedLog.level === "WARN" && "badge-warning",
                  selectedLog.level === "ERROR" && "badge-critical"
                )}>
                  {selectedLog.level}
                </span>
                <span className="badge-status bg-accent text-accent-foreground">
                  {selectedLog.module}
                </span>
                {selectedLog.branch && (
                  <span className="badge-status bg-primary/15 text-primary">
                    {selectedLog.branch}
                  </span>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Timestamp</p>
                <p className="font-mono text-foreground">{new Date(selectedLog.timestamp).toLocaleString('en-US', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Message</p>
                <p className="font-medium text-foreground">{selectedLog.message}</p>
              </div>

              {selectedLog.details && (
                <div>
                  <p className="text-sm text-muted-foreground">Details</p>
                  <pre className="p-3 bg-accent/30 rounded-lg text-sm font-mono text-foreground overflow-x-auto">
                    {selectedLog.details}
                  </pre>
                </div>
              )}

              {selectedLog.stackTrace && (
                <div>
                  <p className="text-sm text-muted-foreground">Stack Trace</p>
                  <pre className="p-3 bg-status-critical/10 rounded-lg text-sm font-mono text-status-critical overflow-x-auto">
                    {selectedLog.stackTrace}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {selectedLog.requestId && (
                  <div>
                    <p className="text-xs text-muted-foreground">Request ID</p>
                    <p className="font-mono text-sm text-foreground">{selectedLog.requestId}</p>
                  </div>
                )}
                {selectedLog.userId && (
                  <div>
                    <p className="text-xs text-muted-foreground">User ID</p>
                    <p className="font-mono text-sm text-foreground">{selectedLog.userId}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              if (selectedLog) handleCopyLog(selectedLog);
            }}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Logs Dialog */}
      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Logs</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all logs? This action cannot be undone and all log entries will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearLogs} className="bg-status-critical hover:bg-status-critical/90">
              Clear All Logs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
