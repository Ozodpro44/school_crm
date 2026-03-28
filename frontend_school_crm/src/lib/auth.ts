import { User, UserRole, Permission, Branch } from "@/types";
import { branchesDB, usersDB } from "./storage";

const AUTH_KEY = "school_auth_user";

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
    canViewSettings: false,
    canEditSettings: false,
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
  
  return Boolean(user.permissions?.[permission]) || false;
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
  
  // All users can see all branches for now
  // Branch access control should be done on the backend
  return branchesDB.getAll();
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
  // User-branch relationship is managed by backend via branch_managers table
  // This function returns all users for now - filtering should be done on backend
  return usersDB.getAll();
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