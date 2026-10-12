"use client";

import type { MonthStatus } from "@/types";

interface MonthStatusBadgeProps {
  status: MonthStatus;
  month?: number;
  year?: number;
  className?: string;
}

export default function MonthStatusBadge({
  status,
  month,
  year,
  className = "",
}: MonthStatusBadgeProps) {
  const isOpen = status === "OPEN";
  
  // Was light-only, so in dark mode this rendered a pale pill on a dark card.
  const statusClass = isOpen
    ? "bg-green-100 text-green-800 border border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
    : "bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  
  const statusLabel = isOpen ? "OPEN" : "CLOSED";
  const statusDot = isOpen ? "●" : "○";

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusClass} ${className}`}
      title={`Financial month status: ${statusLabel}`}
    >
      <span className="text-lg">{statusDot}</span>
      <span>{statusLabel}</span>
      {month && year && (
        <span className="text-xs opacity-75">
          ({month}/{year})
        </span>
      )}
    </span>
  );
}
