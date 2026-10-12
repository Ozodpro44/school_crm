import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@/lib/i18n";
import { getDevSettings } from "@/services/api-client";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { SidebarContent } from "./Sidebar";
import { Topbar } from "./Topbar";

export const SETTINGS_CHANGED_EVENT = "dev:settingsChanged";

/** Server-side maintenance flag (the platform setting every developer shares), kept fresh after saves. */
function useMaintenanceMode(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getDevSettings()
      .then((s) => { if (!cancelled) setOn(Boolean(s.maintenanceMode)); })
      .catch(() => { /* banner is informational; the Settings page reports load errors */ });
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ maintenanceMode?: boolean }>).detail;
      if (typeof detail?.maintenanceMode === "boolean") setOn(detail.maintenanceMode);
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onChanged);
    };
  }, []);
  return on;
}

const COLLAPSED_KEY = "dev:sidebarCollapsed";

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === "true"; } catch { return false; }
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const maintenance = useMaintenanceMode();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      try { localStorage.setItem(COLLAPSED_KEY, String(!v)); } catch { /* best effort */ }
      return !v;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border transition-[width] duration-200 lg:block",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 border-sidebar-border p-0 lg:hidden">
          <SheetTitle className="sr-only">{t("devPortal")}</SheetTitle>
          <SheetDescription className="sr-only">{t("devPortal")}</SheetDescription>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className={cn("min-h-screen transition-[padding] duration-200", collapsed ? "lg:pl-14" : "lg:pl-60")}>
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        {maintenance && (
          <div className="flex items-center gap-2.5 border-b border-status-warning/30 bg-status-warning/10 px-4 py-2 text-sm text-status-warning lg:px-8">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{t("maintenanceModeActive")}</span>
            <Link to="/settings" className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100">
              {t("disableInSettings")}
            </Link>
          </div>
        )}
        <main className="mx-auto w-full max-w-[1400px] animate-fade-in px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
