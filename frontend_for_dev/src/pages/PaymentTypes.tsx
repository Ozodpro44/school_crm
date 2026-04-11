import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, CreditCard, RefreshCw } from "lucide-react";
import {
  PaymentType,
  getAllPaymentTypes,
  createPaymentType,
  updatePaymentType,
  togglePaymentType,
  deletePaymentType,
} from "@/services/subscription-api";

const emptyForm = {
  code: "",
  displayName: "",
  description: "",
  isActive: true,
  sortOrder: 0,
};

export default function PaymentTypes() {
  const [types, setTypes] = useState<PaymentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentType | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllPaymentTypes();
      setTypes(data);
    } catch {
      toast.error("Failed to load payment types");
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
      toast.error("Code and display name are required");
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
        setTypes((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        toast.success("Payment type updated");
      } else {
        const created = await createPaymentType({
          code: form.code,
          displayName: form.displayName,
          description: form.description || undefined,
          isActive: form.isActive,
          sortOrder: form.sortOrder,
        });
        setTypes((prev) => [...prev, created]);
        toast.success("Payment type created");
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (pt: PaymentType) => {
    try {
      const updated = await togglePaymentType(pt.id);
      setTypes((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast.success(`${updated.displayName} ${updated.isActive ? "activated" : "deactivated"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  const handleDelete = async (pt: PaymentType) => {
    if (!window.confirm(`Delete "${pt.displayName}"? This cannot be undone.`)) return;
    try {
      await deletePaymentType(pt.id);
      setTypes((prev) => prev.filter((t) => t.id !== pt.id));
      toast.success("Payment type deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Types</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage which payment methods are available in subscription billing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            Add Type
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Display Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Order</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Type</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
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
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No payment types found
                </td>
              </tr>
            ) : (
              types.map((pt) => (
                <tr key={pt.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{pt.code}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{pt.displayName}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">
                    {pt.description || <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{pt.sortOrder}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant={pt.isActive ? "default" : "secondary"}
                      className={pt.isActive ? "bg-green-500/15 text-green-700 dark:text-green-400 border-0" : ""}
                    >
                      {pt.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {pt.isSystem ? (
                      <Badge variant="outline" className="text-xs">System</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs opacity-50">Custom</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(pt)}
                        title={pt.isActive ? "Deactivate" : "Activate"}
                      >
                        {pt.isActive
                          ? <ToggleRight className="w-4 h-4 text-green-500" />
                          : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(pt)}
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {!pt.isSystem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(pt)}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
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
            <DialogTitle>
              {editTarget ? "Edit Payment Type" : "New Payment Type"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="pt-code">Code <span className="text-destructive">*</span></Label>
              <Input
                id="pt-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. payme"
                disabled={!!editTarget}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Internal identifier stored in subscriptions. Cannot be changed after creation.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="pt-name">Display Name <span className="text-destructive">*</span></Label>
              <Input
                id="pt-name"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="e.g. Payme"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pt-desc">Description</Label>
              <Input
                id="pt-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description shown to users"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pt-order">Sort Order</Label>
              <Input
                id="pt-order"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="pt-active">Active</Label>
              <Switch
                id="pt-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editTarget ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
