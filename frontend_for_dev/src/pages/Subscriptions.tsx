import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, CreditCard, Gift, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/kit/PageHeader";
import { StatusPill } from "@/components/kit/StatusPill";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { EmptyState, ErrorNotice } from "@/components/kit/States";
import { FilterBar, RefreshButton, SearchField } from "@/components/kit/Toolbar";
import { RowActions } from "@/components/kit/RowActions";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { Field, SwitchRow } from "@/components/kit/Field";
import { Pager, usePaging } from "@/components/kit/Pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPicker } from "@/components/UserPicker";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";
import { useResource } from "@/hooks/useResource";
import { orEmpty } from "@/lib/empty";
import { formatDate, formatMoney, PLATFORM_CURRENCY, toDateInput, toRFC3339 } from "@/lib/format";
import { subStatusTone, SUBSCRIPTION_STATUSES, SUB_STATUS_LABEL_KEY } from "@/lib/status";
import { cn } from "@/lib/utils";
import {
  createSubscription, deleteSubscription, getPlatformStats, grantTrial, listPlans, listSubscriptions, updateSubscription,
  type AdminSubscription, type SubscriptionPlan,
} from "@/services/api-client";

interface Bundle {
  subs: AdminSubscription[];
  plans: SubscriptionPlan[];
  mrr: number | null;
}

const PAGE_SIZE = 25;
const FILTER_CHIPS = ["active", "trial", "pending_payment", "past_due", "expired", "cancelled"] as const;

