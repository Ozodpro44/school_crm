import { User, UserRole, Permission } from "@/types";
import { clearAuthState, getStoredUser } from "@/lib/storage";

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

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

