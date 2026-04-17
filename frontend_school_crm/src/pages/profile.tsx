import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Mail,
  Calendar,
  Shield,
  User,
  LogOut,
  ArrowLeft,
  Edit2,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { getCurrentUser, logout } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { User as UserType } from "@/types";
import { getTranslation } from "@/lib/translations";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";

const ROLE_CONFIG: Record<string, { color: string; avatar: string; label: string; description: string }> = {
  admin: {
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    avatar: "from-red-500 to-pink-600",
    label: "Admin",
    description: "Full system access — manages all branches and data",
  },
  branch_admin: {
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    avatar: "from-orange-500 to-amber-500",
    label: "Branch Admin",
    description: "Full access within your branch",
  },
  manager: {
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    avatar: "from-blue-500 to-indigo-600",
    label: "Manager",
    description: "Manages students, payments and classes",
  },
  accountant: {
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    avatar: "from-purple-500 to-violet-600",
    label: "Accountant",
    description: "Manages payments, salaries and expenses",
  },
  teacher: {
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    avatar: "from-emerald-500 to-teal-500",
    label: "Teacher",
    description: "Access to your classes and students",
  },
};

const PERMISSION_LABELS: Partial<Record<string, string>> = {
  canViewStudents: "View Students",
  canCreateStudents: "Create Students",
  canEditStudents: "Edit Students",
  canDeleteStudents: "Delete Students",
  canViewTeachers: "View Teachers",
  canCreateTeachers: "Create Teachers",
  canEditTeachers: "Edit Teachers",
  canDeleteTeachers: "Delete Teachers",
  canViewPayments: "View Payments",
  canCreatePayments: "Create Payments",
  canEditPayments: "Edit Payments",
  canDeletePayments: "Delete Payments",
  canViewSalaries: "View Salaries",
  canManageSalaries: "Manage Salaries",
  canViewExpenses: "View Expenses",
  canManageExpenses: "Manage Expenses",
  canViewReports: "View Reports",
  canManageBranches: "Manage Branches",
  canManageUsers: "Manage Users",
  canViewSettings: "View Settings",
  canEditSettings: "Edit Settings",
};

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState({ fullName: "", email: "" });
  const [passwordFormData, setPasswordFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setUser(currentUser);
    setIsLoading(false);
  }, [router]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const openEditModal = () => {
    if (!user) return;
    setEditFormData({ fullName: user.fullName || "", email: user.email || "" });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const openPasswordModal = () => {
    setPasswordFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setFormErrors({});
    setIsPasswordModalOpen(true);
  };

  const validateEditForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!editFormData.fullName.trim())
      errors.fullName = t("fullNameRequired") || "Full name is required";
    if (!editFormData.email.trim())
      errors.email = t("emailRequired") || "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email))
      errors.email = t("invalidEmail") || "Invalid email format";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePasswordForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!passwordFormData.currentPassword.trim())
      errors.currentPassword = t("currentPasswordRequired") || "Current password is required";
    if (!passwordFormData.newPassword.trim())
      errors.newPassword = t("newPasswordRequired") || "New password is required";
    else if (passwordFormData.newPassword.length < 6)
      errors.newPassword = t("passwordTooShort") || "Password must be at least 6 characters";
    if (!passwordFormData.confirmPassword.trim())
      errors.confirmPassword = t("confirmPasswordRequired") || "Confirm password is required";
    else if (passwordFormData.newPassword !== passwordFormData.confirmPassword)
      errors.confirmPassword = t("passwordMismatch") || "Passwords do not match";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /** Sync updated user object to both localStorage keys used across the app */
  const syncUserToLocalStorage = (updatedUser: UserType) => {
    const json = JSON.stringify(updatedUser);
    localStorage.setItem("current_user", json);
    localStorage.setItem("school_auth_user", json);
    window.dispatchEvent(new CustomEvent("userProfileUpdated", { detail: updatedUser }));
  };

  const handleUpdateProfile = async () => {
    if (!validateEditForm() || !user) return;
    setIsSaving(true);
    try {
      const updatedUser = await apiRequest<UserType>(`/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          full_name: editFormData.fullName,
          email: editFormData.email,
        }),
      });
      setUser(updatedUser);
      syncUserToLocalStorage(updatedUser);
      setIsEditModalOpen(false);
      toast({
        title: t("profileUpdated") || "Profile updated",
        description: t("profileUpdatedDescription") || "Your profile has been updated successfully.",
        variant: "default",
      });
    } catch (error) {
      setFormErrors({ submit: (error as Error).message || t("updateError") || "An error occurred" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!validatePasswordForm() || !user) return;
    setIsSaving(true);
    try {
      await apiRequest(`/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          current_password: passwordFormData.currentPassword,
          password: passwordFormData.newPassword,
        }),
      });
      setIsPasswordModalOpen(false);
      setPasswordFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({
        title: t("passwordUpdated") || "Password updated",
        description: t("passwordUpdatedDescription") || "Your password has been changed successfully.",
        variant: "default",
      });
    } catch (error) {
      setFormErrors({ submit: (error as Error).message || t("updateError") || "An error occurred" });
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("uz-UZ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 md:col-span-2" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!user) return null;

  const roleConfig = ROLE_CONFIG[user.role] ?? ROLE_CONFIG["manager"]!;
  const permissions = user.permissions ?? {};
  const grantedPermissions = Object.entries(permissions).filter(([, v]) => v);
  const deniedPermissions = Object.entries(permissions).filter(([, v]) => !v);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {t("myProfile") || "My Profile"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t("viewAndManageProfile") || "View and manage your account"}
          </p>
        </div>
      </div>

      {/* Profile card + contact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Avatar + role */}
        <Card className="md:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-24 h-24 rounded-full bg-gradient-to-br ${roleConfig.avatar} flex items-center justify-center text-white font-bold text-3xl mb-4 shadow-lg`}
              >
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {user.fullName}
              </h2>
              <Badge className={`mt-2 ${roleConfig.color}`}>
                {roleConfig.label}
              </Badge>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                {roleConfig.description}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact + account details */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {t("accountDetails") || "Account Details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <Mail className="w-5 h-5 text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("emailAddress") || "Email"}</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{user.email || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <Shield className="w-5 h-5 text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("role") || "Role"}</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{roleConfig.label}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("memberSince") || "Member since"}</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{formatDate(user.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Permissions */}
      {Object.keys(permissions).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {t("permissions") || "Permissions"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {grantedPermissions.map(([key]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg"
                >
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {PERMISSION_LABELS[key] ?? key}
                  </p>
                </div>
              ))}
              {deniedPermissions.map(([key]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg opacity-50"
                >
                  <XCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {PERMISSION_LABELS[key] ?? key}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" onClick={openEditModal}>
          <Edit2 className="w-4 h-4 mr-2" />
          {t("editProfile") || "Edit Profile"}
        </Button>
        <Button variant="outline" onClick={openPasswordModal}>
          <Shield className="w-4 h-4 mr-2" />
          {t("changePassword") || "Change Password"}
        </Button>
        <Button variant="destructive" onClick={handleLogout} className="ml-auto">
          <LogOut className="w-4 h-4 mr-2" />
          {t("logout")}
        </Button>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editProfile") || "Edit Profile"}</DialogTitle>
            <DialogDescription>
              {t("updateProfileInfo") || "Update your profile information"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formErrors.submit && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 p-3 rounded-lg text-sm">
                {formErrors.submit}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("fullName") || "Full Name"}</Label>
              <Input
                id="fullName"
                value={editFormData.fullName}
                onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                className={formErrors.fullName ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {formErrors.fullName && <p className="text-xs text-red-500">{formErrors.fullName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailAddress") || "Email"}</Label>
              <Input
                id="email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className={formErrors.email ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={isSaving}>
              {t("cancel")}
            </Button>
            <Button onClick={handleUpdateProfile} disabled={isSaving}>
              {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("saving")}</> : t("save") || "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("changePassword") || "Change Password"}</DialogTitle>
            <DialogDescription>
              {t("changePasswordDescription") || "Enter your current password and a new password"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formErrors.submit && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 p-3 rounded-lg text-sm">
                {formErrors.submit}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t("currentPassword") || "Current Password"}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordFormData.currentPassword}
                onChange={(e) => setPasswordFormData({ ...passwordFormData, currentPassword: e.target.value })}
                className={formErrors.currentPassword ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {formErrors.currentPassword && <p className="text-xs text-red-500">{formErrors.currentPassword}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("newPassword") || "New Password"}</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordFormData.newPassword}
                onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                className={formErrors.newPassword ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {formErrors.newPassword && <p className="text-xs text-red-500">{formErrors.newPassword}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">{t("confirmPassword") || "Confirm Password"}</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={passwordFormData.confirmPassword}
                onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                className={formErrors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {formErrors.confirmPassword && <p className="text-xs text-red-500">{formErrors.confirmPassword}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordModalOpen(false)} disabled={isSaving}>
              {t("cancel")}
            </Button>
            <Button onClick={handleChangePassword} disabled={isSaving}>
              {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("updating")}</> : t("updatePassword") || "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
