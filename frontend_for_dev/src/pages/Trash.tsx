import { useMemo, useState } from "react";
import { Building2, Loader2, RotateCcw, Trash2, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/kit/PageHeader";
import { StatusPill } from "@/components/kit/StatusPill";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { EmptyState, ErrorNotice } from "@/components/kit/States";
import { FilterBar, RefreshButton, SearchField } from "@/components/kit/Toolbar";
import { Pager, usePaging } from "@/components/kit/Pager";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@/lib/i18n";
import { useResource } from "@/hooks/useResource";
import { orEmpty } from "@/lib/empty";
import { formatDateTime } from "@/lib/format";
import { getTrash, restoreBranch, restoreUser, type TrashedCRMBranch, type TrashedCRMUser } from "@/services/api-client";

// Platform-wide restore window: this whole app is developer-only, so there is
// no shorter 7-day / own-branch variant like the main CRM's Trash page.
const WINDOW_DAYS = 30;
const PAGE_SIZE = 20;

type Row =
  | { resource: "users"; item: TrashedCRMUser }
  | { resource: "branches"; item: TrashedCRMBranch };

const rowKey = (r: Row) => `${r.resource}-${r.item.id}`;
const nameOf = (r: Row) => (r.resource === "users" ? r.item.fullName || r.item.email : r.item.name);

function daysLeft(deletedAt: string) {
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(WINDOW_DAYS - elapsed));
}

export default function Trash() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const res = useResource<Row[]>(async () => {
    const data = await getTrash();
    return [
      ...data.users.map((item): Row => ({ resource: "users", item })),
      ...data.branches.map((item): Row => ({ resource: "branches", item })),
    ].sort((a, b) => new Date(b.item.deletedAt).getTime() - new Date(a.item.deletedAt).getTime());
  }, t("failedToLoadData"));
  const rows = orEmpty(res.data);

  const [search, setSearch] = useState("");
  const [resource, setResource] = useState<"all" | "users" | "branches">("all");
  const [restoringKey, setRestoringKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (resource === "all" || r.resource === resource) && (!q || nameOf(r).toLowerCase().includes(q)));
  }, [rows, resource, search]);
  const paging = usePaging(filtered, PAGE_SIZE, `${resource}|${search}`);

  const restore = async (row: Row) => {
    const key = rowKey(row);
    setRestoringKey(key);
    try {
      if (row.resource === "users") await restoreUser(row.item.id);
      else await restoreBranch(row.item.id);
      res.setData((d) => (d ?? []).filter((r) => rowKey(r) !== key));
      toast.success(t("restored"));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t("failedToRestore"));
    } finally {
      setRestoringKey(null);
    }
  };

  const columns: Column<Row>[] = [
    {
      key: "type",
      header: t("trashResourceType"),
      cell: (r) => (
        <StatusPill tone="neutral" dot={false}>
          {r.resource === "branches" ? <Building2 className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
          {r.resource === "branches" ? t("trashResBranch") : t("trashResUser")}
        </StatusPill>
      ),
    },
    {
      key: "name",
      header: t("name"),
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{nameOf(r)}</p>
          {r.resource === "users" && <p className="truncate text-xs text-muted-foreground">{r.item.email}</p>}
        </div>
      ),
    },
    { key: "deleted", header: t("deletedAt"), showFrom: "sm", cell: (r) => <span className="tnum text-muted-foreground">{formatDateTime(r.item.deletedAt, language)}</span> },
    {
      key: "left",
      header: t("daysLeft"),
      cell: (r) => {
        const left = daysLeft(r.item.deletedAt);
        return (
          <span className={left <= 3 ? "tnum font-medium text-status-critical" : "tnum text-muted-foreground"}>
            {left} {t("daysLeft")}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("actions")}</span>,
      align: "right",
      cell: (r) => {
        const busy = restoringKey === rowKey(r);
        return (
          <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => void restore(r)}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            {t("restore")}
          </Button>
        );
      },
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title={t("trashTitle")}
        description={t("manageTrash")}
        actions={<RefreshButton onClick={() => void res.reload()} busy={res.fetching} />}
      />

      {res.error && <ErrorNotice message={res.error} onRetry={() => void res.reload()} />}

      <FilterBar>
        <SearchField value={search} onChange={setSearch} placeholder={t("searchTrashPlaceholder")} className="max-w-md" />
        <Select value={resource} onValueChange={(v) => setResource(v as typeof resource)}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allTypes")}</SelectItem>
            <SelectItem value="users">{t("trashResUser")}</SelectItem>
            <SelectItem value="branches">{t("trashResBranch")}</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={paging.slice}
        rowKey={rowKey}
        loading={res.loading}
        empty={<EmptyState icon={Trash2} title={search || resource !== "all" ? t("noTrashMatchSearch") : t("noTrashYet")} />}
        footer={<Pager page={paging.page} pages={paging.pages} total={filtered.length} onPage={paging.setPage} />}
      />
    </DashboardLayout>
  );
}
