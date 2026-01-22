import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  getSubscriptionPlans,
  getCurrentSubscription,
  createSubscription,
  formatPrice,
  getPlanBadgeColor,
  initiateClickUzPayment,
  initiateTelegramPayment,
} from "@/lib/subscription-api";
import { SubscriptionPlan, Subscription } from "@/types";

export default function SubscriptionsPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] =
    useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentPending, setPaymentPending] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"telegram" | "test">("telegram");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansData, subscriptionData] = await Promise.all([
        getSubscriptionPlans(),
        getCurrentSubscription(),
      ]);
      setPlans(plansData);
      setCurrentSubscription(subscriptionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubscription = async (planId: string) => {
    try {
      setIsCreating(true);
      setError(null);
      const response = await createSubscription({
        planId,
        paymentMethod: "card",
      });

      // Check if payment is required
      const result = response as any;
      if (result.payment_required && result.subscription?.id) {
        setPaymentPending(result.subscription.id);
        setShowPaymentModal(true);
      } else {
        await loadData();
        setSelectedPlanId(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create subscription",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handlePayClick = async () => {
    if (!paymentPending) return;
    try {
      setIsCreating(true);
      
      if (paymentMethod === "telegram") {
        // Use Telegram payment
        const paymentInfo = await initiateTelegramPayment(paymentPending);
        
        // Open Telegram bot payment link
        window.open(paymentInfo.telegram_link, "_blank");
        
        setShowPaymentModal(false);
        setPaymentPending(null);
        alert("Please complete payment in Telegram. Your subscription will activate after payment.");
      } else {
        // Use test payment
        const paymentInfo = await initiateClickUzPayment(paymentPending);
        
        const testPaymentUrl = `http://localhost:8080/api/dev/test-payment?invoice_id=${paymentInfo.invoice_number}`;
        
        const instructions = `Payment initiated successfully!\n\nInvoice: ${paymentInfo.invoice_number}\nAmount: $${paymentInfo.amount}\n\nTo test payment completion:\n\n1. Copy this URL:\n${testPaymentUrl}\n\n2. Open it in your browser or use curl:\ncurl -X POST "${testPaymentUrl}"\n\n3. Then refresh this page to see your active subscription.`;
        
        alert(instructions);
        setShowPaymentModal(false);
        setPaymentPending(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to initiate payment",
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Subscription Plans
          </h1>
          <p className="text-gray-600">
            Choose the perfect plan for your school
          </p>
        </div>

        {/* Current Subscription Info */}
        {currentSubscription && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">
              Your Current Subscription
            </h2>
            <p className="text-blue-700">
              You are currently on the{" "}
              <strong>
                {plans.find((p) => p.id === currentSubscription.planId)?.name}
              </strong>{" "}
              plan until{" "}
              <strong>
                {currentSubscription.renewalDate
                  ? new Date(currentSubscription.renewalDate).toLocaleDateString()
                  : currentSubscription.endDate
                    ? new Date(currentSubscription.endDate).toLocaleDateString()
                    : "N/A"}
              </strong>
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 font-semibold mb-2">
              Error Loading Plans
            </p>
            <p className="text-red-600 text-sm">{error}</p>
            {error.includes("table not initialized") && (
              <p className="text-red-600 text-sm mt-2">
                Please contact your administrator to seed the subscription
                plans.
              </p>
            )}
          </div>
        )}

        {/* Plans Grid */}
        {plans.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              No subscription plans available yet.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden border border-gray-200"
            >
              {/* Plan Header */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                {plan.description && (
                  <p className="text-blue-100 text-sm">{plan.description}</p>
                )}
              </div>

              {/* Plan Body */}
              <div className="p-6">
                {/* Price */}
                <div className="mb-6">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatPrice(plan.price)}
                  </div>
                  <p className="text-gray-600 text-sm">
                    per {plan.billingPeriod}
                  </p>
                </div>

                {/* Limits */}
                <div className="mb-6 space-y-3">
                  {plan.maxBranches && (
                    <div className="flex items-center text-gray-700">
                      <svg
                        className="w-5 h-5 text-green-500 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Up to {plan.maxBranches} branches</span>
                    </div>
                  )}
                  {plan.maxStudents && (
                    <div className="flex items-center text-gray-700">
                      <svg
                        className="w-5 h-5 text-green-500 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Up to {plan.maxStudents} students</span>
                    </div>
                  )}
                  {plan.maxClasses && (
                    <div className="flex items-center text-gray-700">
                      <svg
                        className="w-5 h-5 text-green-500 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Up to {plan.maxClasses} classes</span>
                    </div>
                  )}
                </div>

                {/* Features */}
                {Object.keys(plan.features || {}).length > 0 && (
                  <div className="mb-6 pb-6 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">
                      Features
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(plan.features || {}).map(
                        ([key, value]) => (
                          <div key={key} className="text-sm text-gray-600">
                            {typeof value === "boolean" && value ? "✓" : ""}
                            {" " + key.replace(/_/g, " ")}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={() => handleCreateSubscription(plan.id)}
                  disabled={
                    isCreating || currentSubscription?.planId === plan.id
                  }
                  className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                    currentSubscription?.planId === plan.id
                      ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {currentSubscription?.planId === plan.id
                    ? "Current Plan"
                    : isCreating
                      ? "Subscribing..."
                      : "Choose Plan"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I change my plan?
              </h3>
              <p className="text-gray-600">
                Yes, you can upgrade or downgrade your plan at any time. Changes
                will take effect on your next billing cycle.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                What happens when I cancel?
              </h3>
              <p className="text-gray-600">
                Your subscription will remain active until the end of your
                current billing period. After that, you'll lose access to
                premium features.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Do you offer refunds?
              </h3>
              <p className="text-gray-600">
                Yes, we offer a 14-day money-back guarantee if you're not
                satisfied with your plan.
              </p>
            </div>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Choose Payment Method
              </h2>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600">Subscription ID:</p>
                <p className="font-mono text-sm text-gray-900">
                  {paymentPending?.substring(0, 8)}...
                </p>
              </div>
              
              {/* Payment Method Selection */}
              <div className="space-y-3 mb-6">
                <label className="flex items-center p-4 border-2 rounded-lg cursor-pointer" style={{borderColor: paymentMethod === "telegram" ? "#0088cc" : "#ddd", backgroundColor: paymentMethod === "telegram" ? "#f0f8ff" : "white"}}>
                  <input
                    type="radio"
                    name="payment"
                    value="telegram"
                    checked={paymentMethod === "telegram"}
                    onChange={(e) => setPaymentMethod(e.target.value as "telegram")}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">Telegram Payment</p>
                    <p className="text-sm text-gray-600">Pay via Telegram bot @CLICKtest</p>
                  </div>
                </label>
                
                <label className="flex items-center p-4 border-2 rounded-lg cursor-pointer" style={{borderColor: paymentMethod === "test" ? "#0088cc" : "#ddd", backgroundColor: paymentMethod === "test" ? "#f0f8ff" : "white"}}>
                  <input
                    type="radio"
                    name="payment"
                    value="test"
                    checked={paymentMethod === "test"}
                    onChange={(e) => setPaymentMethod(e.target.value as "test")}
                    className="mr-3"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">Test Payment</p>
                    <p className="text-sm text-gray-600">For development only</p>
                  </div>
                </label>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentPending(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePayClick}
                  disabled={isCreating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isCreating ? "Processing..." : "Continue"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
