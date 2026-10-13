/**
 * API Configuration
 *
 * Only values that are safe to ship to the browser belong here: everything
 * prefixed VITE_ is inlined into the public JS bundle at build time, so
 * credentials (e.g. a Railway API token) must never be added as VITE_ vars.
 */

export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'),
  devMode: import.meta.env.VITE_DEV_MODE === 'true',
  debugApi: import.meta.env.VITE_DEBUG_API === 'true',
} as const;

export function isApiReady(): boolean {
  return !!API_CONFIG.baseUrl;
}
