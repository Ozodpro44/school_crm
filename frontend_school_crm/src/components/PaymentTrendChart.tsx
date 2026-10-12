import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/exportUtils";

type Payment = {
  amount: number;
  month: string | number;
  year: number;
  paidDate?: string | null;
};

type PaymentTrendChartProps = {
  /** Raw payment records (any order). */
  payments: Payment[];
  /** Monthly target amount — drawn as a horizontal reference line when provided. */
  targetAmount?: number;
  /** Number of recent months to show (default 6). */
  months?: number;
  /** Labels for the localized month names — month index 1–12 → string. */
  monthLabels: Record<number, string>;
  /** Height in px, default 180. */
  height?: number;
};

/**
 * PaymentTrendChart — small bar chart showing a student's payment amount per
 * month across the last N months. Bars with >= targetAmount are green, partial
 * are orange, missing months render as empty bars.
 */
export function PaymentTrendChart({
  payments,
  targetAmount = 0,
  months = 6,
  monthLabels,
  height = 180,
}: PaymentTrendChartProps) {
  const data = useMemo(() => buildMonthlyData(payments, months, monthLabels), [
    payments,
    months,
    monthLabels,
  ]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: "11px", fill: "currentColor" }}
          tickLine={false}
          axisLine={false}
          className="text-slate-500 dark:text-slate-400"
        />
        <YAxis
          hide
          domain={[0, "dataMax"]}
        />
        <Tooltip
          cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid rgb(226 232 240)",
            fontSize: 12,
            padding: "6px 10px",
          }}
          formatter={(value: number | undefined) => [formatCurrency(value ?? 0), "Paid"]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={colorFor(entry.amount, targetAmount)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function colorFor(amount: number, target: number): string {
  if (amount === 0) return "#e2e8f0"; // slate-200
  if (target > 0 && amount >= target) return "#10b981"; // green-500
  if (target > 0 && amount > 0 && amount < target) return "#f59e0b"; // amber-500
  return "#6366f1"; // indigo-500 (fallback when no target set)
}

function buildMonthlyData(
  payments: Payment[],
  months: number,
  labels: Record<number, string>
) {
  const now = new Date();
  const buckets: { label: string; amount: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const amount = payments
      .filter(
        (p) =>
          Number(p.month) === m &&
          Number(p.year) === y &&
          (p.paidDate != null)
      )
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    buckets.push({ label: labels[m] ?? String(m), amount });
  }
  return buckets;
}
