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
  Menu,
  X,
  TrendingDown,
  Building2,
  Settings,
  Globe,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Calendar,
  Clock,
  ChevronDown,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getCurrentUser, logout, hasPermission } from "@/lib/auth";
import { User, Language } from "@/types";
import { getTranslation } from "@/lib/translations";
import { useLanguage, useSetLanguage } from "@/hooks/use-language";
import { useBranch } from "@/context/BranchContext";
import { 
  getCurrentSubscription, 
  getDaysUntilExpiry, 
  isTrialEndingSoon 
} from "@/lib/subscription-api";
import { SubscriptionResponse } from "@/types";
import { AlertTriangle, Crown, Sparkles } from "lucide-react";

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
    containerClass =
      "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
    dotClass = "bg-red-500 animate-pulse";
    titleText = "Subscription Expired";
    subtitleText = "Renew to restore access";
  } else if (isTrial && daysLeft <= 3) {
    containerClass =
      "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
    dotClass = "bg-red-500 animate-pulse";
    titleText = `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`;
    subtitleText = "Trial ending soon!";
  } else if (isWarning) {
    containerClass =
      "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
    dotClass = "bg-amber-500";
    titleText = `${daysLeft} days remaining`;
    subtitleText = "Free Trial";
  } else if (isTrial) {
    containerClass =
      "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
    dotClass = "bg-amber-400";
    titleText = `${daysLeft} days remaining`;
    subtitleText = "Free Trial";
  } else {
    // Active subscription
    containerClass =
      "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800";
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
    ? "text-red-500 dark:text-red-500"
    : isWarning || isTrial
    ? "text-amber-500 dark:text-amber-500"
    : "text-indigo-500 dark:text-indigo-500";

  if (collapsed) {
    return (
      <Link href="/billing">
        <div 
          className={`flex items-center justify-center p-2 rounded-xl border transition-all hover:bg-white/10 ${containerClass}`}
          title={`${titleText} - ${subtitleText}`}
        >
          <span className={`w-3 h-3 rounded-full flex-shrink-0 shadow-sm ${dotClass}`} />
        </div>
      </Link>
    );
  }

  return (
    <Link href="/billing">
      <div
        className={`rounded-xl px-3 py-2.5 border cursor-pointer shadow-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] ${containerClass}`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
          <div className="min-w-0 flex-1">
            <p className={`text-[10px] font-black uppercase tracking-widest truncate ${textClass}`}>
              {titleText}
            </p>
            <p className={`text-[10px] font-medium leading-none mt-0.5 truncate ${subTextClass}`}>{subtitleText}</p>
          </div>
          {(isExpired || isCritical) && (
            <span className={`text-xs font-bold flex-shrink-0 ${textClass}`}>
              !
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Subscription badge wrapper (needs sidebar context) ───────────────────────

function SidebarSubscriptionBadgeSection({ subInfo }: { subInfo: SubInfo }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  return (
    <div className={cn(
      "mt-auto transition-all duration-200",
      isCollapsed ? "px-1.5 py-3 flex justify-center" : "px-4 py-6"
    )}>
      <SubscriptionBadge {...subInfo} collapsed={isCollapsed} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const language = useLanguage();
  const setLanguage = useSetLanguage();
  const { currentBranch, branches, setCurrentBranchById, clearBranches } =
    useBranch();
  // Unified Subscription State
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [fetchingSub, setFetchingSub] = useState(false);
  const [subInfo, setSubInfo] = useState<SubInfo | null>(null);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);

    if (!currentUser && router.pathname !== "/login") {
      router.push("/login");
      return;
    }

    // Auto-set manager's branch when they login
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

  // Listen for user profile updates
  useEffect(() => {
    const handleUserProfileUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        setUser(customEvent.detail);
      }
    };

    window.addEventListener("userProfileUpdated", handleUserProfileUpdate);
    return () => {
      window.removeEventListener("userProfileUpdated", handleUserProfileUpdate);
    };
  }, []);

  // Unified Subscription Effect - Fetches plan and sets display info once
  useEffect(() => {
    if (user?.role === "admin") {
      setFetchingSub(true);
      getCurrentSubscription()
        .then((sub) => {
          setSubscription(sub);
          if (sub) {
            const msLeft = sub.endDate
              ? new Date(sub.endDate).getTime() - Date.now()
              : Infinity;
            const daysLeft = msLeft === Infinity ? 9999 : Math.ceil(msLeft / 86_400_000);
            setSubInfo({
              status: sub.status,
              daysLeft,
              planName: (sub as any).plan?.name ?? (sub.status === 'trial' ? 'Trial' : 'Basic'),
            });
          } else {
            setSubInfo(null);
          }
        })
        .catch(() => setSubInfo(null))
        .finally(() => setFetchingSub(false));
    } else {
      setSubscription(null);
      setSubInfo(null);
    }
  }, [user?.id]);

  // ── Global subscription / branch event handlers ──────────────────────────
  // subscription:limitReached — fired by api.ts when the server returns 402
  //   with error="subscription_limit_reached". Opens the upgrade modal.
  // branch:accessDenied      — fired by api.ts when the server returns 403
  //   for the X-Branch-ID header (BOLA guard). Clears stale selection.
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  useEffect(() => {
    const onLimitReached = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string }>).detail;
      setUpgradeMessage(detail?.message || "");
      setUpgradeModalOpen(true);
    };

    const onBranchAccessDenied = () => {
      // The stale branch id was already removed from localStorage by api.ts.
      // Push to home so the branch selector resets cleanly.
      router.push("/");
    };

    window.addEventListener("subscription:limitReached", onLimitReached);
    window.addEventListener("branch:accessDenied", onBranchAccessDenied);
    return () => {
      window.removeEventListener("subscription:limitReached", onLimitReached);
      window.removeEventListener("branch:accessDenied", onBranchAccessDenied);
    };
  }, [router]);

  // Update current date and time every second
  useEffect(() => {
    setCurrentDate(new Date());
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000); // Update every second
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    clearBranches();
    logout();
    router.push("/login");
  };

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
  };

  const handleBranchChange = (branchId: string) => {
    setCurrentBranchById(branchId);
    // The branchChange event dispatched by setCurrentBranchById will trigger
    // dashboard data refresh via the listener in index.tsx
  };

  const t = (key: string) => getTranslation(key, language);

  if (!user && router.pathname !== "/login") {
    return null;
  }

  if (router.pathname === "/login") {
    return <>{children}</>;
  }

  const navigationGroups = [
    {
      title: "Main",
      items: [
        { name: t("dashboard"), href: "/", icon: LayoutDashboard, show: true },
        { name: t("students"), href: "/students", icon: Users, show: true },
        { name: t("teachers"), href: "/teachers", icon: GraduationCap, show: true },
        { name: t("classes"), href: "/classes", icon: BookOpen, show: true },
      ]
    },
    {
      title: t("finance") || "Finance",
      items: [
        { name: t("payments"), href: "/payments", icon: DollarSign, show: true },
        { name: t("salaries"), href: "/salaries", icon: Wallet, show: true },
        { name: t("expenses"), href: "/expenses", icon: TrendingDown, show: true },
      ]
    },
    {
      title: t("administration") || "Administration",
      items: [
        {
          name: t("reports"),
          href: "/reports",
          icon: FileText,
          show: hasPermission("canViewReports"),
        },
        {
          name: t("branches"),
          href: "/branches",
          icon: Building2,
          show: user?.role === "admin",
        },
        {
          name: t("managers"),
          href: "/managers",
          icon: UserCog,
          show: user?.role === "admin" || user?.role === "branch_admin",
        },
        {
          name: t("settings"),
          href: "/settings",
          icon: Settings,
          show: user?.role === "admin",
        },
      ]
    },
    {
      title: "Support",
      items: [
        { name: t("help"), href: "/help", icon: HelpCircle, show: true },
      ]
    }
  ];

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <Sidebar collapsible="icon" className="border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
          <SidebarHeader className="border-b border-slate-200 dark:border-slate-800 p-0">
            {/* Expanded header: logo + text + collapse button */}
            <div className="group-data-[collapsible=icon]:hidden flex items-center justify-between gap-2 px-4 py-3">
              <Link href="/" className="flex items-center gap-3 group flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform flex-shrink-0">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-base bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate leading-tight">
                    {currentBranch?.name || t("schoolName") || "School"}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase truncate opacity-70">
                    School Management
                  </span>
                </div>
              </Link>
              <SidebarTrigger className="h-7 w-7 flex-shrink-0 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" />
            </div>
            {/* Collapsed header: logo icon + expand button stacked */}
            <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center gap-2 py-3">
              <Link href="/" className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5 text-white" />
              </Link>
              <SidebarTrigger className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" />
            </div>
          </SidebarHeader>

          <SidebarContent className="py-4">
            {/* Branch "Workspace Switcher" Selector */}
            {branches.length > 0 && user?.role === "admin" && (
              <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupContent className="px-3">
                  <Select value={currentBranch?.id || ""} onValueChange={handleBranchChange}>
                    <SelectTrigger className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-none hover:bg-slate-100 dark:hover:bg-slate-800 h-11 text-xs shadow-none group/switcher transition-all">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-700">
                          <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                        </div>
                        <div className="flex flex-col items-start text-left">
                          <span className="font-bold text-slate-900 dark:text-slate-100 leading-tight">Workspace</span>
                          <SelectValue placeholder={t("selectBranch")} className="text-[10px] text-slate-500" />
                        </div>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {[...branches].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Navigation Groups */}
            {navigationGroups.map((group) => (
              <Collapsible key={group.title} defaultOpen={true} className="group/collapsible">
                <SidebarGroup className="py-2">
                  <SidebarGroupLabel asChild className="px-6 group-data-[collapsible=icon]:hidden">
                    <CollapsibleTrigger className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500/50 py-3 hover:text-indigo-600 transition-colors">
                      {group.title}
                      <ChevronDown className="w-3 h-3 opacity-0 group-hover/collapsible:opacity-100 transition-all group-data-[state=open]/collapsible:rotate-180" />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu className="px-3 gap-0.5">
                        {group.items.filter(i => i.show).map((item) => {
                          const isActive = router.pathname === item.href;
                          const Icon = item.icon;
                          return (
                            <SidebarMenuItem key={item.name}>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive}
                                tooltip={item.name}
                                className={cn(
                                  "h-9 px-3 rounded-lg flex items-center gap-3 transition-all duration-200 group/nav relative active:scale-[0.97]",
                                  isActive 
                                    ? "bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 font-bold" 
                                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                                )}
                              >
                                <Link href={item.href}>
                                  <div className={cn(
                                    "flex items-center justify-center transition-all duration-150 group-hover/nav:translate-x-0.5",
                                    isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover/nav:text-indigo-600"
                                  )}>
                                    <Icon className="w-[18px] h-[18px]" />
                                  </div>
                                  <span className="text-sm group-data-[collapsible=icon]:hidden">{item.name}</span>
                                  {isActive && (
                                    <div className="absolute left-0 w-[2.5px] h-4 bg-indigo-600 dark:bg-indigo-500 rounded-full" />
                                  )}
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            ))}
            
            {user?.role === "admin" && subInfo && (
              <SidebarSubscriptionBadgeSection subInfo={subInfo} />
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200 dark:border-slate-800 p-3">
             <SidebarMenu>
               <SidebarMenuItem>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton 
                        size="lg" 
                        className="w-full hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl p-1.5 h-auto transition-all active:scale-[0.98]"
                      >
                        <Avatar className="h-9 w-9 border border-indigo-100 dark:border-indigo-900 shadow-sm">
                          <AvatarFallback className="bg-indigo-600 text-white text-[11px] font-bold uppercase">
                            {user?.fullName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left min-w-0 ml-2 group-data-[collapsible=icon]:hidden">
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {user?.fullName}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-tighter">
                            {user?.role?.replace("_", " ")}
                          </p>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-data-[collapsible=icon]:hidden opacity-50 group-hover:opacity-100 transition-opacity" />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 p-2 shadow-xl border-slate-200 dark:border-slate-800" side="right" align="end" sideOffset={12}>
                      <div className="flex items-center justify-between px-2 py-1 mb-2">
                         <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Settings</span>
                         <ThemeSwitch />
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push("/admin-profile")} className="rounded-lg gap-2 cursor-pointer py-2">
                        <UserCog className="h-4 w-4 text-indigo-600" />
                        <span className="font-semibold text-sm">Account Settings</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-lg gap-2 cursor-pointer py-2">
                         <Globe className="h-4 w-4 text-indigo-600" />
                         <div className="flex-1 flex items-center justify-between">
                            <span className="font-semibold text-sm">Language</span>
                            <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full uppercase">{language}</span>
                         </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="rounded-lg gap-2 cursor-pointer py-2 text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20">
                        <LogOut className="h-4 w-4" />
                        <span className="font-semibold text-sm capitalize">Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
               </SidebarMenuItem>
             </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile-only header (desktop toggle is inside the sidebar header) */}
          <header className="md:hidden sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-base bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                {currentBranch?.name || t("schoolName") || "School"}
              </span>
            </Link>
            <SidebarTrigger />
          </header>

          <main className="flex-1 overflow-x-hidden">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
      <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black text-xl bg-gradient-to-br from-indigo-600 to-pink-600 bg-clip-text text-transparent uppercase tracking-tight">
              {t("subscriptionLimitReached") || "Limit reached"}
            </DialogTitle>
            <DialogDescription className="font-medium text-slate-500">
              {upgradeMessage || t("subscriptionLimitDetail") || "You have reached the limit included in your current plan. Upgrade to add more."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 border-t pt-4 mt-2">
            <Button variant="ghost" onClick={() => setUpgradeModalOpen(false)} className="font-bold uppercase tracking-widest text-[10px]">
              {t("close") || "Close"}
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 font-bold uppercase tracking-widest text-[10px] shadow-indigo-100 shadow-lg transition-transform active:scale-95"
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
