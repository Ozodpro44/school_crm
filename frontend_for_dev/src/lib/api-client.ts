/**
 * API Client for School CRM Backend
 * Handles authentication, requests, and error handling
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000');

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    branchId: string;
  };
}

interface Student {
  id: string;
  fullName: string;
  classId: string;
  phone: string;
  parentPhone: string;
  monthlyPayment: number;
  status: 'active' | 'left' | 'suspended';
  branchId: string;
  enrollmentDate: string;
}

interface Payment {
  id: string;
  studentId: string;
  amount: number;
  month: string;
  year: number;
  paymentMethod: 'cash' | 'card' | 'bank';
  status: 'paid' | 'unpaid' | 'partial';
  invoiceNumber: string;
  notes: string;
  paidDate: string;
  branchId: string;
}

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  monthlyPayment: number;
  adminId: string;
}

interface Class {
  id: string;
  name: string;
  teacherId: string;
  branchId: string;
}

interface Teacher {
  id: string;
  fullName: string;
  subjects: string;
  monthlySalary: number;
  phone: string;
  email: string;
  branchId: string;
  joinedDate: string;
}

export class APIClient {
  private token: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Setup token refresh or other interceptors if needed
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  getToken(): string | null {
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken();
          window.location.href = '/login';
          throw new Error('Unauthorized - please login again');
        }

        const error = await response.text();
        throw new Error(`API Error (${response.status}): ${error}`);
      }

      if (response.status === 204) {
        return null as any;
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${API_TIMEOUT}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ============ AUTHENTICATION ============

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async register(data: {
    email: string;
    password: string;
    fullName: string;
    role: string;
    branchId: string;
  }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============ STUDENTS ============

  async getStudents(branchId: string): Promise<Student[]> {
    return this.request(`/students?branchId=${branchId}`);
  }

  async getStudent(id: string): Promise<Student> {
    return this.request(`/students/${id}`);
  }

  async createStudent(data: Partial<Student>): Promise<Student> {
    return this.request('/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStudent(id: string, data: Partial<Student>): Promise<Student> {
    return this.request(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStudent(id: string): Promise<void> {
    return this.request(`/students/${id}`, {
      method: 'DELETE',
    });
  }

  // ============ PAYMENTS ============

  async getPayments(branchId: string): Promise<Payment[]> {
    return this.request(`/payments?branchId=${branchId}`);
  }

  async getPaymentsByStudent(
    studentId: string,
    month: string,
    year: number
  ): Promise<Payment[]> {
    return this.request(`/payments?studentId=${studentId}&month=${month}&year=${year}`);
  }

  async getPayment(id: string): Promise<Payment> {
    return this.request(`/payments/${id}`);
  }

  async getPaymentSummary(
    branchId: string
  ): Promise<{
    totalPaid: number;
    totalUnpaid: number;
    totalPartial: number;
    byMethod: Record<string, number>;
  }> {
    return this.request(`/payments/branch/${branchId}/summary`);
  }

  async createPayment(data: Partial<Payment>): Promise<Payment> {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePayment(id: string, data: Partial<Payment>): Promise<Payment> {
    return this.request(`/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePayment(id: string): Promise<void> {
    return this.request(`/payments/${id}`, {
      method: 'DELETE',
    });
  }

  // ============ BRANCHES ============

  async getBranches(): Promise<Branch[]> {
    return this.request('/branches');
  }

  async getBranch(id: string): Promise<Branch> {
    return this.request(`/branches/${id}`);
  }

  async createBranch(data: Partial<Branch>): Promise<Branch> {
    return this.request('/branches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBranch(id: string, data: Partial<Branch>): Promise<Branch> {
    return this.request(`/branches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBranch(id: string): Promise<void> {
    return this.request(`/branches/${id}`, {
      method: 'DELETE',
    });
  }

  // ============ CLASSES ============

  async getClasses(branchId: string): Promise<Class[]> {
    return this.request(`/classes?branchId=${branchId}`);
  }

  async getClass(id: string): Promise<Class> {
    return this.request(`/classes/${id}`);
  }

  async createClass(data: Partial<Class>): Promise<Class> {
    return this.request('/classes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClass(id: string, data: Partial<Class>): Promise<Class> {
    return this.request(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClass(id: string): Promise<void> {
    return this.request(`/classes/${id}`, {
      method: 'DELETE',
    });
  }

  // ============ TEACHERS ============

  async getTeachers(branchId: string): Promise<Teacher[]> {
    return this.request(`/teachers?branchId=${branchId}`);
  }

  async getTeacher(id: string): Promise<Teacher> {
    return this.request(`/teachers/${id}`);
  }

  async createTeacher(data: Partial<Teacher>): Promise<Teacher> {
    return this.request('/teachers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTeacher(id: string, data: Partial<Teacher>): Promise<Teacher> {
    return this.request(`/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTeacher(id: string): Promise<void> {
    return this.request(`/teachers/${id}`, {
      method: 'DELETE',
    });
  }

  // ============ HEALTH CHECK ============

  async healthCheck(): Promise<{ status: string }> {
    return this.request('/health');
  }
}

// Singleton instance
export const apiClient = new APIClient();
