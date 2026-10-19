import { User, UserRole, Permission } from "@/types";
import { clearAuthState, getStoredUser, setStoredUser } from "@/lib/storage";
import { getUserPermissions } from "@/lib/api";

const DEFAULT_PERMISSIONS: Record<UserRole, Permission> = {
  admin: {
    canViewStudents: true,
    canCreateStudents: true,
    canEditStudents: true,
    canDeleteStudents: true,
    canViewTeachers: true,
    canCreateTeachers: true,
    canEditTeachers: true,
    canDeleteTeachers: true,
    canViewClasses: true,
    canCreateClasses: true,
    canEditClasses: true,
    canDeleteClasses: true,
    canViewPayments: true,
    canCreatePayments: true,
    canEditPayments: true,
    canDeletePayments: true,
    canViewSalaries: true,
    canCreateSalaries: true,
    canEditSalaries: true,
    canDeleteSalaries: true,
    canViewExpenses: true,
    canCreateExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: true,
    canViewReports: true,
    canViewSettings: true,
    canEditSettings: true,
    canViewAttendance: true,
    canViewAssignments: true,
    canSendMessages: true,
  },
  branch_admin: {
    canViewStudents: true,
    canCreateStudents: true,
    canEditStudents: true,
    canDeleteStudents: true,
    canViewTeachers: true,
    canCreateTeachers: true,
    canEditTeachers: true,
    canDeleteTeachers: true,
    canViewClasses: true,
    canCreateClasses: true,
    canEditClasses: true,
    canDeleteClasses: true,
    canViewPayments: true,
    canCreatePayments: true,
    canEditPayments: true,
    canDeletePayments: true,
    canViewSalaries: true,
    canCreateSalaries: true,
    canEditSalaries: true,
    canDeleteSalaries: true,
    canViewExpenses: true,
    canCreateExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: true,
    canViewReports: true,
    canViewSettings: true,
    canEditSettings: true,
    canViewAttendance: true,
    canViewAssignments: true,
    canSendMessages: true,
  },
  manager: {
    canViewStudents: true,
    canCreateStudents: true,
    canEditStudents: true,
    canDeleteStudents: false,
    canViewTeachers: true,
    canCreateTeachers: true,
    canEditTeachers: true,
    canDeleteTeachers: false,
    canViewClasses: true,
    canCreateClasses: true,
    canEditClasses: true,
    canDeleteClasses: false,
    canViewPayments: true,
    canCreatePayments: true,
    canEditPayments: true,
    canDeletePayments: false,
    canViewSalaries: true,
    canCreateSalaries: true,
    canEditSalaries: true,
    canDeleteSalaries: false,
    canViewExpenses: true,
    canCreateExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: false,
    canViewReports: true,
    canViewSettings: false,
    canEditSettings: false,
    canViewAttendance: true,
    canViewAssignments: true,
    canSendMessages: true,
  },
  accountant: {
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
    canCreatePayments: true,
    canEditPayments: true,
    canDeletePayments: false,
    canViewSalaries: true,
    canCreateSalaries: true,
    canEditSalaries: true,
    canDeleteSalaries: false,
    canViewExpenses: true,
    canCreateExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: false,
    canViewReports: true,
    canViewSettings: false,
    canEditSettings: false,
    canViewAttendance: true,
    canViewAssignments: true,
    canSendMessages: true,
  },
  teacher: {
    canViewStudents: true,
    canCreateStudents: false,
    canEditStudents: false,
    canDeleteStudents: false,
    canViewTeachers: false,
    canCreateTeachers: false,
    canEditTeachers: false,
    canDeleteTeachers: false,
    canViewClasses: true,
    canCreateClasses: false,
    canEditClasses: false,
    canDeleteClasses: false,
    canViewPayments: false,
    canCreatePayments: false,
    canEditPayments: false,
    canDeletePayments: false,
    canViewSalaries: false,
    canCreateSalaries: false,
    canEditSalaries: false,
    canDeleteSalaries: false,
    canViewExpenses: false,
    canCreateExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,
    canViewReports: false,
    canViewSettings: false,
    canEditSettings: false,
    canViewAttendance: true,
    canViewAssignments: true,
    canSendMessages: true,
  },
  student: {
    canViewStudents: false,
    canCreateStudents: false,
    canEditStudents: false,
    canDeleteStudents: false,
    canViewTeachers: false,
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
    canViewSalaries: false,
    canCreateSalaries: false,
    canEditSalaries: false,
    canDeleteSalaries: false,
    canViewExpenses: false,
    canCreateExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,
    canViewReports: false,
    canViewSettings: false,
    canEditSettings: false,
    canViewAttendance: true,
    canViewAssignments: true,
    canSendMessages: true,
  },
  parent: {
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
    canViewSalaries: false,
    canCreateSalaries: false,
    canEditSalaries: false,
    canDeleteSalaries: false,
    canViewExpenses: false,
    canCreateExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,
    canViewReports: false,
    canViewSettings: false,
    canEditSettings: false,
    canViewAttendance: true,
    canViewAssignments: true,
    canSendMessages: true,
  },
};


