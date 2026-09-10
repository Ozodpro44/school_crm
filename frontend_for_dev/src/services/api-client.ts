const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api").replace(/\/$/, "");

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

let onUnauthorized: (() => void) | undefined;
export function setOnUnauthorized(cb: () => void) { onUnauthorized = cb; }
export function setToken(token: string) { localStorage.setItem("auth_token", token); }
export function clearToken() { localStorage.removeItem("auth_token"); }

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers, signal: controller.signal });
    clearTimeout(tid);

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      const err = new Error(body.error ?? `HTTP ${res.status}`);
      (err as Error & { status: number }).status = res.status;
      // A 401 from the login/register endpoints means "wrong credentials",
      // not "session expired" — it must not trigger the global logout +
      // hard redirect, which would wipe the login page's own error state
      // before the "Invalid email or password" toast can even render.
      if (res.status === 401 && !endpoint.startsWith("/dev/auth/")) onUnauthorized?.();
      throw err;
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  } catch (e) {
    clearTimeout(tid);
    if (e instanceof TypeError) throw new Error("Network error: cannot reach server");
    throw e;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await request<AuthUser & { token: string }>("/dev/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return { token: res.token, user: { id: res.id, email: res.email, fullName: res.fullName, role: res.role } };
}

export async function register(email: string, password: string, fullName: string): Promise<{ token: string; user: AuthUser }> {
  const res = await request<AuthUser & { token: string }>("/dev/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName }),
  });
  return { token: res.token, user: { id: res.id, email: res.email, fullName: res.fullName, role: res.role } };
}

// ── Platform Stats ─────────────────────────────────────────────────────────────

export interface PlatformStats {
  totalUsers: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  expiredSubscriptions: number;
  pendingSubscriptions: number;
  mrr: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  return request<PlatformStats>("/dev/stats");
}

// ── Health ─────────────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: string;
  version?: string;
  uptime?: number;
  responseTime: number;
  services?: Record<string, string>;
}

export async function getHealth(): Promise<HealthStatus> {
  const rootUrl = BASE_URL.replace(/\/api\/?$/, "");
  const start = Date.now();
  const res = await fetch(`${rootUrl}/health`);
  const responseTime = Date.now() - start;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { ...data, responseTime };
}

// ── Logs ───────────────────────────────────────────────────────────────────────

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  module: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface LogsFilter {
  limit?: number;
  level?: string;
  module?: string;
}

export async function getLogs(filter: LogsFilter = {}): Promise<LogEntry[]> {
  const p = new URLSearchParams();
  if (filter.limit) p.set("limit", String(filter.limit));
  if (filter.level && filter.level !== "ALL") p.set("level", filter.level);
  if (filter.module && filter.module !== "all") p.set("module", filter.module);
  const qs = p.toString();
  const raw = await request<unknown[]>(`/dev/logs${qs ? `?${qs}` : ""}`);
  return (raw ?? []).map((l: unknown, i) => {
    const log = l as Record<string, unknown>;
    const lvl = String(log.level ?? "INFO").toUpperCase();
    return {
      id: String(log.id ?? i),
      timestamp: String(log.timestamp ?? new Date().toISOString()),
      level: (["DEBUG","INFO","WARN","ERROR"].includes(lvl) ? lvl : "INFO") as LogEntry["level"],
      module: String(log.module ?? log.service ?? "api"),
      message: String(log.message ?? ""),
      metadata: (log.metadata as Record<string, unknown>) ?? undefined,
    };
  });
}

export async function clearLogs(): Promise<void> {
  return request<void>("/dev/logs", { method: "DELETE" });
}

// ── Subscriptions ──────────────────────────────────────────────────────────────

export interface AdminSubscription {
  id: string;
  userId: string;
  planId: string;
  branchId?: string | null;
  status: string;
  startDate: string;
  endDate?: string | null;
  renewalDate?: string | null;
  autoRenew: boolean;
  paymentMethod?: string | null;
  notes?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  userEmail: string;
  userFullName: string;
  planName: string;
  planPrice: number;
  billingPeriod: string;
}

