/**
 * Subscription API Service
 * Handles all subscription-related API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8080/api";

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billingPeriod: "monthly" | "yearly";
  maxBranches: number;
  maxStudents: number;
  maxClasses: number;
  features: Record<string, boolean>;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  branchId?: string;
  status: "active" | "paused" | "cancelled" | "expired";
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

export interface CreateSubscriptionPlanRequest {
  name: string;
  description: string;
  price: number;
  billingPeriod: "monthly" | "yearly";
  maxBranches: number;
  maxStudents: number;
  maxClasses: number;
  features?: Record<string, boolean>;
}

export interface UpdateSubscriptionPlanRequest extends CreateSubscriptionPlanRequest {}

export interface CreateUserSubscriptionRequest {
  userId: string;
  planId: string;
  branchId?: string;
  paymentMethod?: string;
  autoRenew?: boolean;
  notes?: string;
}

export interface UpdateUserSubscriptionRequest {
  planId?: string;
  status?: string;
  autoRenew?: boolean;
  paymentMethod?: string;
  notes?: string;
}

// Get auth token from localStorage
const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem("auth_token") || null;
  } catch {
    return null;
  }
};

// Make API request with error handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || `API Error: ${response.status}`;
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * SUBSCRIPTION PLANS API
 */

/**
 * Get all subscription plans
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const plans = await apiRequest<SubscriptionPlan[]>("/subscriptions/plans");
    return Array.isArray(plans) ? plans : [];
  } catch {
    return [];
  }
}

/**
 * Create a new subscription plan
 */
export async function createSubscriptionPlan(
  request: CreateSubscriptionPlanRequest
): Promise<SubscriptionPlan> {
  return apiRequest<SubscriptionPlan>("/dev/subscription-plans", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Update a subscription plan
 */
export async function updateSubscriptionPlan(
  planId: string,
  request: UpdateSubscriptionPlanRequest
): Promise<SubscriptionPlan> {
  return apiRequest<SubscriptionPlan>(
    `/dev/subscription-plans/${planId}`,
    {
      method: "PUT",
      body: JSON.stringify(request),
    }
  );
}

/**
 * Delete a subscription plan
 */
export async function deleteSubscriptionPlan(planId: string): Promise<void> {
  await apiRequest(`/dev/subscription-plans/${planId}`, {
    method: "DELETE",
  });
}

/**
 * USER SUBSCRIPTIONS API
 */

/**
 * Get all user subscriptions
 */
export async function getUserSubscriptions(): Promise<UserSubscription[]> {
  try {
    const subscriptions = await apiRequest<UserSubscription[]>("/dev/subscriptions");
    return Array.isArray(subscriptions) ? subscriptions : [];
  } catch {
    return [];
  }
}

/**
 * Get subscription by ID
 */
export async function getSubscriptionById(
  subscriptionId: string
): Promise<UserSubscription> {
  return apiRequest<UserSubscription>(`/dev/subscriptions/${subscriptionId}`);
}

/**
 * Create a user subscription
 */
export async function createUserSubscription(
  request: CreateUserSubscriptionRequest
): Promise<UserSubscription> {
  return apiRequest<UserSubscription>("/dev/subscriptions", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Update a user subscription
 */
export async function updateUserSubscription(
  subscriptionId: string,
  request: UpdateUserSubscriptionRequest
): Promise<UserSubscription> {
  return apiRequest<UserSubscription>(`/dev/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/**
 * Delete a user subscription
 */
export async function deleteUserSubscription(
  subscriptionId: string
): Promise<void> {
  await apiRequest(`/dev/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });
}

/**
 * Get all users (for user selection dropdown)
 */
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
