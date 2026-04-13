import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  Building2,
  CreditCard,
  Users,
  Activity,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Logs & Errors", href: "/logs", icon: FileText },
  { name: "Incidents", href: "/incidents", icon: AlertTriangle },
  { name: "Branches", href: "/branches", icon: Building2 },
  { name: "Subscriptions", href: "/subscriptions", icon: CreditCard },
  { name: "Subscription Plans", href: "/subscription-plans", icon: CreditCard },
  { name: "Payment Types",      href: "/payment-types",      icon: Wallet     },
  { name: "Users & Admins",     href: "/users",              icon: Users      },
  { name: "API Analytics", href: "/analytics", icon: Activity },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-semibold text-sm text-foreground">Wonderkids</h1>
                <p className="text-[10px] text-muted-foreground capitalize">{user?.role ?? "Admin"}</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center mx-auto">
              <Zap className="w-5 h-5 text-primary" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 scrollbar-thin">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive =
                item.href === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.href);
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={cn(
                      "nav-item",
                      isActive && "nav-item-active",
                      collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="text-sm">{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3 space-y-2">
          {/* User info */}
          {!collapsed && user && (
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.fullName || "Developer"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-status-critical/10 transition-colors text-muted-foreground hover:text-status-critical",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="text-xs">Logout</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
