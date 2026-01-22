import React, { useState, useEffect } from "react";
import { getSubscriptionPlans, formatPrice } from "@/lib/subscription-api";
import { SubscriptionPlan } from "@/types";

interface PricingTableProps {
  onSelectPlan?: (plan: SubscriptionPlan) => void;
  highlightPlanId?: string;
}

export default function PricingTable({
  onSelectPlan,
  highlightPlanId,
}: PricingTableProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const data = await getSubscriptionPlans();
      setPlans(data);
    } catch (error) {
      console.error("Failed to load plans:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-3 text-left text-gray-900 font-semibold">
              Plan
            </th>
            <th className="border border-gray-300 px-4 py-3 text-center text-gray-900 font-semibold">
              Price
            </th>
            <th className="border border-gray-300 px-4 py-3 text-center text-gray-900 font-semibold">
              Branches
            </th>
            <th className="border border-gray-300 px-4 py-3 text-center text-gray-900 font-semibold">
              Students
            </th>
            <th className="border border-gray-300 px-4 py-3 text-center text-gray-900 font-semibold">
              Classes
            </th>
            <th className="border border-gray-300 px-4 py-3 text-center text-gray-900 font-semibold">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr
              key={plan.id}
              className={`hover:bg-gray-50 transition-colors ${
                highlightPlanId === plan.id ? "bg-blue-50" : ""
              }`}
            >
              <td className="border border-gray-300 px-4 py-3">
                <div>
                  <p className="font-semibold text-gray-900">{plan.name}</p>
                  {plan.description && (
                    <p className="text-sm text-gray-600">{plan.description}</p>
                  )}
                </div>
              </td>
              <td className="border border-gray-300 px-4 py-3 text-center">
                <p className="font-semibold text-gray-900">
                  {formatPrice(plan.price)}
                </p>
                <p className="text-xs text-gray-600 capitalize">
                  per {plan.billingPeriod}
                </p>
              </td>
              <td className="border border-gray-300 px-4 py-3 text-center text-gray-700">
                {plan.maxBranches || "Unlimited"}
              </td>
              <td className="border border-gray-300 px-4 py-3 text-center text-gray-700">
                {plan.maxStudents || "Unlimited"}
              </td>
              <td className="border border-gray-300 px-4 py-3 text-center text-gray-700">
                {plan.maxClasses || "Unlimited"}
              </td>
              <td className="border border-gray-300 px-4 py-3 text-center">
                {onSelectPlan && (
                  <button
                    onClick={() => onSelectPlan(plan)}
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    Select
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