export async function listSubscriptions(): Promise<AdminSubscription[]> {
  const res = await request<AdminSubscription[]>("/dev/subscriptions");
  return Array.isArray(res) ? res : [];
}

export async function getSubscription(id: string): Promise<AdminSubscription> {
  return request<AdminSubscription>(`/dev/subscriptions/${id}`);
}

export async function createSubscription(req: {
  userId: string; planId: string; branchId?: string;
  status?: string; autoRenew?: boolean; paymentMethod?: string; notes?: string;
}): Promise<AdminSubscription> {
  return request<AdminSubscription>("/dev/subscriptions", { method: "POST", body: JSON.stringify(req) });
}

export async function updateSubscription(id: string, req: Partial<{
  status: string; planId: string; autoRenew: boolean;
  paymentMethod: string; endDate: string; renewalDate: string; notes: string;
  // Notes can't be cleared just by omitting/nulling `notes` — the backend
  // can't tell "not provided" from "explicit null" via standard JSON
  // unmarshaling, so clearing it needs this explicit flag.
  clearNotes: boolean;
}>): Promise<AdminSubscription> {
  return request<AdminSubscription>(`/dev/subscriptions/${id}`, { method: "PUT", body: JSON.stringify(req) });
}

export async function deleteSubscription(id: string): Promise<void> {
  return request<void>(`/dev/subscriptions/${id}`, { method: "DELETE" });
}

export async function grantTrial(userId: string, days?: number, notes?: string): Promise<void> {
  return request<void>(`/dev/subscriptions/${userId}/grant-trial`, {
    method: "POST",
    body: JSON.stringify({ days, notes }),
  });
}

// ── Subscription Plans ─────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  billingPeriod: string;
  maxBranches?: number;
  maxStudents?: number;
  maxClasses?: number;
  features: Record<string, unknown>;
  isActive?: boolean;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export async function listPlans(): Promise<SubscriptionPlan[]> {
  const res = await request<SubscriptionPlan[]>("/dev/plans");
  return Array.isArray(res) ? res : [];
}

export async function createPlan(req: {
  name: string; description?: string; price: number; billingPeriod: string;
  maxBranches?: number; maxStudents?: number; maxClasses?: number;
  features?: Record<string, unknown>; status?: string;
}): Promise<SubscriptionPlan> {
  return request<SubscriptionPlan>("/dev/subscription-plans", { method: "POST", body: JSON.stringify(req) });
}

export async function updatePlan(id: string, req: Partial<{
  name: string; description: string; price: number; billingPeriod: string;
  maxBranches: number; maxStudents: number; maxClasses: number;
  features: Record<string, unknown>; status: string;
}>): Promise<SubscriptionPlan> {
  return request<SubscriptionPlan>(`/dev/subscription-plans/${id}`, { method: "PUT", body: JSON.stringify(req) });
}

export async function deletePlan(id: string): Promise<void> {
  return request<void>(`/dev/subscription-plans/${id}`, { method: "DELETE" });
}

// ── Payment Types ──────────────────────────────────────────────────────────────

export interface PaymentType {
  id: string;
  code: string;
  displayName: string;
  description?: string;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  config?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export async function listPaymentTypes(): Promise<PaymentType[]> {
  const res = await request<PaymentType[]>("/dev/payment-types");
  return Array.isArray(res) ? res : [];
}

export async function createPaymentType(req: {
  code: string; displayName: string; description?: string;
  isActive?: boolean; sortOrder?: number; config?: Record<string, unknown>;
}): Promise<PaymentType> {
  return request<PaymentType>("/dev/payment-types", { method: "POST", body: JSON.stringify(req) });
}

export async function updatePaymentType(id: string, req: Partial<{
  displayName: string; description: string; isActive: boolean; sortOrder: number;
}>): Promise<PaymentType> {
  return request<PaymentType>(`/dev/payment-types/${id}`, { method: "PATCH", body: JSON.stringify(req) });
}

export async function togglePaymentType(id: string): Promise<PaymentType> {
  return request<PaymentType>(`/dev/payment-types/${id}/toggle`, { method: "POST" });
}

export async function deletePaymentType(id: string): Promise<void> {
  return request<void>(`/dev/payment-types/${id}`, { method: "DELETE" });
}

// ── CRM Users ──────────────────────────────────────────────────────────────────

export interface CRMUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branchId?: string | null;
  createdAt?: string;
}

