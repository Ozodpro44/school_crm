import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { EmptyState } from "@/components/EmptyState";
import { BarChart3 } from "lucide-react";

interface ChartData {
  label: string;
  income: number;
  expenses: number;
}

interface FinancialChartProps {
  data: ChartData[];
}

/**
 * Income vs. expenses per period.
 *
 * Previously a hand-drawn <canvas>: it hardcoded light-theme greys for the
 * grid and axis labels (so it never adapted to dark mode), only redrew when
 * `data` changed (so resizing left a stretched, blurry bitmap), divided by a
 * zero `maxValue` when every value was 0, printed raw unformatted axis
 * numbers, and exposed nothing to assistive tech.
 *
 * recharts is already a dependency here — AttendanceDonut and
 * PaymentTrendChart both use it — so this now matches the rest of the app and
 * gets theming, resizing, tooltips and focusable marks for free. Colours come
 * from the --chart-* tokens rather than hardcoded hex.
 */
export function FinancialChart({ data }: FinancialChartProps) {
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const hasValues = useMemo(
    () => data.some((d) => d.income > 0 || d.expenses > 0),
    [data]
  );

  // Compact axis ticks — a raw 12780000 is unreadable in a 40px gutter.
  const formatAxis = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
    if (abs >= 1_000) return `${Math.round(value / 1_000)}K`;
    return String(value);
  };

  if (!data.length || !hasValues) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <EmptyState icon={BarChart3} title={t("noChartData")} compact />
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      {/* minHeight keeps recharts from warning (and from drawing at a -1
          size) on the frames where the container is measured before layout
          settles — e.g. when the card mounts inside a hidden responsive
          branch. */}
      <ResponsiveContainer width="100%" height="100%" minHeight={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border))"
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatAxis}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value, name) => [formatCurrency(Number(value ?? 0)), String(name)]}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
              color: "hsl(var(--popover-foreground))",
              fontSize: 13,
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
            iconType="circle"
            iconSize={9}
          />
          <Bar
            dataKey="income"
            name={t("income")}
            fill="hsl(var(--chart-1))"
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
          <Bar
            dataKey="expenses"
            name={t("expenses")}
            fill="hsl(var(--chart-2))"
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
