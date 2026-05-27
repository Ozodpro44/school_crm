import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Building2, Search, Plus, MoreVertical, Edit, Trash2,
  MapPin, Phone, CreditCard, Loader2, AlertCircle, RefreshCw,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  listBranches, createBranch, updateBranch, deleteBranch,
  type CRMBranch,
} from "@/services/api-client";

const emptyForm = { name: "", address: "", phone: "", monthlyPayment: 0 };

function fmt(n?: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function Branches() {
  const [branches, setBranches] = useState<CRMBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<CRMBranch | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBranches();
      setBranches(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = branches.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.name.toLowerCase().includes(q) || (b.address || "").toLowerCase().includes(q);
  });

  const totalRevenue = branches.reduce((sum, b) => sum + (b.monthlyPayment || 0), 0);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Branch name is required"); return; }
    setSaving(true);
    try {
      const created = await createBranch({
        name: form.name,
        address: form.address || undefined,
        phone: form.phone || undefined,
        monthlyPayment: Number(form.monthlyPayment) || undefined,
      });
      setBranches((prev) => [...prev, created]);
      setCreateOpen(false);
      setForm(emptyForm);
      toast.success("Branch created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create branch");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selected || !form.name.trim()) { toast.error("Branch name is required"); return; }
    setSaving(true);
    try {
      const updated = await updateBranch(selected.id, {
        name: form.name,
        address: form.address || undefined,
        phone: form.phone || undefined,
        monthlyPayment: Number(form.monthlyPayment) || undefined,
      });
      setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setEditOpen(false);
      toast.success("Branch updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update branch");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await deleteBranch(selected.id);
      setBranches((prev) => prev.filter((b) => b.id !== selected.id));
      setDeleteOpen(false);
      toast.success("Branch deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete branch");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (branch: CRMBranch) => {
    setSelected(branch);
    setForm({
      name: branch.name,
      address: branch.address ?? "",
      phone: branch.phone ?? "",
      monthlyPayment: branch.monthlyPayment ?? 0,
    });
    setEditOpen(true);
  };

  const BranchForm = () => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Branch Name *</Label>
        <Input
          placeholder="e.g. Downtown Campus"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Input
          placeholder="Street address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input
          placeholder="+1 555 000 0000"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Monthly Payment ($)</Label>
        <Input
          type="number"
          min="0"
          placeholder="0"
          value={form.monthlyPayment || ""}
          onChange={(e) => setForm({ ...form, monthlyPayment: Number(e.target.value) })}
          className="font-mono"
        />
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Branches</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage school branches</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button size="sm" className="gap-2" onClick={() => { setForm(emptyForm); setCreateOpen(true); }}>
            <Plus className="w-4 h-4" />
            Add Branch
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap gap-4 mb-5">
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-card">
          <Building2 className="w-4 h-4 text-primary" />
          <span className="font-mono font-bold text-foreground">{branches.length}</span>
          <span className="text-sm text-muted-foreground">Total Branches</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-card">
          <DollarSign className="w-4 h-4 text-status-healthy" />
          <span className="font-mono font-bold text-status-healthy">{fmt(totalRevenue)}</span>
          <span className="text-sm text-muted-foreground">Monthly Revenue</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-4 rounded-lg border border-status-critical/30 bg-status-critical/10 text-status-critical text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <Button variant="ghost" size="sm" onClick={load} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="glass-card rounded-lg p-3 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search branches by name or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 bg-background text-sm"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-lg p-14 flex flex-col items-center gap-3 text-muted-foreground">
          <Building2 className="w-9 h-9 opacity-30" />
          <p className="text-sm">{search ? "No branches match your search" : "No branches yet"}</p>
          {!search && (
            <Button size="sm" onClick={() => { setForm(emptyForm); setCreateOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Branch
            </Button>
          )}
        </div>
      ) : (
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Address</th>
                  <th className="text-left px-4 py-3 font-medium">Phone</th>
                  <th className="text-right px-4 py-3 font-medium">Monthly Payment</th>
                  <th className="text-left px-4 py-3 font-medium">Admin ID</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((branch) => (
                  <tr key={branch.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-status-healthy/15 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-status-healthy" />
                        </div>
                        <span className="font-medium text-foreground">{branch.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {branch.address ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[160px]">{branch.address}</span>
                        </div>
                      ) : <span className="opacity-40 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {branch.phone ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {branch.phone}
                        </div>
                      ) : <span className="opacity-40 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 text-status-healthy text-sm font-mono font-semibold">
                        <CreditCard className="w-3.5 h-3.5" />
                        {fmt(branch.monthlyPayment)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {branch.adminId ? (
                        <code className="text-xs font-mono text-muted-foreground">
                          {branch.adminId.slice(0, 8)}…
                        </code>
                      ) : <span className="text-xs opacity-40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {branch.createdAt
                        ? new Date(branch.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(branch)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Branch
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-status-critical"
                            onClick={() => { setSelected(branch); setDeleteOpen(true); }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Branch
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Branch</DialogTitle>
            <DialogDescription>Create a new school branch.</DialogDescription>
          </DialogHeader>
          <BranchForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>Update branch information.</DialogDescription>
          </DialogHeader>
          <BranchForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{selected?.name}"? All associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-status-critical hover:bg-status-critical/90"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Branch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
