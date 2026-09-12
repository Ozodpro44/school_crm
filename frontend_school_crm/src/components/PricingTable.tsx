import React, { useState, useEffect } from "react";
import { getSubscriptionPlans, formatPrice } from "@/lib/subscription-api";
import { SubscriptionPlan } from "@/types";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";

interface PricingTableProps {
  onSelectPlan?: (plan: SubscriptionPlan) => void;
  highlightPlanId?: string;
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlanFeatures({ plan, t }: { plan: SubscriptionPlan; t: (key: string) => string }) {
  const features: string[] = [];

  if (plan.maxBranches) features.push(t("upToBranches").replace("{count}", String(plan.maxBranches)));
  else features.push(t("unlimitedBranches"));

  if (plan.maxStudents) features.push(t("upToStudents").replace("{count}", String(plan.maxStudents)));
  else features.push(t("unlimitedStudents"));

  if (plan.maxClasses) features.push(t("upToClasses").replace("{count}", String(plan.maxClasses)));
  else features.push(t("unlimitedClasses"));

  // Append any extra boolean features from the features map
  if (plan.features && typeof plan.features === "object") {
    Object.entries(plan.features).forEach(([key, val]) => {
      if (val === true) {
        // Convert camelCase/snake_case key to readable label
        const label = key
          .replace(/_/g, " ")
          .replace(/([A-Z])/g, " $1")
          .toLowerCase()
          .replace(/^\w/, (c) => c.toUpperCase());
        features.push(label);
      }
    });
  }

  return (
    <ul className="space-y-2 mt-4">
      {features.map((f) => (
        <li key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <CheckIcon />
          {f}
        </li>
      ))}
    </ul>
  );
}

function PlanCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 animate-pulse">
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-6" />
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-1" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6" />
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        ))}
      </div>
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg mt-6" />
    </div>
  );
}

export default function PricingTable({ onSelectPlan, highlightPlanId }: PricingTableProps) {
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSubscriptionPlans()
      .then(setPlans)
      .catch((err) => console.error("Failed to load plans:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => <PlanCardSkeleton key={i} />)}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
        </svg>
        <p className="text-sm">{t("noPlansAvailable")}</p>
      </div>
    );
  }

  // Mark the middle plan (or second plan) as "popular" if there are 2+ plans
  const popularIdx = plans.length >= 3 ? 1 : plans.length === 2 ? 1 : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {plans.map((plan, idx) => {
        const isCurrent = highlightPlanId === plan.id;
        const isPopular = idx === popularIdx && plans.length > 1;

        return (
          <div
            key={plan.id}
            className={`relative rounded-2xl border-2 p-6 flex flex-col transition-shadow
              ${isCurrent
                ? "border-blue-500 shadow-lg shadow-blue-100 dark:shadow-blue-900/20 bg-blue-50 dark:bg-blue-900/10"
                : isPopular
                ? "border-indigo-500 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 bg-white dark:bg-gray-800"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
              }`}
          >
            {/* Badge */}
            {isCurrent && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
                {t("currentPlanBadge")}
              </span>
            )}
            {!isCurrent && isPopular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
                {t("mostPopularBadge")}
              </span>
            )}

            {/* Plan name & description */}
            <div className="mb-4">
              <h3 className={`text-lg font-bold ${isCurrent ? "text-blue-900 dark:text-blue-100" : "text-gray-900 dark:text-white"}`}>
                {plan.name}
              </h3>
              {plan.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  {plan.description}
                </p>
              )}
            </div>

            {/* Price */}
            <div className="mb-2">
              <span className={`text-3xl font-extrabold ${isCurrent ? "text-blue-700 dark:text-blue-300" : isPopular ? "text-indigo-700 dark:text-indigo-300" : "text-gray-900 dark:text-white"}`}>
                {formatPrice(plan.price)}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                / {t(plan.billingPeriod)}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 dark:border-gray-700 my-4" />

            {/* Features */}
            <div className="flex-1">
              <PlanFeatures plan={plan} t={t} />
            </div>

            {/* CTA */}
            {onSelectPlan && (
              <button
                onClick={() => onSelectPlan(plan)}
                className={`mt-6 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
                  ${isCurrent
                    ? "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500"
                    : isPopular
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500"
                    : "bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white text-white focus:ring-gray-500"
                  }`}
              >
                {isCurrent ? t("renewPlan") : t("selectPlan")}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
