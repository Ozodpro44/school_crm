/**
 * Single source of truth for client-side auth + branch state.
 *
 * Why this module exists:
 *   Auth/branch state used to be scattered across 7+ localStorage keys
 *   (auth_token, current_user, school_auth_user, token, selectedBranchId,
 *   lastSyncAt, ...) read and written by api.ts, auth.ts, auth-api.ts,
 *   BranchContext, and individual pages. That made user-switch / logout
 *   leak stale data and forced every caller to know all the keys.
 *
 *   All client-side persistence now goes through this module.
 *
 * Canonical keys:
 *   AUTH_TOKEN       — JWT string
 *   AUTH_USER        — JSON-serialized current user
 *   BRANCH_ID        — selected branch id (also sent as X-Branch-ID)
 *   LAST_SYNC_AT     — timestamp of last successful API response (offline UX)
 */

export const StorageKeys = {
  AUTH_TOKEN: "auth_token",
  AUTH_USER: "current_user",
  BRANCH_ID: "selectedBranchId",
  LAST_SYNC_AT: "lastSyncAt",
} as const;

// Custom DOM events used to broadcast auth/branch changes within the same tab.
// (The `storage` event only fires across tabs, so we need our own bus.)
export const AuthEvents = {
  LOGIN: "auth:login",
  LOGOUT: "auth:logout",
  BRANCH_CHANGE: "branch:change",
  BRANCH_ACCESS_DENIED: "branch:accessDenied",
  SUBSCRIPTION_LIMIT_REACHED: "subscription:limitReached",
} as const;

// ── primitives ─────────────────────────────────────────────────────────────

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function write(key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

function emit(type: string, detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

// ── token ──────────────────────────────────────────────────────────────────

export function getAuthToken(): string | null {
  return read(StorageKeys.AUTH_TOKEN);
}

export function setAuthToken(token: string): void {
  write(StorageKeys.AUTH_TOKEN, token);
}

// ── user ───────────────────────────────────────────────────────────────────

export interface StoredUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branchId?: string;
  branchIds?: string[];
  permissions?: Record<string, boolean>;
  [key: string]: unknown;
}

export function getStoredUser<T extends StoredUser = StoredUser>(): T | null {
  const raw = read(StorageKeys.AUTH_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser): void {
  write(StorageKeys.AUTH_USER, JSON.stringify(user));
}

// ── branch ─────────────────────────────────────────────────────────────────

export function getStoredBranchId(): string | null {
  return read(StorageKeys.BRANCH_ID);
}

export function setStoredBranchId(branchId: string): void {
  write(StorageKeys.BRANCH_ID, branchId);
  emit(AuthEvents.BRANCH_CHANGE, branchId);
}

export function clearStoredBranchId(): void {
  remove(StorageKeys.BRANCH_ID);
  emit(AuthEvents.BRANCH_CHANGE, null);
}

// ── sync timestamp ─────────────────────────────────────────────────────────

export function markLastSync(): void {
  write(StorageKeys.LAST_SYNC_AT, Date.now().toString());
}

export function getLastSyncAt(): number | null {
  const raw = read(StorageKeys.LAST_SYNC_AT);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// ── login / logout ─────────────────────────────────────────────────────────

/**
 * Persist a successful login: token + user + (optional) branch id.
 * Emits AuthEvents.LOGIN so listeners (BranchContext, LanguageContext) can
 * react without polling.
 */
export function persistLogin(payload: {
  token: string;
  user: StoredUser;
  branchId?: string;
}): void {
  setAuthToken(payload.token);
  setStoredUser(payload.user);
  if (payload.branchId) {
    write(StorageKeys.BRANCH_ID, payload.branchId);
  }
  emit(AuthEvents.LOGIN, { user: payload.user, branchId: payload.branchId });
}

/**
 * Wipe all client-side auth state. Emits AuthEvents.LOGOUT.
 *
 * Also strips legacy keys (`school_auth_user`, `token`) from prior versions
 * of the app so a re-login lands in a clean state.
 */
export function clearAuthState(): void {
  remove(StorageKeys.AUTH_TOKEN);
  remove(StorageKeys.AUTH_USER);
  remove(StorageKeys.BRANCH_ID);
  remove(StorageKeys.LAST_SYNC_AT);
  // legacy keys — safe to remove unconditionally
  remove("school_auth_user");
  remove("token");
  emit(AuthEvents.LOGOUT);
}
