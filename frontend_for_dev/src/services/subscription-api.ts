/**
 * Subscription API Service
 * Handles all subscription-related API calls for the developer dashboard.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8080/api";

// ─── Types matching backend models ───────────────────────────────────────────

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  billingPeriod: "monthly" | "yearly";
  maxBranches?: number;
  maxStudents?: number;
  maxClasses?: number;
  features: Record<string, unknown>;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

/** Flat denormalized view returned by GET /dev/subscriptions */
export interface AdminSubscriptionView {
  id: string;
  userId: string;
  planId: string;
  branchId?: string;
  status: string; // active | trial | paused | cancelled | expired | pending_payment | past_due
  startDate: string;
  endDate?: string;
  renewalDate?: string;
  autoRenew: boolean;
  paymentMethod?: string;
  notes?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joined user fields
  userEmail: string;
  userFullName: string;
  // Joined plan fields
  planName: string;
  planPrice: number;
  billingPeriod: string;
}

export interface PlatformStats {
  totalUsers: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  expiredSubscriptions: number;
  pendingSubscriptions: number;
  mrr: number;
}

export interface CreateSubscriptionPlanRequest {
  name: string;
  description?: string;
  price: number;
  billingPeriod: "monthly" | "yearly";
  maxBranches?: number;
  maxStudents?: number;
  maxClasses?: number;
  features?: Record<string, unknown>;
  status?: "active" | "inactive";
}

export interface UpdateSubscriptionPlanRequest extends CreateSubscriptionPlanRequest {}

/** Matches backend AdminCreateSubscriptionRequest */
export interface CreateAdminSubscriptionRequest {
  userId: string;
  planId: string;
  branchId?: string;
  status?: string;
  autoRenew?: boolean;
  paymentMethod?: string;
  notes?: string;
  billingPeriod?: string;
}

/** Matches backend AdminUpdateSubscriptionRequest (all optional = partial update) */
export interface UpdateAdminSubscriptionRequest {
  status?: string;
  planId?: string;
  autoRenew?: boolean;
  paymentMethod?: string;
  endDate?: string;
  renewalDate?: string;
  notes?: string;
}

// Alias so existing imports of UserSubscription keep working
export type UserSubscription = AdminSubscriptionView;

// ─── Auth ─────────────────────────────────────────────────────────────────────

const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem("auth_token") || null;
  } catch {
    return null;
  }
};

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${response.status}`);
  }
  return response.json();
}

// ─── Platform Stats ───────────────────────────────────────────────────────────

export async function getPlatformStats(): Promise<PlatformStats> {
  return apiRequest<PlatformStats>("/dev/stats");
}

// ─── Subscription Plans (public) ──────────────────────────────────────────────

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const plans = await apiRequest<SubscriptionPlan[]>("/subscriptions/plans");
    return Array.isArray(plans) ? plans : [];
  } catch {
    return [];
  }
}

/** All plans including inactive — dev admin only */
export async function getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const plans = await apiRequest<SubscriptionPlan[]>("/dev/plans");
    return Array.isArray(plans) ? plans : [];
  } catch {
    return [];
  }
}

export async function createSubscriptionPlan(
  request: CreateSubscriptionPlanRequest
): Promise<SubscriptionPlan> {
  return apiRequest<SubscriptionPlan>("/dev/subscription-plans", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function updateSubscriptionPlan(
  planId: string,
  request: UpdateSubscriptionPlanRequest
): Promise<SubscriptionPlan> {
  return apiRequest<SubscriptionPlan>(`/dev/subscription-plans/${planId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export async function deleteSubscriptionPlan(planId: string): Promise<void> {
  await apiRequest(`/dev/subscription-plans/${planId}`, { method: "DELETE" });
}

// ─── Admin Subscription CRUD ──────────────────────────────────────────────────

export async function getUserSubscriptions(): Promise<AdminSubscriptionView[]> {
  try {
    const subs = await apiRequest<AdminSubscriptionView[]>("/dev/subscriptions");
    return Array.isArray(subs) ? subs : [];
  } catch {
    return [];
  }
}

export async function getSubscriptionById(id: string): Promise<AdminSubscriptionView> {
  return apiRequest<AdminSubscriptionView>(`/dev/subscriptions/${id}`);
}

export async function createUserSubscription(
  request: CreateAdminSubscriptionRequest
): Promise<AdminSubscriptionView> {
  return apiRequest<AdminSubscriptionView>("/dev/subscriptions", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function updateUserSubscription(
  id: string,
  request: UpdateAdminSubscriptionRequest
): Promise<AdminSubscriptionView> {
  return apiRequest<AdminSubscriptionView>(`/dev/subscriptions/${id}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export async function deleteUserSubscription(id: string): Promise<void> {
  await apiRequest(`/dev/subscriptions/${id}`, { method: "DELETE" });
}

// ─── Users (for selection dropdowns) ─────────────────────────────────────────

export async function getAllUsers(): Promise<
  Array<{ id: string; fullName: string; email: string }>
> {
  try {
    const response = await apiRequest<
      Array<{ id: string; fullName: string; email: string }>
    >("/dev/users");
    return Array.isArray(response) ? response : [];
  } catch {
    return [];
  }
}
