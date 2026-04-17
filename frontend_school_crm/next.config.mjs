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

const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    rules: getTurboRules(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  allowedDevOrigins: ["*.daytona.work", "*.softgen.dev"],
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.softgen.ai https://cdn.softgen.dev; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://incredible-love-production-0008.up.railway.app https://*.railway.app http://localhost:* https://*.sentry.io; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; worker-src blob:;",
          },
        ],
      },
    ];
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
