import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getTrash,
  restoreTrashedItem,
  type TrashResourceKey,
  type TrashResponse,
} from "@/lib/api";
import { useNotify } from "@/hooks/use-notify";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";
import { DataTable, Column } from "@/components/DataTable";
import { FilterBar, FilterSearch, FilterReset, filterSelectClass } from "@/components/FilterBar";

// Longer of the two restore windows in days (regular caller: 7, developer/
// super_admin: 30) — used only to compute "days left" for display; the
// actual cutoff is enforced server-side per caller role.
const RESOURCE_LABEL_KEY: Record<TrashResourceKey, string> = {
  branches: "trashResBranch",
  users: "trashResUser",
  students: "trashResStudent",
  classes: "trashResClass",
  assignments: "trashResAssignment",
  teachers: "trashResTeacher",
  salaries: "trashResSalary",
  payments: "trashResPayment",
  expenses: "trashResExpense",
};

const RESOURCE_COLORS: Record<TrashResourceKey, string> = {
  branches: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  users: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  students: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400",
  classes: "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400",
  assignments: "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400",
  teachers: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
  salaries: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
  payments: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  expenses: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
};

interface TrashRow {
  resource: TrashResourceKey;
  id: string;
  name: string;
  deletedAt: string;
  deletedBy?: string;
}

function nameFor(resource: TrashResourceKey, item: any): string {
  switch (resource) {
    case "branches":
    case "classes":
      return item.name;
    case "users":
    case "students":
    case "teachers":
      return item.fullName;
    case "assignments":
      return item.title;
    case "salaries":
      return item.teacherName || item.teacherId;
    case "payments":
      return item.invoiceNumber || item.id;
    case "expenses":
      return item.title;
    default:
      return item.id;
  }
}

function flatten(data: TrashResponse): TrashRow[] {
  const rows: TrashRow[] = [];
  (Object.keys(RESOURCE_LABEL_KEY) as TrashResourceKey[]).forEach((resource) => {
    const bucket = data[resource];
    if (!bucket?.items) return;
    for (const item of bucket.items) {
      rows.push({
        resource,
        id: item.id,
        name: nameFor(resource, item),
        deletedAt: item.deletedAt,
        deletedBy: (item as any).deletedBy,
      });
    }
  });
  return rows.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
}

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

export default function TrashPage() {
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const notify = useNotify();
  // This app's UserRole never includes developer/super_admin — those are
  // Developer Portal-only roles (frontend_for_dev has its own, 30-day,
  // platform-wide Trash page). Every caller here is branch-scoped, 7 days.
  const windowDays = 7;

  const [rows, setRows] = useState<TrashRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [resource, setResource] = useState<"all" | TrashResourceKey>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTrash();
      setRows(flatten(data));
    } catch {
      notify.error(t("error"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [notify, t]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let out = rows;
    if (resource !== "all") out = out.filter((r) => r.resource === resource);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => r.name?.toLowerCase().includes(q));
    }
    return out;
  }, [rows, resource, search]);

  const handleRestore = async (row: TrashRow) => {
    setRestoringId(row.id);
    try {
      await restoreTrashedItem(row.resource, row.id);
      notify.success(t("restored"));
      setRows((prev) => prev.filter((r) => !(r.resource === row.resource && r.id === row.id)));
    } catch (e) {
      notify.error(t("failedToRestore"), e instanceof Error ? e.message : undefined);
    } finally {
      setRestoringId(null);
    }
  };

  const daysLeft = (deletedAt: string) => {
    const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86400000;
    return Math.max(0, Math.ceil(windowDays - elapsed));
  };

  const columns: Column<TrashRow>[] = [
    {
      key: "resource",
      header: t("trashResourceType"),
      cellClassName: "w-32",
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RESOURCE_COLORS[row.resource]}`}>
          {t(RESOURCE_LABEL_KEY[row.resource])}
        </span>
      ),
    },
    {
      key: "name",
      header: t("name"),
      render: (row) => (
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{row.name}</span>
      ),
    },
    {
      key: "deletedAt",
      header: t("deletedAt"),
      cellClassName: "text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap w-40",
      hideOnMobile: true,
      render: (row) => formatTime(row.deletedAt),
    },
    {
      key: "daysLeft",
      header: t("daysLeft"),
      cellClassName: "w-28",
      render: (row) => {
        const left = daysLeft(row.deletedAt);
        return (
          <span className={left <= 2 ? "text-red-500 font-semibold text-sm" : "text-sm text-slate-500 dark:text-slate-400"}>
            {left} {t("daysLeft")}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: t("actions"),
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          disabled={restoringId === row.id}
          onClick={() => {
            if (confirm(t("restoreConfirm"))) handleRestore(row);
          }}
        >
          {restoringId === row.id ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          )}
          {t("restore")}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-brand-gradient flex items-center gap-3">
          <Trash2 className="w-8 h-8 text-indigo-600" />
          {t("trash")}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          {t("trashDesc")} — {windowDays} {t("daysLeft")}
        </p>
      </div>

      <FilterBar>
        <FilterSearch value={search} onChange={setSearch} placeholder={t("search")} />
        <Select value={resource} onValueChange={(v) => setResource(v as "all" | TrashResourceKey)}>
          <SelectTrigger className={filterSelectClass("w-48")}>
            <SelectValue placeholder={t("trashResourceType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allTypes")}</SelectItem>
            {(Object.keys(RESOURCE_LABEL_KEY) as TrashResourceKey[]).map((r) => (
              <SelectItem key={r} value={r}>
                {t(RESOURCE_LABEL_KEY[r])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FilterReset onClick={() => { setResource("all"); setSearch(""); }} show={resource !== "all" || !!search} label={t("reset")} />
      </FilterBar>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            {loading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <span>{filtered.length.toLocaleString()}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            loading={loading}
            skeletonRows={8}
            emptyIcon={Trash2}
            emptyTitle={t("trashEmpty")}
            emptyDescription={t("trashEmptyDesc")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
