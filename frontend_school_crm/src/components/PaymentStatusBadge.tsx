import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "paid" | "partial" | "not_paid" | "unpaid" | "none";

type PaymentStatusBadgeProps = {
  status: Status | string | null | undefined;
  /** Show small icon next to the label (default: true) */
  withIcon?: boolean;
  /** Override the auto-translated label */
  label?: string;
  className?: string;
};

/**
 * Unified payment status badge — used across students, payments,
 * class-details, student-details and reports. Replaces scattered
 * inline color logic with a single component.
 */
export function PaymentStatusBadge({
  status,
  withIcon = true,
  label,
  className,
}: PaymentStatusBadgeProps) {
  const normalized = normalize(status);
  const config = CONFIG[normalized];

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium border-0",
        config.className,
        className
      )}
    >
      {withIcon && <config.icon className="w-3 h-3" />}
      <span>{label ?? config.defaultLabel}</span>
    </Badge>
  );
}

function normalize(status: unknown): "paid" | "partial" | "unpaid" {
  if (status === "paid") return "paid";
  if (status === "partial") return "partial";
  return "unpaid";
}

const CONFIG = {
  paid: {
    icon: CheckCircle2,
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    defaultLabel: "Paid",
  },
  partial: {
    icon: AlertCircle,
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    defaultLabel: "Partial",
  },
  unpaid: {
    icon: XCircle,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    defaultLabel: "Not paid",
  },
};
