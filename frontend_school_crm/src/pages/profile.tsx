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
  Monitor,
} from "lucide-react";
import { getCurrentUser, logout } from "@/lib/auth";
import { setStoredUser } from "@/lib/storage";
import { apiRequest, getAuthToken, listSessions, revokeSession, UserSession } from "@/lib/api";
import { User as UserType } from "@/types";
import { getTranslation } from "@/lib/translations";
import { useLanguage } from "@/hooks/use-language";
import { useNotify } from "@/hooks/use-notify";

const ROLE_CONFIG: Record<string, { color: string; avatar: string; labelKey: string; descKey: string }> = {
  admin:        { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",              avatar: "from-red-500 to-pink-600",        labelKey: "admin",       descKey: "adminRoleDesc" },
  branch_admin: { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", avatar: "from-orange-500 to-amber-500",    labelKey: "branchAdmin", descKey: "branchAdminRoleDesc" },
  manager:      { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",          avatar: "from-blue-500 to-indigo-600",     labelKey: "manager",     descKey: "managerRoleDesc" },
  accountant:   { color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", avatar: "from-purple-500 to-violet-600",   labelKey: "accountant",  descKey: "accountantRoleDesc" },
  teacher:      { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",      avatar: "from-emerald-500 to-teal-500",   labelKey: "teacher",     descKey: "teacherRoleDesc" },
};

const PERMISSION_LABEL_KEYS: Partial<Record<string, string>> = {
  canViewStudents:    "permViewStudents",
  canCreateStudents:  "permCreateStudents",
  canEditStudents:    "permEditStudents",
  canDeleteStudents:  "permDeleteStudents",
  canViewTeachers:    "permViewTeachers",
  canCreateTeachers:  "permCreateTeachers",
  canEditTeachers:    "permEditTeachers",
  canDeleteTeachers:  "permDeleteTeachers",
  canViewPayments:    "permViewPayments",
  canCreatePayments:  "permCreatePayments",
  canEditPayments:    "permEditPayments",
  canDeletePayments:  "permDeletePayments",
  canViewSalaries:    "permViewSalaries",
  canManageSalaries:  "permManageSalaries",
  canViewExpenses:    "permViewExpenses",
  canManageExpenses:  "permManageExpenses",
  canViewReports:     "permViewReports",
  canManageBranches:  "permManageBranches",
  canManageUsers:     "permManageUsers",
  canViewSettings:    "permViewSettings",
  canEditSettings:    "permEditSettings",
};

/** Decodes the "sid" claim out of a JWT without verifying it — used only to
 * highlight which session row belongs to the browser the user is currently
 * looking at. The token is already trusted (it's this browser's own). */
function decodeSessionId(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json).sid ?? null;
  } catch {
    return null;
  }
}

/** Turns a raw User-Agent string into a short human-readable label. */
function formatUserAgent(ua: string): string {
  if (!ua) return "Unknown device";
  let os = "Unknown OS";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Unknown browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  return `${browser} · ${os}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const notify = useNotify();
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<UserSession | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
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
    setCurrentSessionId(decodeSessionId(getAuthToken()));

    listSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, [router]);

  const handleRevokeSession = async () => {
    if (!revokeTarget) return;
    setIsRevoking(true);
    try {
      await revokeSession(revokeTarget.id);
      setSessions((prev) => prev.filter((s) => s.id !== revokeTarget.id));
      notify.success(t("signOut"), t("signOutDeviceConfirm"));
      if (revokeTarget.id === currentSessionId) {
        logout();
      }
    } catch (error) {
      notify.error(t("error"), (error as Error).message || t("updateError"));
    } finally {
      setIsRevoking(false);
      setRevokeTarget(null);
    }
  };

  const handleLogout = () => {
    // logout() performs a hard navigation to /login.
    logout();
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
      errors.fullName = t("fullNameRequired");
    if (!editFormData.email.trim())
      errors.email = t("emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email))
      errors.email = t("invalidEmail");
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePasswordForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!passwordFormData.currentPassword.trim())
      errors.currentPassword = t("currentPasswordRequired");
    if (!passwordFormData.newPassword.trim())
      errors.newPassword = t("newPasswordRequired");
    else if (passwordFormData.newPassword.length < 6)
      errors.newPassword = t("passwordTooShort");
    if (!passwordFormData.confirmPassword.trim())
      errors.confirmPassword = t("confirmPasswordRequired");
    else if (passwordFormData.newPassword !== passwordFormData.confirmPassword)
      errors.confirmPassword = t("passwordMismatch");
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /** Persist updated user via the canonical storage helper, then broadcast. */
  const syncUserToLocalStorage = (updatedUser: UserType) => {
    setStoredUser(updatedUser as unknown as Parameters<typeof setStoredUser>[0]);
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
      notify.success(t("profileUpdated"), t("profileUpdatedDescription"));
    } catch (error) {
      setFormErrors({ submit: (error as Error).message || t("updateError") });
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
      notify.success(t("passwordUpdated"), t("passwordUpdatedDescription"));
    } catch (error) {
      setFormErrors({ submit: (error as Error).message || t("updateError") });
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
          <h1 className="text-display text-slate-900 dark:text-slate-100">
            {t("myProfile")}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t("viewAndManageProfile")}
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
                {t(roleConfig.labelKey as any) || roleConfig.labelKey}
              </Badge>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                {t(roleConfig.descKey as any) || roleConfig.descKey}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact + account details */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {t("accountDetails")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <Mail className="w-5 h-5 text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("emailAddress")}</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{user.email || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <Shield className="w-5 h-5 text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("role")}</p>
                <p className="font-medium text-slate-900 dark:text-slate-100">{t(roleConfig.labelKey as any) || roleConfig.labelKey}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("memberSince")}</p>
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
              {t("permissions")}
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
                    {t((PERMISSION_LABEL_KEYS[key] ?? key) as any) || PERMISSION_LABEL_KEYS[key] || key}
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
                    {t((PERMISSION_LABEL_KEYS[key] ?? key) as any) || PERMISSION_LABEL_KEYS[key] || key}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            {t("activeSessions")}
          </CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("activeSessionsDesc")}</p>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("noActiveSessions")}</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center gap-4 p-3 border border-slate-200 dark:border-slate-800 rounded-lg"
                >
                  <Monitor className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {formatUserAgent(session.userAgent)}
                      </p>
                      {session.id === currentSessionId && (
                        <Badge variant="secondary" className="text-xs">
                          {t("thisDevice")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {session.ipAddress || "—"} · {formatDate(session.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/20 flex-shrink-0"
                    onClick={() => setRevokeTarget(session)}
                  >
                    {t("signOut")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" onClick={openEditModal}>
          <Edit2 className="w-4 h-4 mr-2" />
          {t("editProfile")}
        </Button>
        <Button variant="outline" onClick={openPasswordModal}>
          <Shield className="w-4 h-4 mr-2" />
          {t("changePassword")}
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
            <DialogTitle>{t("editProfile")}</DialogTitle>
            <DialogDescription>
              {t("updateProfileInfo")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formErrors.submit && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 p-3 rounded-lg text-sm">
                {formErrors.submit}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("fullName")}</Label>
              <Input
                id="fullName"
                value={editFormData.fullName}
                onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                className={formErrors.fullName ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {formErrors.fullName && <p className="text-xs text-red-500">{formErrors.fullName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailAddress")}</Label>
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
              {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("saving")}</> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("changePassword")}</DialogTitle>
            <DialogDescription>
              {t("changePasswordDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {formErrors.submit && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 p-3 rounded-lg text-sm">
                {formErrors.submit}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
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
              <Label htmlFor="newPassword">{t("newPassword")}</Label>
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
              <Label htmlFor="confirmNewPassword">{t("confirmPassword")}</Label>
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
              {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("updating")}</> : t("updatePassword")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Session Confirmation */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("signOut")}</DialogTitle>
            <DialogDescription>{t("signOutDeviceConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)} disabled={isRevoking}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleRevokeSession} disabled={isRevoking}>
              {isRevoking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t("signOut")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
