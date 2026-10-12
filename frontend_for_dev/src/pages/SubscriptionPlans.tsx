import { useState } from "react";
import { BookOpen, Building2, GraduationCap, Layers, Loader2, Pencil, Plus, Power, Star, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/kit/PageHeader";
import { StatusPill } from "@/components/kit/StatusPill";
import { EmptyState, ErrorNotice } from "@/components/kit/States";
import { RefreshButton } from "@/components/kit/Toolbar";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { Field, SwitchRow } from "@/components/kit/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";
import { useResource } from "@/hooks/useResource";
import { formatNumber, PLATFORM_CURRENCY } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createPlan, deletePlan, listPlans, updatePlan, type SubscriptionPlan } from "@/services/api-client";

// ── Helpers ────────────────────────────────────────────────────────────────────

type FeatureRow = { key: string; enabled: boolean };

// Capabilities a school-CRM plan actually varies by — one-click toggles instead
// of asking for a raw camelCase key. Anything else goes in "custom features".
const PRESET_FEATURES: { key: string; labelKey: string }[] = [
  { key: "smsNotifications", labelKey: "featureSmsNotifications" },
  { key: "telegramBot", labelKey: "featureTelegramBot" },
  { key: "prioritySupport", labelKey: "featurePrioritySupport" },
  { key: "apiAccess", labelKey: "featureApiAccess" },
  { key: "customBranding", labelKey: "featureCustomBranding" },
  { key: "advancedReports", labelKey: "featureAdvancedReports" },
];
const isPreset = (key: string) => PRESET_FEATURES.some((p) => p.key === key);

const featuresToRows = (f?: Record<string, unknown>): FeatureRow[] =>
  Object.entries(f ?? {}).map(([key, val]) => ({ key, enabled: Boolean(val) }));

const rowsToFeatures = (rows: FeatureRow[]): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  for (const r of rows) {
    const key = r.key.trim();
    if (key) out[key] = r.enabled;
  }
  return out;
};

const isActive = (p: SubscriptionPlan) => p.status === "active" || (p.status == null && p.isActive !== false);

interface PlanForm {
  name: string; description: string; price: string; billingPeriod: "monthly" | "yearly";
  maxBranches: string; maxStudents: string; maxClasses: string; maxTeachers: string;
  status: "active" | "inactive"; isFeatured: boolean; sortOrder: string;
}

const emptyForm: PlanForm = {
  name: "", description: "", price: "0", billingPeriod: "monthly",
  maxBranches: "1", maxStudents: "100", maxClasses: "10", maxTeachers: "20",
  status: "active", isFeatured: false, sortOrder: "0",
};

