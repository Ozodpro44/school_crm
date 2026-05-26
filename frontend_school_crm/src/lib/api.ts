/**
 * API Client for Wonderkids' CRM Backend
 * Complete integration with all Golang backend endpoints
 * Handles all HTTP requests with authentication, error handling, and data marshalling
 */

import { Branch } from "@/types";
import {
  AuthEvents,
  clearAuthState,
  clearStoredBranchId,
  getAuthToken as readAuthToken,
  getStoredBranchId,
  getStoredUser as readStoredUser,
  markLastSync,
  persistLogin,
  setAuthToken as writeAuthToken,
  setStoredUser as writeStoredUser,
} from "@/lib/storage";

// NEXT_PUBLIC_API_URL must be set in production. Fallback to localhost for local dev only.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

// Microservices return { items: T[] }; the monolith returned plain T[].
// This helper handles both so callers don't have to.
function unwrapItems<T>(response: T[] | { items: T[] } | unknown): T[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === "object" && Array.isArray((response as { items: T[] }).items)) {
    return (response as { items: T[] }).items;
  }
  return [];
}

/**
 * Build a query string from a params object, skipping undefined / null / empty values.
 * Returns an empty string when no params remain (so callers can blindly append it).
 */
function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

interface RequestOptions extends RequestInit {
  timeout?: number;
}

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    branchId?: string;
    branchIds?: string[];
    permissions?: Permissions;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role: string;
  schoolName?: string;
}

// User Types
export interface User {
  id: string;
  email: string;
  role: string;
  fullName: string;
  createdAt: string;
  updatedAt: string;
}

// Student Types
export interface Student {
  id: string;
  fullName: string;
  classId: string;
  phone: string;
  parentPhone: string;
  monthlyPayment: number;
  status: "active" | "left" | "suspended";
  branchId: string;
  enrollmentDate?: string;
  leftDate?: string | null;
  classSignedDate?: string | null;
  classConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

// Consolidated row shape returned by /students/consolidated/data
// (mirrors backend models.StudentList — embeds class + payment).
export interface StudentListRow {
  id: string;
  fullName: string;
  class: { id: string; name: string };
  phone: string;
  parentPhone: string;
  monthlyPayment: number;
  status: "active" | "left" | "suspended";
  branchId: string;
  payment: { status: "paid" | "partial" | "none"; amount: number };
  createdAt: string;
  updatedAt: string;
}

export interface StudentsConsolidatedData {
  items: StudentListRow[];
  classes: { id: string; name: string }[];
  total: number;
  page: number;
  limit: number;
  nextCursor?: string;
}

export interface CreateStudentRequest {
  fullName: string;
  classId?: string;
  phone: string;
  parentPhone: string;
  monthlyPayment: number;
  status: "active" | "left" | "suspended";
  branchId: string;
  enrollmentDate?: string;
}

// Payment Types
export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  month: string;
  year: number;
  paymentMethod: "cash" | "click" | "bank" | "terminal";
  status: "paid" | "partial";
  invoiceNumber: string;
  notes?: string;
  paidDate?: string;
  branchId: string;
  createdBy?: string;
  createdAt: string;
  }

  export interface CreatePaymentRequest {
  studentId: string;
  amount: number;
  month: string;
  year: number;
  paymentMethod: "cash" | "click" | "bank" | "terminal";
  status: "paid" | "partial";
  invoiceNumber: string;
  notes?: string;
  paidDate?: string;
  branchId: string;
  }

export interface UpdatePaymentRequest {
  status?: "paid" | "partial";
  paymentMethod?: "cash" | "click" | "bank" | "terminal";
  amount?: number;
  notes?: string;
  paidDate?: string;
  }

// Consolidated payments response (mirrors backend models.PaymentListResponse).
export interface PaymentsConsolidatedData {
  items: Payment[];
  classes: { id: string; name: string }[];
  students: {
    id: string;
    fullName: string;
    phone: string;
    classId: string;
    className: string;
    monthlyPayment: number;
  }[];
  indicators: {
    totalPaid: number;
    totalUnpaid: number;
    byMethod: Record<string, number>;
  };
  total: number;
  page: number;
  limit: number;
  nextCursor?: string;
}

export interface PaymentSummary {
  totalPaid: number;
  totalUnpaid: number;
  totalPartial: number;
  byMethod: {
    click: number;
    cash: number;
    bank: number;
    terminal: number;
  };
}

// Class Types
export interface Class {
  id: string;
  name: string;
  teacherId?: string;
  studentIds: string[];
  branchId: string;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClassRequest {
  name: string;
  teacherId?: string;
  branchId: string;
}

// Branch Types


export interface CreateBranchRequest {
  name: string;
  address: string;
  phone: string;
  monthlyPayment: number;
  adminId?: string;
}

// Teacher Types
export interface Teacher {
  id: string;
  fullName: string;
  subjects: string[];
  monthlySalary: number;
  phone: string;
  email: string;
  assignedClasses: string[];
  branchId: string;
  joinedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeacherRequest {
  fullName: string;
  subjects: string[];
  monthlySalary: number;
  phone: string;
  email: string;
  password?: string;
  branchId: string;
  joinedDate?: string;
}

// Salary Types
export interface Salary {
  id: string;
  teacherId: string;
  amount: number;
  month: string;
  year: number;
  paymentMethod: "cash" | "card" | "bank";
  status: "paid" | "partial";
  notes?: string;
  paidDate?: string;
  branchId: string;
  createdBy?: string;
  createdAt: string;
  }

  export interface CreateSalaryRequest {
  teacherId: string;
  amount: number;
  month: string;
  year: number;
  paymentMethod: "cash" | "card" | "bank";
  status: "paid" | "partial";
  notes?: string;
  paidDate?: string;
  branchId: string;
  }

