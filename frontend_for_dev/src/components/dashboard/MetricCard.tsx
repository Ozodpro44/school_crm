import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  changeLabel = "vs last week",
  icon: Icon,
  iconColor = "text-primary"
}: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className="metric-card">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
      </div>
      <p className="text-muted-foreground text-sm mb-1">{title}</p>
      <p className="text-2xl font-semibold text-foreground mb-2">{value}</p>
      {change !== undefined && (
        <div className="flex items-center gap-1 text-xs">
          {isPositive && <TrendingUp className="w-3 h-3 text-status-healthy" />}
          {isNegative && <TrendingDown className="w-3 h-3 text-status-critical" />}
          <span className={cn(
            isPositive && "text-status-healthy",
            isNegative && "text-status-critical",
            !isPositive && !isNegative && "text-muted-foreground"
          )}>
            {isPositive && "+"}{change}%
          </span>
          <span className="text-muted-foreground">{changeLabel}</span>
        </div>
      )}
    </div>
  );
}
