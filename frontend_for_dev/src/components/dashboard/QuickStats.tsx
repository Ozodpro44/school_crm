import { Users, GraduationCap, CreditCard, Activity } from "lucide-react";
import { MetricCard } from "./MetricCard";

export function QuickStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Students"
        value="622"
        change={12}
        icon={GraduationCap}
      />
      <MetricCard
        title="Active Teachers"
        value="47"
        change={5}
        icon={Users}
      />
      <MetricCard
        title="Monthly Revenue"
        value="₽2.4M"
        change={8}
        icon={CreditCard}
      />
      <MetricCard
        title="API Calls Today"
        value="24.5K"
        change={-3}
        icon={Activity}
      />
    </div>
  );
}
