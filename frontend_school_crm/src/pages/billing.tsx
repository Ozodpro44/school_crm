import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import PricingTable from "@/components/PricingTable";
import {
  getCurrentSubscription,
  createSubscription,
  initiateClickUzPayment,
  initiateTelegramPayment,
} from "@/lib/subscription-api";
import { formatPrice } from "@/lib/subscription-api";
import type { SubscriptionPlan, SubscriptionResponse } from "@/types";
import { getCurrentUser } from "@/lib/auth";

type PaymentMethod = "click" | "telegram" | "manual";

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

// Returns the number of days until subscription endDate (negative if already past)
function getDaysUntilExpiry(sub: SubscriptionResponse): number {
  if (!sub.endDate) return Infinity;
  const end = new Date(sub.endDate).getTime();
  const now = Date.now();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

// Returns true if the subscription is a trial that ends within 7 days (or already ended)
function isTrialEndingSoon(sub: SubscriptionResponse): boolean {
  if (sub.status !== "trial") return false;
  if (!sub.endDate) return false;
  return getDaysUntilExpiry(sub) <= 7;
}

export default function BillingPage() {
  const router = useRouter();
  const [currentSub, setCurrentSub] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Payment modal state
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("click");
  const [paymentState, setPaymentState] = useState<PaymentState | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    setUserRole(user?.role ?? null);

    getCurrentSubscription()
      .then((sub) => {
        setCurrentSub(sub);
        // Redirect active users (or trial not ending soon) to dashboard
        if (sub && sub.status === "active") {
          router.replace("/");
          return;
        }
        if (sub && sub.status === "trial" && !isTrialEndingSoon(sub)) {
          router.replace("/");
          return;
        }
      })
      .catch(() => setCurrentSub(null))
      .finally(() => setLoading(false));
  }, [router]);

  // Step 1: user clicks "Select" on a plan — open payment modal
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

  // Step 2: user clicks "Pay" inside modal
  const handlePay = async () => {
    if (!selectedPlan) return;
    setPaying(true);
    setError(null);

    try {
      // Reuse existing subscription ID if already created — prevents duplicate
      // subscriptions when the user retries with a different payment method.
      let subId = paymentState?.subscriptionId;
      if (!subId) {
        const sub = await createSubscription({
          planId: selectedPlan.id,
          paymentMethod,
        });
        subId = (sub as any).id ?? (sub as any).subscription?.id;
        // Persist the ID so any subsequent retry skips re-creation.
        setPaymentState((prev) => prev ? { ...prev, subscriptionId: subId! } : prev);
      }

      if (paymentMethod === "click") {
        const data = await initiateClickUzPayment(subId);
        // Build Click.uz redirect URL
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

      // manual — just show confirmation
      setPaymentState({ step: "manual_pending", subscriptionId: subId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const isOwner = userRole === "admin";

  // Determine the status banner message for admin users
  const getAdminBanner = (): { text: string; subtext: string; color: "red" | "yellow" | "blue" } | null => {
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
  const bannerColors = {
    red:    "bg-red-50 border-red-200 text-red-800",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
    blue:   "bg-blue-50 border-blue-200 text-blue-800",
  };

  // Non-owner users (manager, teacher, accountant, branch_admin) should NOT
  // see the pricing table — just a blocked notice.
  if (!isOwner) {
    const isInactive =
      !currentSub ||
      !["active", "trial"].includes(currentSub.status ?? "") ||
      (currentSub.status === "trial" && getDaysUntilExpiry(currentSub) <= 0);

    if (isInactive) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Subscription Required
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Access to this CRM requires an active subscription. Please contact
              your school administrator to renew or activate the subscription.
            </p>
          </div>
        </div>
      );
    }

    // Trial user within valid period — redirect should have happened; show nothing
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Status banner for admin */}
        {adminBanner && (
          <div className={`mb-8 p-4 border rounded-lg text-center ${bannerColors[adminBanner.color]}`}>
            <p className="font-medium">{adminBanner.text}</p>
            {adminBanner.subtext && (
              <p className="text-sm mt-1 opacity-80">{adminBanner.subtext}</p>
            )}
          </div>
        )}

        <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">
          Subscription Plans
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Select a plan to activate your school CRM access.
        </p>

        <PricingTable
          onSelectPlan={handleSelectPlan}
          highlightPlanId={currentSub?.plan?.id}
        />
      </div>

      {/* Payment Modal */}
      {selectedPlan && paymentState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            {/* Choose payment method */}
            {paymentState.step === "method" && (
              <>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  Complete Your Purchase
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                  {selectedPlan.name} —{" "}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {formatPrice(selectedPlan.price)}/{selectedPlan.billingPeriod}
                  </span>
                </p>

                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Choose payment method
                </p>

                <div className="space-y-2 mb-5">
                  {(
                    [
                      {
                        id: "click" as PaymentMethod,
                        label: "Click.uz",
                        icon: "💳",
                        desc: "Pay online via Click.uz",
                      },
                      {
                        id: "telegram" as PaymentMethod,
                        label: "Telegram",
                        icon: "✈️",
                        desc: "Pay via Telegram bot",
                      },
                      {
                        id: "manual" as PaymentMethod,
                        label: "Bank Transfer",
                        icon: "🏦",
                        desc: "Manual bank transfer (contact admin)",
                      },
                    ] as const
                  ).map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        paymentMethod === m.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={m.id}
                        checked={paymentMethod === m.id}
                        onChange={() => setPaymentMethod(m.id)}
                        className="accent-blue-600"
                      />
                      <span className="text-xl">{m.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {m.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {m.desc}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                {error && (
                  <p className="text-sm text-red-600 mb-4">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePay}
                    disabled={paying}
                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                  >
                    {paying && (
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    )}
                    {paying ? "Processing…" : "Pay Now"}
                  </button>
                </div>
              </>
            )}

            {/* Telegram pending */}
            {paymentState.step === "telegram_pending" &&
              paymentState.telegramData && (
                <>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Telegram Payment
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {paymentState.telegramData.instruction}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                    Amount:{" "}
                    <span className="font-semibold">
                      {formatPrice(paymentState.telegramData.amount)}
                    </span>
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={closeModal}
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 dark:text-gray-300 hover:bg-gray-50 text-sm transition-colors"
                    >
                      Close
                    </button>
                    <a
                      href={paymentState.telegramData.telegram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium text-center hover:bg-blue-600 transition-colors"
                    >
                      Open Telegram
                    </a>
                  </div>
                </>
              )}

            {/* Manual pending */}
            {paymentState.step === "manual_pending" && (
              <>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Subscription Created
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Your subscription has been created and is pending payment.
                  Please contact the administrator to complete the bank transfer
                  and activate your account.
                </p>
                <p className="text-xs text-gray-400 mb-5">
                  Subscription ID:{" "}
                  <span className="font-mono">{paymentState.subscriptionId}</span>
                </p>
                <button
                  onClick={closeModal}
                  className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  OK
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
