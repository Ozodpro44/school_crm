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

/**
 * Login user with email and password
 * Calls backend API for authentication
 */
export async function login(email: string, password: string): Promise<User> {
  try {
    const response = await api.login({ email, password });

    // Transform backend response to frontend User type
    const user: User = {
      id: response.user.id,
      email: response.user.email,
      password: "", // Don't store password in frontend
      role: response.user.role as UserRole,
      fullName: response.user.fullName,
      branchId: response.user.branchId,
      permissions: DEFAULT_PERMISSIONS[response.user.role as UserRole],
      createdAt: new Date().toISOString(),
    };

    // Store user in localStorage (without password)
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
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
  role: UserRole,
  branchId?: string
): Promise<User> {
  try {
    const response = await api.register({
      email,
      password,
      fullName,
      role,
      branchId,
    });

    const user: User = {
      id: response.user.id,
      email: response.user.email,
      password: "",
      role: response.user.role as UserRole,
      fullName: response.user.fullName,
      branchId: response.user.branchId,
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
