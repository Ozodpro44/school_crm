import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  getCurrentSubscription,
  getSubscriptionPayments,
  getSubscriptionUsage,
  cancelSubscription,
  updateSubscriptionStatus,
  isSubscriptionActive,
  isExpiringsoon,
  getDaysUntilRenewal,
} from "@/lib/subscription-api";
import {
  Subscription,
  SubscriptionPayment,
  SubscriptionUsage,
} from "@/types";

export default function SubscriptionDetailsPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [usage, setUsage] = useState<SubscriptionUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    loadSubscriptionDetails();
  }, []);

  const loadSubscriptionDetails = async () => {
    try {
      setLoading(true);
      const [subData, paymentsData, usageData] = await Promise.all([
        getCurrentSubscription(),
        getSubscriptionPayments(""),
        getSubscriptionUsage(""),
      ]);

      if (subData) {
        setSubscription(subData);
        const paymentsResult = await getSubscriptionPayments(subData.id);
        const usageResult = await getSubscriptionUsage(subData.id);
        setPayments(paymentsResult);
        setUsage(usageResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    try {
      setIsCancelling(true);
      setError(null);
      await cancelSubscription(subscription.id);
      await loadSubscriptionDetails();
      setShowCancelConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUpdateStatus = async (newStatus: "active" | "paused") => {
    if (!subscription) return;

    try {
      await updateSubscriptionStatus(subscription.id, newStatus);
      await loadSubscriptionDetails();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update subscription");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              No Active Subscription
            </h1>
            <p className="text-gray-600 mb-6">
              You don't have an active subscription yet. Browse our plans to get
              started.
            </p>
            <button
              onClick={() => router.push("/subscriptions")}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  const daysUntilRenewal = getDaysUntilRenewal(subscription);
  const isActive = isSubscriptionActive(subscription);
  const expiringSoon = isExpiringsoon(subscription);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Subscription Details</h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Status Alert */}
        {!isActive && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-700">
              Your subscription is {subscription.status}. Please renew to continue
              using premium features.
            </p>
          </div>
        )}

        {expiringSoon && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-orange-700">
              Your subscription expires in {daysUntilRenewal} days. Please renew to
              avoid service interruption.
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Status</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 text-sm">Status</p>
                  <p className="text-lg font-semibold text-gray-900 capitalize">
                    {subscription.status}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Start Date</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(subscription.startDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Renewal Date</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {subscription.renewalDate
                      ? new Date(subscription.renewalDate).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Auto-Renew</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {subscription.autoRenew ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                {subscription.status === "active" ? (
                  <>
                    <button
                      onClick={() => handleUpdateStatus("paused")}
                      className="flex-1 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
                    >
                      Pause Subscription
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : subscription.status === "paused" ? (
                  <button
                    onClick={() => handleUpdateStatus("active")}
                    className="w-full bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Resume Subscription
                  </button>
                ) : null}
              </div>
            </div>

            {/* Usage Card */}
            {usage.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Usage</h2>
                <div className="space-y-4">
                  {usage.map((item) => (
                    <div key={item.id}>
                      <div className="flex justify-between mb-2">
                        <span className="capitalize text-gray-700">
                          {item.metricName}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {item.currentUsage}
                          {item.limitValue ? `/${item.limitValue}` : ""}
                        </span>
                      </div>
                      {item.limitValue && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              (item.currentUsage / item.limitValue) * 100 > 80
                                ? "bg-red-500"
                                : "bg-green-500"
                            }`}
                            style={{
                              width: `${Math.min(
                                (item.currentUsage / item.limitValue) * 100,
                                100
                              )}%`,
                            }}
                          ></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Payment History Sidebar */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Payment History
            </h2>
            {payments.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="pb-3 border-b border-gray-200 last:border-b-0"
                  >
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900">
                        ${payment.amount.toFixed(2)}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          payment.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : payment.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {payment.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-sm">No payments yet</p>
            )}
          </div>
        </div>

        {/* Cancel Confirmation Modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Cancel Subscription?
              </h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to cancel your subscription? You will lose
                access to premium features immediately.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={isCancelling}
                  className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isCancelling ? "Cancelling..." : "Cancel Subscription"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
