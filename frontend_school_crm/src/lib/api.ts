/**
 * API Client for Wonderkids' CRM Backend
 * Complete integration with all Golang backend endpoints
 * Handles all HTTP requests with authentication, error handling, and data marshalling
 */

import { Branch } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://incredible-love-production-0008.up.railway.app/api";

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

export interface CreateStudentRequest {
  fullName: string;
  classId: string;
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
  paymentMethod: "cash" | "card" | "bank";
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
  paymentMethod: "cash" | "card" | "bank";
  status: "paid" | "partial";
  invoiceNumber: string;
  notes?: string;
  paidDate?: string;
  branchId: string;
  }

  export interface UpdatePaymentRequest {
  status?: "paid" | "partial";
  paymentMethod?: "cash" | "card" | "bank";
  amount?: number;
  notes?: string;
  paidDate?: string;
  }

export interface PaymentSummary {
  totalPaid: number;
  totalUnpaid: number;
  totalPartial: number;
  byMethod: {
    card: number;
    cash: number;
    bank: number;
  };
}

// Class Types
export interface Class {
  id: string;
  name: string;
  teacherId?: string;
  studentIds: string[];
  branchId: string;
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
  const { timeout = 10000, ...fetchOptions } = options;
  const token = getAuthToken();
  const branchId = typeof window !== "undefined" ? localStorage.getItem("selectedBranchId") : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...fetchOptions.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Add current branch ID to header for all requests
  if (branchId) {
    headers["X-Branch-ID"] = branchId;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `API Error: ${response.status}`;
      
      // Check for invalid token error and logout if needed (only 401, not 403)
      const isInvalidToken = (errorMessage.toLowerCase().includes("invalid token") || 
                             errorMessage.toLowerCase().includes("unauthorized")) &&
                             response.status === 401;
      
      if (isInvalidToken) {
        // Clear auth data from localStorage
        if (typeof window !== "undefined") {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("school_auth_user");
          localStorage.removeItem("current_user");
          localStorage.removeItem("selectedBranchId");
        }
        // Redirect to login
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("An unexpected error occurred");
  }
}

/**
 * Get stored authentication token
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

/**
 * Set authentication token
 */
export function setAuthToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("auth_token", token);
  }
}

/**
 * Clear authentication token
 */
export function clearAuthToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/**
 * Get current user from localStorage
 */
export function getCurrentUser(): LoginResponse["user"] | null {
  if (typeof window === "undefined") return null;
  const userJson = localStorage.getItem("current_user");
  return userJson ? JSON.parse(userJson) : null;
}

/**
 * Set current user in localStorage
 */
export function setCurrentUser(user: LoginResponse["user"]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("current_user", JSON.stringify(user));
  }
}

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * Login user with email and password
 */
export async function login(request: LoginRequest): Promise<LoginResponse> {
  const response = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(request),
  });

  if (response.token) {
    setAuthToken(response.token);
    setCurrentUser(response.user);
  }

  return response;
}

/**
 * Register new user
 */
export async function register(request: RegisterRequest): Promise<LoginResponse> {
  const response = await apiRequest<LoginResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(request),
  });

  if (response.token) {
    setAuthToken(response.token);
    setCurrentUser(response.user);
  }

  return response;
}

/**
 * Logout user
 */
export function logout(): void {
  clearAuthToken();
  if (typeof window !== "undefined") {
    localStorage.removeItem("current_user");
  }
}

// ============================================================================
// USER ENDPOINTS
// ============================================================================

/**
 * List all users (admin only)
 */
export async function listUsers(branchId?: string): Promise<User[]> {
  const endpoint = branchId ? `/users?branchId=${branchId}` : "/users";
  const response = await apiRequest<User[]>(endpoint);
  return Array.isArray(response) ? response : [];
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
 * List students by branch
 */
export async function listStudents(branchId: string): Promise<Student[]> {
  const response = await apiRequest<Student[]>(
    `/students?branchId=${branchId}`
  );
  return Array.isArray(response) ? response : [];
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
  }
): Promise<Payment[] | { data: Payment[]; total: number; page: number; limit: number; totalPages: number }> {
  let query = "";
  if (filters?.branchId) query += `branchId=${filters.branchId}`;
  if (filters?.studentId)
    query += `${query ? "&" : ""}studentId=${filters.studentId}`;
  if (filters?.month) query += `${query ? "&" : ""}month=${filters.month}`;
  if (filters?.year) query += `${query ? "&" : ""}year=${filters.year}`;
  if (filters?.page !== undefined) query += `${query ? "&" : ""}page=${filters.page}`;
  if (filters?.limit !== undefined) query += `${query ? "&" : ""}limit=${filters.limit}`;

  const response = await apiRequest<Payment[] | { data: Payment[]; total: number; page: number; limit: number; totalPages: number }>(
    `/payments${query ? "?" + query : ""}`
  );
  return Array.isArray(response) ? response : (response || []);
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
  const response = await apiRequest<Class[]>(
    `/classes?branchId=${branchId}`
  );
  return Array.isArray(response) ? response : [];
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

/**
 * Get branch by ID
 */
export async function getBranch(id: string): Promise<Branch> {
  return apiRequest<Branch>(`/branches/${id}`);
}

/**
 * List all branches
 */
export async function listBranches(): Promise<Branch[]> {
  const response = await apiRequest<Branch[]>("/branches");
  return Array.isArray(response) ? response : [];
}

/**
 * Update branch
 */
export async function updateBranch(
  id: string,
  updates: Partial<Branch>
): Promise<Branch> {
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
  const response = await apiRequest<Payment[]>(
    `/payments/student/${studentId}/history${query}`
  );
  return Array.isArray(response) ? response : [];
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
  const response = await apiRequest<Teacher[]>(
    `/teachers?branchId=${branchId}`
  );
  return Array.isArray(response) ? response : [];
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
  
  const response = await apiRequest<Salary[]>(`/salaries?${query}`);
  return Array.isArray(response) ? response : [];
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
  
  const response = await apiRequest<Expense[]>(`/expenses?${query}`);
  return Array.isArray(response) ? response : [];
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
  classId?: string
): Promise<PaymentReportItem[]> {
  let query = `?branchId=${branchId}&month=${month}&year=${year}`;
  if (classId && classId !== "all") query += `&classId=${classId}`;

  const response = await apiRequest<PaymentReportItem[]>(
    `/reports/payments${query}`
  );
  return Array.isArray(response) ? response : [];
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
