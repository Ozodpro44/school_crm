/**
 * Subscription API Client
 * Handles all subscription-related API calls
 */

import {
  SubscriptionPlan,
  Subscription,
  SubscriptionUsage,
  SubscriptionPayment,
  SubscriptionResponse,
} from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://incredible-love-production-0008.up.railway.app/api";

// Helper function for unauthenticated API requests
async function makePublicRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options?.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API request failed: ${response.statusText}`);
  }

  return response.json();
}

// Helper function for authenticated API requests
async function makeRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options?.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API request failed: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// SUBSCRIPTION PLANS
// ============================================================================

/**
 * Get all available subscription plans
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return makeRequest<SubscriptionPlan[]>("/subscriptions/plans");
}

/**
 * Get a specific subscription plan
 */
export async function getSubscriptionPlan(
  planId: string
): Promise<SubscriptionPlan> {
  return makeRequest<SubscriptionPlan>(`/subscriptions/plans/${planId}`);
}

// ============================================================================
// USER SUBSCRIPTIONS
// ============================================================================

/**
 * Get current user's active subscription
 */
export async function getCurrentSubscription(): Promise<SubscriptionResponse | null> {
  try {
    return await makeRequest<SubscriptionResponse>("/subscriptions/current");
  } catch (error) {
    // No active subscription found
    return null;
  }
}

/**
 * Create a new subscription for the user
 */
export async function createSubscription(data: {
  planId: string;
  branchId?: string;
  paymentMethod: string;
  notes?: string;
}): Promise<Subscription> {
  return makeRequest<Subscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: data.planId,
      branch_id: data.branchId,
      payment_method: data.paymentMethod,
      notes: data.notes,
    }),
  });
}

/**
 * Update subscription status
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: "active" | "paused"
): Promise<{ message: string }> {
  return makeRequest<{ message: string }>(
    `/subscriptions/${subscriptionId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<{
  message: string;
}> {
  return makeRequest<{ message: string }>(
    `/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
    }
  );
}

// ============================================================================
// SUBSCRIPTION USAGE
// ============================================================================

/**
 * Get usage metrics for a subscription
 */
export async function getSubscriptionUsage(
  subscriptionId: string
): Promise<SubscriptionUsage[]> {
  try {
    return await makeRequest<SubscriptionUsage[]>(
      `/subscriptions/${subscriptionId}/usage`
    );
  } catch (error) {
    return [];
  }
}

/**
 * Check if subscription usage exceeds limits
 */
export async function checkUsageLimits(subscriptionId: string): Promise<{
  exceeded: boolean;
  metrics: SubscriptionUsage[];
}> {
  const usage = await getSubscriptionUsage(subscriptionId);
  const exceeded = usage.some(
    (u) => u.limitValue && u.currentUsage >= u.limitValue
  );
  return { exceeded, metrics: usage };
}

// ============================================================================
// SUBSCRIPTION PAYMENTS
// ============================================================================

/**
 * Get payment history for a subscription
 */
export async function getSubscriptionPayments(
  subscriptionId: string
): Promise<SubscriptionPayment[]> {
  try {
    return await makeRequest<SubscriptionPayment[]>(
      `/subscriptions/${subscriptionId}/payments`
    );
  } catch (error) {
    return [];
  }
}

/**
 * Get latest payment for a subscription
 */
export async function getLatestPayment(
  subscriptionId: string
): Promise<SubscriptionPayment | null> {
  const payments = await getSubscriptionPayments(subscriptionId);
  return payments.length > 0 ? payments[0] : null;
}

/**
 * Get total spent on subscription
 */
export async function getTotalSpent(subscriptionId: string): Promise<number> {
  const payments = await getSubscriptionPayments(subscriptionId);
  return payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);
}

// ============================================================================
// CLICK.UZ PAYMENTS
// ============================================================================

/**
 * Initiate Click.uz payment for subscription
 */
export async function initiateClickUzPayment(subscriptionId: string): Promise<{
  payment_id: string;
  invoice_number: string;
  amount: number;
  merchant_id: string;
  service_id: string;
  status: string;
}> {
  return makeRequest(
    `/subscriptions/${subscriptionId}/pay-click`,
    {
      method: "POST",
    }
  );
}

/**
 * Get payment status
 */
export async function getPaymentStatus(paymentId: string): Promise<{
  payment_id: string;
  status: string;
}> {
  return makeRequest(
    `/subscriptions/payment-status?payment_id=${paymentId}`
  );
}

/**
 * Initiate Telegram payment for subscription
 */
export async function initiateTelegramPayment(subscriptionId: string): Promise<{
  payment_id: string;
  invoice_number: string;
  amount: number;
  status: string;
  telegram_link: string;
  telegram_url: string;
  instruction: string;
}> {
  return makeRequest(
    `/subscriptions/${subscriptionId}/pay-telegram`,
    {
      method: "POST",
    }
  );
}

// ============================================================================
// SUBSCRIPTION UTILITIES
// ============================================================================

/**
 * Check if subscription is active
 */
export function isSubscriptionActive(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  return subscription.status === "active";
}

/**
 * Check if subscription will expire soon (within 7 days)
 */
export function isExpiringsoon(subscription: Subscription | null): boolean {
  if (!subscription || !subscription.endDate) return false;

  const endDate = new Date(subscription.endDate);
  const today = new Date();
  const daysUntilExpiry = Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
}

/**
 * Get days until subscription renewal
 */
export function getDaysUntilRenewal(subscription: Subscription | null): number {
  if (!subscription || !subscription.renewalDate) return -1;

  const renewalDate = new Date(subscription.renewalDate);
  const today = new Date();
  return Math.ceil(
    (renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

/**
 * Format price for display
 */
export function formatPrice(price: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(price);
}

/**
 * Get plan badge color based on features
 */
export function getPlanBadgeColor(
  maxBranches?: number
): "blue" | "green" | "purple" {
  if (!maxBranches) return "blue";
  if (maxBranches <= 5) return "blue";
  if (maxBranches <= 20) return "green";
  return "purple";
}
