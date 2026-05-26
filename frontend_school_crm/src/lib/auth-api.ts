/**
 * Authentication Module - Connects to Golang Backend
 * Handles login, registration, and token management
 */

import { User, UserRole, Permission } from "@/types";
import * as api from "./api";
import { clearAuthState, getStoredUser, setStoredUser } from "./storage";

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

    // api.login already persisted token + user + branch via persistLogin
    // and emitted AuthEvents.LOGIN. We refresh the stored user with the
    // enriched record (permissions/branchIds) computed above so consumers
    // see the merged shape.
    setStoredUser(user as unknown as Parameters<typeof setStoredUser>[0]);

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

    // api.register already persisted token + user + branch via persistLogin.
    // Overwrite with the enriched record (permissions baked in).
    setStoredUser(user as unknown as Parameters<typeof setStoredUser>[0]);

    return user;
  } catch (error) {
    console.error("Registration failed:", error);
    throw error;
  }
}

/**
 * Logout user — wipes all auth + branch state. The hard redirect is owned by
 * @/lib/auth.logout(); callers wanting that flow should use it instead.
 */
export function logout(): void {
  clearAuthState();
}

/**
 * Get currently authenticated user
 */
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

  return Boolean(user.permissions?.[permission]) || false;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null && api.getAuthToken() !== null;
}

/**
 * Request password reset - sends OTP to email
 */
export async function forgotPassword(email: string): Promise<{ message: string; email: string }> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      let errorMessage = `Error: ${response.status} ${response.statusText}`;
      try {
        const error = JSON.parse(responseText);
        errorMessage = error.error || error.message || errorMessage;
      } catch {
        errorMessage = responseText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return JSON.parse(responseText);
  } catch (error) {
    console.error('Forgot password failed:', error);
    throw error;
  }
}

/**
 * Verify OTP and get reset token
 */
export async function verifyOTP(email: string, otp: string): Promise<{ message: string; resetToken: string; email: string }> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to verify OTP';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const responseText = await response.text();
    return JSON.parse(responseText);
  } catch (error) {
    console.error('OTP verification failed:', error);
    throw error;
  }
}

/**
 * Resend OTP to email
 */
export async function resendOTP(email: string): Promise<{ message: string }> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/resend-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to resend OTP';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const responseText = await response.text();
    return JSON.parse(responseText);
  } catch (error) {
    console.error('Resend OTP failed:', error);
    throw error;
  }
}

/**
 * Reset password with reset token
 */
export async function resetPassword(email: string, resetToken: string, newPassword: string): Promise<{ message: string }> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, resetToken, newPassword }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to reset password';
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || error.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const responseText = await response.text();
    return JSON.parse(responseText);
  } catch (error) {
    console.error('Password reset failed:', error);
    throw error;
  }
}
