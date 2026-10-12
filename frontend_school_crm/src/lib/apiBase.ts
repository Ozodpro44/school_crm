/**
 * Single source for the backend API base URL, shared by api.ts,
 * auth-api.ts and subscription-api.ts.
 */

const DEFAULT_API_URL = "http://localhost:8080/api/v1";

function resolveApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid NEXT_PUBLIC_API_URL: ${raw}`);
  }
  const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:" && !isLocal) {
    throw new Error("NEXT_PUBLIC_API_URL must use https in production");
  }
  return raw;
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * Unauthenticated JSON request (password-reset flows, public plan listing).
 * Never sends a token and never triggers logout.
 */
export async function publicRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      let message = `Error: ${response.status} ${response.statusText}`;
      try {
        const parsed = JSON.parse(text);
        message = parsed.error || parsed.message || message;
      } catch {
        message = text || message;
      }
      throw new Error(message);
    }
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