  export interface UpdateSalaryRequest {
  status?: "paid" | "partial";
  paymentMethod?: "cash" | "card" | "bank";
  amount?: number;
  notes?: string;
  paidDate?: string;
}

// Expense Types
export interface Expense {
  id: string;
  title: string;
  description: string;
  amount: number;
  category: string;
  paymentMethod: "cash" | "card" | "bank";
  date: string;
  branchId: string;
  createdBy: string;
  notes?: string;
  createdAt: string;
}

export interface CreateExpenseRequest {
  title: string;
  description: string;
  amount: number;
  category: string;
  paymentMethod: "cash" | "card" | "bank";
  date: string;
  branchId: string;
  notes?: string;
}

// Income Types
export interface Income {
  id: string;
  source: string;
  amount: number;
  date: string;
  description?: string;
  branchId: string;
  createdAt: string;
}

export interface CreateIncomeRequest {
  source: string;
  amount: number;
  date: string;
  description?: string;
  branchId: string;
}

// Settings Types
export interface Settings {
  name: string;
  monthlyPayment: number;
  currency: string;
  updatedDate: string;
  createdDate: string;
}

export interface UpdateSettingsRequest {
  name?: string;
  monthlyPayment?: number;
  currency?: string;
  address?: string;
  phone?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Make an authenticated API request
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { timeout = 30000, ...fetchOptions } = options;
  const token = getAuthToken();
  const branchId = getStoredBranchId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Add current branch ID to header for all requests
  if (branchId) {
    headers["X-Branch-ID"] = branchId;
  }

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Track last successful sync time for the offline banner
    if (response.ok) {
      markLastSync();
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `API Error: ${response.status}`;

      // Auto-logout on ANY 401 from a protected endpoint.
      // (Public auth endpoints — /auth/login, /auth/register, /auth/forgot-password,
      // /auth/reset-password, /auth/verify-otp, /auth/resend-otp — return 401 for
      // bad credentials and we must NOT redirect away from the login page in that case.)
      if (response.status === 401 && typeof window !== "undefined") {
        const isAuthEndpoint = endpoint.startsWith("/auth/");
        const onPublicPage =
          window.location.pathname.startsWith("/login") ||
          window.location.pathname.startsWith("/register") ||
          window.location.pathname.startsWith("/forgot-password");

        if (!isAuthEndpoint && !onPublicPage) {
          clearAuthState();
          window.location.href = "/login";
        }
      }

      // Subscription expired / paused → redirect to billing page.
      if (response.status === 402 && errorData.error === "subscription_required") {
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/billing")) {
          window.location.href = "/billing";
        }
      }

      // Subscription plan limit reached (students / classes / branches) →
      // fire a custom event so any mounted upgrade modal can open without a
      // full-page redirect.
      if (response.status === 402 && errorData.error === "subscription_limit_reached") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(AuthEvents.SUBSCRIPTION_LIMIT_REACHED, {
              detail: { message: errorData.detail || errorMessage },
            })
          );
        }
      }

      // Branch access denied — the X-Branch-ID header was rejected by the
      // server's TenantBranchMiddleware. Clear the stale branch selection and
      // notify the BranchContext so it can redirect / pick another branch.
      if (response.status === 403 && errorData.error?.includes("branch")) {
        clearStoredBranchId();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(AuthEvents.BRANCH_ACCESS_DENIED));
        }
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      // Handle abort errors (timeout)
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
    throw new Error("An unexpected error occurred");
  }
}

// Auth-state helpers are exported from @/lib/storage. We re-export the read
// helpers under the old names so callers that imported `getAuthToken` from
// "@/lib/api" keep working.
export function getAuthToken(): string | null {
  return readAuthToken();
}

export function setAuthToken(token: string): void {
  writeAuthToken(token);
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

export function getCurrentUser(): LoginResponse["user"] | null {
  return readStoredUser() as unknown as LoginResponse["user"] | null;
}

export function setCurrentUser(user: LoginResponse["user"]): void {
  writeStoredUser(user as unknown as Parameters<typeof writeStoredUser>[0]);
}

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * Login user with email and password. On success, the JWT and the user blob
 * are persisted atomically (token + user + branch + LOGIN event in one place).
 */
export async function login(request: LoginRequest): Promise<LoginResponse> {
  const response = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(request),
  });

  if (response.token) {
    persistLogin({
      token: response.token,
      user: response.user as unknown as Parameters<typeof persistLogin>[0]["user"],
      branchId: response.user.branchId,
    });
  }

  return response;
}

/**
 * Register new user. Same persistence rules as login().
 */
export async function register(request: RegisterRequest): Promise<LoginResponse> {
  const response = await apiRequest<LoginResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(request),
  });

  if (response.token) {
    persistLogin({
      token: response.token,
      user: response.user as unknown as Parameters<typeof persistLogin>[0]["user"],
      branchId: response.user.branchId,
    });
  }

  return response;
}


/**
 * Logout user — wipes all auth + branch state and emits AuthEvents.LOGOUT.
 * Note: a separate `logout()` in @/lib/auth additionally redirects to /login.
 * This one just clears state, leaving navigation to the caller.
 */
export function logout(): void {
  clearAuthState();
}

// ============================================================================
// USER ENDPOINTS
// ============================================================================

/**
 * List all users (admin only)
 */
export async function listUsers(branchId?: string): Promise<User[]> {
  const endpoint = branchId ? `/users?branchId=${branchId}` : "/users";
  const response = await apiRequest<unknown>(endpoint);
  return unwrapItems<User>(response);
}

/**
 * Create a new user
 */
export async function createUser(
  email: string,
  password: string,
  fullName: string,
  role: string
): Promise<User> {
  return apiRequest<User>("/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      fullName,
      role,
    }),
  });
}

/**
 * Get user by ID
 */
export async function getUser(id: string): Promise<User> {
  return apiRequest<User>(`/users/${id}`);
}

/**
 * Update user
 */
