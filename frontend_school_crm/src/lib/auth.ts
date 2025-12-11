import { User, UserRole, Permission, Branch } from "@/types";
import { branchesDB, usersDB } from "./storage";

const AUTH_KEY = "school_auth_user";

const DEFAULT_PERMISSIONS: Record<UserRole, Permission> = {
  admin: {
    canViewStudents: true,
    canEditStudents: true,
    canDeleteStudents: true,
    canViewTeachers: true,
    canEditTeachers: true,
    canDeleteTeachers: true,
    canViewClasses: true,
    canEditClasses: true,
    canDeleteClasses: true,
    canViewPayments: true,
    canEditPayments: true,
    canViewSalaries: true,
    canEditSalaries: true,
    canViewExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: true,
    canViewReports: true,
    canFinishMonth: true,
    canViewSettings: true,
    canEditSettings: true,
  },
  branch_admin: {
    canViewStudents: true,
    canEditStudents: true,
    canDeleteStudents: true,
    canViewTeachers: true,
    canEditTeachers: true,
    canDeleteTeachers: true,
    canViewClasses: true,
    canEditClasses: true,
    canDeleteClasses: true,
    canViewPayments: true,
    canEditPayments: true,
    canViewSalaries: true,
    canEditSalaries: true,
    canViewExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: true,
    canViewReports: true,
    canFinishMonth: true,
    canViewSettings: false,
    canEditSettings: false,
  },
  manager: {
    canViewStudents: true,
    canEditStudents: true,
    canDeleteStudents: false,
    canViewTeachers: true,
    canEditTeachers: true,
    canDeleteTeachers: false,
    canViewClasses: true,
    canEditClasses: true,
    canDeleteClasses: false,
    canViewPayments: true,
    canEditPayments: true,
    canViewSalaries: true,
    canEditSalaries: true,
    canViewExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: false,
    canViewReports: true,
    canFinishMonth: true,
    canViewSettings: false,
    canEditSettings: false,
  },
  accountant: {
    canViewStudents: true,
    canEditStudents: false,
    canDeleteStudents: false,
    canViewTeachers: true,
    canEditTeachers: false,
    canDeleteTeachers: false,
    canViewClasses: true,
    canEditClasses: false,
    canDeleteClasses: false,
    canViewPayments: true,
    canEditPayments: true,
    canViewSalaries: true,
    canEditSalaries: true,
    canViewExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: false,
    canViewReports: true,
    canFinishMonth: false,
    canViewSettings: false,
    canEditSettings: false,
  },
  teacher: {
    canViewStudents: true,
    canEditStudents: false,
    canDeleteStudents: false,
    canViewTeachers: false,
    canEditTeachers: false,
    canDeleteTeachers: false,
    canViewClasses: true,
    canEditClasses: false,
    canDeleteClasses: false,
    canViewPayments: false,
    canEditPayments: false,
    canViewSalaries: false,
    canEditSalaries: false,
    canViewExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,
    canViewReports: false,
    canFinishMonth: false,
    canViewSettings: false,
    canEditSettings: false,
  },
  student: {
    canViewStudents: false,
    canEditStudents: false,
    canDeleteStudents: false,
    canViewTeachers: false,
    canEditTeachers: false,
    canDeleteTeachers: false,
    canViewClasses: true,
    canEditClasses: false,
    canDeleteClasses: false,
    canViewPayments: true,
    canEditPayments: false,
    canViewSalaries: false,
    canEditSalaries: false,
    canViewExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,
    canViewReports: false,
    canFinishMonth: false,
    canViewSettings: false,
    canEditSettings: false,
  },
  parent: {
    canViewStudents: true,
    canEditStudents: false,
    canDeleteStudents: false,
    canViewTeachers: true,
    canEditTeachers: false,
    canDeleteTeachers: false,
    canViewClasses: true,
    canEditClasses: false,
    canDeleteClasses: false,
    canViewPayments: true,
    canEditPayments: false,
    canViewSalaries: false,
    canEditSalaries: false,
    canViewExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,
    canViewReports: false,
    canFinishMonth: false,
    canViewSettings: false,
    canEditSettings: false,
  },
};

export function initializeDefaultUsers(): void {
  // Default users initialization disabled - no example data
}

export function login(email: string, password: string): User | null {
  const users = usersDB.getAll();
  const user = users.find((u) => u.email === email && u.password === password);
  
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    localStorage.setItem(AUTH_KEY, JSON.stringify(userWithoutPassword));
    return userWithoutPassword as User;
  }
  
  return null;
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem("school_auth_user");
  localStorage.removeItem("current_user");
  localStorage.removeItem("auth_token");
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  
  // Try API-saved user first (from @/lib/api login)
  let userStr = localStorage.getItem("current_user");
  
  // Fall back to local auth user
  if (!userStr) {
    userStr = localStorage.getItem(AUTH_KEY);
  }
  
  if (!userStr) return null;
  
  try {
    const user = JSON.parse(userStr);
    if (!user.permissions) {
      user.permissions = DEFAULT_PERMISSIONS[user.role as UserRole] || DEFAULT_PERMISSIONS.teacher;
    }
    return user;
  } catch {
    return null;
  }
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
  
  return user.permissions?.[permission] || false;
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

export function deleteUser(userId: string): boolean {
  return usersDB.delete(userId);
}

export function getUserBranches(): Branch[] {
  const user = getCurrentUser();
  if (!user) return [];
  
  if (user.role === "admin") {
    return branchesDB.getAll();
  }
  
  if (user.branchId) {
    const branch = branchesDB.getById(user.branchId);
    return branch ? [branch] : [];
  }
  
  return [];
}

export function createUser(userData: Omit<User, "id" | "createdAt">): User {
  const permissions = userData.permissions || DEFAULT_PERMISSIONS[userData.role];
  
  const newUser: User = {
    ...userData,
    permissions,
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  
  return usersDB.create(newUser);
}

export function updateUserPermissions(userId: string, permissions: Partial<Permission>): User | null {
  const user = usersDB.getById(userId);
  if (!user) return null;

  const updatedPermissions = { ...user.permissions, ...permissions } as Permission;
  const updatedUser = usersDB.update(userId, { permissions: updatedPermissions });

  // If the updated user is the currently authenticated user, sync localStorage
  if (typeof window !== "undefined") {
    const currentStr = localStorage.getItem(AUTH_KEY);
    if (currentStr) {
      try {
        const current = JSON.parse(currentStr);
        if (current && current.id === userId) {
          const merged = { ...current, permissions: updatedPermissions };
          localStorage.setItem(AUTH_KEY, JSON.stringify(merged));
        }
      } catch (err) {
        // ignore JSON parse errors
      }
    }
  }

  return updatedUser;
}

export function getAllUsers(): User[] {
  return usersDB.getAll();
}

export function getUsersByBranch(branchId: string): User[] {
  return usersDB.getAll().filter((u) => u.branchId === branchId);
}

export function updateUserPassword(userId: string, newPassword: string): boolean {
  const user = usersDB.getById(userId);
  if (!user) return false;

  const updated = usersDB.update(userId, { password: newPassword });
  if (!updated) return false;

  // If updating the current user, update localStorage
  if (typeof window !== "undefined") {
    const currentStr = localStorage.getItem(AUTH_KEY);
    if (currentStr) {
      try {
        const current = JSON.parse(currentStr);
        if (current && current.id === userId) {
          // Note: We don't store password in localStorage for security
          localStorage.setItem(AUTH_KEY, JSON.stringify(current));
        }
      } catch (err) {
        // ignore JSON parse errors
      }
    }
  }

  return true;
}