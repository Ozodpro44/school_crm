import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { Activity, Plus, Pencil, Trash2 } from "lucide-react";
import type { AuditLogEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

type RecentActivityFeedProps = {
  entries: AuditLogEntry[];
  loading?: boolean;
  /** Card title — pass a translated string */
  title: string;
  /** Caption shown when there are zero entries */
  emptyLabel?: string;
  /** Max rows to render */
  limit?: number;
  className?: string;
};

const ACTION_ICON = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
};

const ACTION_TONE = {
  create: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  update: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  delete: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function RecentActivityFeed({
  entries,
  loading = false,
  title,
  emptyLabel = "No recent activity",
  limit = 5,
  className,
}: RecentActivityFeedProps) {
  const items = entries.slice(0, limit);

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
          <Activity className="w-4 h-4 text-indigo-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-3">
            {[...Array(limit)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-sm text-slate-400">{emptyLabel}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((entry) => {
              const ActionIcon = ACTION_ICON[entry.action] ?? Pencil;
              const toneClass = ACTION_TONE[entry.action] ?? ACTION_TONE.update;
              return (
                <li key={entry.id} className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <InitialsAvatar name={entry.userName || "?"} size="md" />
                    <span
                      className={cn(
                        "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900",
                        toneClass
                      )}
                    >
                      <ActionIcon className="w-2.5 h-2.5" />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {entry.userName || "Unknown"}
                      </span>{" "}
                      <span className="text-slate-500 dark:text-slate-400">
                        {entry.description || `${entry.action} ${entry.resource}`}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {formatRelative(entry.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Compact relative timestamp ("just now", "3m ago", "2h ago", "Apr 12"). */
function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
