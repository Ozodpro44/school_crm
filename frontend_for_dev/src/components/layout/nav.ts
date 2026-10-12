import {
  Activity, AlertTriangle, Bell, BookOpen, Building2, CreditCard, FileText,
  LayoutDashboard, Settings, Trash2, Users, Wallet,
} from "lucide-react";

export interface NavItem {
  nameKey: string;
  href: string;
  icon: React.ElementType;
}

export interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: "navGroupPlatform",
    items: [
      { nameKey: "navDashboard", href: "/", icon: LayoutDashboard },
      { nameKey: "navAnalytics", href: "/analytics", icon: Activity },
      { nameKey: "navIncidents", href: "/incidents", icon: AlertTriangle },
      { nameKey: "navLogs", href: "/logs", icon: FileText },
    ],
  },
  {
    titleKey: "navGroupBilling",
    items: [
      { nameKey: "navSubscriptions", href: "/subscriptions", icon: CreditCard },
      { nameKey: "navPlans", href: "/subscription-plans", icon: BookOpen },
      { nameKey: "navPaymentTypes", href: "/payment-types", icon: Wallet },
    ],
  },
  {
    titleKey: "navGroupData",
    items: [
      { nameKey: "navBranches", href: "/branches", icon: Building2 },
      { nameKey: "navUsers", href: "/users", icon: Users },
      { nameKey: "navTrash", href: "/trash", icon: Trash2 },
    ],
  },
  {
    titleKey: "navGroupSystem",
    items: [
      { nameKey: "navNotifications", href: "/notifications", icon: Bell },
      { nameKey: "navSettings", href: "/settings", icon: Settings },
    ],
  },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}
