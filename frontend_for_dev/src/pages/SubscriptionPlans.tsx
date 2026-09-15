import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Plus, Edit, Trash2, RefreshCw, Loader2, AlertCircle,
  Layers, CheckCircle2, XCircle, DollarSign, Users, Building2, BookOpen,
  GraduationCap, Star, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  listPlans, createPlan, updatePlan, deletePlan,
  type SubscriptionPlan,
} from "@/services/api-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";

const emptyForm = {
  name: "",
  description: "",
  price: 0,
  billingPeriod: "monthly" as "monthly" | "yearly",
  maxBranches: 1,
  maxStudents: 100,
  maxClasses: 10,
  maxTeachers: 20,
  status: "active" as "active" | "inactive",
  isFeatured: false,
  sortOrder: 0,
};

// Editable row for the features list — kept separate from the plain
// {key: boolean} map the API sends/receives so a row's key can be edited
// (and duplicates caught) before it's collapsed back into that map on save.
type FeatureRow = { key: string; enabled: boolean };

// Common capabilities a school-CRM plan actually varies by — rendered as a
// one-click checklist instead of asking the developer to type a raw
// camelCase key from memory every time. Anything not on this list still
// falls back to the free-text "Custom features" section below.
const PRESET_FEATURES: { key: string; labelKey: string }[] = [
  { key: "smsNotifications", labelKey: "featureSmsNotifications" },
  { key: "telegramBot", labelKey: "featureTelegramBot" },
  { key: "prioritySupport", labelKey: "featurePrioritySupport" },
  { key: "apiAccess", labelKey: "featureApiAccess" },
  { key: "customBranding", labelKey: "featureCustomBranding" },
  { key: "advancedReports", labelKey: "featureAdvancedReports" },
];

function isPresetFeatureKey(key: string): boolean {
  return PRESET_FEATURES.some((p) => p.key === key);
}

function featuresToRows(features: Record<string, unknown> | undefined): FeatureRow[] {
  if (!features) return [];
  return Object.entries(features).map(([key, val]) => ({ key, enabled: Boolean(val) }));
}

function rowsToFeatures(rows: FeatureRow[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (key) out[key] = row.enabled;
  }
  return out;
}

