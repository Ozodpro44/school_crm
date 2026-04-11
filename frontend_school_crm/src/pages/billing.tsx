import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import PricingTable from "@/components/PricingTable";
import {
  getCurrentSubscription,
  createSubscription,
  initiateClickUzPayment,
  initiateTelegramPayment,
  getActivePaymentTypes,
  type ActivePaymentType,
} from "@/lib/subscription-api";
import { formatPrice } from "@/lib/subscription-api";
import type { SubscriptionPlan, SubscriptionResponse } from "@/types";
import { getCurrentUser } from "@/lib/auth";

// PaymentMethod is now a dynamic string (the code from payment_types table)
type PaymentMethod = string;

interface PaymentState {
  step: "method" | "click_pending" | "telegram_pending" | "manual_pending";
  subscriptionId?: string;
  clickData?: {
    payment_id: string;
    amount: number;
    merchant_id: string;
    service_id: string;
  };
  telegramData?: {
    telegram_url: string;
    instruction: string;
    amount: number;
  };
}

function getDaysUntilExpiry(sub: SubscriptionResponse): number {
  if (!sub.endDate) return Infinity;
  const end = new Date(sub.endDate).getTime();
  const now = Date.now();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

function isTrialEndingSoon(sub: SubscriptionResponse): boolean {
  if (sub.status !== "trial") return false;
  if (!sub.endDate) return false;
  return getDaysUntilExpiry(sub) <= 7;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ─── Payment method icon helpers ──────────────────────────────────────────────

function iconForCode(code: string): React.ReactNode {
  if (code === "click") return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path strokeLinecap="round" d="M2 10h20" />
    </svg>
  );
  if (code === "telegram") return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.88 13.47l-2.967-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.836.95l-.531-.861z" />
    </svg>
  );
  // default: bank/generic
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l9-3 9 3M3 6v14m18-14v14M3 20h18M9 10v10M15 10v10" />
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function BillingPage() {
  const router = useRouter();
  const [currentSub, setCurrentSub] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [paymentTypes, setPaymentTypes] = useState<ActivePaymentType[]>([]);

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("click");
  const [paymentState, setPaymentState] = useState<PaymentState | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    setUserRole(user?.role ?? null);

    Promise.all([
      getCurrentSubscription().catch(() => null),
      getActivePaymentTypes(),
    ]).then(([sub, types]) => {
      setPaymentTypes(types);
      setCurrentSub(sub);
      if (types.length > 0) {
        setPaymentMethod(types[0].code);
      }
      if (sub && sub.status === "active") {
        router.replace("/");
        return;
      }
      if (sub && sub.status === "trial" && !isTrialEndingSoon(sub)) {
        router.replace("/");
        return;
      }
    }).finally(() => setLoading(false));
  }, [router]);

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setPaymentMethod("click");
    setPaymentState({ step: "method" });
    setError(null);
  };

  const closeModal = () => {
    setSelectedPlan(null);
    setPaymentState(null);
    setError(null);
  };

  const handlePay = async () => {
    if (!selectedPlan) return;
    setPaying(true);
    setError(null);

    try {
      let subId = paymentState?.subscriptionId;
      if (!subId) {
        const sub = await createSubscription({ planId: selectedPlan.id, paymentMethod });
        subId = (sub as any).id ?? (sub as any).subscription?.id;
        setPaymentState((prev) => prev ? { ...prev, subscriptionId: subId! } : prev);
      }

      if (paymentMethod === "click") {
        const data = await initiateClickUzPayment(subId);
        const clickUrl =
          `https://my.click.uz/services/pay?service_id=${data.service_id}` +
          `&merchant_id=${data.merchant_id}` +
          `&amount=${data.amount}` +
          `&transaction_param=${data.payment_id}` +
          `&return_url=${encodeURIComponent(window.location.origin + "/billing")}`;
        window.location.href = clickUrl;
        return;
      }

      if (paymentMethod === "telegram") {
        const data = await initiateTelegramPayment(subId);
        setPaymentState({
          step: "telegram_pending",
          subscriptionId: subId,
          telegramData: {
            telegram_url: data.telegram_url,
            instruction: data.instruction,
            amount: data.amount,
          },
        });
        return;
      }

      // All other payment methods (manual / bank transfer / custom) → show pending
      setPaymentState({ step: "manual_pending", subscriptionId: subId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading subscription info…</p>
        </div>
      </div>
    );
  }

  const isOwner = userRole === "admin";

  // ── Non-owner blocked state ───────────────────────────────────────────────

  if (!isOwner) {
    const isInactive =
      !currentSub ||
      !["active", "trial"].includes(currentSub.status ?? "") ||
      (currentSub.status === "trial" && getDaysUntilExpiry(currentSub) <= 0);

    if (isInactive) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
          <div className="max-w-sm w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-5">
              <AlertIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Subscription Required
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              Access to this CRM requires an active subscription. Please contact
              your school administrator to renew or activate the subscription.
            </p>
          </div>
        </div>
      );
    }

    return null;
  }

  // ── Status banner ──────────────────────────────────────────────────────────

  type BannerConfig = {
    text: string;
    subtext: string;
    color: "red" | "yellow" | "blue";
  };

  const getAdminBanner = (): BannerConfig | null => {
    if (!currentSub) {
      return { text: "Welcome! Choose a plan to get started.", subtext: "", color: "blue" };
    }
    const status = currentSub.status;
    if (status === "trial" && isTrialEndingSoon(currentSub)) {
      const days = getDaysUntilExpiry(currentSub);
      if (days <= 0) {
        return {
          text: "Your trial period has ended.",
          subtext: "Choose a plan below to restore access.",
          color: "red",
        };
      }
      return {
        text: `Your trial period ends in ${days} day${days === 1 ? "" : "s"}.`,
        subtext: "Choose a plan below to continue without interruption.",
        color: "yellow",
      };
    }
    if (status === "expired" || status === "cancelled" || status === "past_due") {
      const msgs: Record<string, string> = {
        expired: "Your subscription has expired.",
        cancelled: "Your subscription has been cancelled.",
        past_due: "Your subscription payment is past due.",
      };
      return {
        text: msgs[status] ?? "Your subscription is inactive.",
        subtext: "Choose a plan below to renew.",
        color: "red",
      };
    }
    if (status === "pending_payment") {
      return {
        text: "Payment pending.",
        subtext: "Complete payment or choose a different plan.",
        color: "yellow",
      };
    }
    if (status === "paused") {
      return {
        text: "Your subscription is currently paused.",
        subtext: "Choose a plan below to restore access.",
        color: "yellow",
      };
    }
    return null;
  };

  const adminBanner = getAdminBanner();

  const bannerConfig = {
    red: {
      wrapper: "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800",
      icon: <AlertIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />,
      titleClass: "text-red-800 dark:text-red-300 font-semibold",
      subtextClass: "text-red-700 dark:text-red-400",
    },
    yellow: {
      wrapper: "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800",
      icon: <ClockIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />,
      titleClass: "text-amber-800 dark:text-amber-300 font-semibold",
      subtextClass: "text-amber-700 dark:text-amber-400",
    },
    blue: {
      wrapper: "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800",
      icon: <InfoIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />,
      titleClass: "text-blue-800 dark:text-blue-300 font-semibold",
      subtextClass: "text-blue-700 dark:text-blue-400",
    },
  };

  // ── Page render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 py-14 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Subscription Plans
          </h1>
          <p className="mt-3 text-base text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
            Select a plan to activate your school CRM access. All plans include full platform features.
          </p>
        </div>

        {/* Status banner */}
        {adminBanner && (
          <div className={`mb-8 rounded-xl px-5 py-4 flex items-start gap-3 ${bannerConfig[adminBanner.color].wrapper}`}>
            {bannerConfig[adminBanner.color].icon}
            <div>
              <p className={`text-sm ${bannerConfig[adminBanner.color].titleClass}`}>
                {adminBanner.text}
              </p>
              {adminBanner.subtext && (
                <p className={`text-xs mt-0.5 ${bannerConfig[adminBanner.color].subtextClass}`}>
                  {adminBanner.subtext}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Pricing table */}
        <PricingTable
          onSelectPlan={handleSelectPlan}
          highlightPlanId={currentSub?.plan?.id}
        />
      </div>

      {/* ── Payment Modal ──────────────────────────────────────────────────── */}
      {selectedPlan && paymentState && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* ── Step: Choose method ──────────────────────────────────────── */}
            {paymentState.step === "method" && (
              <>
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      Complete Your Purchase
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {selectedPlan.name} &mdash;{" "}
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatPrice(selectedPlan.price)}/{selectedPlan.billingPeriod}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Close"
                  >
                    <XIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Payment methods */}
                <div className="px-6 pt-4 pb-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    Choose payment method
                  </p>
                  <div className="space-y-2">
                    {paymentTypes.map((m) => (
                      <button
                        key={m.code}
                        type="button"
                        onClick={() => setPaymentMethod(m.code)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left
                          ${paymentMethod === m.code
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/50"
                          }`}
                      >
                        <div className={`p-2 rounded-lg ${paymentMethod === m.code ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}>
                          {iconForCode(m.code)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${paymentMethod === m.code ? "text-blue-900 dark:text-blue-100" : "text-gray-900 dark:text-white"}`}>
                            {m.displayName}
                          </p>
                          {m.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {m.description}
                            </p>
                          )}
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${paymentMethod === m.code ? "border-blue-500" : "border-gray-300 dark:border-gray-600"}`}>
                          {paymentMethod === m.code && (
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="mx-6 mt-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="px-6 py-5 flex gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePay}
                    disabled={paying}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {paying ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Processing…
                      </>
                    ) : (
                      "Pay Now"
                    )}
                  </button>
                </div>
              </>
            )}

            {/* ── Step: Telegram pending ───────────────────────────────────── */}
            {paymentState.step === "telegram_pending" && paymentState.telegramData && (
              <>
                <div className="px-6 pt-6 pb-4 text-center">
                  <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.88 13.47l-2.967-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.836.95l-.531-.861z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    Pay via Telegram
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {paymentState.telegramData.instruction}
                  </p>
                  <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2 mb-5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Amount:</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {formatPrice(paymentState.telegramData.amount)}
                    </span>
                  </div>
                </div>
                <div className="px-6 pb-5 flex gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                  <a
                    href={paymentState.telegramData.telegram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold text-center transition-colors"
                  >
                    Open Telegram
                  </a>
                </div>
              </>
            )}

            {/* ── Step: Manual pending ─────────────────────────────────────── */}
            {paymentState.step === "manual_pending" && (
              <>
                <div className="px-6 pt-6 pb-4 text-center">
                  <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircleIcon className="w-7 h-7 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    Subscription Created
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                    Your subscription has been created and is pending payment.
                    Please contact the administrator to complete the bank transfer
                    and activate your account.
                  </p>
                  {paymentState.subscriptionId && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-2 mb-5 text-left">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Subscription ID</p>
                      <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">
                        {paymentState.subscriptionId}
                      </p>
                    </div>
                  )}
                </div>
                <div className="px-6 pb-5">
                  <button
                    onClick={closeModal}
                    className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
