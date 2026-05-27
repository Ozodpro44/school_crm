import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, Building2, CreditCard,
  Users, Activity, Bell, Settings, LogOut, ChevronLeft,
  ChevronRight, Terminal, Wallet, BookOpen, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const NAV = [
  { name: "Dashboard",        href: "/",                   icon: LayoutDashboard },
  { name: "Logs",             href: "/logs",               icon: FileText        },
  { name: "Branches",         href: "/branches",           icon: Building2       },
  { name: "Subscriptions",    href: "/subscriptions",      icon: CreditCard      },
  { name: "Plans",            href: "/subscription-plans", icon: BookOpen        },
  { name: "Payment Types",    href: "/payment-types",      icon: Wallet          },
  { name: "Users",            href: "/users",              icon: Users           },
  { name: "Analytics",        href: "/analytics",          icon: Activity        },
  { name: "Incidents",        href: "/incidents",          icon: AlertTriangle   },
  { name: "Notifications",    href: "/notifications",      icon: Bell            },
  { name: "Settings",         href: "/settings",           icon: Settings        },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
    navigate("/login");
  };

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex h-14 items-center border-b border-sidebar-border flex-shrink-0",
        collapsed ? "justify-center px-0" : "px-4 gap-2.5"
      )}>
        <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <Terminal className="w-4 h-4 text-primary" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-xs font-bold text-primary tracking-wider uppercase leading-none">Dev Portal</p>
            <p className="text-[10px] text-sidebar-foreground mt-0.5">Wonderkids CRM</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map(({ name, href, icon: Icon }) => {
          const active = href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);
          return (
            <Link
              key={href}
              to={href}
              title={collapsed ? name : undefined}
              className={cn(
                "nav-item",
                active && "nav-item-active",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{name}</span>}
              {!collapsed && active && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2 space-y-1 flex-shrink-0">
        {!collapsed && user && (
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-[11px] font-bold text-primary flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-accent-foreground truncate">
                {user.fullName || "Developer"}
              </p>
              <p className="text-[10px] text-sidebar-foreground truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "w-full flex items-center gap-2 py-2 px-2 rounded-lg transition-colors text-sidebar-foreground hover:text-destructive hover:bg-destructive/10 text-xs",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && "Sign out"}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground hover:text-sidebar-accent-foreground"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : (
            <span className="flex items-center gap-1.5 text-xs">
              <ChevronLeft className="w-3.5 h-3.5" /> Collapse
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
