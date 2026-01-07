
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import * as api from "@/lib/api";
import { Branch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { Plus, Building2, MapPin, Phone, Edit, Trash2, Users, DollarSign } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { useRouter } from "next/router";
import { Badge } from "@/components/ui/badge";
import { formatPhoneNumber } from "@/lib/utils";
import { useBranch } from "@/context/BranchContext";

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
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
      const branchList = await api.listBranches();
      setBranches(branchList);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load branches:", error);
      toast({
        title: t("error"),
        description: t("failedToLoadBranches") || "Failed to load branches",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.address || !formData.phone) {
      toast({
        title: t("error"),
        description: t("fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    if (formData.monthlyPayment <= 0) {
      toast({
        title: t("error"),
        description: "Monthly payment must be greater than 0",
        variant: "destructive",
      });
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
        description: t("failedToSaveBranch") || "Failed to save branch",
        variant: "destructive",
      });
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

    const { branchId, email, password, fullName } = adminForm;
    if (!email || !password || !fullName) {
      toast({
        title: t("error"),
        description: t("fillAllFields"),
        variant: "destructive",
      });
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
    }
  };

  if (loading) {
    return (
      
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      
    );
  }

  return (
    
      <div className="space-y-6">
        <div className="flex justify-between items-center">
           <div>
             <h1 className="text-3xl font-bold tracking-tight">{t("branches")}</h1>
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
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t("cancel")}
                  </Button>
                  <Button type="submit">
                    {t("save")}
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
                    <Button type="button" variant="outline" onClick={() => setIsCreateAdminOpen(false)}>{t("cancel")}</Button>
                    <Button type="submit">{t("create")}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
        </div>

        {branches.length === 0 ? (
           <Card>
             <CardContent className="flex flex-col items-center justify-center py-12">
               <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
               <p className="text-lg font-medium mb-2">{t("branchesNotFound")}</p>
               <p className="text-sm text-muted-foreground mb-4">
                 {t("createFirstBranch")}
               </p>
             </CardContent>
           </Card>
         ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => {
              return (
                <Card key={branch.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{branch.name}</CardTitle>
                      </div>
                      <div className="flex gap-2">
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
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4" />
                          {branch.address}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4" />
                          {formatPhoneNumber(branch.phone)}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="h-4 w-4" />
                          {branch.monthlyPayment.toLocaleString()} UZS/ой
                        </div>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">{t("admin")}</Label>
                        {branch.adminId ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">{branch.adminId}</Badge>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1 w-full"
                            onClick={() => handleCreateBranchAdmin(branch.id)}
                          >
                            <Users className="h-3 w-3 mr-2" />
                            {t("createAdmin")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    
  );
}
