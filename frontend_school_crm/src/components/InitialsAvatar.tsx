import React from "react";
import { cn } from "@/lib/utils";

type InitialsAvatarProps = {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-9 h-9 text-xs",
  lg: "w-12 h-12 text-sm",
};

// 8 stable color pairs. We pick one by hashing the name.
const PALETTE = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
];

function hashIndex(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % PALETTE.length;
}

function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]!;
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1]!;
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}

/**
 * InitialsAvatar — small round chip showing the first letters of a name.
 * Deterministic color based on the name, so the same person always
 * gets the same color across pages.
 */
export function InitialsAvatar({
  name,
  size = "md",
  className,
}: InitialsAvatarProps) {
  const color = PALETTE[hashIndex(name)];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold flex-shrink-0 select-none",
        SIZES[size],
        color,
        className
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
