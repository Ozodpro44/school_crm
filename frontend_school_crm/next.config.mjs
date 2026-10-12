/** @type {import('next').NextConfig} */
import { withSentryConfig } from "@sentry/nextjs";
import { createRequire } from "module";

// Check if element-tagger is available
function isElementTaggerAvailable() {
  try {
    const require = createRequire(import.meta.url);
    require.resolve("@softgenai/element-tagger");
    return true;
  } catch {
    return false;
  }
}

// Build turbo rules only if tagger is available
function getTurboRules() {
  if (!isElementTaggerAvailable()) {
    console.log(
      "[Softgen] Element tagger not found, skipping loader configuration"
    );
    return {};
  }

  return {
    "*.tsx": ["@softgenai/element-tagger"],
    "*.jsx": ["@softgenai/element-tagger"],
  };
}

const isProd = process.env.NODE_ENV === "production";

const DEFAULT_API_URL = "http://localhost:8080/api/v1";

function apiOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).origin;
  } catch {
    return new URL(DEFAULT_API_URL).origin;
  }
}

// Single source of truth for security headers (do not duplicate in vercel.json
// or middleware). 'unsafe-inline' scripts remain because Next.js emits inline
// bootstrap scripts; 'unsafe-eval' is only needed by the dev server/HMR.
function buildCsp() {
  const connect = ["'self'", apiOrigin(), "https://*.sentry.io"];
  if (!isProd) connect.push("http://localhost:*", "ws://localhost:*");
  const script = ["'self'", "'unsafe-inline'"];
  if (!isProd) script.push("'unsafe-eval'");
  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `connect-src ${connect.join(" ")}`,
    "img-src 'self' data: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    rules: getTurboRules(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(apiOrigin()).hostname,
      },
    ],
  },
  allowedDevOrigins: ["*.daytona.work", "*.softgen.dev"],
  output: "standalone",
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};


// Wrap with Sentry only when DSN is set — no-op otherwise.
const hasSentryDSN = !!(
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN
);

export default hasSentryDSN
  ? withSentryConfig(nextConfig, {
      // Sentry webpack plugin options
      silent: true,       // suppress build-time output
      hideSourceMaps: true,
      disableLogger: true,
      // Source maps are uploaded to Sentry, not served publicly.
      widenClientFileUpload: true,
      // Disable automatic instrumentation of server components (Pages Router app).
      autoInstrumentServerFunctions: false,
    })
  : nextConfig;
