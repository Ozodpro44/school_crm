import type { Tone } from "@/components/kit/StatusPill";

// Must match the backend's subscriptions.status check constraint exactly.
export const SUBSCRIPTION_STATUSES = [
  "active", "trial", "pending_payment", "past_due", "expired", "cancelled", "paused",
] as const;

export const SUB_STATUS_TONE: Record<string, Tone> = {
  active: "healthy",
  trial: "info",
  pending_payment: "warning",
  past_due: "warning",
  expired: "critical",
  cancelled: "neutral",
  paused: "accent",
};

export const SUB_STATUS_LABEL_KEY: Record<string, string> = {
  active: "statActive",
  trial: "statTrial",
  pending_payment: "statPendingPayment",
  past_due: "statPastDue",
  expired: "statExpiredSub",
  cancelled: "statCancelled",
  paused: "statPaused",
};

export function subStatusTone(status: string | undefined): Tone {
  return SUB_STATUS_TONE[(status ?? "").toLowerCase()] ?? "neutral";
}
