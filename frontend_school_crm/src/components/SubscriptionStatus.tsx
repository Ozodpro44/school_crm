import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  getCurrentSubscription,
  isSubscriptionActive,
  isExpiringsoon,
  getDaysUntilRenewal,
} from "@/lib/subscription-api";
import { Subscription } from "@/types";

export default function SubscriptionStatus() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const sub = await getCurrentSubscription();
      setSubscription(sub);
    } catch (error) {
      console.error("Failed to load subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!subscription) {
    return (
      <Link href="/subscriptions" className="block">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4 hover:shadow-lg transition-shadow">
          <p className="text-sm font-semibold mb-2">No Active Subscription</p>
          <p className="text-xs text-blue-100">
            Upgrade to unlock premium features
          </p>
        </div>
      </Link>
    );
  }

  const isActive = isSubscriptionActive(subscription);
  const expiringSoon = isExpiringsoon(subscription);
  const daysUntilRenewal = getDaysUntilRenewal(subscription);

  return (
    <Link href="/subscription-details" className="block">
      <div
        className={`rounded-lg p-4 hover:shadow-lg transition-shadow ${
          isActive
            ? "bg-gradient-to-r from-green-500 to-green-600"
            : expiringSoon
            ? "bg-gradient-to-r from-orange-500 to-orange-600"
            : "bg-gradient-to-r from-red-500 to-red-600"
        } text-white`}
      >
        <p className="text-sm font-semibold mb-1 capitalize">
          {subscription.status} Subscription
        </p>
        {expiringSoon && daysUntilRenewal > 0 ? (
          <p className="text-xs text-white text-opacity-90">
            Renews in {daysUntilRenewal} day{daysUntilRenewal !== 1 ? "s" : ""}
          </p>
        ) : (
          <p className="text-xs text-white text-opacity-90">
            {new Date(
              subscription.renewalDate || subscription.endDate || ""
            ).toLocaleDateString()}
          </p>
        )}
      </div>
    </Link>
  );
}
