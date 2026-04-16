/**
 * Frontend environment config validation.
 *
 * Call validateConfig() once at app startup (_app.tsx).
 * Returns a list of human-readable errors — empty means all good.
 *
 * Rules:
 *  - NEXT_PUBLIC_API_URL must be set in production
 *  - Must not end with a trailing slash (causes double-slash in URLs)
 *  - Must start with http:// or https://
 */

export interface ConfigError {
  variable: string;
  message: string;
  fatal: boolean;
}

export function validateConfig(): ConfigError[] {
  const errors: ConfigError[] = [];
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const isProduction = process.env.NODE_ENV === "production";

  if (!apiUrl) {
    errors.push({
      variable: "NEXT_PUBLIC_API_URL",
      message: isProduction
        ? "NEXT_PUBLIC_API_URL is not set. API calls will fail in production."
        : "NEXT_PUBLIC_API_URL is not set — falling back to http://localhost:8080/api/v1",
      fatal: isProduction,
    });
  } else {
    if (!apiUrl.startsWith("http://") && !apiUrl.startsWith("https://")) {
      errors.push({
        variable: "NEXT_PUBLIC_API_URL",
        message: `NEXT_PUBLIC_API_URL must start with http:// or https:// (got: "${apiUrl}")`,
        fatal: true,
      });
    }
    if (apiUrl.endsWith("/")) {
      errors.push({
        variable: "NEXT_PUBLIC_API_URL",
        message: `NEXT_PUBLIC_API_URL must not end with a trailing slash (got: "${apiUrl}")`,
        fatal: false,
      });
    }
  }

  return errors;
}

/** Returns true if any fatal config error exists. */
export function hasFatalConfigError(errors: ConfigError[]): boolean {
  return errors.some((e) => e.fatal);
}
