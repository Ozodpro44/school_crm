import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Tone } from "./StatusPill";

const VALUE_TONE: Partial<Record<Tone, string>> = {
  healthy: "text-status-healthy",
  critical: "text-status-critical",
  warning: "text-status-warning",
};

interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  loading?: boolean;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

/** One metric. Quiet by default; colour is reserved for values that mean good/bad. */
export function Stat({ label, value, hint, icon: Icon, tone = "neutral", loading, onClick, active, className }: StatProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4 text-left",
        onClick && "transition-colors hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active && "border-foreground/50",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] text-muted-foreground">{label}</span>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <span className={cn("tnum truncate text-2xl font-semibold tracking-tight text-foreground", VALUE_TONE[tone])}>
          {value}
        </span>
      )}
      {hint && !loading && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
    </Comp>
  );
}