export async function listUsers(): Promise<CRMUser[]> {
  try {
    const res = await request<CRMUser[]>("/dev/users");
    if (Array.isArray(res)) return res;
  } catch { /* fallthrough */ }
  const res = await request<CRMUser[]>("/dev/crm/users");
  return Array.isArray(res) ? res : [];
}

// The backend only persists full_name/email/password from this body (other
// keys, e.g. role/branchId, are silently accepted-but-dropped) — matching
// that constraint here instead of exposing controls that would silently
// fail. Keys must stay snake_case; that's what the handler reads.
export async function updateUser(id: string, req: {
  full_name?: string; email?: string; password?: string;
}): Promise<CRMUser> {
  return request<CRMUser>(`/dev/crm/users/${id}`, { method: "PUT", body: JSON.stringify(req) });
}

export async function deleteUser(id: string): Promise<void> {
  return request<void>(`/dev/crm/users/${id}`, { method: "DELETE" });
}

// ── CRM Branches ──────────────────────────────────────────────────────────────

export interface CRMBranch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  monthlyPayment?: number;
  adminId?: string;
  createdAt?: string;
}

export async function listBranches(): Promise<CRMBranch[]> {
  const res = await request<CRMBranch[]>("/dev/crm/branches");
  return Array.isArray(res) ? res : [];
}

export async function createBranch(req: {
  name: string; address?: string; phone?: string; monthlyPayment?: number; adminId?: string;
}): Promise<CRMBranch> {
  return request<CRMBranch>("/dev/crm/branches", { method: "POST", body: JSON.stringify(req) });
}

export async function updateBranch(id: string, req: Partial<{
  name: string; address: string; phone: string; monthlyPayment: number; adminId: string;
}>): Promise<CRMBranch> {
  return request<CRMBranch>(`/dev/crm/branches/${id}`, { method: "PUT", body: JSON.stringify(req) });
}

export async function deleteBranch(id: string): Promise<void> {
  return request<void>(`/dev/crm/branches/${id}`, { method: "DELETE" });
}

// ── Dev Settings ──────────────────────────────────────────────────────────────

export async function getDevSettings(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/dev/settings");
}

export async function updateDevSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/dev/settings", { method: "PUT", body: JSON.stringify(settings) });
}

// ── Dev Notifications ─────────────────────────────────────────────────────────
// Distinct storage from /dev/settings — the dedicated endpoints for alert
// preferences and a real recent-activity feed.

export async function getNotificationPreferences(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/dev/notifications/preferences");
}

export async function updateNotificationPreferences(
  prefs: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/dev/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify(prefs),
  });
}

export interface RecentNotification {
  id: string;
  level: string;
  module?: string;
  message: string;
  createdAt: string;
}

export async function getRecentNotifications(): Promise<RecentNotification[]> {
  const res = await request<RecentNotification[]>("/dev/notifications/recent");
  return Array.isArray(res) ? res : [];
}

// Legacy compat for old imports
export const apiClient = {
  login: (email: string, password: string) => login(email, password),
  getDevLogs: (p?: { limit?: number; level?: string; module?: string }) => getLogs(p),
  clearDevLogs: clearLogs,
  getBranches: listBranches,
  getUsers: listUsers,
  healthCheck: getHealth,
  getDevSettings,
  updateDevSettings,
  setToken,
  clearToken,
  setOnUnauthorized,
};