export async function updateUser(
  id: string,
  updates: Partial<User>
): Promise<User> {
  return apiRequest<User>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

/**
 * Delete user
 */
export async function deleteUser(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/users/${id}`, {
    method: "DELETE",
  });
}

/**
 * Update user permissions
 */
export async function updateUserPermissions(
  userId: string,
  permissions: Record<string, boolean>
): Promise<any> {
  return apiRequest<any>(`/users/${userId}/permissions`, {
    method: "PUT",
    body: JSON.stringify(permissions),
  });
}

// ============================================================================
// STUDENT ENDPOINTS
// ============================================================================

/**
 * Create a new student
 */
export async function createStudent(
  request: CreateStudentRequest
): Promise<Student> {
  return apiRequest<Student>("/students", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Get student by ID
 */
export async function getStudent(id: string): Promise<Student> {
  return apiRequest<Student>(`/students/${id}`);
}

/**
 * List students by branch with pagination and filters
 */
export async function listStudents(
  branchId: string,
  page?: number,
  limit?: number,
  filters?: {
    search?: string;
    classId?: string;
    status?: "active" | "left" | "suspended";
  }
): Promise<{
  data: Student[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  let query = `/students?branchId=${branchId}`;
  if (page) query += `&page=${page}`;
  if (limit) query += `&limit=${limit}`;
  if (filters?.search) query += `&search=${encodeURIComponent(filters.search)}`;
  if (filters?.classId) query += `&classId=${filters.classId}`;
  if (filters?.status) query += `&status=${filters.status}`;

  const response = await apiRequest<any>(query);
  if (!response) return { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
  // student_service returns { items, total, page, limit }; monolith returned { data, ... }
  const items: Student[] = Array.isArray(response.items) ? response.items
    : Array.isArray(response.data) ? response.data
    : Array.isArray(response) ? response : [];
  const total = response.total ?? items.length;
  const pg = response.page ?? 1;
  const lim = response.limit ?? (limit ?? 10);
  return { data: items, total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) || 1 };
}

/**
 * Update student
 */
export async function updateStudent(
  id: string,
  updates: Partial<Student>
): Promise<Student> {
  return apiRequest<Student>(`/students/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

/**
 * Delete student
 */
export async function deleteStudent(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/students/${id}`, {
    method: "DELETE",
  });
}

/**
 * Search students with payment information for payment modal
 */
export async function searchStudentsWithPayments(
  branchId: string,
  search?: string,
  month?: string,
  year?: string
): Promise<Array<{
  id: string;
  fullName: string;
  phone: string;
  classId: string;
  className: string;
  monthlyPayment: number;
  paidAmount: number;
  status: "paid" | "partial" | "none";
  branchId: string;
}>> {
  let query = `?branchId=${branchId}`;
  if (search) query += `&search=${encodeURIComponent(search)}`;
  if (month) query += `&month=${month}`;
  if (year) query += `&year=${year}`;

  return apiRequest<Array<{
    id: string;
    fullName: string;
    phone: string;
    classId: string;
    className: string;
    monthlyPayment: number;
    paidAmount: number;
    status: "paid" | "partial" | "none";
    branchId: string;
  }>>(`/students/search/with-payments${query}`);
}

/**
 * Get students and classes consolidated data — used by the students table.
 */
export async function getStudentsConsolidatedData(
  branchId: string,
  page?: number,
  limit?: number,
  filters?: {
    search?: string;
    classId?: string;
    status?: string;
    paymentStatus?: string;
    month?: string;
    year?: string;
  }
): Promise<StudentsConsolidatedData> {
  const query = buildQuery({
    branchId,
    page,
    limit,
    search: filters?.search,
    classId: filters?.classId,
    status: filters?.status,
    paymentStatus: filters?.paymentStatus,
    month: filters?.month,
    year: filters?.year,
  });
  return apiRequest<StudentsConsolidatedData>(`/students/consolidated/data${query}`);
}

// ============================================================================
// PAYMENT ENDPOINTS
// ============================================================================

/**
 * Create a new payment
 */
export async function createPayment(
  request: CreatePaymentRequest
): Promise<Payment> {
  return apiRequest<Payment>("/payments", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Get payment by ID
 */
export async function getPayment(id: string): Promise<Payment> {
  return apiRequest<Payment>(`/payments/${id}`);
}

/**
 * List payments with optional filters
 */
export async function listPayments(
  filters?: {
    branchId?: string;
    studentId?: string;
    month?: string;
    year?: number;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }
): Promise<Payment[] | { items?: Payment[]; data?: Payment[]; total: number; page: number; limit: number; totalPages?: number; nextCursor?: string }> {
  let query = "";
  if (filters?.branchId) query += `branchId=${filters.branchId}`;
  if (filters?.studentId)
    query += `${query ? "&" : ""}studentId=${filters.studentId}`;
  if (filters?.month) query += `${query ? "&" : ""}month=${filters.month}`;
  if (filters?.year) query += `${query ? "&" : ""}year=${filters.year}`;
  if (filters?.page !== undefined) query += `${query ? "&" : ""}page=${filters.page}`;
  if (filters?.limit !== undefined) query += `${query ? "&" : ""}limit=${filters.limit}`;
  if (filters?.search) query += `${query ? "&" : ""}search=${encodeURIComponent(filters.search)}`;
  if (filters?.status) query += `${query ? "&" : ""}status=${filters.status}`;

  const response = await apiRequest<Payment[] | { items?: Payment[]; data?: Payment[]; total: number; page: number; limit: number; totalPages?: number; nextCursor?: string }>(
    `/payments${query ? "?" + query : ""}`
  );
  return Array.isArray(response) ? response : (response || []);
}

/**
 * Get payment status for a student in current month
 */
export async function getPaymentStatus(
  studentId: string,
  branchId: string
): Promise<{ status: string; amount: number }> {
  return apiRequest<{ status: string; amount: number }>(
    `/payments/status/${studentId}?branchId=${branchId}`
  );
}

/**
 * Search students with payment status and apply filters
 */
export interface StudentPaymentInfo {
  id: string;
  fullName: string;
  classId: string;
  phone: string;
  monthlyPayment: number;
  status: "active" | "left" | "suspended";
  amountPaid: number;
  paymentStatus: "paid" | "partial" | "not_paid";
  remaining: number;
}

export async function searchStudentsWithPaymentStatus(filters?: {
  branchId: string;
  search?: string;
  classId?: string;
  status?: "active" | "left" | "suspended";
  paymentStatus?: "paid" | "partial" | "not_paid";
  limit?: number;
  offset?: number;
}): Promise<{
  data: StudentPaymentInfo[];
  total: number;
  limit: number;
  offset: number;
}> {
  let query = "";
  if (filters?.branchId) query += `branchId=${filters.branchId}`;
  if (filters?.search)
    query += `${query ? "&" : ""}search=${encodeURIComponent(filters.search)}`;
  if (filters?.classId)
    query += `${query ? "&" : ""}classId=${filters.classId}`;
  if (filters?.status) query += `${query ? "&" : ""}status=${filters.status}`;
  if (filters?.paymentStatus)
    query += `${query ? "&" : ""}paymentStatus=${filters.paymentStatus}`;
  if (filters?.limit !== undefined) query += `${query ? "&" : ""}limit=${filters.limit}`;
  if (filters?.offset !== undefined) query += `${query ? "&" : ""}offset=${filters.offset}`;

  return apiRequest<{
    data: StudentPaymentInfo[];
    total: number;
    limit: number;
    offset: number;
  }>(`/payments/search/students${query ? "?" + query : ""}`);
}

/**
 * Update payment
 */
export async function updatePayment(
  id: string,
  updates: UpdatePaymentRequest
): Promise<Payment> {
  return apiRequest<Payment>(`/payments/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

/**
 * Delete payment
 */
export async function deletePayment(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/payments/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get payment summary for a branch
 */
export async function getPaymentSummary(
  branchId: string
): Promise<PaymentSummary> {
  return apiRequest<PaymentSummary>(`/payments/branch/${branchId}/summary`);
}

/**
 * Get payment indicators by period
 */
export async function getPaymentIndicators(
  branchId: string,
  month: string,
  year: number
): Promise<PaymentSummary> {
  return apiRequest<PaymentSummary>(`/payments/payments/${branchId}/indicators?month=${month}&year=${year}`);
}

/**
 * Get payments and classes consolidated data
 */
export async function getPaymentsConsolidatedData(
  branchId: string,
  page?: number,
  limit?: number,
  filters?: {
    search?: string;
    status?: string;
    month?: string;
    year?: string;
    paymentMethod?: string;
    classId?: string;
  }
): Promise<PaymentsConsolidatedData> {
  const query = buildQuery({
    branchId,
    page,
    limit,
    search: filters?.search,
    status: filters?.status,
    month: filters?.month,
    year: filters?.year,
    paymentMethod: filters?.paymentMethod,
    classId: filters?.classId,
  });
  return apiRequest<PaymentsConsolidatedData>(`/payments/consolidated/data${query}`);
}

// ============================================================================
// CLASS ENDPOINTS
// ============================================================================

/**
 * Create a new class
 */
export async function createClass(request: CreateClassRequest): Promise<Class> {
  return apiRequest<Class>("/classes", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Get class by ID
 */
export async function getClass(id: string): Promise<Class> {
  return apiRequest<Class>(`/classes/${id}`);
}

/**
 * List classes by branch
 */
export async function listClasses(branchId: string): Promise<Class[]> {
  const response = await apiRequest<unknown>(`/classes?branchId=${branchId}`);
  return unwrapItems<Class>(response);
}

/**
 * Update class
 */
export async function updateClass(
  id: string,
  updates: Partial<Class>
): Promise<Class> {
  return apiRequest<Class>(`/classes/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

/**
 * Delete class
 */
export async function deleteClass(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/classes/${id}`, {
    method: "DELETE",
  });
}

// ============================================================================
// BRANCH ENDPOINTS
// ============================================================================

/**
 * Create a new branch
 */
export async function createBranch(request: CreateBranchRequest): Promise<Branch> {
  return apiRequest<Branch>("/branches", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// Short-lived in-memory cache for getBranch — avoids re-fetching the same
// branch on every loadData() call within the same page render cycle.
const _branchCache = new Map<string, { data: Branch; expiresAt: number }>();
const BRANCH_CACHE_TTL_MS = 10_000; // 10 seconds

/**
 * Get branch by ID (cached for 10 s to deduplicate parallel calls)
 */
export async function getBranch(id: string): Promise<Branch> {
  const cached = _branchCache.get(id);
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  const data = await apiRequest<Branch>(`/branches/${id}`);
  _branchCache.set(id, { data, expiresAt: Date.now() + BRANCH_CACHE_TTL_MS });
  return data;
}

/** Call after updating a branch so the next getBranch reflects new data. */
export function invalidateBranchCache(id: string) {
  _branchCache.delete(id);
}

/**
 * List all branches
 */
export async function listBranches(): Promise<Branch[]> {
  const response = await apiRequest<unknown>("/branches");
  return unwrapItems<Branch>(response);
}

/**
 * Update branch
 */
export async function updateBranch(
  id: string,
  updates: Partial<Branch>
): Promise<Branch> {
  invalidateBranchCache(id);
  return apiRequest<Branch>(`/branches/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

/**
 * Delete branch
 */
export async function deleteBranch(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/branches/${id}`, {
    method: "DELETE",
  });
}

/**
 * Switch branch to next month (Admin only)
 * Advances the branch's current_month to the next calendar month
 */
export async function switchBranchMonth(id: string): Promise<Branch> {
  return apiRequest<Branch>(`/branches/${id}/switch-month`, {
    method: "POST",
  });
}

/**
 * Get student payment history (Admin sees all, Manager sees current month only)
 */
export async function getStudentPaymentHistory(
  studentId: string,
  branchId?: string
): Promise<Payment[]> {
  const query = branchId ? `?branchId=${branchId}` : "";
  const response = await apiRequest<unknown>(`/payments/student/${studentId}/history${query}`);
  return unwrapItems<Payment>(response);
}

// ============================================================================
// TEACHER ENDPOINTS
// ============================================================================

/**
 * Create a new teacher
 */
export async function createTeacher(
  request: CreateTeacherRequest
): Promise<Teacher> {
  return apiRequest<Teacher>("/teachers", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Get teacher by ID
 */
export async function getTeacher(id: string): Promise<Teacher> {
  return apiRequest<Teacher>(`/teachers/${id}`);
}

/**
 * List teachers by branch
 */
export async function listTeachers(branchId: string): Promise<Teacher[]> {
  const response = await apiRequest<unknown>(`/teachers?branchId=${branchId}`);
  return unwrapItems<Teacher>(response);
}

/**
 * Update teacher
 */
export async function updateTeacher(
  id: string,
  updates: Partial<Teacher>
): Promise<Teacher> {
  return apiRequest<Teacher>(`/teachers/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

/**
 * Delete teacher
 */
export async function deleteTeacher(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/teachers/${id}`, {
    method: "DELETE",
  });
}

// ============================================================================
// SALARY ENDPOINTS
// ============================================================================

/**
 * Create a new salary record
 */
export async function createSalary(
  request: CreateSalaryRequest
): Promise<Salary> {
  return apiRequest<Salary>("/salaries", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Get salary by ID
 */
export async function getSalary(id: string): Promise<Salary> {
  return apiRequest<Salary>(`/salaries/${id}`);
}

/**
 * List salaries by branch with optional month/year filter (Admin only for historical data)
 */
export async function listSalaries(
  branchId: string,
  month?: string,
  year?: number
): Promise<Salary[]> {
  let query = `branchId=${branchId}`;
  if (month) query += `&month=${month}`;
  if (year) query += `&year=${year}`;
  
  const response = await apiRequest<unknown>(`/salaries?${query}`);
  return unwrapItems<Salary>(response);
}

/**
 * Update salary record
 */
export async function updateSalary(
  id: string,
  updates: UpdateSalaryRequest
): Promise<Salary> {
  return apiRequest<Salary>(`/salaries/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

/**
 * Delete salary record
 */
export async function deleteSalary(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/salaries/${id}`, {
    method: "DELETE",
  });
}

// ============================================================================
// EXPENSE ENDPOINTS
// ============================================================================

/**
 * Create a new expense
 */
export async function createExpense(
  request: CreateExpenseRequest
): Promise<Expense> {
  return apiRequest<Expense>("/expenses", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Get expense by ID
 */
export async function getExpense(id: string): Promise<Expense> {
  return apiRequest<Expense>(`/expenses/${id}`);
}

/**
 * Update expense
 */
export async function updateExpense(
  id: string,
  request: CreateExpenseRequest
): Promise<Expense> {
  return apiRequest<Expense>(`/expenses/${id}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/**
 * List expenses by branch with optional month/year filter (Admin only for historical data)
 */
export async function listExpenses(
  branchId: string,
  month?: string,
  year?: number
): Promise<Expense[]> {
  let query = `branchId=${branchId}`;
  if (month) query += `&month=${month}`;
  if (year) query += `&year=${year}`;
  
  const response = await apiRequest<unknown>(`/expenses?${query}`);
  return unwrapItems<Expense>(response);
}

/**
 * Expense summary indicators
 */
export interface ExpenseSummary {
  totalAmount: number;
  byCategory: Record<string, number>;
  byMethod: Record<string, number>;
}

/**
 * Expense list response with pagination and indicators
 */
export interface ExpenseListResponse {
  items: Expense[];
  indicators: ExpenseSummary;
  total: number;
  page: number;
  limit: number;
}

/**
 * Get expenses with filters, pagination, and indicators (consolidated endpoint)
 */
export async function getExpensesConsolidatedData(
  branchId: string,
  page?: number,
  limit?: number,
  filters?: {
    search?: string;
    category?: string;
    paymentMethod?: string;
    month?: string;
    year?: string;
  }
): Promise<ExpenseListResponse> {
  let query = `/expenses/consolidated/data?branchId=${branchId}`;
  if (page) query += `&page=${page}`;
  if (limit) query += `&limit=${limit}`;
  if (filters?.search) query += `&search=${encodeURIComponent(filters.search)}`;
  if (filters?.category) query += `&category=${filters.category}`;
  if (filters?.paymentMethod) query += `&paymentMethod=${filters.paymentMethod}`;
  if (filters?.month) query += `&month=${filters.month}`;
  if (filters?.year) query += `&year=${filters.year}`;
  return apiRequest<ExpenseListResponse>(query);
}

/**
 * Delete expense
 */
export async function deleteExpense(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/expenses/${id}`, {
    method: "DELETE",
  });
}

// ============================================================================
// INCOME ENDPOINTS
// ============================================================================

/**
 * Create a new income record
 */
export async function createIncome(request: CreateIncomeRequest): Promise<Income> {
  return apiRequest<Income>("/incomes", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Get income by ID
 */
export async function getIncome(id: string): Promise<Income> {
  return apiRequest<Income>(`/incomes/${id}`);
}

/**
 * List incomes by branch
 */
export async function listIncomes(branchId: string): Promise<Income[]> {
  const response = await apiRequest<Income[]>(
    `/incomes?branchId=${branchId}`
  );
  return Array.isArray(response) ? response : [];
}

/**
 * Delete income record
 */
export async function deleteIncome(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/incomes/${id}`, {
    method: "DELETE",
  });
}

// ============================================================================
// REPORT TYPES
// ============================================================================

export interface PaymentReportItem {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  amount: number;
  month: string;
  year: number;
  status: string;
  paymentMethod: string;
  paidDate?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface SalaryReportItem {
  id: string;
  teacherId: string;
  teacherName: string;
  amount: number;
  month: string;
  year: number;
  status: string;
  paymentMethod: string;
  paidDate?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface DebtorReportItem {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  month: string;
  year: number;
  monthlyPayment: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
}

export interface ExpenseReportItem {
  id: string;
  title: string;
  description: string;
  category: string;
  amount: number;
  paymentMethod: string;
  date: string;
  createdBy: string;
  createdByName?: string;
  notes?: string;
  createdAt: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalSalaries: number;
  totalExpenses: number;
  netProfit: number;
  paymentsByMethod: Record<string, number>;
  salariesByStatus: Record<string, number>;
}

// ============================================================================
// REPORT ENDPOINTS
// ============================================================================

/**
 * Get payment report with optional filtering
 */
export async function getPaymentReport(
  branchId: string,
  month: string,
  year: string,
  classId?: string,
  page?: number,
  limit?: number
): Promise<{
  data: PaymentReportItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  let query = `?branchId=${branchId}&month=${month}&year=${year}`;
  if (classId && classId !== "all") query += `&classId=${classId}`;
  if (page) query += `&page=${page}`;
  if (limit) query += `&limit=${limit}`;

  const response = await apiRequest<any>(
    `/reports/payments${query}`
  );
  return response || { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
}

/**
 * Get salary report with optional filtering
 */
export async function getSalaryReport(
  branchId: string,
  startDate: string,
  endDate: string,
  status?: string
): Promise<SalaryReportItem[]> {
  let query = `?branchId=${branchId}&startDate=${startDate}&endDate=${endDate}`;
  if (status && status !== "all") query += `&status=${status}`;

  const response = await apiRequest<SalaryReportItem[]>(
    `/reports/salaries${query}`
  );
  return Array.isArray(response) ? response : [];
}

/**
 * Get debtors report for specific month/year
 */
export async function getDebtorsReport(
  branchId: string,
  month: string,
  year: number,
  classId?: string
): Promise<DebtorReportItem[]> {
  let query = `?branchId=${branchId}&month=${month}&year=${year}`;
  if (classId && classId !== "all") query += `&classId=${classId}`;

  const response = await apiRequest<DebtorReportItem[]>(
    `/reports/debtors${query}`
  );
  return Array.isArray(response) ? response : [];
}

/**
 * Get expenses report with optional filtering
 */
export async function getExpensesReport(
  branchId: string,
  startDate: string,
  endDate: string,
  category?: string
): Promise<ExpenseReportItem[]> {
  let query = `?branchId=${branchId}&startDate=${startDate}&endDate=${endDate}`;
  if (category && category !== "all") query += `&category=${category}`;

  const response = await apiRequest<ExpenseReportItem[]>(
    `/reports/expenses${query}`
  );
  return Array.isArray(response) ? response : [];
}

/**
 * Get financial summary for date range
 */
export async function getFinancialSummary(
  branchId: string,
  startDate: string,
  endDate: string
): Promise<FinancialSummary> {
  const query = `?branchId=${branchId}&startDate=${startDate}&endDate=${endDate}`;
  return apiRequest<FinancialSummary>(`/reports/financial-summary${query}`);
}

// ── Background Job Queue ───────────────────────────────────────────────────

export type JobStatus = "pending" | "running" | "done" | "failed";

export interface JobResponse {
  job_id: string;
  status: JobStatus;
  result?: any;
  error?: string;
  created_at?: string;
  started_at?: string;
  done_at?: string;
}

/** Submit a background job. Returns immediately with job_id. */
export async function submitJob(
  type: string,
  payload: Record<string, unknown>
): Promise<JobResponse> {
  return apiRequest<JobResponse>("/jobs", {
    method: "POST",
    body: JSON.stringify({ type, ...payload }),
  });
}

/** Poll a single job by ID. */
export async function pollJob(jobId: string): Promise<JobResponse> {
  return apiRequest<JobResponse>(`/jobs/${jobId}`);
}

/**
 * Submit a job and poll every 1.5 s until it finishes.
 * Resolves with the parsed result, or rejects with the server error message.
 */
export async function runReportJob(
  type: string,
  payload: Record<string, unknown>
): Promise<any> {
  const { job_id } = await submitJob(type, payload);
  for (;;) {
    await new Promise((r) => setTimeout(r, 1500));
    const job = await pollJob(job_id);
    if (job.status === "done") return job.result ?? null;
    if (job.status === "failed")
      throw new Error(job.error ?? "Report generation failed");
  }
}

/**
 * Get all dashboard data in a single API call
 */
export async function getDashboardData(
  branchId: string,
  month: number,
  year: number
): Promise<any> {
  const query = `?branchId=${branchId}&month=${month}&year=${year}`;
  return apiRequest(`/reports/dashboard${query}`);
}

// ============================================================================
// NOTIFICATIONS ENDPOINTS
// ============================================================================

export interface AppNotification {
  id: string;
  branchId: string;
  title: string;
  message: string;
  type: "payment" | "student" | "system";
  resourceType?: string;
  resourceId?: string;
  isRead: boolean;
  createdAt: string;
}

export async function getNotifications(limit = 20): Promise<AppNotification[]> {
  const branchId = getStoredBranchId();
  const q = buildQuery({ branchId, limit });
  const response = await apiRequest<unknown>(`/notifications${q}`);
  return unwrapItems<AppNotification>(response);
}

export async function getUnreadCount(): Promise<number> {
  const branchId = getStoredBranchId();
  const q = buildQuery({ branchId });
  const data = await apiRequest<{ count: number }>(`/notifications/count${q}`);
  return data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  return apiRequest(`/notifications/${id}/read`, { method: "PUT" });
}

export async function markAllNotificationsRead(): Promise<void> {
  return apiRequest("/notifications/read-all", { method: "PUT" });
}

// ============================================================================
// AUDIT LOG ENDPOINTS
// ============================================================================

export interface AuditLogEntry {
  id: string;
  branchId: string | null;
  userId: string | null;
  userName: string;
  action: "create" | "update" | "delete";
  resource: string;
  resourceId: string | null;
  description: string;
  createdAt: string;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getAuditLogs(params: {
  resource?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<AuditLogResponse> {
  const q = new URLSearchParams();
  if (params.resource) q.set("resource", params.resource);
  if (params.userId) q.set("userId", params.userId);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  return apiRequest<AuditLogResponse>(`/audit-logs?${q.toString()}`);
}

// ============================================================================
// FORECAST ENDPOINTS
// ============================================================================

export interface MonthlyForecastPoint {
  label: string;
  expectedIncome: number;
  actualIncome: number;
  actualExpenses: number;
}

export interface ForecastData {
  expectedMonthlyIncome: number;
  activeStudentCount: number;
  avgMonthlyPayment: number;
  actualIncomeThisMonth: number;
  totalExpensesThisMonth: number;
  projectedSalaryCosts: number;
  breakEvenRate: number;
  isBreakingEven: boolean;
  trend: MonthlyForecastPoint[];
}

export async function getForecastData(branchId: string, month: number, year: number): Promise<ForecastData> {
  return apiRequest<ForecastData>(`/reports/forecast?branchId=${branchId}&month=${month}&year=${year}`);
}

export interface BranchAnalyticsItem {
  branchId: string;
  branchName: string;
  activeStudents: number;
  revenue: number;
  collectionRate: number;
  teacherCount: number;
}

export interface BranchesOverview {
  month: number;
  year: number;
  branches: BranchAnalyticsItem[];
  topBranchId: string;
  topBranchName: string;
  totalRevenue: number;
  totalStudents: number;
}

export async function getBranchesOverview(month: number, year: number): Promise<BranchesOverview> {
  return apiRequest<BranchesOverview>(`/reports/branches-overview?month=${month}&year=${year}`);
}

// ============================================================================
// EXPENSE BUDGETS ENDPOINTS
// ============================================================================

export interface BudgetWithActual {
  id: string;
  branchId: string;
  category: string;
  month: string;
  year: number;
  amount: number;
  actual: number;
  usedPct: number;
  isExceeded: boolean;
  isNearLimit: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getExpenseBudgets(branchId: string, month: string, year: number): Promise<BudgetWithActual[]> {
  return apiRequest<BudgetWithActual[]>(`/expense-budgets?branchId=${branchId}&month=${month}&year=${year}`);
}

export async function upsertExpenseBudget(data: {
  branchId: string;
  category: string;
  month: string;
  year: number;
  amount: number;
}): Promise<BudgetWithActual> {
  return apiRequest<BudgetWithActual>("/expense-budgets", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteExpenseBudget(branchId: string, category: string, month: string, year: number): Promise<void> {
  return apiRequest<void>(`/expense-budgets?branchId=${branchId}&category=${encodeURIComponent(category)}&month=${month}&year=${year}`, {
    method: "DELETE",
  });
}

// ============================================================================
// SETTINGS ENDPOINTS
// ============================================================================

/**
 * Get settings for authenticated user's branch or a specific branch
 */
export async function getSettings(branchId?: string): Promise<Settings> {
  const endpoint = branchId ? `/settings?branchId=${branchId}` : "/settings";
  return apiRequest<Settings>(endpoint);
}

/**
 * Update settings for authenticated user's branch
 */
export async function updateSettings(
  updates: UpdateSettingsRequest
): Promise<Settings> {
  return apiRequest<Settings>("/settings", {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

// ============================================================================
// CLASS SCHEDULE
// ============================================================================

export interface ScheduleSlot {
  id: string;
  branchId: string;
  classId: string;
  teacherId?: string;
  teacherName?: string;
  dayOfWeek: number; // 1=Mon…6=Sat
  startTime: string; // "09:00"
  endTime: string;
  room: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
}

export async function listSchedule(branchId: string, classId?: string): Promise<ScheduleSlot[]> {
  let q = `/schedule?branchId=${branchId}`;
  if (classId) q += `&classId=${classId}`;
  const res = await apiRequest<ScheduleSlot[]>(q);
  return Array.isArray(res) ? res : [];
}

export async function upsertScheduleSlot(data: {
  branchId: string; classId: string; teacherId?: string;
  dayOfWeek: number; startTime: string; endTime: string; room?: string; subject?: string;
}): Promise<ScheduleSlot> {
  return apiRequest<ScheduleSlot>("/schedule", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteScheduleSlot(id: string, branchId: string): Promise<void> {
  return apiRequest<void>(`/schedule/${id}?branchId=${branchId}`, { method: "DELETE" });
}

// ============================================================================
// MASS MESSAGING
// ============================================================================

export interface MessageLogEntry {
  id: string;
  branchId: string;
  sentBy?: string;
  message: string;
  templateKey: string;
  recipientsCount: number;
  deliveredCount: number;
  filters: string;
  createdAt: string;
}

export interface SendMessagePayload {
  branchId: string;
  message: string;
  templateKey?: string;
  filters?: {
    classIds?: string[];
    paymentStatus?: string;
    enrolledAfter?: string;
    enrolledBefore?: string;
    studentIds?: string[];
  };
}

export async function listMessageHistory(branchId: string, limit = 50): Promise<MessageLogEntry[]> {
  const res = await apiRequest<MessageLogEntry[]>(`/messages?branchId=${branchId}&limit=${limit}`);
  return Array.isArray(res) ? res : [];
}

export async function sendMassMessage(payload: SendMessagePayload): Promise<MessageLogEntry> {
  return apiRequest<MessageLogEntry>("/messages/send", { method: "POST", body: JSON.stringify(payload) });
}

export async function setStudentTelegramChatId(studentId: string, chatId: string): Promise<void> {
  return apiRequest<void>(`/messages/student/${studentId}/telegram`, {
    method: "PUT",
    body: JSON.stringify({ chatId }),
  });
}

// ============================================================================
// ASSIGNMENTS
// ============================================================================

export interface AssignmentItem {
  id: string;
  branchId: string;
  classId: string;
  className?: string;
  teacherId?: string;
  subject: string;
  title: string;
  description: string;
  dueDate: string;
  createdBy?: string;
  totalStudents?: number;
  submittedCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName?: string;
  status: "pending" | "submitted" | "late" | "missing";
  grade?: number;
  feedback: string;
  submittedAt?: string;
  gradedAt?: string;
  gradedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export async function listAssignments(branchId: string, classId?: string): Promise<AssignmentItem[]> {
  let q = `/assignments?branchId=${branchId}`;
  if (classId) q += `&classId=${classId}`;
  const res = await apiRequest<AssignmentItem[]>(q);
  return Array.isArray(res) ? res : [];
}

export async function createAssignment(data: {
  branchId: string; classId: string; teacherId?: string;
  subject?: string; title: string; description?: string; dueDate: string;
}): Promise<AssignmentItem> {
  return apiRequest<AssignmentItem>("/assignments", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteAssignment(id: string, branchId: string): Promise<void> {
  return apiRequest<void>(`/assignments/${id}?branchId=${branchId}`, { method: "DELETE" });
}

export async function getAssignmentSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
  const res = await apiRequest<AssignmentSubmission[]>(`/assignments/${assignmentId}/submissions`);
  return Array.isArray(res) ? res : [];
}

export async function updateSubmission(
  submissionId: string,
  data: { status?: string; grade?: number; feedback?: string }
): Promise<AssignmentSubmission> {
  return apiRequest<AssignmentSubmission>(`/assignments/submissions/${submissionId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function getStudentAssignmentProgress(studentId: string, branchId: string): Promise<AssignmentSubmission[]> {
  const res = await apiRequest<AssignmentSubmission[]>(`/assignments/student/${studentId}/progress?branchId=${branchId}`);
  return Array.isArray(res) ? res : [];
}

// ============================================================================
// TEACHER PORTAL
// ============================================================================

export interface TeacherPortalClass {
  id: string;
  name: string;
  branchId: string;
  studentCount: number;
}

export interface TeacherPortalStudent {
  id: string;
  fullName: string;
  phone: string;
  classId: string;
  className: string;
  monthlyPayment: number;
  paymentStatus: "paid" | "partial" | "unpaid";
  paidAmount: number;
}

export interface TeacherPortalSalary {
  id?: string;
  amount: number;
  month: string;
  year: number;
  status: string;
  monthlySalary: number;
}

export interface TeacherPortalData {
  teacher: {
    id: string;
    fullName: string;
    phone: string;
    email: string;
    monthlySalary: number;
    subjects: string[];
    userId?: string;
    branchId: string;
    joinedDate?: string;
  } | null;
  classes: TeacherPortalClass[];
  students: TeacherPortalStudent[];
  salary: TeacherPortalSalary | null;
}

/**
 * Get teacher portal data for the currently logged-in teacher user
 */
export async function getTeacherPortalData(): Promise<TeacherPortalData> {
  return apiRequest<TeacherPortalData>("/teacher-portal/me");
}

/**
 * Link a teacher record to a user account (admin only)
 */
export async function linkTeacherToUser(teacherId: string, userId: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/teacher-portal/me/link/${teacherId}`, {
    method: "PUT",
    body: JSON.stringify({ userId }),
  });
}

// ============================================================================
// ATTENDANCE (per-student)
// ============================================================================

export interface AttendanceRecord {
  id: string;
  branchId: string;
  classId: string;
  studentId: string;
  date: string;
  status: "present" | "absent" | "late";
  note?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  studentName?: string;
}

/**
 * Get attendance records for a specific student, optionally filtered by year/month
 */
export async function getStudentAttendanceRecords(
  studentId: string,
  year?: number,
  month?: number
): Promise<AttendanceRecord[]> {
  let query = `/students/${studentId}/attendance`;
  const params: string[] = [];
  if (year) params.push(`year=${year}`);
  if (month) params.push(`month=${month}`);
  if (params.length > 0) query += "?" + params.join("&");
  return apiRequest<AttendanceRecord[]>(query);
}

// ============================================================================
// STUDENT NOTES
// ============================================================================

export interface StudentNote {
  id: string;
  branchId: string;
  studentId: string;
  content: string;
  createdBy?: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * List internal notes for a student
 */
export async function listStudentNotes(studentId: string, branchId: string): Promise<StudentNote[]> {
  return apiRequest<StudentNote[]>(`/students/${studentId}/notes?branchId=${branchId}`);
}

/**
 * Add a note for a student
 */
export async function addStudentNote(
  studentId: string,
  branchId: string,
  content: string
): Promise<StudentNote> {
  return apiRequest<StudentNote>(`/students/${studentId}/notes?branchId=${branchId}`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

/**
 * Delete a student note
 */
export async function deleteStudentNote(
  studentId: string,
  branchId: string,
  noteId: string
): Promise<void> {
  return apiRequest<void>(`/students/${studentId}/notes/${noteId}?branchId=${branchId}`, {
    method: "DELETE",
  });
}

// ============================================================================
// CONTACT LOG
// ============================================================================

export interface ContactLogEntry {
  id: string;
  branchId: string;
  studentId: string;
  contactType: string;
  outcome: string;
  note: string;
  contactedAt: string;
  createdBy?: string;
  createdByName: string;
  createdAt: string;
}

/**
 * List contact log entries for a student
 */
export async function listContactLog(studentId: string, branchId: string): Promise<ContactLogEntry[]> {
  return apiRequest<ContactLogEntry[]>(`/students/${studentId}/contact-log?branchId=${branchId}`);
}

/**
 * Add a contact log entry
 */
export async function addContactLog(
  studentId: string,
  branchId: string,
  data: { contactType?: string; outcome?: string; note: string; contactedAt?: string }
): Promise<ContactLogEntry> {
  return apiRequest<ContactLogEntry>(`/students/${studentId}/contact-log?branchId=${branchId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Delete a contact log entry
 */
export async function deleteContactLog(
  studentId: string,
  branchId: string,
  logId: string
): Promise<void> {
  return apiRequest<void>(`/students/${studentId}/contact-log/${logId}?branchId=${branchId}`, {
    method: "DELETE",
  });
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check if backend API is healthy
 */
export async function healthCheck(): Promise<{ status: string }> {
  try {
    return await fetch(`${API_BASE_URL.replace("/api", "")}/health`)
      .then((res) => res.json())
      .catch(() => ({ status: "error" }));
  } catch {
    return { status: "error" };
  }
}
