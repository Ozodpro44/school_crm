import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { AlertTriangle } from "lucide-react";

function useMaintenanceMode() {
  const [on, setOn] = useState(() => localStorage.getItem("dev:maintenanceMode") === "true");
  useEffect(() => {
    const sync = () => setOn(localStorage.getItem("dev:maintenanceMode") === "true");
    window.addEventListener("dev:maintenanceModeChanged", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("dev:maintenanceModeChanged", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return on;
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const maintenanceMode = useMaintenanceMode();

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 min-h-screen pl-60 transition-all duration-300">
        {maintenanceMode && (
          <div className="flex items-center gap-3 px-6 py-2.5 bg-status-warning/10 border-b border-status-warning/25 text-status-warning text-sm sticky top-0 z-30">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">Maintenance mode is active</span>
            <span className="text-status-warning/60 text-xs">— Disable in Settings</span>
          </div>
        )}
        <div className="p-6 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