export default function Subscriptions() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const statusLabel = (s: string) => t(SUB_STATUS_LABEL_KEY[s?.toLowerCase()] ?? s);
  // Grant trial / delete are gated server-side to the "admin" developer role.
  const isAdminDeveloper = user?.role === "admin";

  const [params, setParams] = useSearchParams();
  const statusFilter = params.get("status") ?? "all";
  const setStatusFilter = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete("status"); else next.set("status", v);
    setParams(next, { replace: true });
  };
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");

  const [dialog, setDialog] = useState<
    | { kind: "create" }
    | { kind: "edit"; sub: AdminSubscription }
    | { kind: "trial"; sub: AdminSubscription }
    | { kind: "delete"; sub: AdminSubscription }
    | null
  >(null);
  // Bumped every time a dialog opens, so form dialogs remount with fresh state.
  const [seq, setSeq] = useState(0);
  const openDialog = (d: NonNullable<typeof dialog>) => { setSeq((n) => n + 1); setDialog(d); };
  const [busy, setBusy] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const res = useResource<Bundle>(async () => {
    const [subs, plans, stats] = await Promise.allSettled([listSubscriptions(), listPlans(), getPlatformStats()]);
    if (subs.status === "rejected") throw subs.reason;
    return {
      subs: subs.value,
      plans: plans.status === "fulfilled" ? plans.value : [],
      mrr: stats.status === "fulfilled" ? stats.value.mrr : null,
    };
  }, t("failedToLoadData"));

  const subs = orEmpty(res.data?.subs);
  const plans = orEmpty(res.data?.plans);
  const planNames = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, p.name])), [plans]);

  const replaceSub = (updated: AdminSubscription) =>
    res.setData((d) => (d ? { ...d, subs: d.subs.map((s) => (s.id === updated.id ? updated : s)) } : d));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subs.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (planFilter !== "all" && s.planId !== planFilter) return false;
      if (q && !s.userEmail.toLowerCase().includes(q) && !(s.userFullName ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [subs, statusFilter, planFilter, search]);

  const paging = usePaging(filtered, PAGE_SIZE, `${statusFilter}|${planFilter}|${search}`);
  const count = (st: string) => subs.filter((s) => s.status === st).length;
  const planOptions = useMemo(() => Array.from(new Set(subs.map((s) => s.planId))), [subs]);
  const filtersActive = statusFilter !== "all" || planFilter !== "all" || search !== "";

  const run = async (fn: () => Promise<void>, failKey: string) => {
    setBusy(true);
    try {
      await fn();
      setDialog(null);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t(failKey));
    } finally {
      setBusy(false);
    }
  };

  const toggleAutoRenew = async (sub: AdminSubscription, value: boolean) => {
    setRenewingId(sub.id);
    try {
      replaceSub(await updateSubscription(sub.id, { autoRenew: value }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToUpdate"));
    } finally {
      setRenewingId(null);
    }
  };

  const columns: Column<AdminSubscription>[] = [
    {
      key: "user",
      header: t("user"),
      cell: (s) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{s.userFullName || s.userEmail}</p>
          <p className="truncate text-xs text-muted-foreground">{s.userEmail}</p>
        </div>
      ),
    },
    { key: "plan", header: t("plan"), showFrom: "sm", cell: (s) => s.planName },
    {
      key: "status",
      header: t("status"),
      cell: (s) => <StatusPill tone={subStatusTone(s.status)}>{statusLabel(s.status)}</StatusPill>,
    },
    {
      key: "price",
      header: t("price"),
      align: "right",
      showFrom: "lg",
      cell: (s) =>
        s.planPrice > 0 ? (
          <span className="tnum whitespace-nowrap">
            {formatMoney(s.planPrice, PLATFORM_CURRENCY, language)}
            <span className="text-xs text-muted-foreground"> / {s.billingPeriod}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{t("free")}</span>
        ),
    },
    { key: "start", header: t("start"), showFrom: "xl", cell: (s) => <span className="tnum text-muted-foreground">{formatDate(s.startDate, language)}</span> },
    { key: "end", header: t("end"), showFrom: "md", cell: (s) => <span className="tnum text-muted-foreground">{formatDate(s.endDate, language)}</span> },
    {
      key: "renew",
      header: t("autoRenewCol"),
      align: "center",
      showFrom: "md",
      cell: (s) => (
        <Switch
          checked={s.autoRenew}
          disabled={renewingId === s.id}
          onCheckedChange={(v) => void toggleAutoRenew(s, v)}
          aria-label={t("autoRenewCol")}
        />
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("actions")}</span>,
      align: "right",
      className: "w-12",
      cell: (s) => (
        <RowActions
          actions={[
            { label: t("edit"), icon: Pencil, onSelect: () => openDialog({ kind: "edit", sub: s }) },
            {
              label: t("grantTrial"), icon: Gift, disabled: !isAdminDeveloper,
              title: isAdminDeveloper ? undefined : t("adminRoleRequired"),
              onSelect: () => openDialog({ kind: "trial", sub: s }),
            },
            {
              label: t("delete"), icon: Trash2, destructive: true, separated: true, disabled: !isAdminDeveloper,
              title: isAdminDeveloper ? undefined : t("adminRoleRequired"),
              onSelect: () => openDialog({ kind: "delete", sub: s }),
            },
          ]}
        />
      ),
    },
  ];

  const target = dialog && "sub" in dialog ? dialog.sub : null;
  const targetName = target ? target.userFullName || target.userEmail : "";

  return (
    <DashboardLayout>
      <PageHeader
        title={t("subscriptionsTitle")}
        description={t("manageTenantSubscriptions")}
        actions={
          <>
            <RefreshButton onClick={() => void res.reload()} busy={res.fetching} />
            <Button onClick={() => openDialog({ kind: "create" })} className="gap-2">
              <Plus className="h-4 w-4" />
              {t("newSubscription")}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-[13px] transition-colors",
            statusFilter === "all" ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {t("all")} <span className="tnum opacity-70">{subs.length}</span>
        </button>
        {FILTER_CHIPS.map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(statusFilter === st ? "all" : st)}
            aria-pressed={statusFilter === st}
            className={cn(
              "rounded-full border px-3 py-1 text-[13px] transition-colors",
              statusFilter === st ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {statusLabel(st)} <span className="tnum opacity-70">{count(st)}</span>
          </button>
        ))}
        {res.data?.mrr != null && (
          <span className="ml-auto text-[13px] text-muted-foreground">
            MRR <span className="tnum font-mono font-medium text-foreground">{formatMoney(res.data.mrr, PLATFORM_CURRENCY, language)}</span>
          </span>
        )}
      </div>

      {res.error && <ErrorNotice message={res.error} onRetry={() => void res.reload()} />}

      <FilterBar>
        <SearchField value={search} onChange={setSearch} placeholder={t("searchByNameOrEmail")} />
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="sm:w-52"><SelectValue placeholder={t("allPlans")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allPlans")}</SelectItem>
            {planOptions.map((id) => <SelectItem key={id} value={id}>{planNames[id] ?? id}</SelectItem>)}
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button variant="ghost" onClick={() => { setSearch(""); setPlanFilter("all"); setStatusFilter("all"); }}>
            {t("clearFilters")}
          </Button>
        )}
      </FilterBar>

      <DataTable
        columns={columns}
        rows={paging.slice}
        rowKey={(s) => s.id}
        loading={res.loading}
        empty={<EmptyState icon={CreditCard} title={filtersActive ? t("noResultsForFilters") : t("noSubscriptionsFound")} />}
        footer={<Pager page={paging.page} pages={paging.pages} total={filtered.length} onPage={paging.setPage} />}
      />

      <SubscriptionFormDialog
        key={`form-${seq}`}
        mode={dialog?.kind === "edit" ? "edit" : "create"}
        sub={dialog?.kind === "edit" ? dialog.sub : null}
        plans={plans}
        open={dialog?.kind === "create" || dialog?.kind === "edit"}
        busy={busy}
        onClose={() => setDialog(null)}
        onSubmit={(values) =>
          run(async () => {
            if (dialog?.kind === "edit") {
              const sub = dialog.sub;
              const originalEnd = toDateInput(sub.endDate);
              const originalRenewal = toDateInput(sub.renewalDate);
              const notesCleared = (sub.notes ?? "") !== "" && values.notes.trim() === "";
              // Only send a date the developer actually changed: re-sending the
              // pre-filled values would suppress the backend's own "re-activate an
              // expired subscription → extend by one billing period" logic.
              const updated = await updateSubscription(sub.id, {
                status: values.status,
                planId: values.planId || undefined,
                endDate: values.endDate !== originalEnd ? toRFC3339(values.endDate) : undefined,
                renewalDate: values.renewalDate !== originalRenewal ? toRFC3339(values.renewalDate) : undefined,
                notes: values.notes || undefined,
                clearNotes: notesCleared,
                autoRenew: values.autoRenew,
              });
              replaceSub(updated);
              toast.success(t("subscriptionUpdated"));
            } else {
              const created = await createSubscription({
                userId: values.userId,
                planId: values.planId,
                status: values.status,
                autoRenew: values.autoRenew,
                notes: values.notes || undefined,
                startDate: toRFC3339(values.startDate),
                endDate: toRFC3339(values.endDate),
              });
              res.setData((d) => (d ? { ...d, subs: [created, ...d.subs] } : d));
              toast.success(t("subscriptionCreated"));
            }
          }, dialog?.kind === "edit" ? "failedToUpdate" : "failedToCreateSubscription")
        }
        t={t}
        statusLabel={statusLabel}
      />

      <TrialDialog
        key={`trial-${seq}`}
        open={dialog?.kind === "trial"}
        name={targetName}
        busy={busy}
        onClose={() => setDialog(null)}
        onSubmit={(days, notes) =>
          run(async () => {
            if (dialog?.kind !== "trial") return;
            await grantTrial(dialog.sub.userId, days, notes || undefined);
            await res.reload();
            toast.success(tf(t("trialGrantedForDays"), { days }));
          }, "failedToGrantTrial")
        }
        t={t}
      />

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("deleteSubscription")}
        description={tf(t("permanentlyDeleteSubscriptionFor"), { name: targetName })}
        confirmLabel={t("delete")}
        busy={busy}
        onConfirm={() =>
          run(async () => {
            if (dialog?.kind !== "delete") return;
            await deleteSubscription(dialog.sub.id);
            res.setData((d) => (d ? { ...d, subs: d.subs.filter((s) => s.id !== dialog.sub.id) } : d));
            toast.success(t("subscriptionDeleted"));
          }, "failedToDelete")
        }
      />
    </DashboardLayout>
  );
}

