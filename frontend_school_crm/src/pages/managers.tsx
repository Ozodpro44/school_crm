import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { listUsers, deleteUser as deleteUserAPI, listBranches, getAuthToken, updateUserPermissions } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { User, Permission, Branch } from "@/types";
import { Plus, Edit2, Trash2, Shield, UserCog, Lock, Loader2 } from "lucide-react";
import { getTranslation } from "@/lib/translations";
import { updateUserPassword } from "@/lib/auth";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { useBranch } from "@/context/BranchContext";

export default function ManagersPage() {
  const [isLoading, setIsLoading] = useState(true);
   const [managers, setManagers] = useState<User[]>([]);
   const [branches, setBranches] = useState<Branch[]>([]);
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
   const [editingManager, setEditingManager] = useState<User | null>(null);
   const [passwordData, setPasswordData] = useState({
     newPassword: "",
     confirmPassword: "",
   });
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isDeleteLoading, setIsDeleteLoading] = useState(false);
   const [deletingManagerId, setDeletingManagerId] = useState<string | null>(null);
   const [isBulkDeleteLoading, setIsBulkDeleteLoading] = useState(false);
   const language = useLanguage();
     const { toast } = useToast();
     const { currentBranch } = useBranch();
     const {
       toggleSelect,
       toggleSelectAll,
       clearSelection,
       isSelected,
       getSelectedCount,
       getSelectedIds,
       areAllSelected,
       areSomeSelected,
     } = useMultiSelect<User>();

   const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    branchId: "",
  });

  const [permissions, setPermissions] = useState<Permission>({
    canViewStudents: true,
    canCreateStudents: false,
    canEditStudents: false,
    canDeleteStudents: false,
    canViewTeachers: true,
    canCreateTeachers: false,
    canEditTeachers: false,
    canDeleteTeachers: false,
    canViewClasses: true,
    canCreateClasses: false,
    canEditClasses: false,
    canDeleteClasses: false,
    canViewPayments: true,
    canCreatePayments: false,
    canEditPayments: false,
    canDeletePayments: false,
    canViewSalaries: true,
    canCreateSalaries: false,
    canEditSalaries: false,
    canDeleteSalaries: false,
    canViewExpenses: true,
    canCreateExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,
    canViewReports: true,
    canViewSettings: false,
    canEditSettings: false,
  });

  const [originalPermissions, setOriginalPermissions] = useState<Permission | null>(null);

  useEffect(() => {
    setIsLoading(true);
    loadData().finally(() => setIsLoading(false));
  }, [currentBranch]);

  const loadData = async () => {
     const user = getCurrentUser();
     
     // If not authenticated, don't try to load data
     if (!user) {
       setManagers([]);
       setBranches([]);
       setIsLoading(false);
       return;
     }

     try {
       const allBranches = await listBranches();
       const branchId = currentBranch?.id || localStorage.getItem("selectedBranchId");
       
       // Transform API branches to include managerIds
       const transformedBranches = allBranches.map(branch => ({
         ...branch,
         managerIds: []
       }));
       
       if (!branchId) {
         setManagers([]);
         setBranches(transformedBranches);
         return;
       }

       // Fetch managers for the current branch from backend
       const branchManagers = await listUsers(branchId);
       
       // Filter to get only managers and branch_admins
       const filteredManagers = branchManagers.filter(u => 
         u.role === "manager" || u.role === "branch_admin"
       ).map(u => ({
         ...u,
         role: u.role as any,
         branchIds: [branchId]
       }));

       setManagers(filteredManagers as User[]);

       if (user?.role === "admin") {
         setBranches(transformedBranches);
       } else if (user?.role === "branch_admin") {
         const branch = transformedBranches.find(b => b.id === branchId);
         setBranches(branch ? [branch] : []);
       }
     } catch (error) {
       console.error("Failed to load managers:", error);
       toast({
         title: t("error"),
         description: t("failedToLoadManagers"),
         variant: "destructive",
       });
     } finally {
       setIsLoading(false);
     }
   };

  const t = (key: string) => getTranslation(key, language);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (editingManager) {
      try {
        // Update permissions via backend API
        // Convert Permission object to Record<string, boolean>
        const permissionsPayload: Record<string, boolean> = {};
        Object.entries(permissions).forEach(([key, value]) => {
          permissionsPayload[key] = value;
        });
        await updateUserPermissions(editingManager.id, permissionsPayload);
        toast({ title: t("permissionsUpdatedSuccess") || "Permissions updated successfully", variant: "success" });
        await loadData();
      } catch (error) {
        console.error("Failed to update permissions:", error);
        toast({ title: "Error", description: "Failed to update permissions", variant: "destructive" });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      try {
        if (!formData.fullName || !formData.email || !formData.password || !formData.branchId) {
          toast({ title: "Error", description: "Please fill in all required fields including branch", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }
        
        // Create user with branchId
        const userData = {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          role: "manager",
          branchId: formData.branchId,
        };
        
        // Get auth token
        const token = getAuthToken();
        
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        // API call will handle adding to branch_managers table
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'}/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(userData),
        });
        
        let responseData;
        try {
          responseData = await response.json();
        } catch (e) {
          console.error("Failed to parse response:", e);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        
        if (!response.ok) {
          const errorMsg = responseData?.error || responseData?.message || `Server error: ${response.status}`;
          console.error("Manager creation failed:", errorMsg, responseData);
          throw new Error(errorMsg);
        }
        
        toast({ title: t("success") || "Success", description: "Manager created successfully", variant: "success" });
        await loadData();
        } catch (error) {
        console.error("Failed to create manager:", error);
        toast({ title: "Error", description: "Failed to create manager", variant: "destructive" });
        } finally {
        setIsSubmitting(false);
        }
        }

        resetForm();
        setIsDialogOpen(false);
  };

  const handleEdit = (manager: User) => {
    setEditingManager(manager);
    setFormData({
      fullName: manager.fullName,
      email: manager.email,
      password: "",
      branchId: currentBranch?.id || localStorage.getItem("selectedBranchId") || "",
    });
    const perms = manager.permissions || getDefaultPermissions();
    setPermissions(perms);
    setOriginalPermissions(perms);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm(t("confirmDelete") || "Are you sure you want to delete this manager?")) {
      setDeletingManagerId(id);
      setIsDeleteLoading(true);
      try {
        await deleteUserAPI(id);
        await loadData();
        toast({ title: t("deleted") || "Deleted", description: t("managerDeleted") || "Manager deleted", variant: "success" });
      } catch (error) {
        console.error("Failed to delete manager:", error);
        toast({ title: "Error", description: "Failed to delete manager", variant: "destructive" });
      } finally {
        setIsDeleteLoading(false);
        setDeletingManagerId(null);
      }
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = getSelectedIds();
    if (selectedIds.length === 0) return;

    if (confirm(`${t("confirmDelete") || "Are you sure?"} (${selectedIds.length} ${t("items")})`)) {
      setIsBulkDeleteLoading(true);
      try {
        await Promise.all(selectedIds.map((id) => deleteUserAPI(id)));
        clearSelection();
        await loadData();
        toast({
          title: t("deleted"),
          description: `${selectedIds.length} ${t("managersDeleted") || "managers deleted"}`,
          variant: "success",
        });
      } catch (error) {
        console.error("Failed to delete managers:", error);
        toast({ title: "Error", description: "Failed to delete managers", variant: "destructive" });
      } finally {
        setIsBulkDeleteLoading(false);
      }
    }
  };

  const handleChangePassword = (manager: User) => {
    setEditingManager(manager);
    setPasswordData({
      newPassword: "",
      confirmPassword: "",
    });
    setIsPasswordDialogOpen(true);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: t("error") || "Error", description: t("passwordsDoNotMatch") || "Passwords do not match", variant: "destructive" });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({ title: t("error") || "Error", description: t("passwordMinLengthError") || "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    if (editingManager && updateUserPassword(editingManager.id, passwordData.newPassword)) {
      toast({ title: t("success") || "Success", description: t("passwordUpdatedSuccess") || "Password updated successfully", variant: "success" });
      setIsPasswordDialogOpen(false);
      setPasswordData({
        newPassword: "",
        confirmPassword: "",
      });
      setEditingManager(null);
    } else {
      toast({ title: t("error") || "Error", description: t("passwordUpdateError") || "Failed to update password", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: "",
      email: "",
      password: "",
      branchId: currentBranch?.id || "",
    });
    setPermissions(getDefaultPermissions());
    setOriginalPermissions(null);
    setEditingManager(null);
  };

  const getDefaultPermissions = (): Permission => ({
    canViewStudents: true,
    canCreateStudents: false,
    canEditStudents: false,
    canDeleteStudents: false,
    canViewTeachers: true,
    canCreateTeachers: false,
    canEditTeachers: false,
    canDeleteTeachers: false,
    canViewClasses: true,
    canCreateClasses: false,
    canEditClasses: false,
    canDeleteClasses: false,
    canViewPayments: true,
    canCreatePayments: false,
    canEditPayments: false,
    canDeletePayments: false,
    canViewSalaries: true,
    canCreateSalaries: false,
    canEditSalaries: false,
    canDeleteSalaries: false,
    canViewExpenses: true,
    canCreateExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,
    canViewReports: true,
    canViewSettings: false,
    canEditSettings: false,
  });

  const hasPermissionsChanged = (): boolean => {
    if (!editingManager || !originalPermissions) return false;
    return JSON.stringify(permissions) !== JSON.stringify(originalPermissions);
  };

  const updatePermission = (key: keyof Permission, value: boolean) => {
    setPermissions(prev => ({ ...prev, [key]: value }));
  };

  const getBranchName = (branchId?: string) => {
    if (!branchId) return "N/A";
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || "N/A";
  };

  const getManagerBranches = (manager: User) => {
    const branchIds = (manager as any).branchIds || [];
    if (branchIds.length === 0) return "N/A";
    const allBranches = branches;
    return branchIds
      .map(id => allBranches.find(b => b.id === id)?.name || "")
      .filter(name => name)
      .join(", ");
  };

  const permissionGroups = [
    {
      title: t("students"),
      permissions: [
        { key: "canViewStudents" as keyof Permission, label: t("canView") },
        { key: "canCreateStudents" as keyof Permission, label: t("canCreate") || "Create" },
        { key: "canEditStudents" as keyof Permission, label: t("canEdit") },
        { key: "canDeleteStudents" as keyof Permission, label: t("canDelete") },
      ],
    },
    {
      title: t("teachers"),
      permissions: [
        { key: "canViewTeachers" as keyof Permission, label: t("canView") },
        { key: "canCreateTeachers" as keyof Permission, label: t("canCreate") || "Create" },
        { key: "canEditTeachers" as keyof Permission, label: t("canEdit") },
        { key: "canDeleteTeachers" as keyof Permission, label: t("canDelete") },
      ],
    },
    {
      title: t("classes"),
      permissions: [
        { key: "canViewClasses" as keyof Permission, label: t("canView") },
        { key: "canCreateClasses" as keyof Permission, label: t("canCreate") || "Create" },
        { key: "canEditClasses" as keyof Permission, label: t("canEdit") },
        { key: "canDeleteClasses" as keyof Permission, label: t("canDelete") },
      ],
    },
    {
      title: t("payments"),
      permissions: [
        { key: "canViewPayments" as keyof Permission, label: t("canView") },
        { key: "canCreatePayments" as keyof Permission, label: t("canCreate") || "Create" },
        { key: "canEditPayments" as keyof Permission, label: t("canEdit") },
        { key: "canDeletePayments" as keyof Permission, label: t("canDelete") },
      ],
    },
    {
      title: t("salaries"),
      permissions: [
        { key: "canViewSalaries" as keyof Permission, label: t("canView") },
        { key: "canCreateSalaries" as keyof Permission, label: t("canCreate") || "Create" },
        { key: "canEditSalaries" as keyof Permission, label: t("canEdit") },
        { key: "canDeleteSalaries" as keyof Permission, label: t("canDelete") },
      ],
    },
    {
      title: t("expenses"),
      permissions: [
        { key: "canViewExpenses" as keyof Permission, label: t("canView") },
        { key: "canCreateExpenses" as keyof Permission, label: t("canCreate") || "Create" },
        { key: "canEditExpenses" as keyof Permission, label: t("canEdit") },
        { key: "canDeleteExpenses" as keyof Permission, label: t("canDelete") },
      ],
    },
    {
      title: t("reports"),
      permissions: [
        { key: "canViewReports" as keyof Permission, label: t("canView") },
      ],
    },
    {
      title: t("settings"),
      permissions: [
        { key: "canViewSettings" as keyof Permission, label: t("canView") },
        { key: "canEditSettings" as keyof Permission, label: t("canEdit") },
      ],
    },
  ];

  if (isLoading) {
    return (
      
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>

          {/* Action Button Skeleton */}
          <Skeleton className="h-10 w-32" />

          {/* Search Skeleton */}
          <Skeleton className="h-10 w-full sm:w-64" />

          {/* Table Skeleton */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-4 border-b">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </CardContent>
            </Card>

            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("changePassword")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t("newPassword")} *</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                    placeholder={t("enterNewPassword")}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("confirmPassword")} *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                    }
                    placeholder={t("confirmNewPassword")}
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPasswordDialogOpen(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button type="submit">
                    {t("updatePassword")}
                  </Button>
                </div>
              </form>
            </DialogContent>
            </Dialog>
            </div>
            
            );
            }

  return (
    
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {t("managers")}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {t("manageManagersPermissions")}
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                onClick={() => resetForm()}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("addManager")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingManager ? t("editManager") : t("addNewManager")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t("fullName")} *</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      required
                      disabled={!!editingManager}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{t("email")} *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                      disabled={!!editingManager}
                      autoComplete="off"
                    />
                  </div>

                  {!editingManager && (
                    <div className="space-y-2">
                      <Label htmlFor="password">{t("password")} *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required
                        autoComplete="new-password"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="branchId">{t("branch")} *</Label>
                    <Select
                      value={formData.branchId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, branchId: value })
                      }
                      required
                      disabled={!!editingManager}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectBranch")} />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!editingManager && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t("managerBranchNote") || "Menejer faqat tayinlangan filialini boshqara oladi"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    {t("permissions")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {permissionGroups.map((group) => (
                      <div key={group.title} className="space-y-3">
                        <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300">
                          {group.title}
                        </h4>
                        <div className="space-y-2 pl-4">
                          {group.permissions.map((perm) => (
                            <div key={perm.key} className="flex items-center space-x-2">
                              <Checkbox
                                id={perm.key}
                                checked={Boolean(permissions[perm.key])}
                                onCheckedChange={(checked) =>
                                  updatePermission(perm.key, checked as boolean)
                                }
                              />
                              <Label
                                htmlFor={perm.key}
                                className="text-sm cursor-pointer"
                              >
                                {perm.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                   <Button
                     type="button"
                     variant="outline"
                     onClick={() => setIsDialogOpen(false)}
                     disabled={isSubmitting}
                   >
                     {t("cancel")}
                   </Button>
                   <Button 
                     type="submit"
                     disabled={isSubmitting || (editingManager && !hasPermissionsChanged())}
                   >
                     {isSubmitting ? (
                       <>
                         <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin mr-2" />
                         {editingManager ? t("updating") : t("creating")}
                       </>
                     ) : (
                       editingManager ? t("update") : t("create")
                     )}
                   </Button>
                 </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className={`border-l-4 transition-all ${
          getSelectedCount() > 0
            ? "border-l-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-l-slate-300 dark:border-l-slate-600 bg-slate-50 dark:bg-slate-900/50 opacity-50"
        }`}>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {getSelectedCount()} {t("itemsSelected") || "items selected"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={getSelectedCount() === 0 || isBulkDeleteLoading}
              >
                {isBulkDeleteLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {t("deleting") || "Deleting..."}
                  </>
                ) : (
                  t("deleteSelected") || "Delete Selected"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={clearSelection}
                disabled={getSelectedCount() === 0}
              >
                {t("cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              {t("managersList")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-4">
                        <Checkbox
                          checked={areAllSelected(managers) || areSomeSelected(managers)}
                          onCheckedChange={() => toggleSelectAll(managers)}
                        />
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                        {t("name")}
                      </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("email")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("branch")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("role")}
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {managers.map((manager) => (
                    <tr
                      key={manager.id}
                      className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
                        isSelected(manager.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <Checkbox
                          checked={isSelected(manager.id)}
                          onCheckedChange={() => toggleSelect(manager.id)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {manager.fullName}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                        {manager.email}
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                         {getManagerBranches(manager)}
                       </td>
                      <td className="py-3 px-4">
                        <Badge className="capitalize">
                          {manager.role.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(manager)}
                            title={t("editPermissions")}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleChangePassword(manager)}
                            title={t("changePassword")}
                          >
                            <Lock className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(manager.id)}
                            title={t("delete")}
                            disabled={isDeleteLoading && deletingManagerId === manager.id}
                          >
                            {isDeleteLoading && deletingManagerId === manager.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-red-500" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {managers.length === 0 && (
                <div className="text-center py-12">
                  <UserCog className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">
                    {t("noManagersYet")}
                  </p>
                </div>
              )}
            </div>
            </CardContent>
            </Card>

            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
            <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("changePassword")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t("newPassword")} *</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                  }
                  placeholder={t("enterNewPassword")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("confirmPassword")} *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                  }
                  placeholder={t("confirmNewPassword")}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPasswordDialogOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit">
                  {t("updatePassword")}
                </Button>
              </div>
            </form>
            </DialogContent>
            </Dialog>
            </div>
            
            );
            }