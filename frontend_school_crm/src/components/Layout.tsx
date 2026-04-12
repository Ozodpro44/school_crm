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
  SidebarRail,
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
          <SidebarHeader className="border-b border-slate-200 dark:border-slate-800 p-4">
            <Link href="/" className="flex items-center gap-3 px-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="font-black text-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate leading-tight">
                  {currentBranch?.name || t("schoolName") || "School"}
                </span>
                <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase truncate opacity-70">
                  School Management
                </span>
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent className="py-4">
            {/* Branch Selector (Desktop only) */}
            {branches.length > 0 && user?.role === "admin" && (
              <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Branch</SidebarGroupLabel>
                <SidebarGroupContent className="px-4 mt-2">
                  <Select value={currentBranch?.id || ""} onValueChange={handleBranchChange}>
                    <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-10 text-xs shadow-sm">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                        <SelectValue placeholder={t("selectBranch")} />
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
                <SidebarGroup>
                  <SidebarGroupLabel asChild className="px-6 group-data-[collapsible=icon]:hidden">
                    <CollapsibleTrigger className="flex w-full items-center justify-between text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 py-3 mt-2 hover:text-indigo-500 transition-colors">
                      {group.title}
                      <ChevronDown className="w-3 h-3 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu className="px-3 gap-1.5 pt-1">
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
                                  "h-10 px-3 rounded-xl flex items-center gap-3 transition-all duration-300 group/nav relative overflow-hidden",
                                  isActive 
                                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-[inset_0_0_0_1px_rgba(79,70,229,0.1),0_0_20px_rgba(79,70,229,0.1)] backdrop-blur-sm" 
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                                )}
                              >
                                <Link href={item.href}>
                                  <div className={cn(
                                    "flex items-center justify-center w-5 h-5 transition-all duration-300 group-hover/nav:scale-110 group-hover/nav:translate-x-0.5",
                                    isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover/nav:text-indigo-500"
                                  )}>
                                    <Icon className="w-[18px] h-[18px]" />
                                  </div>
                                  <span className="font-bold text-sm tracking-tight group-data-[collapsible=icon]:hidden">{item.name}</span>
                                  {isActive && (
                                    <>
                                      <div className="absolute left-0 w-[3px] h-6 bg-indigo-600 dark:bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(79,70,229,1)] animate-in slide-in-from-left-full duration-500" />
                                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent pointer-events-none" />
                                    </>
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
            
            <div className="mt-auto px-4 py-6">
               {user?.role === "admin" && subInfo && (
                <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                  <SubscriptionBadge {...subInfo} collapsed={false} />
                </div>
              )}
            </div>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-900/50">
             <SidebarMenu>
               <SidebarMenuItem>
                 <div className="flex items-center gap-2 px-1 mb-2 group-data-[collapsible=icon]:hidden">
                    <ThemeSwitch />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-70">Appearance</span>
                 </div>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton 
                        size="lg" 
                        className="w-full hover:bg-white dark:hover:bg-slate-800 rounded-xl p-2 h-auto shadow-sm active:scale-95 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                      >
                        <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-800 shadow-sm ring-1 ring-indigo-500/20">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-600 text-white font-black text-xs">
                            {user?.fullName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left min-w-0 ml-3 group-data-[collapsible=icon]:hidden">
                          <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                            {user?.fullName}
                          </p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500/70 truncate">
                            {user?.role?.replace("_", " ")}
                          </p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-slate-400 group-data-[collapsible=icon]:hidden transition-transform group-hover:translate-y-0.5" />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" side="right" align="end" sideOffset={8}>
                      <DropdownMenuLabel className="font-black text-[10px] uppercase tracking-widest opacity-50 px-2 py-2">Account Management</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push("/admin-profile")} className="cursor-pointer gap-2 font-semibold">
                        <UserCog className="h-4 w-4 text-indigo-500" />
                        <span>Profile Settings</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer gap-2 font-semibold">
                         <Globe className="h-4 w-4 text-indigo-500" />
                         <div className="flex-1 flex items-center justify-between">
                            <span>Language</span>
                            <span className="text-[10px] font-black text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase">{language}</span>
                         </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:text-red-500 cursor-pointer gap-2 font-semibold">
                        <LogOut className="h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
               </SidebarMenuItem>
             </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="lg:hidden sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm p-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-base bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                {currentBranch?.name || t("schoolName") || "School"}
              </span>
            </Link>
            <SidebarTrigger className="lg:hidden" />
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
