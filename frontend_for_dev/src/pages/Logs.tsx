import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Search, Download, Clock, AlertCircle, AlertTriangle, Info, Eye, Copy, Trash2, Loader } from "lucide-react";
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

const mockLogs: LogEntry[] = [
  {
    id: "1",
    timestamp: "2024-01-14 14:32:15.234",
    level: "ERROR",
    module: "payments",
    message: "Payment gateway timeout after 30s",
    details: "TransactionID: txn_abc123, Amount: ₽15000, Gateway: Sberbank",
    stackTrace: "Error: Connection timeout\n  at PaymentService.processPayment (payments.go:145)\n  at handlers.HandlePayment (handlers.go:89)\n  at gin.Context.Next (context.go:116)",
    requestId: "req_xyz789",
    userId: "user_456",
    branch: "Moscow Central",
  },
  {
    id: "2",
    timestamp: "2024-01-14 14:31:45.891",
    level: "WARN",
    module: "auth",
    message: "Multiple failed login attempts detected",
    details: "IP: 192.168.1.45, User: admin@school.ru, Attempts: 5",
    requestId: "req_abc123",
  },
  {
    id: "3",
    timestamp: "2024-01-14 14:30:22.456",
    level: "INFO",
    module: "students",
    message: "Student enrollment completed successfully",
    details: "StudentID: std_789, Branch: Moscow Central",
    requestId: "req_def456",
    branch: "Moscow Central",
  },
  {
    id: "4",
    timestamp: "2024-01-14 14:29:11.123",
    level: "INFO",
    module: "api",
    message: "GET /api/v1/students completed in 45ms",
    requestId: "req_ghi789",
  },
  {
    id: "5",
    timestamp: "2024-01-14 14:28:55.789",
    level: "ERROR",
    module: "email",
    message: "Failed to send notification email",
    details: "Recipient: parent@email.com, Error: SMTP connection refused",
    stackTrace: "Error: SMTP connection refused\n  at EmailService.sendMail (email.go:78)\n  at NotificationService.notify (notifications.go:45)",
    requestId: "req_jkl012",
    branch: "Saint Petersburg Main",
  },
  {
    id: "6",
    timestamp: "2024-01-14 14:27:33.456",
    level: "WARN",
    module: "redis",
    message: "Redis memory usage above 80%",
    details: "Current: 410MB, Max: 512MB",
  },
  {
    id: "7",
    timestamp: "2024-01-14 14:26:18.234",
    level: "INFO",
    module: "auth",
    message: "User session created",
    details: "UserID: usr_456, Role: Teacher",
    requestId: "req_mno345",
    userId: "usr_456",
  },
  {
    id: "8",
    timestamp: "2024-01-14 14:25:02.891",
    level: "INFO",
    module: "payments",
    message: "Payment processed successfully",
    details: "TransactionID: txn_def456, Amount: ₽8500",
    requestId: "req_pqr678",
    branch: "Sochi Campus",
  },
];

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
      
      // Try to fetch from backend API first
      try {
        const { apiClient } = await import('@/services/api-client');
        const backendLogs = await apiClient.getLogs(100);
        
        if (backendLogs && Array.isArray(backendLogs) && backendLogs.length > 0) {
          // Convert backend logs to LogEntry format
          const convertedLogs: LogEntry[] = backendLogs.map((log, index) => {
            // Map log levels to valid LogLevel type
            let level: LogLevel = 'INFO';
            const upperLevel = (log.level || 'info').toUpperCase();
            if (upperLevel === 'ERROR') level = 'ERROR';
            else if (upperLevel === 'WARN') level = 'WARN';
            
            return {
              id: log.id || String(index),
              timestamp: log.timestamp || new Date().toISOString(),
              level,
              module: log.module || log.service || 'backend',
              message: log.message || '',
              details: log.details || (log.metadata ? JSON.stringify(log.metadata, null, 2) : undefined),
              stackTrace: log.stackTrace,
              requestId: log.requestId,
              userId: log.userId,
              branch: log.branch,
            };
          });
          
          setLogData(convertedLogs);
          return;
        }
      } catch (apiError) {
        // Backend API not available or returned no logs
      }
      
      // Use mock logs as fallback
      // TODO: Add backend /api/logs endpoint to show real logs
      setLogData(mockLogs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch logs';
      setError(message);
      setLogData(mockLogs);
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

  const handleClearLogs = () => {
    setLogData([]);
    setIsClearDialogOpen(false);
    toast.success("Logs cleared");
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
            Real-time application logs from Railway deployment
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
              Loading logs from Railway...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No logs found matching your filters
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
                        {log.timestamp}
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
                <p className="font-mono text-foreground">{selectedLog.timestamp}</p>
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