export function logout(): void {
  if (typeof window === "undefined") return;
  clearAuthState();
  // Hard navigation guarantees React Query caches and component state
  // are dropped — preventing leakage of the previous user's data.
  window.location.href = "/login";
}

export function getCurrentUser(): User | null {
  const raw = getStoredUser();
  if (!raw) return null;
  const user = raw as unknown as User;
  if (!user.permissions) {
    user.permissions =
      DEFAULT_PERMISSIONS[user.role as UserRole] || DEFAULT_PERMISSIONS.teacher;
  }
  return user;
}

export function hasRole(requiredRole: UserRole | UserRole[]): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  
  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(user.role);
  }
  
  return user.role === requiredRole;
}

export function hasPermission(permission: keyof Permission): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  
  if (user.role === "admin") return true;
  
  return Boolean(user.permissions?.[permission]) || false;
}

/**
 * Page-level access for sections every branch member used to get
 * (Attendance, Tasks, Messaging). Only managers/accountants are restricted by
 * the saved flags; a flag missing from an older stored session counts as
 * allowed, so nobody is locked out before their permissions are refreshed.
 */
export function hasPageAccess(permission: "canViewAttendance" | "canViewAssignments" | "canSendMessages"): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.role !== "manager" && user.role !== "accountant") return true;
  const value = user.permissions?.[permission];
  return value === undefined ? true : Boolean(value);
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}


/**
 * Brings the signed-in user's permission flags in line with the backend.
 *
 * - admin: always everything (hasPermission short-circuits on the role).
 * - branch_admin: always allowed to delete; other flags follow the role defaults.
 * - everyone else: if an admin has saved permissions for them
 *   (user_service permissions row, written in full from the Managers page),
 *   those flags win over the role defaults; with no saved row the defaults stay.
 *
 * Before this, only the stored role defaults were ever used, so switching a
 * flag off for a manager changed nothing in the UI. Returns true when
 * anything changed, so callers can re-render.
 */
export async function refreshPermissions(): Promise<boolean> {
  const user = getCurrentUser();
  if (!user || user.role === "admin") return false;

  const defaults = (DEFAULT_PERMISSIONS[user.role as UserRole] || DEFAULT_PERMISSIONS.teacher) as Permission;
  const next: Permission = { ...defaults, ...(user.permissions || {}) } as Permission;

  if (user.role === "branch_admin") {
    for (const key of Object.keys(defaults) as (keyof Permission)[]) {
      if (/^canDelete/.test(key)) (next as unknown as Record<string, boolean>)[key] = true;
    }
  } else {
    const server = await getUserPermissions(user.id);
    if (server === null) return false; // no row / request failed: keep what we have
    for (const key of Object.keys(defaults) as (keyof Permission)[]) {
      const v = server[key as string];
      if (typeof v === "boolean") (next as unknown as Record<string, boolean>)[key] = v;
    }
  }

  const before = JSON.stringify(user.permissions || {});
  if (JSON.stringify(next) === before) return false;

  const stored = getStoredUser();
  if (stored) setStoredUser({ ...stored, permissions: next } as unknown as Parameters<typeof setStoredUser>[0]);
  return true;
}
