import React from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PaymentMethodBreakdownProps = {
  icon: LucideIcon;
  title: string;
  iconColor?: string;
  income: number;
  expenses: number;
  profit: number;
  /** Labels (translations) */
  labels: { income: string; expenses: string; profit: string };
  /** Number formatter */
  format: (n: number) => string;
};

/**
 * PaymentMethodBreakdown — the income/expenses/profit triplet shown per method
 * (cash, card, bank) on the dashboard.
 */
export function PaymentMethodBreakdown({
  icon: Icon,
  title,
  iconColor = "text-slate-500",
  income,
  expenses,
  profit,
  labels,
  format,
}: PaymentMethodBreakdownProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
          <Icon className={cn("w-4 h-4", iconColor)} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Row label={labels.income} value={format(income)} valueClass="text-green-600 dark:text-green-400" />
        <Row label={labels.expenses} value={format(expenses)} valueClass="text-red-600 dark:text-red-400" />
        <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
          <Row
            label={labels.profit}
            value={format(profit)}
            labelClass="font-semibold text-slate-700 dark:text-slate-300"
            valueClass={cn(
              "font-semibold",
              profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  labelClass,
  valueClass,
}: {
  label: string;
  value: string;
  labelClass?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className={cn("text-sm text-slate-600 dark:text-slate-400", labelClass)}>{label}</p>
      <span className={cn("text-base font-medium", valueClass)}>{value}</span>
    </div>
  );
}
