export type UserRole = "admin" | "branch_admin" | "manager" | "accountant" | "teacher" | "student" | "parent";
export type PaymentMethod = "card" | "cash" | "bank";
export type StudentPaymentMethod = "click" | "cash" | "bank" | "terminal";
export type StudentStatus = "active" | "left" | "suspended";
export type PaymentStatus = "paid" | "partial";
export type Language = "uz-cyrl" | "uz-latn" | "en";
export type MonthStatus = "OPEN" | "CLOSED";
export type SubscriptionStatus = "active" | "trial" | "paused" | "cancelled" | "expired" | "pending_payment" | "past_due";
export type SubscriptionPaymentStatus = "pending" | "completed" | "failed" | "refunded";
export type BillingPeriod = "monthly" | "yearly";

export interface Permission {
  id?: string;
  userId?: string;
  canViewStudents: boolean;
  canCreateStudents: boolean;
  canEditStudents: boolean;
  canDeleteStudents: boolean;
  canViewTeachers: boolean;
  canCreateTeachers: boolean;
  canEditTeachers: boolean;
  canDeleteTeachers: boolean;
  canViewClasses: boolean;
  canCreateClasses: boolean;
  canEditClasses: boolean;
  canDeleteClasses: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canEditPayments: boolean;
  canDeletePayments: boolean;
  canViewSalaries: boolean;
  canCreateSalaries: boolean;
  canEditSalaries: boolean;
  canDeleteSalaries: boolean;
  canViewExpenses: boolean;
  canCreateExpenses: boolean;
  canEditExpenses: boolean;
  canDeleteExpenses: boolean;
  canViewReports: boolean;
  canViewSettings: boolean;
  canEditSettings: boolean;
}

export interface FinancialMonth {
  id: string;
  branchId: string;
  year: number;
  month: number;
  status: "OPEN" | "CLOSED";
  paymentAmount: number;
  openedAt: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  monthlyPayment: number;
  adminId?: string;
  managerIds: string[];
  currentFinancialMonthId?: string;
  currentFinancialMonth?: FinancialMonth;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  password?: string;
  role: UserRole;
  fullName: string;
  permissions?: Permission;
  branchId?: string;
  branchIds?: string[];
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
  leftDate?: string | null;
  classSignedDate?: string | null;
  classConfirmed?: boolean;
  createdAt: string;
  updatedAt: string;
  class?: {
    id: string;
    name: string;
  };
  payment?: {
    status: string;
    amount: number;
  };
}

export interface Teacher {
  id: string;
  fullName: string;
  subjects: string[];
  monthlySalary: number;
  phone: string;
  email: string;
  userId?: string;
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
  studentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  month: string;
  year: number;
  paymentMethod: StudentPaymentMethod;
  status: PaymentStatus;
  invoiceNumber: string;
  notes?: string;
  paidDate?: string;
  branchId: string;
  createdBy?: string;
  createdByName?: string;
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

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  billingPeriod: BillingPeriod;
  maxBranches?: number;
  maxStudents?: number;
  maxClasses?: number;
  features: Record<string, boolean | string | number>;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  branchId?: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate?: string;
  renewalDate?: string;
  autoRenew: boolean;
  paymentMethod?: string;
  stripeSubscriptionId?: string;
  notes?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionUsage {
  id: string;
  subscriptionId: string;
  metricName: string;
  currentUsage: number;
  limitValue?: number;
  resetDate?: string;
  updatedAt: string;
}

export interface SubscriptionPayment {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: SubscriptionPaymentStatus;
  paymentDate?: string;
  invoiceNumber?: string;
  stripePaymentId?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionResponse extends Subscription {
  plan?: SubscriptionPlan;
}
