import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { AlertTriangle } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

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

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const maintenanceMode = useMaintenanceMode();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-64 min-h-screen transition-all duration-300">
        {maintenanceMode && (
          <div className="flex items-center gap-3 px-6 py-3 bg-status-warning/15 border-b border-status-warning/30 text-status-warning text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">Texnik ishlar rejimi faol</span>
            <span className="text-status-warning/70">— tizim hozirda texnik xizmat ko'rsatish holatida. Sozlamalar orqali o'chirishingiz mumkin.</span>
          </div>
        )}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
