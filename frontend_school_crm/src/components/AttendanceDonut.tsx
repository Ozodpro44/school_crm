import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

type AttendanceStats = {
  present: number;
  absent: number;
  late: number;
};

type AttendanceDonutProps = {
  stats: AttendanceStats;
  /** Labels for the legend. */
  labels: { present: string; absent: string; late: string };
  /** Height in px, default 160. */
  size?: number;
  className?: string;
};

const COLORS = {
  present: "#10b981", // green-500
  absent: "#ef4444",  // red-500
  late: "#f59e0b",    // amber-500
};

/**
 * AttendanceDonut — circular breakdown (present/absent/late) with the
 * attendance-rate % shown in the center. Falls back to an empty state
 * when there are zero records.
 */
export function AttendanceDonut({
  stats,
  labels,
  size = 160,
  className,
}: AttendanceDonutProps) {
  const total = stats.present + stats.absent + stats.late;
  const rate = total > 0 ? Math.round((stats.present / total) * 100) : 0;

  const data = [
    { name: labels.present, value: stats.present, key: "present" as const },
    { name: labels.absent, value: stats.absent, key: "absent" as const },
    { name: labels.late, value: stats.late, key: "late" as const },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-slate-400",
          className
        )}
        style={{ height: size }}
      >
        No attendance records
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius="65%"
              outerRadius="95%"
              paddingAngle={1}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell key={i} fill={COLORS[d.key]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgb(226 232 240)",
                fontSize: 12,
                padding: "6px 10px",
              }}
              formatter={(v, n) => [`${v ?? 0}`, String(n ?? "")]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
            {rate}%
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">
            present
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 text-sm">
        <LegendRow color={COLORS.present} label={labels.present} value={stats.present} />
        <LegendRow color={COLORS.absent}  label={labels.absent}  value={stats.absent} />
        <LegendRow color={COLORS.late}    label={labels.late}    value={stats.late} />
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-slate-600 dark:text-slate-400 capitalize">{label}</span>
      <span className="ml-auto font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
        {value}
      </span>
    </div>
  );
}
