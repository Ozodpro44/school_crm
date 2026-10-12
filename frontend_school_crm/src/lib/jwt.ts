/**
 * Client-side JWT expiry check. UI nicety only: the backend is the source of
 * truth and always re-validates the token.
 */
export function isTokenExpired(token: string | null, skewSeconds = 5): boolean {
  if (!token) return false; // no token: nothing to expire (other guards handle this)
  try {
    const part = token.split(".")[1];
    if (!part) return false;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    if (typeof payload.exp !== "number") return false;
    return payload.exp <= Math.floor(Date.now() / 1000) + skewSeconds;
  } catch {
    return false;
  }
}