// ── Create / edit ──────────────────────────────────────────────────────────────

interface FormValues {
  userId: string; planId: string; status: string; autoRenew: boolean;
  notes: string; startDate: string; endDate: string; renewalDate: string;
}

function SubscriptionFormDialog({
  mode, sub, plans, open, busy, onClose, onSubmit, t, statusLabel,
}: {
  mode: "create" | "edit";
  sub: AdminSubscription | null;
  plans: SubscriptionPlan[];
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (v: FormValues) => void;
  t: (k: string) => string;
  statusLabel: (s: string) => string;
}) {
  const [v, setV] = useState<FormValues>(() => ({
    userId: "",
    planId: sub?.planId ?? "",
    status: sub?.status ?? "active",
    autoRenew: sub?.autoRenew ?? true,
    notes: sub?.notes ?? "",
    startDate: "",
    endDate: toDateInput(sub?.endDate),
    renewalDate: toDateInput(sub?.renewalDate),
  }));
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const submit = () => {
    if (mode === "create") {
      if (!v.userId || !v.planId) { toast.error(t("userIdPlanRequired")); return; }
      if (v.startDate && v.endDate && v.endDate <= v.startDate) { toast.error(t("endDateMustBeAfterStart")); return; }
    }
    onSubmit(v);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{mode === "create" ? t("newSubscription") : t("editSubscription")}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? t("createSubscriptionFor")
              : tf(t("updateSubscriptionFor"), { name: sub?.userFullName || sub?.userEmail || "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          {mode === "create" && (
            <Field label={t("userId")}>
              <UserPicker value={v.userId} onChange={(id) => set("userId", id)} />
            </Field>
          )}
          <Field label={t("plan")}>
            <Select value={v.planId} onValueChange={(x) => set("planId", x)}>
              <SelectTrigger><SelectValue placeholder={mode === "edit" ? t("keepCurrentPlan") : t("selectPlan")} /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {formatMoney(p.price, PLATFORM_CURRENCY)} / {p.billingPeriod}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("status")}>
            <Select value={v.status} onValueChange={(x) => set("status", x)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUBSCRIPTION_STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {mode === "create" ? (
              <>
                <Field label={t("startDate")} hint={t("startDateAutoHint")}>
                  <Input type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} />
                </Field>
                <Field label={t("endDate")} hint={t("endDateAutoHint")}>
                  <Input type="date" value={v.endDate} onChange={(e) => set("endDate", e.target.value)} />
                </Field>
              </>
            ) : (
              <>
                <Field label={t("endDate")}>
                  <Input type="date" value={v.endDate} onChange={(e) => set("endDate", e.target.value)} />
                </Field>
                <Field label={t("renewalDate")}>
                  <Input type="date" value={v.renewalDate} onChange={(e) => set("renewalDate", e.target.value)} />
                </Field>
              </>
            )}
          </div>
          <Field label={t("notes")}>
            <Input value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("optionalNotes")} />
          </Field>
          <SwitchRow label={t("autoRenewLabel")} description={mode === "create" ? t("autoRenewDesc") : undefined}>
            <Switch checked={v.autoRenew} onCheckedChange={(x) => set("autoRenew", x)} />
          </SwitchRow>
        </div>

        <DialogFooter className="border-t p-6 pt-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? t("create") : t("saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Grant trial ────────────────────────────────────────────────────────────────

function TrialDialog({
  open, name, busy, onClose, onSubmit, t,
}: {
  open: boolean; name: string; busy: boolean; onClose: () => void;
  onSubmit: (days: number, notes: string) => void; t: (k: string) => string;
}) {
  const [days, setDays] = useState("14");
  const [notes, setNotes] = useState("");
  const n = Number(days);
  const valid = Number.isInteger(n) && n >= 1 && n <= 365;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("grantTrial")}</DialogTitle>
          <DialogDescription>{tf(t("grantTrialFor"), { name })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t("trialDays")} hint={!valid ? "1 – 365" : undefined}>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} className="w-24 font-mono" />
              <span className="text-sm text-muted-foreground">{t("days")}</span>
            </div>
          </Field>
          <Field label={`${t("notes")} (${t("optional")})`}>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("reasonForTrial")} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("cancel")}</Button>
          <Button onClick={() => onSubmit(n, notes)} disabled={busy || !valid} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {t("grantTrial")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
