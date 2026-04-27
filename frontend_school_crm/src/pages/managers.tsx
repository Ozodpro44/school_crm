import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
import { FormDialog } from "@/components/FormDialog";
import { Field } from "@/components/Field";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { listUsers, deleteUser as deleteUserAPI, listBranches, updateUserPermissions, apiRequest } from "@/lib/api";
import { useNotify } from "@/hooks/use-notify";
import { useLanguage } from "@/hooks/use-language";
import { User, Permission, Branch } from "@/types";
import { Plus, Edit2, Trash2, Shield, UserCog, Lock, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getTranslation } from "@/lib/translations";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { useBranch } from "@/context/BranchContext";
import { DataTable, Column } from "@/components/DataTable";

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
     const { currentBranch } = useBranch();
     const {
       selectedIds: selectedManagerIds,
       toggleSelect,
       toggleSelectAll,
       clearSelection,
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
    role: "manager" as "manager" | "branch_admin",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
       notify.error(t("error"), t("failedToLoadManagers"));
     } finally {
       setIsLoading(false);
     }
   };

  const t = (key: string) => getTranslation(key, language);
  const notify = useNotify();

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
        notify.success(t("permissionsUpdatedSuccess"));
        await loadData();
      } catch (error) {
        notify.error("Error", "Failed to update permissions");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Inline validation
      const errors: Record<string, string> = {};
      if (!formData.fullName.trim()) errors.fullName = t("fullNameRequired") || "Full name is required";
      if (!formData.email.trim()) {
        errors.email = t("emailRequired") || "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = t("invalidEmail") || "Invalid email format";
      }
      if (!formData.password) {
        errors.password = t("passwordRequired") || "Password is required";
      } else if (formData.password.length < 6) {
        errors.password = t("passwordTooShort") || "Password must be at least 6 characters";
      }
      if (!formData.branchId) errors.branchId = t("branchRequired") || "Branch is required";

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        setIsSubmitting(false);
        return;
      }
      setFormErrors({});

      try {
        await apiRequest("/users", {
          method: "POST",
          body: JSON.stringify({
            full_name: formData.fullName,
            email: formData.email,
            password: formData.password,
            role: formData.role,
            branchId: formData.branchId,
          }),
        });
        notify.success(t("success"), t("managerCreatedSuccess"));
        await loadData();
        resetForm();
        setIsDialogOpen(false);
      } catch (error) {
        notify.error(t("error"), (error as Error).message || t("failedToCreateManager") || "Failed to create manager");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleEdit = (manager: User) => {
    setEditingManager(manager);
    setFormData({
      fullName: manager.fullName,
      email: manager.email,
      password: "",
      branchId: currentBranch?.id || localStorage.getItem("selectedBranchId") || "",
      role: (manager.role as "manager" | "branch_admin") || "manager",
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
        notify.success(t("deleted"), t("managerDeleted"));
      } catch (error) {
        notify.error("Error", "Failed to delete manager");
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
        notify.success(t("deleted"), `${selectedIds.length} ${t("managersDeleted") || "managers deleted"}`);
      } catch (error) {
        notify.error("Error", "Failed to delete managers");
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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      notify.error(t("error"), t("passwordsDoNotMatch"));
      return;
    }

    if (passwordData.newPassword.length < 6) {
      notify.error(t("error"), t("passwordMinLengthError"));
      return;
    }

    if (!editingManager) return;

    setIsSubmitting(true);
    try {
      await apiRequest(`/users/${editingManager.id}`, {
        method: "PUT",
        body: JSON.stringify({ password: passwordData.newPassword }),
      });
      notify.success(t("success"), t("passwordUpdatedSuccess"));
      setIsPasswordDialogOpen(false);
      setPasswordData({ newPassword: "", confirmPassword: "" });
      setEditingManager(null);
    } catch {
      notify.error(t("error"), t("passwordUpdateError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: "",
      email: "",
      password: "",
      branchId: currentBranch?.id || "",
      role: "manager",
    });
    setFormErrors({});
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

  const getManagerBranches = (manager: User) => {
    const branchIds = ((manager as any).branchIds || []) as string[];
    if (branchIds.length === 0) return "N/A";
    return branchIds
      .map((id: string) => branches.find(b => b.id === id)?.name || "")
      .filter((name: string) => name)
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

  const columns: Column<User>[] = [
    {
      key: "fullName",
      header: t("name"),
      render: (manager) => (
        <p className="font-medium text-slate-900 dark:text-slate-100">{manager.fullName}</p>
      ),
    },
    {
      key: "email",
      header: t("email"),
      render: (manager) => (
        <span className="text-slate-900 dark:text-slate-100">{manager.email}</span>
      ),
    },
    {
      key: "branch",
      header: t("branch"),
      render: (manager) => (
        <span className="text-slate-900 dark:text-slate-100">{getManagerBranches(manager)}</span>
      ),
    },
    {
      key: "role",
      header: t("role"),
      render: (manager) => (
        <Badge className="capitalize">{manager.role.replace("_", " ")}</Badge>
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (manager) => (
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
      ),
    },
  ];

  const bulkActions = (
    <>
      <Button
        size="sm"
        variant="destructive"
        onClick={handleBulkDelete}
        disabled={isBulkDeleteLoading}
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
      <Button size="sm" variant="outline" onClick={clearSelection}>
        {t("cancel")}
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title={t("managers")} subtitle={t("manageManagersPermissions")} />

        <Button
          className="bg-brand hover:bg-brand-hover"
          onClick={() => { resetForm(); setIsDialogOpen(true); }}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("addManager")}
        </Button>

        <FormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          title={editingManager ? t("editManager") : t("addNewManager")}
          onSubmit={handleSubmit}
          submitLabel={editingManager ? t("update") : t("create")}
          submittingLabel={editingManager ? t("updating") : t("creating")}
          isPending={isSubmitting || !!(editingManager && !hasPermissionsChanged())}
          maxWidth="max-w-4xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              id="fullName"
              label={`${t("fullName")} *`}
              value={formData.fullName}
              error={formErrors.fullName}
              disabled={!!editingManager}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setFormData({ ...formData, fullName: e.target.value });
                if (formErrors.fullName) setFormErrors(prev => ({ ...prev, fullName: "" }));
              }}
            />

            <Field
              id="email"
              label={`${t("email")} *`}
              type="email"
              value={formData.email}
              error={formErrors.email}
              disabled={!!editingManager}
              autoComplete="off"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setFormData({ ...formData, email: e.target.value });
                if (formErrors.email) setFormErrors(prev => ({ ...prev, email: "" }));
              }}
            />

            {!editingManager && (
              <Field
                id="password"
                label={`${t("password")} *`}
                type="password"
                value={formData.password}
                error={formErrors.password}
                autoComplete="new-password"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (formErrors.password) setFormErrors(prev => ({ ...prev, password: "" }));
                }}
              />
            )}

            {!editingManager && (
              <div className="space-y-1.5">
                <Label htmlFor="role">{t("role") || "Role"} *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value as "manager" | "branch_admin" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">{t("manager") || "Manager"}</SelectItem>
                    <SelectItem value="branch_admin">{t("branchAdmin") || "Branch Admin"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="branchId">{t("branch")} *</Label>
              <Select
                value={formData.branchId}
                onValueChange={(value) => {
                  setFormData({ ...formData, branchId: value });
                  if (formErrors.branchId) setFormErrors(prev => ({ ...prev, branchId: "" }));
                }}
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
              {formErrors.branchId && <p className="text-xs text-red-500">{formErrors.branchId}</p>}
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
        </FormDialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataTable<User>
            columns={columns}
            data={managers}
            loading={isLoading}
            skeletonRows={5}
            selectable
            selectedIds={selectedManagerIds}
            onToggleSelect={(id) => toggleSelect(id)}
            onToggleSelectAll={() => toggleSelectAll(managers)}
            areAllSelected={areAllSelected(managers)}
            areSomeSelected={areSomeSelected(managers)}
            bulkActions={bulkActions}
            emptyIcon={UserCog}
            emptyTitle={t("noManagersYet") || "No managers yet"}
            emptyDescription="Add your first manager to let them access and oversee a branch."
            emptyAction={{ label: t("addManager") || "Add Manager", onClick: () => setIsDialogOpen(true) }}
          />
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
