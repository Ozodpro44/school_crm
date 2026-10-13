import { Link, useLocation } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation } from "@/lib/i18n";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_GROUPS, isActivePath } from "./nav";

interface SidebarContentProps {
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapsed?: () => void;
}

/** Navigation rail. Used inline on desktop and inside a Sheet on small screens. */
export function SidebarContent({ collapsed = false, onNavigate, onToggleCollapsed }: SidebarContentProps) {
  const location = useLocation();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn("flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border", collapsed ? "justify-center" : "px-4")}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
          <Terminal className="h-4 w-4" />
        </span>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">{t("devPortal")}</p>
            <p className="truncate text-[11px] text-sidebar-foreground">Wonderkids CRM</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4" aria-label="Primary">
        {NAV_GROUPS.map((group) => (
          <div key={group.titleKey} className="space-y-0.5">
            {!collapsed && (
              <p className="px-2.5 pb-1 text-[11px] font-medium text-sidebar-foreground/70">{t(group.titleKey)}</p>
            )}
            {group.items.map(({ nameKey, href, icon: Icon }) => {
              const active = isActivePath(location.pathname, href);
              const name = t(nameKey);
              const link = (
                <Link
                  to={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50",
                    collapsed && "justify-center px-0 py-2",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/80")} />
                  {!collapsed && <span className="truncate">{name}</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{name}</TooltipContent>
                </Tooltip>
              ) : (
                <div key={href}>{link}</div>
              );
            })}
          </div>
        ))}
      </nav>

      {onToggleCollapsed && (
        <div className="shrink-0 border-t border-sidebar-border p-2">
          <button
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-0 py-2",
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>{t("collapse")}</span>}
          </button>
        </div>
      )}
    </div>
  );
}
