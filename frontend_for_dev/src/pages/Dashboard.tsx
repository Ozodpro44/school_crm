import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SystemHealthPanel } from "@/components/dashboard/SystemHealthPanel";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { RecentIncidents } from "@/components/dashboard/RecentIncidents";
import { BranchOverview } from "@/components/dashboard/BranchOverview";
import { ApiPerformanceChart } from "@/components/dashboard/ApiPerformanceChart";
import { BackendConnectivity } from "@/components/dashboard/BackendConnectivity";
import { Calendar, RefreshCw, FileText, BookOpen, Building2, CreditCard, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { API_CONFIG } from "@/config/api";

const QUICK_LINKS = [
  { label: "Logs & Errors",    href: "/logs",           icon: FileText,   internal: true,  desc: "View application logs" },
  { label: "Branches",         href: "/branches",       icon: Building2,  internal: true,  desc: "Manage school branches" },
  { label: "Subscriptions",    href: "/subscriptions",  icon: CreditCard, internal: true,  desc: "Billing & subscriptions" },
  { label: "Swagger API Docs", href: API_CONFIG.baseUrl.replace("/api", "") + "/api/docs/index.html", icon: BookOpen, internal: false, desc: "OpenAPI documentation" },
];

export default function Dashboard() {
  const navigate = useNavigate();
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

        {/* Quick links */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_LINKS.map(({ label, href, icon: Icon, internal, desc }) => (
              <button
                key={label}
                onClick={() => internal ? navigate(href) : window.open(href, "_blank")}
                className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-accent/30 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{desc}</p>
                </div>
                {!internal && <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
