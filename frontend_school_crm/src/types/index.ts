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
  // Optional on purpose: students.class_id is nullable (migration 000027
  // dropped the NOT NULL so the FK's ON DELETE SET NULL could actually work),
  // and student_service serialises it as `*string` with `omitempty` — so the
  // key is ABSENT for a student whose class was deleted or who hasn't been
  // assigned one yet. student_service even has a "no class" filter
  // (WHERE class_id IS NULL) for exactly these rows. Declaring it as a plain
  // `string` told TypeScript a value was always there and hid the unassigned
  // case from every caller.
  classId?: string;
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
  // The CURRENT branch's own name (e.g. "Chilonzor filiali").
  name: string;
  // The school's overall brand identity, resolved from the branch's admin —
  // stays the same across every branch that admin owns. Optional: absent for
  // a branch whose admin never set one (organization_name is nullable).
  organizationName?: string;
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

// Field names match the wire format exactly (snake_case) — this is what
// backend_school_crm's models.Subscription actually serializes to on
// GET /subscriptions/current and POST /subscriptions (unlike every other
// subscription-related model in this codebase, e.g. SubscriptionPlan below,
// which is camelCase). Previously this interface declared camelCase names
// that don't exist on the wire, so every read of endDate/renewalDate/etc.
// silently returned undefined — e.g. "Time Remaining" always showed
// Infinity and trial-ending warnings never fired.
export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  branch_id?: string;
  status: SubscriptionStatus;
  start_date: string;
  end_date?: string;
  renewal_date?: string;
  auto_renew: boolean;
  payment_method?: string;
  stripe_subscription_id?: string;
  notes?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  created_at: string;
  updated_at: string;
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
