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

export default function BillingPage() {
  const router = useRouter();
  const [currentSub, setCurrentSub] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment modal state
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("click");
  const [paymentState, setPaymentState] = useState<PaymentState | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    getCurrentSubscription()
      .then((sub) => {
        setCurrentSub(sub);
        if (sub && (sub.status === "active" || sub.status === "trial")) {
          router.replace("/");
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
      // Always create the subscription first
      const sub = await createSubscription({
        planId: selectedPlan.id,
        paymentMethod,
      });

      const subId = (sub as any).id ?? (sub as any).subscription?.id;

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

  const isBlocked =
    currentSub && !["active", "trial"].includes(currentSub.status ?? "");
  const statusMessage: Record<string, string> = {
    expired: "Your subscription has expired.",
    cancelled: "Your subscription has been cancelled.",
    paused: "Your subscription is currently paused.",
    pending_payment: "Your subscription is pending payment.",
    past_due: "Your subscription payment is past due.",
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Status banner */}
        {isBlocked && currentSub?.status && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-red-800 font-medium">
              {statusMessage[currentSub.status] ?? "Your subscription is inactive."}
            </p>
            <p className="text-red-600 text-sm mt-1">
              Choose a plan below to restore access to your CRM.
            </p>
          </div>
        )}

        {!currentSub && (
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <p className="text-blue-800 font-medium">
              Welcome! Choose a plan to get started.
            </p>
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
