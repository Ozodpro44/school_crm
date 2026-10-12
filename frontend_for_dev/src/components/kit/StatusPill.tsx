import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "healthy" | "info" | "warning" | "critical" | "neutral" | "accent";

const TONES: Record<Tone, { pill: string; dot: string }> = {
  healthy:  { pill: "bg-status-healthy/10 text-status-healthy ring-status-healthy/25",   dot: "bg-status-healthy" },
  info:     { pill: "bg-status-info/10 text-status-info ring-status-info/25",             dot: "bg-status-info" },
  warning:  { pill: "bg-status-warning/10 text-status-warning ring-status-warning/30",    dot: "bg-status-warning" },
  critical: { pill: "bg-status-critical/10 text-status-critical ring-status-critical/25", dot: "bg-status-critical" },
  accent:   { pill: "bg-primary/10 text-primary ring-primary/25",                         dot: "bg-primary" },
  neutral:  { pill: "bg-muted text-muted-foreground ring-border",                         dot: "bg-muted-foreground/60" },
};

export function toneClasses(tone: Tone) {
  return TONES[tone];
}

interface StatusPillProps {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

/** Small status label: tinted fill + hairline ring, optional leading dot. */
export function StatusPill({ tone = "neutral", children, dot = true, className }: StatusPillProps) {
  const c = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        c.pill,
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />}
      {children}
    </span>
  );
}
