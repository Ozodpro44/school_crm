import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SystemHealthPanel } from "@/components/dashboard/SystemHealthPanel";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { RecentIncidents } from "@/components/dashboard/RecentIncidents";
import { BranchOverview } from "@/components/dashboard/BranchOverview";
import { ApiPerformanceChart } from "@/components/dashboard/ApiPerformanceChart";
import { BackendConnectivity } from "@/components/dashboard/BackendConnectivity";
import { Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const currentTime = new Date().toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Dashboard</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Calendar className="w-4 h-4" />
            <span>{currentTime}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="space-y-6 animate-fade-in">
        <QuickStats />
        <BackendConnectivity />
        <SystemHealthPanel />
        
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <ApiPerformanceChart />
          </div>
          <div>
            <RecentIncidents />
          </div>
        </div>

        <BranchOverview />
      </div>
    </DashboardLayout>
  );
}