export default function SubscriptionPlans() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<SubscriptionPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [featureRows, setFeatureRows] = useState<FeatureRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPlans();
      setPlans(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedToLoadPlans"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Backend validates nothing on these fields (no binding tags), so a
  // negative price/limit would otherwise save silently and corrupt any
  // MRR/limit math built from it downstream.
  const validateForm = (): string | null => {
    if (!form.name.trim()) return t("nameRequired");
    if (!Number.isFinite(form.price) || form.price < 0) return t("priceCannotBeNegative");
    if (!Number.isInteger(form.maxBranches) || form.maxBranches < 1) return t("maxBranchesMin");
    if (!Number.isInteger(form.maxStudents) || form.maxStudents < 1) return t("maxStudentsMin");
    if (!Number.isInteger(form.maxClasses) || form.maxClasses < 1) return t("maxClassesMin");
    if (!Number.isInteger(form.maxTeachers) || form.maxTeachers < 1) return t("maxTeachersMin");
    const keys = featureRows.map((r) => r.key.trim().toLowerCase()).filter(Boolean);
    if (new Set(keys).size !== keys.length) return t("duplicateFeatureName");
    return null;
  };

  const handleCreate = async () => {
    const validationError = validateForm();
    if (validationError) { toast.error(validationError); return; }
    setSaving(true);
    try {
      const created = await createPlan({
        name: form.name,
        description: form.description || undefined,
        price: form.price,
        billingPeriod: form.billingPeriod,
        maxBranches: form.maxBranches,
        maxStudents: form.maxStudents,
        maxClasses: form.maxClasses,
        maxTeachers: form.maxTeachers,
        status: form.status,
        isFeatured: form.isFeatured,
        sortOrder: form.sortOrder,
        features: rowsToFeatures(featureRows),
      });
      setPlans((prev) => [...prev, created]);
      setCreateOpen(false);
      setForm(emptyForm);
      setFeatureRows([]);
      toast.success(t("planCreated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToCreatePlan"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selected) return;
    const validationError = validateForm();
    if (validationError) { toast.error(validationError); return; }
    setSaving(true);
    try {
      const updated = await updatePlan(selected.id, {
        name: form.name,
        description: form.description || undefined,
        price: form.price,
        billingPeriod: form.billingPeriod,
        maxBranches: form.maxBranches,
        maxStudents: form.maxStudents,
        maxClasses: form.maxClasses,
        maxTeachers: form.maxTeachers,
        status: form.status,
        isFeatured: form.isFeatured,
        sortOrder: form.sortOrder,
        features: rowsToFeatures(featureRows),
      });
      setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditOpen(false);
      toast.success(t("planUpdated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToUpdatePlan"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await deletePlan(selected.id);
      setPlans((prev) => prev.filter((p) => p.id !== selected.id));
      setDeleteOpen(false);
      toast.success(t("planDeleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToDeletePlan"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    try {
      const newStatus = (plan.status === "active" || plan.isActive) ? "inactive" : "active";
      const updated = await updatePlan(plan.id, { status: newStatus });
      setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      toast.success(tf(t("planStatusChanged"), { status: t(newStatus) }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failedToUpdatePlan"));
    }
  };

  const openEdit = (plan: SubscriptionPlan) => {
    setSelected(plan);
    setForm({
      name: plan.name,
      description: plan.description ?? "",
      price: plan.price,
      billingPeriod: (plan.billingPeriod as "monthly" | "yearly") || "monthly",
      maxBranches: plan.maxBranches ?? 1,
      maxStudents: plan.maxStudents ?? 100,
      maxClasses: plan.maxClasses ?? 10,
      maxTeachers: plan.maxTeachers ?? 20,
      status: (plan.status === "inactive" || plan.isActive === false) ? "inactive" : "active",
      isFeatured: plan.isFeatured ?? false,
      sortOrder: plan.sortOrder ?? 0,
    });
    setFeatureRows(featuresToRows(plan.features));
    setEditOpen(true);
  };

  const isPlanActive = (plan: SubscriptionPlan) =>
    plan.status === "active" || (plan.status == null && plan.isActive !== false);

  const PlanForm = () => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>{t("planName")}</Label>
        <Input
          placeholder="e.g. Professional"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("description")}</Label>
        <Input
          placeholder={t("briefPlanDescription")}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("priceUsd")}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label>{t("billingPeriod")}</Label>
          <Select
            value={form.billingPeriod}
            onValueChange={(v) => setForm({ ...form, billingPeriod: v as "monthly" | "yearly" })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">{t("monthly")}</SelectItem>
              <SelectItem value="yearly">{t("yearly")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("maxBranches")}</Label>
          <Input
            type="number"
            min="1"
            value={form.maxBranches}
            onChange={(e) => setForm({ ...form, maxBranches: parseInt(e.target.value) || 1 })}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label>{t("maxStudents")}</Label>
          <Input
            type="number"
            min="1"
            value={form.maxStudents}
            onChange={(e) => setForm({ ...form, maxStudents: parseInt(e.target.value) || 1 })}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label>{t("maxClasses")}</Label>
          <Input
            type="number"
            min="1"
            value={form.maxClasses}
            onChange={(e) => setForm({ ...form, maxClasses: parseInt(e.target.value) || 1 })}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label>{t("maxTeachers")}</Label>
          <Input
            type="number"
            min="1"
            value={form.maxTeachers}
            onChange={(e) => setForm({ ...form, maxTeachers: parseInt(e.target.value) || 1 })}
            className="font-mono"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("status")}</Label>
          <Select
            value={form.status}
            onValueChange={(v) => setForm({ ...form, status: v as "active" | "inactive" })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t("active")}</SelectItem>
              <SelectItem value="inactive">{t("inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("sortOrder")}</Label>
          <Input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">{t("sortOrderDesc")}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5" />
            {t("featuredPlan")}
          </p>
          <p className="text-xs text-muted-foreground">{t("featuredPlanDesc")}</p>
        </div>
        <Switch
          checked={form.isFeatured}
          onCheckedChange={(v) => setForm({ ...form, isFeatured: v })}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("features")}</Label>
        <p className="text-xs text-muted-foreground">{t("featuresDesc")}</p>

        {/* Preset features — one click, no typing. Covers the common cases. */}
        <div className="space-y-1 rounded-lg border border-border divide-y divide-border">
          {PRESET_FEATURES.map((preset) => {
            const rowIndex = featureRows.findIndex((r) => r.key === preset.key);
            const enabled = rowIndex !== -1 && featureRows[rowIndex].enabled;
            return (
              <div key={preset.key} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-foreground">{t(preset.labelKey)}</span>
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => {
                    if (rowIndex === -1) {
                      setFeatureRows([...featureRows, { key: preset.key, enabled: v }]);
                    } else {
                      const next = [...featureRows];
                      next[rowIndex] = { ...next[rowIndex], enabled: v };
                      setFeatureRows(next);
                    }
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Custom features — only needed for anything outside the preset list above. */}
        <div className="flex items-center justify-between pt-1">
          <Label className="text-xs text-muted-foreground">{t("customFeatures")}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setFeatureRows([...featureRows, { key: "", enabled: true }])}
          >
            <Plus className="w-3.5 h-3.5" />
            {t("addFeature")}
          </Button>
        </div>
        {featureRows.every((r) => isPresetFeatureKey(r.key)) ? (
          <p className="text-xs text-muted-foreground py-1">{t("noCustomFeatures")}</p>
        ) : (
          <div className="space-y-2">
            {featureRows.map((row, i) => {
              if (isPresetFeatureKey(row.key)) return null;
              return (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder={t("featureNamePlaceholder")}
                    value={row.key}
                    onChange={(e) => {
                      const next = [...featureRows];
                      next[i] = { ...next[i], key: e.target.value };
                      setFeatureRows(next);
                    }}
                    className="flex-1 font-mono text-sm"
                  />
                  <Switch
                    checked={row.enabled}
                    onCheckedChange={(v) => {
                      const next = [...featureRows];
                      next[i] = { ...next[i], enabled: v };
                      setFeatureRows(next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-status-critical"
                    onClick={() => setFeatureRows(featureRows.filter((_, j) => j !== i))}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("subscriptionPlansTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tf(t("planCountSummary"), {
              count: plans.length,
              plural: plans.length !== 1 ? "s" : "",
              activeCount: plans.filter(isPlanActive).length,
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {t("refresh")}
          </Button>
          <Button size="sm" className="gap-2" onClick={() => { setForm(emptyForm); setFeatureRows([]); setCreateOpen(true); }}>
            <Plus className="w-4 h-4" />
            {t("newPlan")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-lg border border-status-critical/30 bg-status-critical/10 text-status-critical text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : plans.length === 0 ? (
        <div className="glass-card rounded-lg p-16 flex flex-col items-center gap-3 text-muted-foreground">
          <Layers className="w-10 h-10 opacity-30" />
          <p className="text-sm">{t("noPlansYet")}</p>
          <Button size="sm" onClick={() => { setForm(emptyForm); setFeatureRows([]); setCreateOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            {t("createPlan")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const active = isPlanActive(plan);
            const featCount = plan.features ? Object.keys(plan.features).length : 0;
            return (
              <div
                key={plan.id}
                className={cn(
                  "glass-card rounded-lg p-5 flex flex-col gap-4 transition-all",
                  !active && "opacity-60"
                )}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{plan.name}</h3>
                      {plan.description && (
                        <p className="text-xs text-muted-foreground">{plan.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {plan.isFeatured && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        {t("featuredBadge")}
                      </span>
                    )}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                        active
                          ? "bg-status-healthy/10 text-status-healthy border border-status-healthy/20"
                          : "bg-muted text-muted-foreground border border-border"
                      )}
                    >
                      {active ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                      {active ? t("active") : t("inactive")}
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="text-2xl font-bold text-foreground font-mono">
                    {plan.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">/{plan.billingPeriod}</span>
                </div>

                {/* Limits */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-accent/50 rounded-lg p-2">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs font-mono font-bold text-foreground">{plan.maxBranches ?? "∞"}</p>
                    <p className="text-[10px] text-muted-foreground">{t("branches")}</p>
                  </div>
                  <div className="bg-accent/50 rounded-lg p-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs font-mono font-bold text-foreground">{plan.maxStudents ?? "∞"}</p>
                    <p className="text-[10px] text-muted-foreground">{t("students")}</p>
                  </div>
                  <div className="bg-accent/50 rounded-lg p-2">
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs font-mono font-bold text-foreground">{plan.maxClasses ?? "∞"}</p>
                    <p className="text-[10px] text-muted-foreground">{t("classes")}</p>
                  </div>
                  <div className="bg-accent/50 rounded-lg p-2">
                    <GraduationCap className="w-3.5 h-3.5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs font-mono font-bold text-foreground">{plan.maxTeachers ?? "∞"}</p>
                    <p className="text-[10px] text-muted-foreground">{t("maxTeachers")}</p>
                  </div>
                </div>

                {featCount > 0 && (
                  <p className="text-xs text-muted-foreground">{tf(t("featuresConfigured"), { count: featCount, plural: featCount !== 1 ? "s" : "" })}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs gap-1"
                    onClick={() => openEdit(plan)}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    {t("edit")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs gap-1"
                    onClick={() => handleToggleActive(plan)}
                  >
                    {active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {active ? t("deactivate") : t("activate")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-status-critical hover:text-status-critical"
                    onClick={() => { setSelected(plan); setDeleteOpen(true); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog — the form got tall once teacher limits/featured/sort
          order/features were added, so the header and footer (Save) now stay
          fixed and only the middle section scrolls, instead of the whole
          dialog growing past the viewport. */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>{t("createPlan")}</DialogTitle>
            <DialogDescription>{t("addNewSubscriptionPlan")}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 flex-1 min-h-0">
            <PlanForm />
          </div>
          <DialogFooter className="p-6 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog — same fixed-header/footer, scrollable-middle layout. */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>{t("editPlan")}</DialogTitle>
            <DialogDescription>{t("updatePlanDetails")}</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 flex-1 min-h-0">
            <PlanForm />
          </div>
          <DialogFooter className="p-6 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deletePlan")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tf(t("deletePlanConfirm"), { name: selected?.name || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-status-critical hover:bg-status-critical/90"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
