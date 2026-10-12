import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Plus, Pencil, Trash2, RefreshCw, Loader2, AlertCircle, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  listPaymentTypes, createPaymentType, updatePaymentType,
  togglePaymentType, deletePaymentType,
  type PaymentType,
} from "@/services/api-client";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, tf } from "@/lib/i18n";

const emptyForm = { code: "", displayName: "", description: "", isActive: true, sortOrder: 0 };

export default function PaymentTypes() {
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [types, setTypes] = useState<PaymentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentType | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPaymentTypes();
      setTypes(data.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedToLoadPaymentTypes"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (pt: PaymentType) => {
    setEditTarget(pt);
    setForm({
      code: pt.code,
      displayName: pt.displayName,
      description: pt.description ?? "",
      isActive: pt.isActive,
      sortOrder: pt.sortOrder,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.displayName.trim()) {
      toast.error(t("codeDisplayNameRequired"));
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await updatePaymentType(editTarget.id, {
          displayName: form.displayName,
          description: form.description || undefined,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        });
        setTypes((prev) => prev.map((pt) => (pt.id === updated.id ? updated : pt)));
        toast.success(t("paymentTypeUpdated"));
      } else {
        const created = await createPaymentType({
          code: form.code,
          displayName: form.displayName,
          description: form.description || undefined,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        });
        setTypes((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
        toast.success(t("paymentTypeCreated"));
      }
      setModalOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (pt: PaymentType) => {
    try {
      const updated = await togglePaymentType(pt.id);
      setTypes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success(tf(updated.isActive ? t("typeActivated") : t("typeDeactivated"), { name: updated.displayName }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toggleFailed"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deletePaymentType(deleteTarget.id);
      setTypes((prev) => prev.filter((pt) => pt.id !== deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
      toast.success(t("paymentTypeDeleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("deleteFailed"));
    } finally {
      setSaving(false);
    }
  };

  const activeCount = types.filter((t) => t.isActive).length;
  const systemCount = types.filter((t) => t.isSystem).length;

  return (
    <DashboardLayout>
      <TooltipProvider>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("paymentTypesTitle")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tf(t("typesCountSummary"), { count: types.length, activeCount, systemCount })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {t("refresh")}
            </Button>
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              {t("addType")}
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 mb-4 rounded-lg border border-status-critical/30 bg-status-critical/10 text-status-critical text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Table */}
        <div className="glass-card rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-xs text-muted-foreground">
                <th className="text-left px-4 py-3 font-medium">{t("code")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("displayName")}</th>
                <th className="text-left px-4 py-3 font-medium">{t("description")}</th>
                <th className="text-center px-4 py-3 font-medium">{t("order")}</th>
                <th className="text-center px-4 py-3 font-medium">{t("active")}</th>
                <th className="text-center px-4 py-3 font-medium">{t("type")}</th>
                <th className="text-right px-4 py-3 font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : types.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-muted-foreground">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t("noPaymentTypesFound")}</p>
                  </td>
                </tr>
              ) : (
                types.map((pt) => (
                  <tr key={pt.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {pt.code}
                      </code>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{pt.displayName}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {pt.description || <span className="opacity-40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-muted-foreground">{pt.sortOrder}</td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={pt.isActive}
                        onCheckedChange={() => handleToggle(pt)}
                        className="data-[state=checked]:bg-status-healthy"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pt.isSystem ? (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          {t("system")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          {t("custom")}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(pt)} className="h-7 w-7 p-0">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {pt.isSystem ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled
                                  className="h-7 w-7 p-0 text-muted-foreground/40"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{t("systemTypesCannotBeDeleted")}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-status-critical hover:text-status-critical"
                            onClick={() => { setDeleteTarget(pt); setDeleteOpen(true); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Create / Edit Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>{editTarget ? t("editPaymentType") : t("newPaymentType")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>{t("code")} <span className="text-status-critical">*</span></Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. payme"
                  disabled={!!editTarget}
                  className={cn("font-mono", !!editTarget && "opacity-60 cursor-not-allowed")}
                />
                {!editTarget && (
                  <p className="text-xs text-muted-foreground">
                    {t("internalIdentifierNotice")}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>{t("displayName")} <span className="text-status-critical">*</span></Label>
                <Input
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="e.g. Payme"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("description")}</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t("shortDescriptionShownToUsers")}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("sortOrder")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-24 font-mono"
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <Label>{t("activeByDefault")}</Label>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>{t("cancel")}</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editTarget ? t("update") : t("create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deletePaymentType")}</AlertDialogTitle>
              <AlertDialogDescription>
                {tf(t("deletePaymentTypeConfirm"), { name: deleteTarget?.displayName || "", code: deleteTarget?.code || "" })}
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
      </TooltipProvider>
    </DashboardLayout>
  );
}