const toForm = (p: SubscriptionPlan): PlanForm => ({
  name: p.name,
  description: p.description ?? "",
  price: String(p.price ?? 0),
  billingPeriod: (p.billingPeriod as "monthly" | "yearly") || "monthly",
  maxBranches: String(p.maxBranches ?? 1),
  maxStudents: String(p.maxStudents ?? 100),
  maxClasses: String(p.maxClasses ?? 10),
  maxTeachers: String(p.maxTeachers ?? 20),
  status: p.status === "inactive" || p.isActive === false ? "inactive" : "active",
  isFeatured: p.isFeatured ?? false,
  sortOrder: String(p.sortOrder ?? 0),
});

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SubscriptionPlans() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const res = useResource(listPlans, t("failedToLoadPlans"));
  const plans = res.data ?? [];

  const [dialog, setDialog] = useState<{ kind: "form"; plan: SubscriptionPlan | null } | { kind: "delete"; plan: SubscriptionPlan } | null>(null);
  const [seq, setSeq] = useState(0);
  const open = (d: NonNullable<typeof dialog>) => { setSeq((n) => n + 1); setDialog(d); };
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const upsert = (plan: SubscriptionPlan) =>
    res.setData((d) => {
      const list = d ?? [];
      return list.some((p) => p.id === plan.id) ? list.map((p) => (p.id === plan.id ? plan : p)) : [...list, plan];
    });

  const toggle = async (plan: SubscriptionPlan) => {
    setTogglingId(plan.id);
    try {
      const status = isActive(plan) ? "inactive" : "active";
      upsert(await updatePlan(plan.id, { status }));
      toast.success(tf(t("planStatusChanged"), { status: t(status) }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToUpdatePlan"));
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = plans.filter(isActive).length;

  return (
    <DashboardLayout>
      <PageHeader
        title={t("subscriptionPlansTitle")}
        description={
          res.data
            ? tf(t("planCountSummary"), { count: plans.length, plural: plans.length !== 1 ? "s" : "", activeCount })
            : undefined
        }
        actions={
          <>
            <RefreshButton onClick={() => void res.reload()} busy={res.fetching} />
            <Button className="gap-2" onClick={() => open({ kind: "form", plan: null })}>
              <Plus className="h-4 w-4" />
              {t("newPlan")}
            </Button>
          </>
        }
      />

      {res.error && <ErrorNotice message={res.error} onRetry={() => void res.reload()} />}

      {res.loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : plans.length === 0 && !res.error ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Layers}
            title={t("noPlansYet")}
            action={<Button onClick={() => open({ kind: "form", plan: null })}><Plus className="h-4 w-4" />{t("createPlan")}</Button>}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const active = isActive(plan);
            const featureCount = Object.values(plan.features ?? {}).filter(Boolean).length;
            const limits = [
              { icon: Building2, label: t("branches"), value: plan.maxBranches },
              { icon: Users, label: t("students"), value: plan.maxStudents },
              { icon: BookOpen, label: t("classes"), value: plan.maxClasses },
              { icon: GraduationCap, label: t("statTeachers"), value: plan.maxTeachers },
            ];
            return (
              <article key={plan.id} className={cn("flex flex-col rounded-xl border bg-card p-5", !active && "opacity-70")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-foreground">{plan.name}</h3>
                    {plan.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{plan.description}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusPill tone={active ? "healthy" : "neutral"}>{active ? t("active") : t("inactive")}</StatusPill>
                    {plan.isFeatured && (
                      <StatusPill tone="accent" dot={false}>
                        <Star className="h-3 w-3 fill-current" />
                        {t("featuredBadge")}
                      </StatusPill>
                    )}
                  </div>
                </div>

                <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="tnum text-3xl font-semibold tracking-tight text-foreground">
                    {plan.price > 0 ? formatNumber(plan.price, language) : t("free")}
                  </span>
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {plan.price > 0 ? `${PLATFORM_CURRENCY} / ${plan.billingPeriod}` : `/ ${plan.billingPeriod}`}
                  </span>
                </p>

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t pt-4 text-sm">
                  {limits.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <dt className="flex items-center gap-1.5 text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </dt>
                      <dd className="tnum font-mono font-medium text-foreground">{value == null ? "∞" : formatNumber(value, language)}</dd>
                    </div>
                  ))}
                </dl>

                {featureCount > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {tf(t("featuresConfigured"), { count: featureCount, plural: featureCount !== 1 ? "s" : "" })}
                  </p>
                )}

                <div className="mt-auto flex items-center gap-2 pt-5">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => open({ kind: "form", plan })}>
                    <Pencil className="h-3.5 w-3.5" />
                    {t("edit")}
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" disabled={togglingId === plan.id} onClick={() => void toggle(plan)}>
                    {togglingId === plan.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                    {active ? t("deactivate") : t("activate")}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-status-critical hover:text-status-critical"
                    aria-label={t("delete")}
                    onClick={() => open({ kind: "delete", plan })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <PlanFormDialog
        key={`plan-${seq}`}
        open={dialog?.kind === "form"}
        plan={dialog?.kind === "form" ? dialog.plan : null}
        busy={busy}
        t={t}
        onClose={() => setDialog(null)}
        onSubmit={async (payload) => {
          const editing = dialog?.kind === "form" ? dialog.plan : null;
          setBusy(true);
          try {
            upsert(editing ? await updatePlan(editing.id, payload) : await createPlan(payload));
            toast.success(editing ? t("planUpdated") : t("planCreated"));
            setDialog(null);
          } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : t(editing ? "failedToUpdatePlan" : "failedToCreatePlan"));
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("deletePlan")}
        description={tf(t("deletePlanConfirm"), { name: dialog?.kind === "delete" ? dialog.plan.name : "" })}
        confirmLabel={t("delete")}
        busy={busy}
        onConfirm={async () => {
          if (dialog?.kind !== "delete") return;
          setBusy(true);
          try {
            await deletePlan(dialog.plan.id);
            res.setData((d) => (d ?? []).filter((p) => p.id !== dialog.plan.id));
            toast.success(t("planDeleted"));
            setDialog(null);
          } catch (e) {
            toast.error(e instanceof Error && e.message ? e.message : t("failedToDeletePlan"));
          } finally {
            setBusy(false);
          }
        }}
      />
    </DashboardLayout>
  );
}

// ── Create / edit dialog ───────────────────────────────────────────────────────

type PlanPayload = Parameters<typeof createPlan>[0];

function PlanFormDialog({
  open, plan, busy, t, onClose, onSubmit,
}: {
  open: boolean; plan: SubscriptionPlan | null; busy: boolean; t: (k: string) => string;
  onClose: () => void; onSubmit: (p: PlanPayload) => void;
}) {
  const [form, setForm] = useState<PlanForm>(() => (plan ? toForm(plan) : emptyForm));
  const [rows, setRows] = useState<FeatureRow[]>(() => featuresToRows(plan?.features));
  const set = <K extends keyof PlanForm>(k: K, v: PlanForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const submit = () => {
    const price = Number(form.price);
    const ints = {
      maxBranches: Number(form.maxBranches), maxStudents: Number(form.maxStudents),
      maxClasses: Number(form.maxClasses), maxTeachers: Number(form.maxTeachers),
    };
    const sortOrder = Number(form.sortOrder);
    // The backend has no binding tags on these fields, so a bad value would save silently.
    if (!form.name.trim()) return void toast.error(t("nameRequired"));
    if (!Number.isFinite(price) || price < 0) return void toast.error(t("priceCannotBeNegative"));
    if (!Number.isInteger(ints.maxBranches) || ints.maxBranches < 1) return void toast.error(t("maxBranchesMin"));
    if (!Number.isInteger(ints.maxStudents) || ints.maxStudents < 1) return void toast.error(t("maxStudentsMin"));
    if (!Number.isInteger(ints.maxClasses) || ints.maxClasses < 1) return void toast.error(t("maxClassesMin"));
    if (!Number.isInteger(ints.maxTeachers) || ints.maxTeachers < 1) return void toast.error(t("maxTeachersMin"));
    const keys = rows.map((r) => r.key.trim().toLowerCase()).filter(Boolean);
    if (new Set(keys).size !== keys.length) return void toast.error(t("duplicateFeatureName"));

    onSubmit({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price,
      billingPeriod: form.billingPeriod,
      ...ints,
      status: form.status,
      isFeatured: form.isFeatured,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      features: rowsToFeatures(rows),
    });
  };

  const patchRow = (i: number, patch: Partial<FeatureRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const customRows = rows.map((r, i) => ({ r, i })).filter(({ r }) => !isPreset(r.key));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>{plan ? t("editPlan") : t("createPlan")}</DialogTitle>
          <DialogDescription>{plan ? t("updatePlanDetails") : t("addNewSubscriptionPlan")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          <Field label={t("planName")}>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Professional" autoFocus />
          </Field>
          <Field label={t("description")}>
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("briefPlanDescription")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("priceUsd")}>
              <Input type="number" min={0} step="1000" value={form.price} onChange={(e) => set("price", e.target.value)} className="font-mono" />
            </Field>
            <Field label={t("billingPeriod")}>
              <Select value={form.billingPeriod} onValueChange={(v) => set("billingPeriod", v as PlanForm["billingPeriod"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t("monthly")}</SelectItem>
                  <SelectItem value="yearly">{t("yearly")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("maxBranches")}><Input type="number" min={1} value={form.maxBranches} onChange={(e) => set("maxBranches", e.target.value)} className="font-mono" /></Field>
            <Field label={t("maxStudents")}><Input type="number" min={1} value={form.maxStudents} onChange={(e) => set("maxStudents", e.target.value)} className="font-mono" /></Field>
            <Field label={t("maxClasses")}><Input type="number" min={1} value={form.maxClasses} onChange={(e) => set("maxClasses", e.target.value)} className="font-mono" /></Field>
            <Field label={t("maxTeachers")}><Input type="number" min={1} value={form.maxTeachers} onChange={(e) => set("maxTeachers", e.target.value)} className="font-mono" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("status")}>
              <Select value={form.status} onValueChange={(v) => set("status", v as PlanForm["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("active")}</SelectItem>
                  <SelectItem value="inactive">{t("inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("sortOrder")} hint={t("sortOrderDesc")}>
              <Input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} className="font-mono" />
            </Field>
          </div>
          <SwitchRow label={t("featuredPlan")} description={t("featuredPlanDesc")}>
            <Switch checked={form.isFeatured} onCheckedChange={(v) => set("isFeatured", v)} />
          </SwitchRow>

          <div className="space-y-2 border-t pt-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t("features")}</p>
              <p className="text-xs text-muted-foreground">{t("featuresDesc")}</p>
            </div>
            <div className="divide-y rounded-lg border">
              {PRESET_FEATURES.map((preset) => {
                const idx = rows.findIndex((r) => r.key === preset.key);
                return (
                  <div key={preset.key} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm">{t(preset.labelKey)}</span>
                    <Switch
                      checked={idx !== -1 && rows[idx].enabled}
                      onCheckedChange={(v) =>
                        idx === -1 ? setRows((r) => [...r, { key: preset.key, enabled: v }]) : patchRow(idx, { enabled: v })
                      }
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-medium text-muted-foreground">{t("customFeatures")}</span>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setRows((r) => [...r, { key: "", enabled: true }])}>
                <Plus className="h-3.5 w-3.5" />
                {t("addFeature")}
              </Button>
            </div>
            {customRows.length === 0 ? (
              <p className="py-1 text-xs text-muted-foreground">{t("noCustomFeatures")}</p>
            ) : (
              customRows.map(({ r, i }) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={r.key} onChange={(e) => patchRow(i, { key: e.target.value })} placeholder={t("featureNamePlaceholder")} className="flex-1 font-mono text-sm" />
                  <Switch checked={r.enabled} onCheckedChange={(v) => patchRow(i, { enabled: v })} />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-status-critical" aria-label={t("delete")} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="border-t p-6 pt-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {plan ? t("saveChanges") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
