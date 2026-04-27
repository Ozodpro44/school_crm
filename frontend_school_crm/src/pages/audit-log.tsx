import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuditLogs, type AuditLogEntry } from "@/lib/api";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { Shield, Search, Filter, RotateCcw } from "lucide-react";
import { DataTable, Column } from "@/components/DataTable";

const RESOURCES = [
  "payment",
  "student",
  "teacher",
  "salary",
  "expense",
  "class",
  "branch",
  "user",
];

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const RESOURCE_COLORS: Record<string, string> = {
  payment:  "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  student:  "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400",
  teacher:  "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  salary:   "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  expense:  "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  class:    "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400",
  branch:   "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  user:     "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AuditLogPage() {
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [resource, setResource] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs({
        resource: resource !== "all" ? resource : undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: LIMIT,
      });
      setEntries(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [resource, from, to, page]);

  useEffect(() => { load(); }, [load]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [resource, from, to]);

  const filtered = search.trim()
    ? entries.filter((e) =>
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        e.userName.toLowerCase().includes(search.toLowerCase()) ||
        e.resource.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  const handleReset = () => {
    setResource("all");
    setFrom("");
    setTo("");
    setSearch("");
    setPage(1);
  };

  const actionLabel = (a: string) => t(a as any) || a.charAt(0).toUpperCase() + a.slice(1);
  const resourceLabel = (r: string) => t(r as any) || r.charAt(0).toUpperCase() + r.slice(1);

  const columns: Column<AuditLogEntry>[] = [
    {
      key: "createdAt",
      header: t("auditTime") || "Time",
      cellClassName: "text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap w-40",
      render: (entry) => formatTime(entry.createdAt),
    },
    {
      key: "userName",
      header: t("auditUser") || "User",
      render: (entry) => (
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {entry.userName || <span className="text-slate-400 italic">{t("unknown") || "Unknown"}</span>}
        </span>
      ),
    },
    {
      key: "action",
      header: t("action") || "Action",
      cellClassName: "w-24",
      render: (entry) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[entry.action] ?? ""}`}>
          {actionLabel(entry.action)}
        </span>
      ),
    },
    {
      key: "resource",
      header: t("resource") || "Resource",
      cellClassName: "w-28",
      render: (entry) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RESOURCE_COLORS[entry.resource] ?? "bg-slate-100 text-slate-600"}`}>
          {resourceLabel(entry.resource)}
        </span>
      ),
    },
    {
      key: "description",
      header: t("description") || "Description",
      cellClassName: "text-sm text-slate-700 dark:text-slate-300 max-w-xs truncate",
      render: (entry) => entry.description,
    },
    {
      key: "resourceId",
      header: t("resourceId") || "Resource ID",
      cellClassName: "w-40",
      hideOnMobile: true,
      render: (entry) =>
        entry.resourceId ? (
          <code className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono">
            {entry.resourceId.slice(0, 8)}…
          </code>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-display text-brand-gradient flex items-center gap-3">
          <Shield className="w-8 h-8 text-indigo-600" />
          {t("auditLog") || "Audit Log"}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          {t("auditLogDesc") || "Track who did what and when across your branch"}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t("search") || "Search…"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>

            {/* Resource filter */}
            <Select value={resource} onValueChange={setResource}>
              <SelectTrigger className="h-9 w-40">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                <SelectValue placeholder={t("resource") || "Resource"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allResources") || "All resources"}</SelectItem>
                {RESOURCES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {resourceLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date from */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{t("from") || "From"}</span>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 w-36 text-sm"
              />
            </div>

            {/* Date to */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{t("to") || "To"}</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 w-36 text-sm"
              />
            </div>

            {/* Reset */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-9 gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t("reset") || "Reset"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>
              {loading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <span>
                  {total.toLocaleString()} {total === 1 ? (t("entry") || "entry") : (t("entries") || "entries")}
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable<AuditLogEntry>
            columns={columns}
            data={filtered}
            loading={loading}
            skeletonRows={8}
            emptyIcon={Shield}
            emptyTitle={t("noAuditEntries") || "No audit entries found"}
            pagination={{ page, limit: LIMIT, total }}
            onPageChange={setPage}
            renderCard={(entry) => (
              <div className="p-4 space-y-1.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[entry.action] ?? ""}`}>
                    {actionLabel(entry.action)}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {formatTime(entry.createdAt)}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {entry.description}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RESOURCE_COLORS[entry.resource] ?? ""}`}>
                    {resourceLabel(entry.resource)}
                  </span>
                  {entry.userName && (
                    <span className="text-xs text-slate-500">{entry.userName}</span>
                  )}
                  {entry.resourceId && (
                    <code className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                      {entry.resourceId.slice(0, 8)}…
                    </code>
                  )}
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
