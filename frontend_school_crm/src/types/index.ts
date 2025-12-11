export type UserRole = "admin" | "branch_admin" | "manager" | "accountant" | "teacher" | "student" | "parent";
export type PaymentMethod = "card" | "cash" | "bank";
export type StudentStatus = "active" | "left" | "suspended";
export type PaymentStatus = "paid" | "unpaid" | "partial";
export type Language = "uz-cyrl" | "uz-latn" | "en";

export interface Permission {
  canViewStudents: boolean;
  canEditStudents: boolean;
  canDeleteStudents: boolean;
  canViewTeachers: boolean;
  canEditTeachers: boolean;
  canDeleteTeachers: boolean;
  canViewClasses: boolean;
  canEditClasses: boolean;
  canDeleteClasses: boolean;
  canViewPayments: boolean;
  canEditPayments: boolean;
  canViewSalaries: boolean;
  canEditSalaries: boolean;
  canViewExpenses: boolean;
  canEditExpenses: boolean;
  canDeleteExpenses: boolean;
  canViewReports: boolean;
  canFinishMonth: boolean;
  canViewSettings: boolean;
  canEditSettings: boolean;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  monthlyPayment: number;
  adminId?: string;
  managerIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
  permissions?: Permission;
  createdAt: string;
}

export interface Student {
  id: string;
  fullName: string;
  classId: string;
  phone: string;
  parentPhone: string;
  monthlyPayment: number;
  status: StudentStatus;
  branchId: string;
  enrollmentDate?: string;
  leftDate?: string;
  classSignedDate?: string;
  classConfirmed?: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export interface Class {
  id: string;
  name: string;
  teacherId?: string;
  studentIds: string[];
  branchId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  month: string;
  year: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  invoiceNumber: string;
  notes?: string;
  paidDate?: string;
  branchId: string;
  createdBy?: string;
  createdAt: string;
}

export interface Salary {
  id: string;
  teacherId: string;
  amount: number;
  month: string;
  year: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  notes?: string;
  paidDate?: string;
  branchId: string;
  createdBy?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  title: string;
  description: string;
  amount: number;
  category: string;
  paymentMethod: PaymentMethod;
  date: string;
  branchId: string;
  createdBy: string;
  notes?: string;
  createdAt: string;
}

export interface Income {
  id: string;
  source: string;
  amount: number;
  date: string;
  description?: string;
  branchId: string;
  createdAt: string;
}

export interface Settings {
  name: string;
  monthlyPayment: number;
  currency: string;
  updatedDate: string;
  createdDate: string;
}

export interface Translation {
  [key: string]: {
    "uz-cyrl": string;
    "uz-latn": string;
    en: string;
  };
}
