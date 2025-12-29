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
  
  const statusClass = isOpen
    ? "bg-green-100 text-green-800 border border-green-300"
    : "bg-gray-100 text-gray-800 border border-gray-300";
  
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
