import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Building2,
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  MapPin,
  Phone,
  CreditCard,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { apiClient } from "@/services/api-client";

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  monthlyPayment: number;
  adminId: string;
}

const emptyForm = {
  name: "",
  address: "",
  phone: "",
  monthlyPayment: 0,
};

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState(emptyForm);

  const fetchBranches = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getBranches();
      setBranches(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load branches";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const filteredBranches = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const resetForm = () => setFormData(emptyForm);

  const handleAddBranch = async () => {
    try {
      setSubmitting(true);
      await apiClient.createBranch({
        name: formData.name,
        address: formData.address,
        phone: formData.phone,
        monthlyPayment: Number(formData.monthlyPayment),
      });
      toast.success("Branch created successfully");
      setIsAddModalOpen(false);
      resetForm();
      fetchBranches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create branch");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditBranch = async () => {
    if (!selectedBranch) return;
    try {
      setSubmitting(true);
      await apiClient.updateBranch(selectedBranch.id, {
        name: formData.name,
        address: formData.address,
        phone: formData.phone,
        monthlyPayment: Number(formData.monthlyPayment),
      });
      toast.success("Branch updated successfully");
      setIsEditModalOpen(false);
      setSelectedBranch(null);
      fetchBranches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update branch");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBranch = async () => {
    if (!selectedBranch) return;
    try {
      setSubmitting(true);
      await apiClient.deleteBranch(selectedBranch.id);
      toast.success("Branch deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedBranch(null);
      fetchBranches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete branch");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address || "",
      phone: branch.phone || "",
      monthlyPayment: branch.monthlyPayment || 0,
    });
    setIsEditModalOpen(true);
  };

  const openViewModal = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsViewModalOpen(true);
  };

  const openDeleteDialog = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsDeleteDialogOpen(true);
  };

  const totalRevenue = branches.reduce((sum, b) => sum + (b.monthlyPayment || 0), 0);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Branch Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage all school branches
          </p>
        </div>
        <Button className="gap-2" onClick={() => { resetForm(); setIsAddModalOpen(true); }}>
          <Plus className="w-4 h-4" />
          Add Branch
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{branches.length}</p>
              <p className="text-sm text-muted-foreground">Total Branches</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-healthy/15 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-status-healthy" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{branches.length}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-status-healthy/15 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-status-healthy" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card rounded-lg p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search branches by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background max-w-md"
          />
        </div>
      </div>

      {/* Branches Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="glass-card rounded-lg p-12 text-center text-muted-foreground">
          {searchQuery ? "No branches match your search." : "No branches yet. Add your first branch."}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredBranches.map((branch) => (
            <div key={branch.id} className="glass-card rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-status-healthy/15 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-status-healthy" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{branch.name}</h3>
                      <p className="text-sm text-muted-foreground truncate max-w-48">{branch.address || "No address"}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openViewModal(branch)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditModal(branch)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Branch
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-status-critical"
                        onClick={() => openDeleteDialog(branch)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Branch
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {branch.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{branch.phone}</span>
                  </div>
                )}
                {branch.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{branch.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span>{formatCurrency(branch.monthlyPayment)} / month</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Branch Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Branch</DialogTitle>
            <DialogDescription>Create a new school branch in the system.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Branch Name</Label>
              <Input
                placeholder="Moscow Central"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                placeholder="Tverskaya st. 15, Building 2"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                placeholder="+7 495 123-45-67"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Payment (RUB)</Label>
              <Input
                type="number"
                placeholder="25000"
                value={formData.monthlyPayment || ""}
                onChange={(e) => setFormData({ ...formData, monthlyPayment: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddBranch} disabled={!formData.name || submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>Update branch information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Branch Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Monthly Payment (RUB)</Label>
              <Input
                type="number"
                value={formData.monthlyPayment || ""}
                onChange={(e) => setFormData({ ...formData, monthlyPayment: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditBranch} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Branch Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Branch Details</DialogTitle>
            <DialogDescription>Detailed information about this branch.</DialogDescription>
          </DialogHeader>
          {selectedBranch && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-status-healthy/15 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-status-healthy" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{selectedBranch.name}</h3>
                </div>
              </div>
              <div className="space-y-3">
                {selectedBranch.address && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{selectedBranch.address}</span>
                  </div>
                )}
                {selectedBranch.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{selectedBranch.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">
                    {formatCurrency(selectedBranch.monthlyPayment)} / month
                  </span>
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">Branch ID</p>
                <p className="font-mono text-sm text-foreground">{selectedBranch.id}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setIsViewModalOpen(false);
                if (selectedBranch) openEditModal(selectedBranch);
              }}
            >
              Edit Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedBranch?.name}"? This will remove all
              associated data including students, teachers, and payment history. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBranch}
              disabled={submitting}
              className="bg-status-critical hover:bg-status-critical/90"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Branch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
