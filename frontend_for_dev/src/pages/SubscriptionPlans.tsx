import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Plus, Edit, Trash2, RefreshCw, Loader2, AlertCircle,
  Layers, CheckCircle2, XCircle, DollarSign, Users, Building2, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  status: "active" as "active" | "inactive",
};

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
        status: form.status,
        features: {},
      });
      setPlans((prev) => [...prev, created]);
      setCreateOpen(false);
      setForm(emptyForm);
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
        status: form.status,
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
      status: (plan.status === "inactive" || plan.isActive === false) ? "inactive" : "active",
    });
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
      <div className="grid grid-cols-3 gap-4">
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
      </div>
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
          <Button size="sm" className="gap-2" onClick={() => { setForm(emptyForm); setCreateOpen(true); }}>
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
          <Button size="sm" onClick={() => { setForm(emptyForm); setCreateOpen(true); }}>
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

                {/* Price */}
                <div className="flex items-baseline gap-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="text-2xl font-bold text-foreground font-mono">
                    {plan.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">/{plan.billingPeriod}</span>
                </div>

                {/* Limits */}
                <div className="grid grid-cols-3 gap-2 text-center">
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("createPlan")}</DialogTitle>
            <DialogDescription>{t("addNewSubscriptionPlan")}</DialogDescription>
          </DialogHeader>
          <PlanForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editPlan")}</DialogTitle>
            <DialogDescription>{t("updatePlanDetails")}</DialogDescription>
          </DialogHeader>
          <PlanForm />
          <DialogFooter>
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
