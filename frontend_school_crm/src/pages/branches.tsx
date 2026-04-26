
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import * as api from "@/lib/api";
import { Branch } from "@/types";
import type { User } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { Plus, Building2, MapPin, Phone, Edit, Trash2, Users, DollarSign, Loader2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { useRouter } from "next/router";
import { Badge } from "@/components/ui/badge";
import { formatPhoneNumber } from "@/lib/utils";
import { formatCurrency } from "@/lib/exportUtils";
import { useBranch } from "@/context/BranchContext";
import { DataTable, Column } from "@/components/DataTable";

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const { toast } = useToast();
  const language = useLanguage();
  const router = useRouter();
  const currentUser = getCurrentUser();
  const t = (key: string) => getTranslation(key, language);
  const { refreshBranches } = useBranch();

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    monthlyPayment: 100000,
    adminId: "",
  });

  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({
    branchId: "",
    email: "",
    password: "",
    fullName: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasCheckedAuth) {
      if (currentUser?.role !== "admin") {
        router.push("/");
        return;
      }
      setHasCheckedAuth(true);
      loadData();
    }
  }, [hasCheckedAuth, currentUser, router]);

  const loadData = async () => {
    const user = getCurrentUser();

    // If not authenticated, don't try to load data
    if (!user) {
      setBranches([]);
      setLoading(false);
      return;
    }

    try {
      const [branchList, userList] = await Promise.all([
        api.listBranches(),
        api.listUsers().catch(() => [] as User[]),
      ]);
      setBranches(branchList);
      setUsers(userList);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load branches:", error);
      toast({
        title: t("error"),
        description: t("failedToLoadBranches"),
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!formData.name || !formData.address || !formData.phone) {
      toast({
        title: t("error"),
        description: t("fillAllFields"),
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (formData.monthlyPayment <= 0) {
      toast({
        title: t("error"),
        description: t("monthlyPaymentMustBePositive"),
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      if (editingBranch) {
        await api.updateBranch(editingBranch.id, {
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
          monthlyPayment: formData.monthlyPayment,
          adminId: formData.adminId || undefined,
        });
        toast({
          title: t("success"),
          description: t("branchUpdated"),
          variant: "success",
        });
      } else {
        // Set current user as admin if no admin is specified
        const adminId = formData.adminId || currentUser?.id;

        await api.createBranch({
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
          monthlyPayment: formData.monthlyPayment,
          adminId: adminId,
        });
        toast({
          title: t("success"),
          description: t("newBranchAdded"),
          variant: "success",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      await loadData();
      await refreshBranches();
      } catch (error) {
      console.error("Error saving branch:", error);
      toast({
        title: t("error"),
        description: t("failedToSaveBranch"),
        variant: "destructive",
      });
      } finally {
      setIsSubmitting(false);
      }
      };

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      monthlyPayment: branch.monthlyPayment,
      adminId: branch.adminId || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm(t("branchDeleteConfirmation"))) {
      setDeletingBranchId(id);
      setIsDeleteLoading(true);
      try {
        await api.deleteBranch(id);
        toast({
          title: t("success"),
          description: t("branchDeleted"),
          variant: "success",
        });
        await loadData();
        await refreshBranches();
      } catch (error) {
        console.error("Error deleting branch:", error);
        toast({
          title: t("error"),
          description: t("failedToDeleteBranch") || "Failed to delete branch",
          variant: "destructive",
        });
      } finally {
        setIsDeleteLoading(false);
        setDeletingBranchId(null);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      phone: "",
      monthlyPayment: 100000,
      adminId: "",
    });
    setEditingBranch(null);
  };

  const handleCreateBranchAdmin = (branchId: string) => {
    setAdminForm({ branchId, email: "", password: "", fullName: "" });
    setIsCreateAdminOpen(true);
  };

  const handleCreateBranchAdminSubmit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    setIsAdminSubmitting(true);

    const { branchId, email, password, fullName } = adminForm;
    if (!email || !password || !fullName) {
      toast({
        title: t("error"),
        description: t("fillAllFields"),
        variant: "destructive",
      });
      setIsAdminSubmitting(false);
      return;
    }

    try {
      const newUser = await api.register({
        email,
        password,
        fullName,
        role: "branch_admin",
      });

      await api.updateBranch(branchId, { adminId: newUser.user.id });

      toast({
        title: t("success"),
        description: t("branchAdminCreated"),
        variant: "success",
      });

      setIsCreateAdminOpen(false);
      setAdminForm({ branchId: "", email: "", password: "", fullName: "" });
      await loadData();
      } catch (error) {
      console.error("Error creating branch admin:", error);
      toast({
        title: t("error"),
        description: t("failedToCreateAdmin") || "Failed to create admin",
        variant: "destructive",
      });
      } finally {
      setIsAdminSubmitting(false);
      }
      };

  const columns: Column<Branch>[] = [
    {
      key: "name",
      header: t("branchName"),
      render: (branch) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-slate-900 dark:text-slate-100">{branch.name}</span>
        </div>
      ),
    },
    {
      key: "address",
      header: t("address"),
      hideOnMobile: true,
      render: (branch) => (
        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate max-w-[200px]">{branch.address}</span>
        </div>
      ),
    },
    {
      key: "phone",
      header: t("phone"),
      hideOnMobile: true,
      render: (branch) => (
        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          {formatPhoneNumber(branch.phone) || "-"}
        </div>
      ),
    },
    {
      key: "monthlyPayment",
      header: t("monthlyPaymentForBranch"),
      hideOnMobile: true,
      render: (branch) => (
        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
          <DollarSign className="h-3.5 w-3.5 shrink-0" />
          {formatCurrency(branch.monthlyPayment)}/oy
        </div>
      ),
    },
    {
      key: "admin",
      header: t("admin"),
      render: (branch) =>
        branch.adminId ? (
          <Badge variant="secondary">
            {users.find((u) => u.id === branch.adminId)?.fullName || branch.adminId}
          </Badge>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCreateBranchAdmin(branch.id)}
          >
            <Users className="h-3 w-3 mr-2" />
            {t("createAdmin")}
          </Button>
        ),
    },
    {
      key: "actions",
      header: t("actions"),
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (branch) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(branch)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(branch.id)}
            disabled={isDeleteLoading && deletingBranchId === branch.id}
          >
            {isDeleteLoading && deletingBranchId === branch.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 text-destructive" />
            )}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <div>
           <h1 className="text-display">{t("branches")}</h1>
           <p className="text-muted-foreground">
             {t("manageBranches")}
           </p>
         </div>
         <Dialog open={isDialogOpen} onOpenChange={(open) => {
           setIsDialogOpen(open);
           if (!open) resetForm();
         }}>
           <DialogTrigger asChild>
             <Button>
               <Plus className="mr-2 h-4 w-4" />
               {t("newBranch")}
             </Button>
           </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                  <DialogTitle>
                    {editingBranch ? t("editBranch") : t("addNewBranch")}
                  </DialogTitle>
                  <DialogDescription>
                    {t("branchInformation")}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">{t("branchName")} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Чилонзор филиали"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address">{t("address")} *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Тошкент ш., Чилонзор т., 12-кв, 34-уй"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone">{t("phone")} *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="monthlyPayment">{t("monthlyPaymentForBranch")} *</Label>
                   <Input
                     id="monthlyPayment"
                     type="number"
                     value={formData.monthlyPayment}
                     onChange={(e) => setFormData({ ...formData, monthlyPayment: parseInt(e.target.value) || 100000 })}
                     placeholder="500000"
                     step="500"
                     min="500"
                     required
                   />
                </div>
                </div>

                <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin mr-2" />
                      {editingBranch ? t("updating") : t("creating")}
                    </>
                  ) : (
                    t("save")
                  )}
                </Button>
                </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

          {/* Create Branch Admin Modal */}
          <Dialog open={isCreateAdminOpen} onOpenChange={(open) => { setIsCreateAdminOpen(open); if (!open) setAdminForm({ branchId: "", email: "", password: "", fullName: "" }); }}>
            <DialogContent className="max-w-md">
              <form onSubmit={(e) => { e.preventDefault(); handleCreateBranchAdminSubmit(e); }}>
                <DialogHeader>
                    <DialogTitle>{t("createAdmin")}</DialogTitle>
                    <DialogDescription>{t("createBranchAdminDescription")}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="adminFullName">{t("fullName")} *</Label>
                    <Input id="adminFullName" value={adminForm.fullName} onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })} required />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="adminEmail">{t("email")} *</Label>
                    <Input id="adminEmail" type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} required />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="adminPassword">{t("password")} *</Label>
                    <Input id="adminPassword" type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} required />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateAdminOpen(false)} disabled={isAdminSubmitting}>{t("cancel")}</Button>
                  <Button type="submit" disabled={isAdminSubmitting}>
                    {isAdminSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin mr-2" />
                        {t("creating")}
                      </>
                    ) : (
                      t("create")
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable<Branch>
            columns={columns}
            data={branches}
            loading={loading}
            skeletonRows={6}
            emptyIcon={Building2}
            emptyTitle={t("branchesNotFound")}
            emptyDescription={t("createFirstBranch")}
            emptyAction={{ label: t("newBranch"), onClick: () => setIsDialogOpen(true) }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
