import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Search, Filter, Download, Clock, AlertCircle, AlertTriangle, Info } from "lucide-react";
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

type LogLevel = "INFO" | "WARN" | "ERROR";

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  details?: string;
}

const mockLogs: LogEntry[] = [
  {
    id: "1",
    timestamp: "2024-01-14 14:32:15.234",
    level: "ERROR",
    module: "payments",
    message: "Payment gateway timeout after 30s",
    details: "TransactionID: txn_abc123, Amount: ₽15000, Gateway: Sberbank",
  },
  {
    id: "2",
    timestamp: "2024-01-14 14:31:45.891",
    level: "WARN",
    module: "auth",
    message: "Multiple failed login attempts detected",
    details: "IP: 192.168.1.45, User: admin@school.ru, Attempts: 5",
  },
  {
    id: "3",
    timestamp: "2024-01-14 14:30:22.456",
    level: "INFO",
    module: "students",
    message: "Student enrollment completed successfully",
    details: "StudentID: std_789, Branch: Moscow Central",
  },
  {
    id: "4",
    timestamp: "2024-01-14 14:29:11.123",
    level: "INFO",
    module: "api",
    message: "GET /api/v1/students completed in 45ms",
  },
  {
    id: "5",
    timestamp: "2024-01-14 14:28:55.789",
    level: "ERROR",
    module: "email",
    message: "Failed to send notification email",
    details: "Recipient: parent@email.com, Error: SMTP connection refused",
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
  },
  {
    id: "8",
    timestamp: "2024-01-14 14:25:02.891",
    level: "INFO",
    module: "payments",
    message: "Payment processed successfully",
    details: "TransactionID: txn_def456, Amount: ₽8500",
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

  const filteredLogs = mockLogs.filter((log) => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.module.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = selectedLevel === "all" || log.level === selectedLevel;
    const matchesModule = selectedModule === "all" || log.module === selectedModule;
    return matchesSearch && matchesLevel && matchesModule;
  });

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Logs & Errors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and filter application logs in real-time
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Export Logs
        </Button>
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
        </div>
        <div className="divide-y divide-border max-h-[600px] overflow-y-auto scrollbar-thin">
          {filteredLogs.map((log) => {
            const LevelIcon = levelConfig[log.level].icon;
            const isExpanded = expandedLog === log.id;
            
            return (
              <div key={log.id}>
                <div
                  className={cn("log-line cursor-pointer", levelConfig[log.level].className)}
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                >
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
                    <div className="flex-1 text-foreground">{log.message}</div>
                  </div>
                </div>
                {isExpanded && log.details && (
                  <div className="px-4 py-3 bg-accent/30 text-sm text-muted-foreground font-mono border-l-2 border-primary ml-4">
                    {log.details}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
