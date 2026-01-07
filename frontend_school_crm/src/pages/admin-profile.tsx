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
  MapPin,
  Calendar,
  Shield,
  Building2,
  User,
  LogOut,
  ArrowLeft,
  Edit2,
} from "lucide-react";
import { getCurrentUser, logout, hasPermission } from "@/lib/auth";
import { User as UserType } from "@/types";
import { getTranslation } from "@/lib/translations";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";

export default function AdminProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: "",
    email: "",
  });
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

    // Redirect if not admin
    if (!currentUser || currentUser.role !== "admin") {
      router.push("/");
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
    if (user) {
      setEditFormData({
        fullName: user.fullName || "",
        email: user.email || "",
      });
      setFormErrors({});
      setIsEditModalOpen(true);
    }
  };

  const openPasswordModal = () => {
    setPasswordFormData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setFormErrors({});
    setIsPasswordModalOpen(true);
  };

  const validateEditForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!editFormData.fullName.trim()) {
      errors.fullName = t("fullNameRequired") || "Full name is required";
    }

    if (!editFormData.email.trim()) {
      errors.email = t("emailRequired") || "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email)) {
      errors.email = t("invalidEmail") || "Invalid email format";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePasswordForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!passwordFormData.currentPassword.trim()) {
      errors.currentPassword =
        t("currentPasswordRequired") || "Current password is required";
    }

    if (!passwordFormData.newPassword.trim()) {
      errors.newPassword =
        t("newPasswordRequired") || "New password is required";
    } else if (passwordFormData.newPassword.length < 6) {
      errors.newPassword =
        t("passwordTooShort") || "Password must be at least 6 characters";
    }

    if (!passwordFormData.confirmPassword.trim()) {
      errors.confirmPassword =
        t("confirmPasswordRequired") || "Confirm password is required";
    } else if (
      passwordFormData.newPassword !== passwordFormData.confirmPassword
    ) {
      errors.confirmPassword =
        t("passwordMismatch") || "Passwords do not match";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateProfile = async () => {
    if (!validateEditForm()) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      if (!token || !user) {
        throw new Error("No authentication token found. Please login again.");
      }

      const updatePayload: any = {
        full_name: editFormData.fullName,
        email: editFormData.email,
      };

      console.log("Update payload:", updatePayload);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatePayload),
        }
      );

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        let errorMessage = t("updateFailed") || "Failed to update profile";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      if (!responseText) {
        throw new Error(t("emptyResponse") || "Empty response from server");
      }

      let updatedUser;
      try {
        updatedUser = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse response:", responseText);
        throw new Error(t("invalidResponse") || "Invalid response from server");
      }
      setUser(updatedUser);
      localStorage.setItem("school_auth_user", JSON.stringify(updatedUser));

      // Dispatch event to notify Layout component to update user data
      window.dispatchEvent(
        new CustomEvent("userProfileUpdated", { detail: updatedUser })
      );

      setIsEditModalOpen(false);
      setEditFormData({
        fullName: "",
        email: "",
      });

      toast({
        title: t("profileUpdated") || "Success",
        description:
          t("profileUpdatedDescription") ||
          "Your profile has been updated successfully.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      setFormErrors({
        submit:
          (error as Error).message || t("updateError") || "An error occurred",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!validatePasswordForm()) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      if (!token || !user) {
        throw new Error("No authentication token found. Please login again.");
      }

      const updatePayload = {
        current_password: passwordFormData.currentPassword,
        password: passwordFormData.newPassword,
      };

      console.log("Password change payload:", updatePayload);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatePayload),
        }
      );

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        let errorMessage = t("updateFailed") || "Failed to change password";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      setIsPasswordModalOpen(false);
      setPasswordFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      toast({
        title: t("passwordUpdated") || "Success",
        description:
          t("passwordUpdatedDescription") ||
          "Your password has been changed successfully.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error changing password:", error);
      setFormErrors({
        submit:
          (error as Error).message || t("updateError") || "An error occurred",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "branch_admin":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "manager":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("uz-UZ", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
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
            {t("adminProfile") || "Admin Profile"}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t("viewAdminDetails") || "View and manage admin account details"}
          </p>
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Picture and Basic Info */}
        <Card className="md:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white font-bold text-3xl mb-4 shadow-lg">
                {user.fullName.charAt(0)}
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {user.fullName}
              </h2>
              <Badge className={`mt-3 ${getRoleColor(user.role)}`}>
                {user.role.replace("_", " ").toUpperCase()}
              </Badge>
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg w-full">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("role") || "Role"}
                </p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  System Administrator
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {t("contactInformation") || "Contact Information"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <Mail className="w-5 h-5 text-slate-600 dark:text-slate-400 flex-shrink-0 mt-1" />
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("emailAddress") || "Email Address"}
                </p>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {user.email || "Not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Shield className="w-5 h-5 text-slate-600 dark:text-slate-400 flex-shrink-0 mt-1" />
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t("accountStatus") || "Account Status"}
                </p>
                <p className="font-medium text-green-600 dark:text-green-400">
                  Active
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {t("accountDetails") || "Account Details"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("userId") || "User ID"}
              </p>
              <p className="font-mono font-semibold text-slate-900 dark:text-slate-100 break-all">
                {user.id}
              </p>
            </div>

            <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("fullName") || "Full Name"}
              </p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {user.fullName}
              </p>
            </div>

            <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {t("createdDate") || "Created Date"}
              </p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {formatDate(user.createdAt)}
              </p>
            </div>

            <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {t("createdDate") || "Created Date"}
              </p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {formatDate(user.createdAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t("permissions") || "Permissions"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              "canManageUsers",
              "canManageBranches",
              "canManageClasses",
              "canManageStudents",
              "canManageTeachers",
              "canViewReports",
              "canManagePayments",
              "canManageSalaries",
              "canManageExpenses",
              "canManageSettings",
            ].map((permission) => (
              <div
                key={permission}
                className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg"
              >
                <Shield className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {t(permission) || permission}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {t("granted") || "Granted"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4 flex-wrap">
        <Button variant="outline" className="flex-1" onClick={openEditModal}>
          <Edit2 className="w-4 h-4 mr-2" />
          {t("editProfile") || "Edit Profile"}
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={openPasswordModal}
        >
          <Shield className="w-4 h-4 mr-2" />
          {t("changePassword") || "Change Password"}
        </Button>
        <Button variant="destructive" className="flex-1" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          {t("logout")}
        </Button>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editProfile") || "Edit Profile"}</DialogTitle>
            <DialogDescription>
              {t("updateProfileInfo") ||
                "Update your profile information"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {formErrors.submit && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 p-3 rounded-lg text-sm">
                {formErrors.submit}
              </div>
            )}

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("fullName") || "Full Name"}</Label>
              <Input
                id="fullName"
                type="text"
                placeholder={t("enterFullName") || "Enter full name"}
                value={editFormData.fullName}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    fullName: e.target.value,
                  })
                }
                className={
                  formErrors.fullName
                    ? "border-red-500 focus:border-red-500"
                    : ""
                }
              />
              {formErrors.fullName && (
                <p className="text-red-500 text-sm">{formErrors.fullName}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">
                {t("emailAddress") || "Email Address"}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t("enterEmail") || "Enter email"}
                value={editFormData.email}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    email: e.target.value,
                  })
                }
                className={
                  formErrors.email ? "border-red-500 focus:border-red-500" : ""
                }
              />
              {formErrors.email && (
                <p className="text-red-500 text-sm">{formErrors.email}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSaving}
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button
              onClick={handleUpdateProfile}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? t("saving") || "Saving..." : t("save") || "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("changePassword") || "Change Password"}
            </DialogTitle>
            <DialogDescription>
              {t("changePasswordDescription") ||
                "Enter your current password and new password"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {formErrors.submit && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 p-3 rounded-lg text-sm">
                {formErrors.submit}
              </div>
            )}

            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">
                {t("currentPassword") || "Current Password"}
              </Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder={
                  t("enterCurrentPassword") || "Enter current password"
                }
                value={passwordFormData.currentPassword}
                onChange={(e) =>
                  setPasswordFormData({
                    ...passwordFormData,
                    currentPassword: e.target.value,
                  })
                }
                className={
                  formErrors.currentPassword
                    ? "border-red-500 focus:border-red-500"
                    : ""
                }
              />
              {formErrors.currentPassword && (
                <p className="text-red-500 text-sm">
                  {formErrors.currentPassword}
                </p>
              )}
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">
                {t("newPassword") || "New Password"}
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder={t("enterNewPassword") || "Enter new password"}
                value={passwordFormData.newPassword}
                onChange={(e) =>
                  setPasswordFormData({
                    ...passwordFormData,
                    newPassword: e.target.value,
                  })
                }
                className={
                  formErrors.newPassword
                    ? "border-red-500 focus:border-red-500"
                    : ""
                }
              />
              {formErrors.newPassword && (
                <p className="text-red-500 text-sm">{formErrors.newPassword}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">
                {t("confirmPassword") || "Confirm Password"}
              </Label>
              <Input
                id="confirmNewPassword"
                type="password"
                placeholder={t("confirmPassword") || "Confirm password"}
                value={passwordFormData.confirmPassword}
                onChange={(e) =>
                  setPasswordFormData({
                    ...passwordFormData,
                    confirmPassword: e.target.value,
                  })
                }
                className={
                  formErrors.confirmPassword
                    ? "border-red-500 focus:border-red-500"
                    : ""
                }
              />
              {formErrors.confirmPassword && (
                <p className="text-red-500 text-sm">
                  {formErrors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPasswordModalOpen(false)}
              disabled={isSaving}
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving
                ? t("updating") || "Updating..."
                : t("updatePassword") || "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
