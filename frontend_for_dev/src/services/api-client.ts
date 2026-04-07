/**
 * API Client Service
 * Handles all API requests to the backend
 */

export interface ApiResponse<T> {
  data: T;
  error: string | null;
  message: string;
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private token: string | null = null;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
    this.timeout = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000');
    this.loadToken();
  }

  /**
   * Load token from localStorage
   */
  private loadToken(): void {
    this.token = localStorage.getItem('auth_token');
  }

  /**
   * Set token (used after login)
   */
  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  /**
   * Clear token (used on logout)
   */
  clearToken(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  /**
   * Generic fetch method with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || `HTTP ${response.status}`);
        (error as any).status = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Network error: Cannot connect to server');
      }
      throw error;
    }
  }

  // ==================== AUTH ====================

  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    // Use developer login endpoint for dev dashboard
    const response = await this.request<{ id: string; email: string; fullName: string; token: string; role: string }>('/dev/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    // Transform response to match expected format
    return {
      token: response.token,
      user: {
        id: response.id,
        email: response.email,
        fullName: response.fullName,
        role: response.role,
      },
    };
  }

  async register(data: {
    email: string;
    password: string;
    fullName: string;
    role: string;
    branchId: string;
  }): Promise<any> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== STUDENTS ====================

  async getStudents(branchId: string): Promise<any[]> {
    return this.request(`/students?branchId=${branchId}`, {
      method: 'GET',
    });
  }

  async getStudent(id: string): Promise<any> {
    return this.request(`/students/${id}`, {
      method: 'GET',
    });
  }

  async createStudent(data: {
    fullName: string;
    classId: string;
    phone: string;
    parentPhone: string;
    monthlyPayment: number;
    status: string;
    branchId: string;
    enrollmentDate?: string;
  }): Promise<any> {
    return this.request('/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStudent(id: string, data: Partial<any>): Promise<any> {
    return this.request(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStudent(id: string): Promise<any> {
    return this.request(`/students/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== PAYMENTS ====================

  async getPayments(branchId?: string, studentId?: string, month?: string, year?: number): Promise<any[]> {
    const params = new URLSearchParams();
    if (branchId) params.append('branchId', branchId);
    if (studentId) params.append('studentId', studentId);
    if (month) params.append('month', month);
    if (year) params.append('year', year.toString());

    return this.request(`/payments?${params.toString()}`, {
      method: 'GET',
    });
  }

  async getPayment(id: string): Promise<any> {
    return this.request(`/payments/${id}`, {
      method: 'GET',
    });
  }

  async getPaymentSummary(branchId: string): Promise<any> {
    return this.request(`/payments/branch/${branchId}/summary`, {
      method: 'GET',
    });
  }

  async createPayment(data: {
    studentId: string;
    amount: number;
    month: string;
    year: number;
    paymentMethod: string;
    status: string;
    invoiceNumber?: string;
    notes?: string;
    paidDate?: string;
    branchId: string;
  }): Promise<any> {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePayment(id: string, data: Partial<any>): Promise<any> {
    return this.request(`/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePayment(id: string): Promise<any> {
    return this.request(`/payments/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== BRANCHES ====================

  async getBranches(): Promise<any[]> {
    return this.request('/branches', {
      method: 'GET',
    });
  }

  async getBranch(id: string): Promise<any> {
    return this.request(`/branches/${id}`, {
      method: 'GET',
    });
  }

  async createBranch(data: {
    name: string;
    address: string;
    phone: string;
    monthlyPayment?: number;
    adminId?: string;
  }): Promise<any> {
    return this.request('/branches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBranch(id: string, data: Partial<any>): Promise<any> {
    return this.request(`/branches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBranch(id: string): Promise<any> {
    return this.request(`/branches/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== CLASSES ====================

  async getClasses(branchId: string): Promise<any[]> {
    return this.request(`/classes?branchId=${branchId}`, {
      method: 'GET',
    });
  }

  async getClass(id: string): Promise<any> {
    return this.request(`/classes/${id}`, {
      method: 'GET',
    });
  }

  async createClass(data: {
    name: string;
    teacherId?: string;
    branchId: string;
  }): Promise<any> {
    return this.request('/classes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClass(id: string, data: Partial<any>): Promise<any> {
    return this.request(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClass(id: string): Promise<any> {
    return this.request(`/classes/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== TEACHERS ====================

  async getTeachers(branchId: string): Promise<any[]> {
    return this.request(`/teachers?branchId=${branchId}`, {
      method: 'GET',
    });
  }

  async getTeacher(id: string): Promise<any> {
    return this.request(`/teachers/${id}`, {
      method: 'GET',
    });
  }

  async createTeacher(data: {
    fullName: string;
    subjects?: string[];
    monthlySalary: number;
    phone: string;
    email: string;
    branchId: string;
    joinedDate?: string;
  }): Promise<any> {
    return this.request('/teachers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTeacher(id: string, data: Partial<any>): Promise<any> {
    return this.request(`/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTeacher(id: string): Promise<any> {
    return this.request(`/teachers/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== SALARIES ====================

  async getSalaries(branchId: string): Promise<any[]> {
    return this.request(`/salaries?branchId=${branchId}`, {
      method: 'GET',
    });
  }

  async getSalary(id: string): Promise<any> {
    return this.request(`/salaries/${id}`, {
      method: 'GET',
    });
  }

  async createSalary(data: {
    teacherId: string;
    amount: number;
    month: string;
    year: number;
    paymentMethod: string;
    status: string;
    notes?: string;
    paidDate?: string;
    branchId: string;
  }): Promise<any> {
    return this.request('/salaries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSalary(id: string, data: Partial<any>): Promise<any> {
    return this.request(`/salaries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSalary(id: string): Promise<any> {
    return this.request(`/salaries/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== EXPENSES ====================

  async getExpenses(branchId: string): Promise<any[]> {
    return this.request(`/expenses?branchId=${branchId}`, {
      method: 'GET',
    });
  }

  async getExpense(id: string): Promise<any> {
    return this.request(`/expenses/${id}`, {
      method: 'GET',
    });
  }

  async createExpense(data: {
    title: string;
    description?: string;
    amount: number;
    category: string;
    paymentMethod: string;
    date: string;
    branchId: string;
    notes?: string;
  }): Promise<any> {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteExpense(id: string): Promise<any> {
    return this.request(`/expenses/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== USERS ====================

  async getUsers(): Promise<any[]> {
    return this.request('/users', {
      method: 'GET',
    });
  }

  async getUser(id: string): Promise<any> {
    return this.request(`/users/${id}`, {
      method: 'GET',
    });
  }

  async updateUser(id: string, data: Partial<any>): Promise<any> {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string): Promise<any> {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== HEALTH ====================

  async healthCheck(): Promise<any> {
    // /health is at root level, not under /api
    const rootUrl = this.baseUrl.replace(/\/api\/?$/, '');
    const response = await fetch(`${rootUrl}/health`);
    if (!response.ok) throw new Error(`Health check failed: HTTP ${response.status}`);
    return response.json();
  }

  // ==================== DEV SETTINGS ====================

  async getDevSettings(): Promise<Record<string, any>> {
    return this.request('/dev/settings', { method: 'GET' });
  }

  async updateDevSettings(settings: Record<string, any>): Promise<Record<string, any>> {
    return this.request('/dev/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // ==================== LOGS ====================

  async getLogs(limit: number = 100): Promise<any[]> {
    return this.request(`/logs?limit=${limit}`, {
      method: 'GET',
    });
  }

  async getLogsByModule(module: string, limit: number = 100): Promise<any[]> {
    return this.request(`/logs?module=${module}&limit=${limit}`, {
      method: 'GET',
    });
  }

  async getLogsByLevel(level: string, limit: number = 100): Promise<any[]> {
    return this.request(`/logs?level=${level}&limit=${limit}`, {
      method: 'GET',
    });
  }

  /**
   * Ingest logs to the backend (used by Railway forwarder)
   * Requires LOGS_TOKEN Bearer token
   */
  async ingestLog(
    token: string,
    payload: {
      service: string;
      level: string;
      message: string;
      metadata?: Record<string, string>;
    }
  ): Promise<any> {
    const url = `${this.baseUrl}/logs/ingest`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

// Singleton instance
export const apiClient = new ApiClient();
