import { useMemo, useState } from "react";
import { Building2, Loader2, MapPin, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/kit/PageHeader";
import { Stat } from "@/components/kit/Stat";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { EmptyState, ErrorNotice } from "@/components/kit/States";
import { FilterBar, RefreshButton, SearchField } from "@/components/kit/Toolbar";
import { RowActions } from "@/components/kit/RowActions";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { Field } from "@/components/kit/Field";
import { Pager, usePaging } from "@/components/kit/Pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPicker } from "@/components/UserPicker";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";
import { useResource } from "@/hooks/useResource";
import { orEmpty } from "@/lib/empty";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { createBranch, deleteBranch, listBranches, listUsers, updateBranch, type CRMBranch, type CRMUser } from "@/services/api-client";

interface Bundle { branches: CRMBranch[]; users: CRMUser[] }

const PAGE_SIZE = 25;

export default function Branches() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const res = useResource<Bundle>(async () => {
    const [branches, users] = await Promise.allSettled([listBranches(), listUsers()]);
    if (branches.status === "rejected") throw branches.reason;
    // Users only resolve admin names; the table still works without them.
    return { branches: branches.value, users: users.status === "fulfilled" ? users.value : [] };
  }, t("failedToLoadBranches"));

  const branches = orEmpty(res.data?.branches);
  const usersById = useMemo(() => new Map((res.data?.users ?? []).map((u) => [u.id, u])), [res.data?.users]);

  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ kind: "form"; branch: CRMBranch | null } | { kind: "delete"; branch: CRMBranch } | null>(null);
  const [seq, setSeq] = useState(0);
  const open = (d: NonNullable<typeof dialog>) => { setSeq((n) => n + 1); setDialog(d); };
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => b.name.toLowerCase().includes(q) || (b.address ?? "").toLowerCase().includes(q));
  }, [branches, search]);
  const paging = usePaging(filtered, PAGE_SIZE, search);

  // Branches may in principle carry different currencies; never add UZS to USD.
  const totals = useMemo(() => {
    const byCurrency = new Map<string, number>();
    for (const b of branches) byCurrency.set(b.currency || "UZS", (byCurrency.get(b.currency || "UZS") ?? 0) + (b.monthlyPayment || 0));
    return Array.from(byCurrency.entries());
  }, [branches]);

  const upsert = (b: CRMBranch) =>
    res.setData((d) => {
      if (!d) return d;
      const exists = d.branches.some((x) => x.id === b.id);
      return { ...d, branches: exists ? d.branches.map((x) => (x.id === b.id ? { ...x, ...b } : x)) : [...d.branches, b] };
    });

  const columns: Column<CRMBranch>[] = [
    {
      key: "name",
      header: t("name"),
      cell: (b) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{b.name}</p>
            {b.address && (
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{b.address}</span>
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: t("phone"),
      showFrom: "md",
      cell: (b) =>
        b.phone ? (
          <span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" />{b.phone}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "payment",
      header: t("monthlyPayment"),
      align: "right",
      cell: (b) => <span className="tnum whitespace-nowrap font-medium">{formatMoney(b.monthlyPayment, b.currency || "UZS", language)}</span>,
    },
    {
      key: "admin",
      header: t("adminLabel"),
      showFrom: "lg",
      cell: (b) => {
        if (!b.adminId) return <span className="text-muted-foreground">{t("noAdmin")}</span>;
        const u = usersById.get(b.adminId);
        return u ? (
          <div className="min-w-0">
            <p className="truncate text-foreground">{u.fullName || u.email}</p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
        ) : (
          <span className="font-mono text-xs text-muted-foreground" title={b.adminId}>{t("unknownUser")}</span>
        );
      },
    },
    { key: "created", header: t("created"), showFrom: "xl", cell: (b) => <span className="tnum text-muted-foreground">{formatDate(b.createdAt, language)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">{t("actions")}</span>,
      align: "right",
      className: "w-12",
      cell: (b) => (
        <RowActions
          actions={[
            { label: t("editBranch"), icon: Pencil, onSelect: () => open({ kind: "form", branch: b }) },
            { label: t("deleteBranch"), icon: Trash2, destructive: true, separated: true, onSelect: () => open({ kind: "delete", branch: b }) },
          ]}
        />
      ),
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title={t("branchesTitle")}
        description={t("manageSchoolBranches")}
        actions={
          <>
            <RefreshButton onClick={() => void res.reload()} busy={res.fetching} />
            <Button className="gap-2" onClick={() => open({ kind: "form", branch: null })}>
              <Plus className="h-4 w-4" />
              {t("addBranch")}
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label={t("totalBranches")} value={formatNumber(branches.length, language)} icon={Building2} loading={res.loading} />
        {(totals.length ? totals : [["UZS", 0] as [string, number]]).map(([cur, sum]) => (
          <Stat key={cur} label={t("monthlyRevenue")} value={formatMoney(sum, cur, language)} loading={res.loading} />
        ))}
      </div>

      {res.error && <ErrorNotice message={res.error} onRetry={() => void res.reload()} />}

      <FilterBar>
        <SearchField value={search} onChange={setSearch} placeholder={t("searchBranchesPlaceholder")} className="max-w-md" />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={paging.slice}
        rowKey={(b) => b.id}
        loading={res.loading}
        empty={
          <EmptyState
            icon={Building2}
            title={search ? t("noBranchesMatchSearch") : t("noBranchesYet")}
            action={!search && <Button onClick={() => open({ kind: "form", branch: null })}><Plus className="h-4 w-4" />{t("addBranch")}</Button>}
          />
        }
        footer={<Pager page={paging.page} pages={paging.pages} total={filtered.length} onPage={paging.setPage} />}
      />

      <BranchFormDialog
        key={`branch-${seq}`}
        open={dialog?.kind === "form"}
        branch={dialog?.kind === "form" ? dialog.branch : null}
        busy={busy}
        t={t}
        onClose={() => setDialog(null)}
        onSubmit={async (v) => {
          const editing = dialog?.kind === "form" ? dialog.branch : null;
          setBusy(true);
          try {
            if (editing) {
              upsert(await updateBranch(editing.id, {
                name: v.name, address: v.address, phone: v.phone, monthlyPayment: v.monthlyPayment,
                ...(v.adminId && v.adminId !== editing.adminId ? { adminId: v.adminId } : {}),
              }));
              toast.success(t("branchUpdated"));
            } else {
              upsert(await createBranch({
                name: v.name, address: v.address, phone: v.phone, monthlyPayment: v.monthlyPayment, adminId: v.adminId || undefined,
              }));
              toast.success(t("branchCreated"));
            }
            setDialog(null);
          } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : t(editing ? "failedToUpdateBranch" : "failedToCreateBranch"));
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("deleteBranch")}
        description={tf(t("deleteBranchConfirm"), { name: dialog?.kind === "delete" ? dialog.branch.name : "" })}
        confirmLabel={t("deleteBranch")}
        busy={busy}
        onConfirm={async () => {
          if (dialog?.kind !== "delete") return;
          setBusy(true);
          try {
            await deleteBranch(dialog.branch.id);
            res.setData((d) => (d ? { ...d, branches: d.branches.filter((x) => x.id !== dialog.branch.id) } : d));
            toast.success(t("branchDeleted"));
            setDialog(null);
          } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : t("failedToDeleteBranch"));
          } finally {
            setBusy(false);
          }
        }}
      />
    </DashboardLayout>
  );
}

interface BranchValues { name: string; address: string; phone: string; monthlyPayment: number; adminId: string }

function BranchFormDialog({
  open, branch, busy, t, onClose, onSubmit,
}: {
  open: boolean; branch: CRMBranch | null; busy: boolean; t: (k: string) => string;
  onClose: () => void; onSubmit: (v: BranchValues) => void;
}) {
  const [v, setV] = useState({
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    phone: branch?.phone ?? "",
    monthlyPayment: branch?.monthlyPayment ? String(branch.monthlyPayment) : "",
    adminId: branch?.adminId ?? "",
  });

  const submit = () => {
    const payment = Number(v.monthlyPayment);
    // Mirrors the backend binding (name/address/phone required, payment > 0).
    if (!v.name.trim()) return void toast.error(t("branchNameRequired"));
    if (!v.address.trim()) return void toast.error(t("addressRequired"));
    if (!v.phone.trim()) return void toast.error(t("phoneRequired"));
    if (!Number.isFinite(payment) || payment <= 0) return void toast.error(t("monthlyPaymentMustBePositive"));
    onSubmit({ name: v.name.trim(), address: v.address.trim(), phone: v.phone.trim(), monthlyPayment: payment, adminId: v.adminId });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{branch ? t("editBranch") : t("addNewBranch")}</DialogTitle>
          <DialogDescription>{branch ? t("updateBranchInfo") : t("createNewSchoolBranch")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("branchNameLabel")}>
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus />
          </Field>
          <Field label={`${t("address")} *`}>
            <Input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
          </Field>
          <Field label={`${t("phone")} *`}>
            <Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="+998 90 000 00 00" inputMode="tel" />
          </Field>
          <Field label={t("monthlyPaymentUsdLabel")}>
            <Input
              type="number"
              min={0}
              step="1000"
              value={v.monthlyPayment}
              onChange={(e) => setV({ ...v, monthlyPayment: e.target.value })}
              className="font-mono"
              placeholder="0"
            />
          </Field>
          <Field label={t("adminUserId")}>
            <UserPicker value={v.adminId} onChange={(adminId) => setV({ ...v, adminId })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {branch ? t("saveChanges") : t("createBranch")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
