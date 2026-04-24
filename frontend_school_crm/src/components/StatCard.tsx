import React from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tone = "indigo" | "purple" | "green" | "blue" | "red" | "orange" | "slate";

const TONE_STYLES: Record<
  Tone,
  { accent: string; icon: string; value?: string }
> = {
  indigo: { accent: "border-l-indigo-500", icon: "text-indigo-500" },
  purple: { accent: "border-l-purple-500", icon: "text-purple-500" },
  green: {
    accent: "border-l-green-500",
    icon: "text-green-500",
    value: "text-green-600 dark:text-green-400",
  },
  blue: { accent: "border-l-blue-500", icon: "text-blue-500" },
  red: {
    accent: "border-l-red-500",
    icon: "text-red-500",
    value: "text-red-600 dark:text-red-400",
  },
  orange: { accent: "border-l-orange-500", icon: "text-orange-500" },
  slate: { accent: "border-l-slate-400", icon: "text-slate-500" },
};

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  /** Small caption shown below the value */
  hint?: React.ReactNode;
  /** Visual accent — changes left border + icon color (and value color for green/red). */
  tone?: Tone;
  /** When true, show skeleton placeholders instead of content. */
  loading?: boolean;
  /** Optional trend indicator shown to the right of the value. */
  trend?: {
    direction: "up" | "down" | "neutral";
    label: string;
  };
  /** Optional click handler — makes the card behave like a button. */
  onClick?: () => void;
  className?: string;
};

/**
 * StatCard — consistent metric tile used on dashboard, reports, branches overview.
 * Replaces the repeated "border-l-4 + CardHeader + CardContent" pattern.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "slate",
  loading = false,
  trend,
  onClick,
  className,
}: StatCardProps) {
  const toneStyle = TONE_STYLES[tone];

  return (
    <Card
      className={cn(
        "border-l-4 transition-all",
        toneStyle.accent,
        onClick && "cursor-pointer hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <Icon className={cn("w-4 h-4", toneStyle.icon)} />
        </div>

        {loading ? (
          <>
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-3 w-32" />
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <div
                className={cn(
                  "text-2xl md:text-3xl font-semibold text-slate-900 dark:text-slate-100",
                  toneStyle.value
                )}
              >
                {value}
              </div>
              {trend && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    trend.direction === "up" && "text-green-600",
                    trend.direction === "down" && "text-red-600",
                    trend.direction === "neutral" && "text-slate-500"
                  )}
                >
                  {trend.label}
                </span>
              )}
            </div>
            {hint && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {hint}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
