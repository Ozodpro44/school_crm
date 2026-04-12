import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  DollarSign,
  Wallet,
  FileText,
  HelpCircle,
  LogOut,
  TrendingDown,
  Building2,
  Settings,
  Globe,
  UserCog,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getCurrentUser, logout, hasPermission } from "@/lib/auth";
import { User } from "@/types";
import { getTranslation } from "@/lib/translations";
import { useLanguage } from "@/hooks/use-language";
import { useBranch } from "@/context/BranchContext";
import { getCurrentSubscription } from "@/lib/subscription-api";

// ── Subscription sidebar badge ────────────────────────────────────────────────

interface SubInfo {
  status: string;
  daysLeft: number;
  planName: string;
  collapsed?: boolean;
}

function SubscriptionBadge({ status, daysLeft, planName, collapsed }: SubInfo) {
  const isExpired = ["expired", "cancelled"].includes(status) || daysLeft <= 0;
  const isTrial = status === "trial";
  const isCritical = isExpired || (isTrial && daysLeft <= 3);
  const isWarning = isTrial && daysLeft > 3 && daysLeft <= 7;

  let containerClass: string;
  let dotClass: string;
  let titleText: string;
  let subtitleText: string;

  if (isExpired) {
    containerClass = "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
    dotClass = "bg-red-500 animate-pulse";
    titleText = "Subscription Expired";
    subtitleText = "Renew to restore access";
  } else if (isTrial && daysLeft <= 3) {
    containerClass = "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
    dotClass = "bg-red-500 animate-pulse";
    titleText = `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`;
    subtitleText = "Trial ending soon!";
  } else if (isWarning) {
    containerClass = "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
    dotClass = "bg-amber-500";
    titleText = `${daysLeft} days remaining`;
    subtitleText = "Free Trial";
  } else if (isTrial) {
    containerClass = "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
    dotClass = "bg-amber-400";
    titleText = `${daysLeft} days remaining`;
    subtitleText = "Free Trial";
  } else {
    containerClass = "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800";
    dotClass = "bg-indigo-500";
    titleText = planName;
    subtitleText = "Active";
  }

  const textClass = isCritical
    ? "text-red-700 dark:text-red-400"
    : isWarning || isTrial
    ? "text-amber-700 dark:text-amber-400"
    : "text-indigo-700 dark:text-indigo-400";

  const subTextClass = isCritical
    ? "text-red-500"
    : isWarning || isTrial
    ? "text-amber-500"
    : "text-indigo-500";

  if (collapsed) {
    return (
      <Link href="/billing">
        <div
          className={`flex items-center justify-center p-2 rounded-lg border transition-all hover:opacity-80 ${containerClass}`}
          title={`${titleText} – ${subtitleText}`}
        >
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
        </div>
      </Link>
    );
  }

  return (
    <Link href="/billing">
      <div className={`rounded-lg px-3 py-2.5 border cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] ${containerClass}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
          <div className="min-w-0 flex-1">
            <p className={`text-[10px] font-bold uppercase tracking-wider truncate ${textClass}`}>
              {titleText}
            </p>
            <p className={`text-[10px] leading-none mt-0.5 truncate ${subTextClass}`}>{subtitleText}</p>
          </div>
          {isCritical && (
            <span className={`text-xs font-bold flex-shrink-0 ${textClass}`}>!</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function SidebarSubscriptionBadgeSection({ subInfo }: { subInfo: SubInfo }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  return (
    <div className={cn(
      "mt-auto transition-all duration-200",
      isCollapsed ? "px-2 py-3 flex justify-center" : "px-2 py-4"
    )}>
      <SubscriptionBadge {...subInfo} collapsed={isCollapsed} />
    </div>
  );
}

// ── Sidebar header section (handles mobile X vs desktop toggle) ───────────────

function SidebarHeaderSection({
  currentBranchName,
  schoolName,
}: {
  currentBranchName: string;
  schoolName: string;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarHeader className="p-0 border-b border-slate-200 dark:border-slate-800">
      {/* Expanded state (desktop open + mobile sheet) */}
      <div className="group-data-[collapsible=icon]:hidden flex items-center justify-between px-3 h-14">
        <Link href="/" className="flex items-center gap-2.5 flex-1 min-w-0 group">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:bg-indigo-700 transition-colors">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate leading-none mb-0.5">
              {currentBranchName}
            </p>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              {schoolName}
            </p>
          </div>
        </Link>

        {/* Desktop: collapse toggle / Mobile: close X */}
        {isMobile ? (
          <button
            onClick={() => setOpenMobile(false)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <SidebarTrigger className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0 transition-colors" />
        )}
      </div>

      {/* Collapsed state (desktop icon mode only) */}
      <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-2 py-3">
        <Link
          href="/"
          className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Building2 className="w-4 h-4 text-white" />
        </Link>
        <SidebarTrigger className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" />
      </div>
    </SidebarHeader>
  );
}

// ── Mobile bottom nav "More" button (needs sidebar context) ───────────────────

function MobileMoreButton({ label }: { label: string }) {
  const { setOpenMobile } = useSidebar();
  return (
    <button
      onClick={() => setOpenMobile(true)}
      className="flex flex-col items-center gap-1 px-3 py-1 min-w-[52px] text-slate-400 dark:text-slate-500 active:scale-95 transition-all"
    >
      <div className="w-8 h-8 flex items-center justify-center rounded-xl">
        <Menu className="w-5 h-5" />
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const language = useLanguage();
  const { currentBranch, branches, setCurrentBranchById, clearBranches } = useBranch();
  const [subInfo, setSubInfo] = useState<SubInfo | null>(null);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);

    if (!currentUser && router.pathname !== "/login") {
      router.push("/login");
      return;
    }

    if (
      currentUser &&
      (currentUser.role === "manager" || currentUser.role === "branch_admin") &&
      currentUser.branchId &&
      branches.length > 0
    ) {
      const userBranch = branches.find((b) => b.id === currentUser.branchId);
      const alreadySet = localStorage.getItem("selectedBranchId") === currentUser.branchId;
      if (userBranch && !alreadySet) {
        setCurrentBranchById(currentUser.branchId);
      }
    }
  }, [router.pathname, router, branches, setCurrentBranchById]);

  useEffect(() => {
    const handleUserProfileUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) setUser(customEvent.detail);
    };
    window.addEventListener("userProfileUpdated", handleUserProfileUpdate);
    return () => window.removeEventListener("userProfileUpdated", handleUserProfileUpdate);
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      getCurrentSubscription()
        .then((sub) => {
          if (sub) {
            const msLeft = sub.endDate
              ? new Date(sub.endDate).getTime() - Date.now()
              : Infinity;
            const daysLeft = msLeft === Infinity ? 9999 : Math.ceil(msLeft / 86_400_000);
            setSubInfo({
              status: sub.status,
              daysLeft,
              planName: (sub as any).plan?.name ?? (sub.status === "trial" ? "Trial" : "Basic"),
            });
          } else {
            setSubInfo(null);
          }
        })
        .catch(() => setSubInfo(null));
    } else {
      setSubInfo(null);
    }
  }, [user?.id]);

  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  useEffect(() => {
    const onLimitReached = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string }>).detail;
      setUpgradeMessage(detail?.message || "");
      setUpgradeModalOpen(true);
    };
    const onBranchAccessDenied = () => router.push("/");

    window.addEventListener("subscription:limitReached", onLimitReached);
    window.addEventListener("branch:accessDenied", onBranchAccessDenied);
    return () => {
      window.removeEventListener("subscription:limitReached", onLimitReached);
      window.removeEventListener("branch:accessDenied", onBranchAccessDenied);
    };
  }, [router]);

  const handleLogout = () => {
    clearBranches();
    logout();
    router.push("/login");
  };

  const handleBranchChange = (branchId: string) => setCurrentBranchById(branchId);

  const t = (key: string) => getTranslation(key, language);

  if (!user && router.pathname !== "/login") return null;
  if (router.pathname === "/login") return <>{children}</>;

  // ── Navigation structure ────────────────────────────────────────────────────

  const navigationGroups = [
    {
      title: t("main") || "Main",
      items: [
        { name: t("dashboard"), href: "/", icon: LayoutDashboard, show: true },
        { name: t("students"), href: "/students", icon: Users, show: true },
        { name: t("teachers"), href: "/teachers", icon: GraduationCap, show: true },
        { name: t("classes"), href: "/classes", icon: BookOpen, show: true },
      ],
    },
    {
      title: t("finance") || "Finance",
      items: [
        { name: t("payments"), href: "/payments", icon: DollarSign, show: true },
        { name: t("salaries"), href: "/salaries", icon: Wallet, show: true },
        { name: t("expenses"), href: "/expenses", icon: TrendingDown, show: true },
      ],
    },
    {
      title: t("administration") || "Admin",
      items: [
        { name: t("reports"), href: "/reports", icon: FileText, show: hasPermission("canViewReports") },
        { name: t("branches"), href: "/branches", icon: Building2, show: user?.role === "admin" },
        { name: t("managers"), href: "/managers", icon: UserCog, show: user?.role === "admin" || user?.role === "branch_admin" },
        { name: t("settings"), href: "/settings", icon: Settings, show: user?.role === "admin" },
      ],
    },
    {
      title: t("support") || "Support",
      items: [
        { name: t("help"), href: "/help", icon: HelpCircle, show: true },
      ],
    },
  ];

  // Bottom nav — 4 primary pages always visible on mobile
  const bottomNavItems = [
    { name: t("dashboard"), href: "/", icon: LayoutDashboard },
    { name: t("students"), href: "/students", icon: Users },
    { name: t("payments"), href: "/payments", icon: DollarSign },
    { name: t("classes"), href: "/classes", icon: BookOpen },
  ];

  const branchDisplayName = currentBranch?.name || t("schoolName") || "School";

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950">

        {/* ────────────────────────────────── SIDEBAR ── */}
        <Sidebar
          collapsible="icon"
          className="border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
          {/* Header */}
          <SidebarHeaderSection
            currentBranchName={branchDisplayName}
            schoolName="Management"
          />

          {/* Content */}
          <SidebarContent className="px-2 py-2">

            {/* Branch switcher (admin only, expanded only) */}
            {branches.length > 0 && user?.role === "admin" && (
              <div className="mb-3 px-1 group-data-[collapsible=icon]:hidden">
                <Select value={currentBranch?.id || ""} onValueChange={handleBranchChange}>
                  <SelectTrigger className="w-full h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs focus:ring-1 focus:ring-indigo-500">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <SelectValue placeholder={t("selectBranch")} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {[...branches]
                      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                      .map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Navigation groups */}
            {navigationGroups.map((group, groupIdx) => (
              <SidebarGroup key={group.title} className="px-0 py-0 mb-0.5">
                {/* Section label — hidden in icon mode */}
                <p className={cn(
                  "px-3 mb-0.5 h-7 flex items-end text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest",
                  "group-data-[collapsible=icon]:hidden",
                  groupIdx === 0 && "h-5"
                )}>
                  {group.title}
                </p>

                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5 px-0">
                    {group.items.filter((i) => i.show).map((item) => {
                      const isActive = router.pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={item.name}
                            className={cn(
                              "h-9 rounded-lg px-3 gap-3 transition-colors duration-150",
                              isActive
                                ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-700"
                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                            )}
                          >
                            <Link href={item.href}>
                              <Icon
                                className={cn(
                                  "w-[18px] h-[18px] flex-shrink-0",
                                  isActive
                                    ? "text-white"
                                    : "text-slate-400 dark:text-slate-500"
                                )}
                              />
                              <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">
                                {item.name}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}

            {/* Subscription badge */}
            {user?.role === "admin" && subInfo && (
              <SidebarSubscriptionBadgeSection subInfo={subInfo} />
            )}
          </SidebarContent>

          {/* Footer — user profile */}
          <SidebarFooter className="p-2 border-t border-slate-200 dark:border-slate-800">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-1.5 active:scale-[0.98]">
                  <Avatar className="h-7 w-7 flex-shrink-0 ring-2 ring-slate-100 dark:ring-slate-800">
                    <AvatarFallback className="bg-indigo-600 text-white text-[11px] font-bold">
                      {user?.fullName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate leading-none mb-0.5">
                      {user?.fullName}
                    </p>
                    <p className="text-[10px] text-slate-400 capitalize truncate">
                      {user?.role?.replace("_", " ")}
                    </p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 group-data-[collapsible=icon]:hidden opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 p-1.5 shadow-xl border-slate-200 dark:border-slate-800"
                side="right"
                align="end"
                sideOffset={10}
              >
                <div className="px-2 py-1.5 mb-1">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {user?.fullName}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize">
                    {user?.role?.replace("_", " ")}
                  </p>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Theme
                  </span>
                  <ThemeSwitch />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/admin-profile")}
                  className="rounded-md gap-2 cursor-pointer py-2"
                >
                  <UserCog className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium">Account</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-md gap-2 cursor-pointer py-2">
                  <Globe className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium flex-1">Language</span>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded uppercase">
                    {language}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="rounded-md gap-2 cursor-pointer py-2 text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm font-medium">Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* ──────────────────────────── MAIN CONTENT ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Mobile top bar */}
          <header className="md:hidden sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 h-12 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                {branchDisplayName}
              </span>
            </div>

            {/* Mobile user avatar + dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 py-1 pl-1 pr-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-95">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-indigo-600 text-white text-[10px] font-bold">
                      {user?.fullName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 p-1.5 shadow-xl border-slate-200 dark:border-slate-800 mr-2"
                align="end"
                sideOffset={8}
              >
                <div className="px-2 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {user?.fullName}
                  </p>
                  <p className="text-xs text-slate-400 capitalize">
                    {user?.role?.replace("_", " ")}
                  </p>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                  <span className="text-xs text-slate-500">Theme</span>
                  <ThemeSwitch />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/admin-profile")}
                  className="rounded-md gap-2 cursor-pointer py-2"
                >
                  <UserCog className="h-4 w-4 text-slate-400" />
                  <span className="text-sm">Account</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="rounded-md gap-2 cursor-pointer py-2 text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm">Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-x-hidden w-full">
            <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-24 md:pb-8">
              {children}
            </div>
          </main>
        </div>

        {/* ──────────────────────── MOBILE BOTTOM NAV ── */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-around px-1 h-16">
            {bottomNavItems.map((item) => {
              const isActive = router.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-1 min-w-[52px] active:scale-95 transition-all",
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-xl transition-colors",
                      isActive ? "bg-indigo-50 dark:bg-indigo-900/30" : ""
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium leading-none">{item.name}</span>
                </Link>
              );
            })}
            <MobileMoreButton label={t("more") || "More"} />
          </div>
        </nav>
      </div>

      {/* Upgrade modal */}
      <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold text-lg text-slate-900 dark:text-slate-100">
              {t("subscriptionLimitReached") || "Limit reached"}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {upgradeMessage ||
                t("subscriptionLimitDetail") ||
                "You have reached the limit included in your current plan. Upgrade to add more."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 border-t pt-4 mt-2">
            <Button
              variant="ghost"
              onClick={() => setUpgradeModalOpen(false)}
              className="text-sm font-medium"
            >
              {t("close") || "Close"}
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold transition-transform active:scale-95"
              onClick={() => {
                setUpgradeModalOpen(false);
                router.push("/billing");
              }}
            >
              {t("upgradePlan") || "Upgrade Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
