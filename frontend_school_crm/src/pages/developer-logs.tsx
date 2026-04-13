import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Trash2, Copy, Check } from 'lucide-react';

interface Log {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  module: string;
  service: string;
  message: string;
  details?: string;
  stack?: string;
  requestId?: string;
  userId?: string;
  branch?: string;
}

type LogLevel = 'all' | 'debug' | 'info' | 'warn' | 'error';
type SortField = 'timestamp' | 'level' | 'service' | 'message';

const LEVEL_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  debug: { bg: 'bg-slate-100', text: 'text-slate-700', badge: 'bg-slate-200 text-slate-700' },
  info: { bg: 'bg-blue-100', text: 'text-blue-700', badge: 'bg-blue-200 text-blue-700' },
  warn: { bg: 'bg-orange-100', text: 'text-orange-700', badge: 'bg-orange-200 text-orange-700' },
  error: { bg: 'bg-red-100', text: 'text-red-700', badge: 'bg-red-200 text-red-700' },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export default function DeveloperLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [isClearingLogs, setIsClearingLogs] = useState(false);

  // Filters
  const [levelFilter, setLevelFilter] = useState<LogLevel>('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortAsc, setSortAsc] = useState(false); // false = descending (newest first)

  // Extract unique services from logs
  const services = Array.from(new Set(logs.map((log) => log.service))).sort();

  // Fetch logs from backend
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('limit', '1000');

      if (levelFilter !== 'all') {
        params.append('level', levelFilter);
      }

      const url = `${API_BASE}/api/logs?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }

      const data: Log[] = (await response.json()) || [];

      // Ensure data is array
      if (!Array.isArray(data)) {
        setLogs([]);
        setFilteredLogs([]);
        return;
      }

      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [levelFilter]);

  // Apply filters and sorting
  useEffect(() => {
    let result = logs;

    // Apply service filter
    if (serviceFilter !== 'all') {
      result = result.filter((log) => log.service === serviceFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (log) =>
          log.message.toLowerCase().includes(query) ||
          log.module.toLowerCase().includes(query) ||
          log.details?.toLowerCase().includes(query) ||
          log.requestId?.toLowerCase().includes(query) ||
          log.userId?.toLowerCase().includes(query),
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'timestamp') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });

    setFilteredLogs(result);
  }, [logs, levelFilter, serviceFilter, searchQuery, sortField, sortAsc]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      fetchLogs();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(timer);
  }, [autoRefresh, fetchLogs]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
      return;
    }

    setIsClearingLogs(true);
    try {
      const response = await fetch(`${API_BASE}/api/logs`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setLogs([]);
        setFilteredLogs([]);
      }
    } catch (err) {
      console.error('Failed to clear logs:', err);
    } finally {
      setIsClearingLogs(false);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      });
    } catch {
      return timestamp;
    }
  };

  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getRowClassName = (level: string) => {
    const colors = LEVEL_COLORS[level] || LEVEL_COLORS.info;
    return colors.bg;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-slate-900">Developer Logs</h1>
            <div className="flex gap-2">
              <Button
                onClick={() => fetchLogs()}
                disabled={loading}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh
              </Button>
              <Button
                onClick={handleClearLogs}
                size="sm"
                variant="destructive"
                className="gap-2"
                disabled={isClearingLogs}
              >
                {isClearingLogs ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </>
                )}
              </Button>
            </div>
          </div>
          <p className="text-slate-600">
            Real-time application logs from Railway services
          </p>
        </div>

        {/* Stats Card */}
        <Card className="mb-6 bg-white border-slate-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Logs</p>
                <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Showing</p>
                <p className="text-2xl font-bold text-slate-900">{filteredLogs.length}</p>
              </div>
              {Object.entries(LEVEL_COLORS).map(([level, colors]) => (
                <div key={level}>
                  <p className="text-sm font-medium text-slate-600 capitalize">{level}</p>
                  <p className={`text-2xl font-bold ${colors.text}`}>
                    {logs.filter((l) => l.level === level).length}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="mb-6 bg-white border-slate-200">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Row 1: Auto-refresh toggle and search */}
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">Auto-refresh (5s)</span>
                </label>

                <div className="flex-1 min-w-64">
                  <Input
                    placeholder="Search logs by message, module, request ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="border-slate-300"
                  />
                </div>
              </div>

              {/* Row 2: Filters and sort */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Level Filter */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-2">
                    Level
                  </label>
                  <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as LogLevel)}>
                    <SelectTrigger className="border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Service Filter */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-2">
                    Service
                  </label>
                  <Select value={serviceFilter} onValueChange={setServiceFilter}>
                    <SelectTrigger className="border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      {services.map((svc) => (
                        <SelectItem key={svc} value={svc}>
                          {svc || 'unknown'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Field */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-2">
                    Sort By
                  </label>
                  <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                    <SelectTrigger className="border-slate-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="timestamp">Timestamp</SelectItem>
                      <SelectItem value="level">Level</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="message">Message</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Order */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase block mb-2">
                    Order
                  </label>
                  <Button
                    onClick={() => setSortAsc(!sortAsc)}
                    variant="outline"
                    className="w-full border-slate-300 justify-center"
                  >
                    {sortAsc ? '↑ Ascending' : '↓ Descending'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Card className="mb-6 bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <p className="text-sm text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Logs Table */}
        <Card className="bg-white border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-700 w-32">
                    Time
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 w-20">
                    Level
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 w-24">
                    Service
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 w-24">
                    Module
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 flex-1">
                    Message
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 w-20">
                    Details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                      Loading logs...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      No logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow
                      key={log.id}
                      className={`border-slate-200 hover:bg-slate-50 transition-colors ${getRowClassName(
                        log.level,
                      )}`}
                    >
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        <div className="font-mono">
                          {formatDate(log.timestamp)}
                          <br />
                          {formatTime(log.timestamp)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${LEVEL_COLORS[log.level]?.badge} text-xs font-semibold uppercase`}
                        >
                          {log.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700">
                        {log.service || '—'}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700">
                        {log.module || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700 max-w-md">
                        <div className="truncate" title={log.message}>
                          {log.message}
                        </div>
                        {log.requestId && (
                          <div className="text-xs text-slate-500 mt-1">
                            req: {log.requestId}
                          </div>
                        )}
                        {log.userId && (
                          <div className="text-xs text-slate-500">
                            user: {log.userId}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.details && (
                          <Button
                            onClick={() => handleCopyToClipboard(log.details || '', log.id)}
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 gap-1"
                            title="Copy details to clipboard"
                          >
                            {copied === log.id ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-500" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-slate-600">
          <p>Showing {filteredLogs.length} of {logs.length} logs • Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}</p>
        </div>
      </div>
    </div>
  );
}
