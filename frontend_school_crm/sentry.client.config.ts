import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialize when DSN is provided — graceful when missing.
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Capture 10% of transactions for performance monitoring.
    tracesSampleRate: 0.1,

    // Replay 5% of sessions, 100% of sessions with errors.
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        // Don't capture passwords or token inputs.
        maskAllInputs: true,
        blockAllMedia: false,
      }),
    ],

    // Suppress noisy network errors from poor connections.
    ignoreErrors: [
      "Network request failed",
      "Failed to fetch",
      "NetworkError",
      "TypeError: Failed to fetch",
      "TypeError: NetworkError when attempting to fetch resource.",
    ],
  });
}
