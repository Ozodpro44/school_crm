import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Trash2, Search, RotateCcw, Loader2, AlertCircle, RefreshCw,
  Building2, User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getTrash, restoreUser, restoreBranch,
  type TrashedCRMUser, type TrashedCRMBranch,
} from "@/services/api-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@/lib/i18n";

// Restore window is platform-wide 30 days here — this whole app is
// developer-only, so there's no shorter 7-day/own-branch variant like the
// main CRM app has on its own Trash page.
const WINDOW_DAYS = 30;

type Row =
  | { resource: "users"; item: TrashedCRMUser }
  | { resource: "branches"; item: TrashedCRMBranch };

function daysLeft(deletedAt: string) {
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86400000;
  return Math.max(0, Math.ceil(WINDOW_DAYS - elapsed));
}

function nameOf(row: Row) {
  return row.resource === "users" ? row.item.fullName : row.item.name;
}

export default function Trash() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [resource, setResource] = useState<"all" | "users" | "branches">("all");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrash();
      const merged: Row[] = [
        ...data.users.map((item): Row => ({ resource: "users", item })),
        ...data.branches.map((item): Row => ({ resource: "branches", item })),
      ].sort((a, b) => new Date(b.item.deletedAt).getTime() - new Date(a.item.deletedAt).getTime());
      setRows(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let out = rows;
    if (resource !== "all") out = out.filter((r) => r.resource === resource);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) => nameOf(r).toLowerCase().includes(q));
    }
    return out;
  }, [rows, resource, search]);

  const handleRestore = async (row: Row) => {
    setRestoringId(row.item.id);
    try {
      if (row.resource === "users") await restoreUser(row.item.id);
      else await restoreBranch(row.item.id);
      setRows((prev) => prev.filter((r) => !(r.resource === row.resource && r.item.id === row.item.id)));
      toast.success(t("restored"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToRestore"));
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("trashTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("manageTrash")}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {t("refresh")}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-4 rounded-lg border border-status-critical/30 bg-status-critical/10 text-status-critical text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <Button variant="ghost" size="sm" onClick={load} className="ml-auto">
            {t("retry")}
          </Button>
        </div>
      )}

      <div className="glass-card rounded-lg p-3 mb-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder={t("searchTrashPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 bg-background text-sm"
          />
        </div>
        <Select value={resource} onValueChange={(v) => setResource(v as "all" | "users" | "branches")}>
          <SelectTrigger className="h-8 w-full sm:w-44 text-sm bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allTypes") || "All types"}</SelectItem>
            <SelectItem value="users">{t("trashResUser")}</SelectItem>
            <SelectItem value="branches">{t("trashResBranch")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-lg p-14 flex flex-col items-center gap-3 text-muted-foreground">
          <Trash2 className="w-9 h-9 opacity-30" />
          <p className="text-sm">{search || resource !== "all" ? t("noTrashMatchSearch") : t("noTrashYet")}</p>
        </div>
      ) : (
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-3 font-medium">{t("trashResourceType") || "Type"}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("name")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("deletedAt")}</th>
                  <th className="text-left px-4 py-3 font-medium">{t("daysLeft")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("actions") || "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((row) => {
                  const left = daysLeft(row.item.deletedAt);
                  const isRestoring = restoringId === row.item.id;
                  return (
                    <tr key={`${row.resource}-${row.item.id}`} className="hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-accent/40 text-foreground">
                          {row.resource === "branches" ? <Building2 className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                          {row.resource === "branches" ? t("trashResBranch") : t("trashResUser")}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{nameOf(row)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(row.item.deletedAt).toLocaleString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={left <= 3 ? "text-status-critical font-semibold" : "text-muted-foreground"}>
                          {left} {t("daysLeft")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={isRestoring}
                          onClick={() => handleRestore(row)}
                        >
                          {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          {t("restore")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
