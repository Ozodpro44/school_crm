/**
 * Authentication Module - Connects to Golang Backend
 * Handles login, registration, and token management
 */

import { User, UserRole, Permission } from "@/types";
import * as api from "./api";

const AUTH_USER_KEY = "school_auth_user";

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
    canViewSalaries: true,
    canCreateSalaries: true,
    canEditSalaries: true,
    canViewExpenses: true,
    canCreateExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: true,
    canViewReports: true,
    canFinishMonth: true,
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
    canViewSalaries: true,
    canCreateSalaries: true,
    canEditSalaries: true,
    canViewExpenses: true,
    canCreateExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: true,
    canViewReports: true,
    canFinishMonth: true,
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
    canCreatePayments: false,
    canEditPayments: false,
    canViewSalaries: true,
    canCreateSalaries: false,
    canEditSalaries: false,
    canViewExpenses: true,
    canCreateExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,
    canViewReports: true,
    canFinishMonth: true,
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
    canViewSalaries: true,
    canCreateSalaries: true,
    canEditSalaries: true,
    canViewExpenses: true,
    canCreateExpenses: true,
    canEditExpenses: true,
    canDeleteExpenses: false,
    canViewReports: true,
    canFinishMonth: false,
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
    canViewSalaries: false,
    canCreateSalaries: false,
    canEditSalaries: false,
    canViewExpenses: false,
    canCreateExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,
    canViewReports: false,
    canFinishMonth: false,
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
    canViewSalaries: false,
    canCreateSalaries: false,
    canEditSalaries: false,
    canViewExpenses: false,
    canCreateExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,
    canViewReports: false,
    canFinishMonth: false,
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
    canViewSalaries: false,
    canCreateSalaries: false,
    canEditSalaries: false,
    canViewExpenses: false,
    canCreateExpenses: false,
    canEditExpenses: false,
    canDeleteExpenses: false,
    canViewReports: false,
    canFinishMonth: false,
    canViewSettings: false,
    canEditSettings: false,
  },
};

/**
 * Login user with email and password
 * Calls backend API for authentication
 */
export async function login(email: string, password: string): Promise<User> {
  try {
    const response = await api.login({ email, password });

    // Transform backend response to frontend User type
    const branchIds = (response.user as any).branchIds || [];
    const branchId = branchIds.length > 0 ? branchIds[0] : (response.user as any).branchId;
    
    const user: User = {
      id: response.user.id,
      email: response.user.email,
      password: "",
      role: response.user.role as UserRole,
      fullName: response.user.fullName,
      permissions: DEFAULT_PERMISSIONS[response.user.role as UserRole],
      branchId: branchId,
      branchIds: branchIds.length > 0 ? branchIds : undefined,
      createdAt: new Date().toISOString(),
    };

    // Store user in localStorage (without password)
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      
      // Set selectedBranchId if user has a branch assigned
      if (user.branchId) {
        localStorage.setItem("selectedBranchId", user.branchId);
      }
    }

    return user;
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
}

/**
 * Register new user
 */
export async function register(
  email: string,
  password: string,
  fullName: string,
  role: UserRole
): Promise<User> {
  try {
    const response = await api.register({
      email,
      password,
      fullName,
      role,
    });

    const user: User = {
      id: response.user.id,
      email: response.user.email,
      password: "",
      role: response.user.role as UserRole,
      fullName: response.user.fullName,
      permissions: DEFAULT_PERMISSIONS[response.user.role as UserRole],
      createdAt: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }

    return user;
  } catch (error) {
    console.error("Registration failed:", error);
    throw error;
  }
}

/**
 * Logout user
 */
export function logout(): void {
  api.logout();
  if (typeof window !== "undefined") {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem("school_auth_user");
    localStorage.removeItem("current_user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("selectedBranchId");
  }
}

/**
 * Get currently authenticated user
 */
export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;

  const userStr = localStorage.getItem(AUTH_USER_KEY);
  if (!userStr) return null;

  try {
    const user = JSON.parse(userStr) as User;
    if (!user.permissions) {
      user.permissions = DEFAULT_PERMISSIONS[user.role as UserRole] || DEFAULT_PERMISSIONS.teacher;
    }
    return user;
  } catch {
    return null;
  }
}

/**
 * Check if user has a specific role
 */
export function hasRole(requiredRole: UserRole | UserRole[]): boolean {
  const user = getCurrentUser();
  if (!user) return false;

  if (Array.isArray(requiredRole)) {
    return requiredRole.includes(user.role);
  }

  return user.role === requiredRole;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(permission: keyof Permission): boolean {
  const user = getCurrentUser();
  if (!user) return false;

  if (user.role === "admin") return true;

  return user.permissions?.[permission] || false;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null && api.getAuthToken() !== null;
}
