import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Render a compact variant inside a card row or tight container. */
  compact?: boolean;
  className?: string;
}

/**
 * Friendly empty-state block used wherever a list, table, or card has no data.
 *
 * Dark-mode aware; the previous version was light-only and looked broken in
 * dark theme. Action button mirrors the primary `Button` styling without
 * dragging in the full Button component (kept dependency-light).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
  className,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-6",
        className
      )}
    >
      <div
        className={cn(
          "rounded-full flex items-center justify-center mb-4",
          "bg-slate-100 dark:bg-slate-800/60",
          compact ? "w-10 h-10" : "w-14 h-14"
        )}
      >
        <Icon
          className={cn(
            "text-slate-400 dark:text-slate-500",
            compact ? "w-5 h-5" : "w-7 h-7"
          )}
        />
      </div>
      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
          {description}
        </p>
      )}
      {action && (
        // Uses the shared Button with the brand gradient so the empty-state
        // CTA matches the page-header CTA for the same action. It used to be
        // a flat indigo button, so an empty table showed two differently
        // styled buttons for the identical action.
        <Button onClick={action.onClick} className="mt-5 bg-brand hover:bg-brand-hover">
          {ActionIcon && <ActionIcon className="w-4 h-4" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
