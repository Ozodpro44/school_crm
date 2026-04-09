import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import PricingTable from "@/components/PricingTable";
import { getCurrentSubscription, createSubscription } from "@/lib/subscription-api";
import type { SubscriptionPlan, SubscriptionResponse } from "@/types";

export default function BillingPage() {
  const router = useRouter();
  const [currentSub, setCurrentSub] = useState<SubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentSubscription()
      .then((sub) => {
        setCurrentSub(sub);
        // If subscription is active/trial, go back to dashboard
        if (sub && (sub.status === "active" || sub.status === "trial")) {
          router.replace("/");
        }
      })
      .catch(() => setCurrentSub(null))
      .finally(() => setLoading(false));
  }, [router]);

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    setSubscribing(true);
    setError(null);
    try {
      await createSubscription({
        planId: plan.id,
        paymentMethod: "manual",
      });
      // Redirect to dashboard after subscribing
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create subscription");
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const isBlocked = currentSub && !["active", "trial"].includes(currentSub.status ?? "");
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
            <p className="text-blue-800 font-medium">Welcome! Choose a plan to get started.</p>
          </div>
        )}

        <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">
          Subscription Plans
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Select a plan to activate your school CRM access.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-center text-red-700 text-sm">
            {error}
          </div>
        )}

        {subscribing ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3" />
            <span className="text-gray-600">Creating your subscription…</span>
          </div>
        ) : (
          <PricingTable
            onSelectPlan={handleSelectPlan}
            highlightPlanId={currentSub?.plan?.id}
          />
        )}
      </div>
    </div>
  );
}
