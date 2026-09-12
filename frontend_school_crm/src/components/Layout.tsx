import { ReactNode, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Bell,
  BellDot,
  CheckCheck,
  Shield,
  BarChart2,
  ClipboardList,
  Zap,
  GraduationCap as PortalIcon,
  Calendar,
  MessageSquare,
  ClipboardCheck,
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
  SidebarInset,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getCurrentUser, logout, hasPermission } from "@/lib/auth";
import { getStoredBranchId } from "@/lib/storage";
import { User } from "@/types";
import { getTranslation } from "@/lib/translations";
import { useLanguage, useSetLanguage } from "@/hooks/use-language";
import { useSettings } from "@/hooks/use-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranch } from "@/context/BranchContext";
import type { Language } from "@/types";
import { getCurrentSubscription } from "@/lib/subscription-api";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "@/lib/api";

// ── Notification bell ─────────────────────────────────────────────────────────

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "uz-latn", label: "O'zbek" },
  { value: "uz-cyrl", label: "Ўзбекча" },
  { value: "en",      label: "English" },
];

function NotificationBell({ direction = "up", align = "right" }: { direction?: "up" | "down"; align?: "left" | "right" }) {
  const bellLanguage = useLanguage();
  const bt = (key: string) => getTranslation(key, bellLanguage);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      setUnread(count);
    } catch {
      // silently ignore (e.g. no branch selected yet)
    }
  }, []);

  // Poll unread count every 30 s
  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, [fetchCount]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await getNotifications(20);
      setNotifications(data);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnread((c) => Math.max(0, c - 1));
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  };

  const typeColor = (type: AppNotification["type"]) => {
    if (type === "payment") return "bg-green-500";
    if (type === "student") return "bg-orange-500";
    return "bg-blue-500";
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return bt("justNow");
    if (m < 60) return `${m}${bt("minAgo")}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}${bt("hourAgo")}`;
    return `${Math.floor(h / 24)}${bt("dayAgo")}`;
  };

  return (
    <Popover open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v) fetchNotifications();
    }}>
      <PopoverTrigger asChild>
        <button
          ref={btnRef}
          className="relative h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Notifications"
        >
          {unread > 0 ? (
            <BellDot className="w-[18px] h-[18px] text-indigo-500" />
          ) : (
            <Bell className="w-[18px] h-[18px]" />
          )}
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-white dark:ring-slate-900">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side={direction === "up" ? "top" : "bottom"}
        align={align === "left" ? "start" : "end"}
        sideOffset={12}
        className="w-80 p-0 overflow-hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200/50 dark:border-slate-800/50 shadow-2xl rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100/50 dark:border-slate-800/50">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {bt("notifications")} {unread > 0 && <span className="text-xs text-indigo-500 ml-1">({unread})</span>}
          </span>
          {unread > 0 && (
            <button
              onClick={handleMarkAll}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {bt("markAllRead")}
            </button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-[380px]">
          {loading ? (
            <div className="space-y-4 p-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 animate-pulse" />
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-full animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-sm text-slate-400 font-medium">{bt("noNotificationsYet")}</p>
            </div>
          ) : (
            <div className="p-1">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.isRead && handleMarkRead(n.id)}
                  className={cn(
                    "w-full flex items-start gap-3 px-3 py-3 text-left rounded-xl transition-all duration-200",
                    !n.isRead 
                      ? "bg-indigo-50/40 dark:bg-indigo-500/5 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10" 
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  )}
                >
                  <span className={cn(
                    "w-2 h-2 mt-1.5 rounded-full flex-shrink-0 shadow-sm", 
                    typeColor(n.type),
                    !n.isRead && "ring-4 ring-indigo-500/10"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-xs font-bold truncate",
                      !n.isRead ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"
                    )}>
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1.5 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0 animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="p-2 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100/50 dark:border-slate-800/50 text-center">
             <Link href="/notifications" prefetch={false} className="text-[10px] font-bold text-slate-400 hover:text-indigo-500 uppercase tracking-widest transition-colors">
               View History
             </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

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
        <Link href="/" className="flex items-center gap-2.5 flex-1 min-w-0 group/brand">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-600/20 group-hover/brand:scale-110 transition-transform duration-300">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            {currentBranchName ? (
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate leading-none mb-1">
                {currentBranchName}
              </p>
            ) : (
              <Skeleton className="h-3.5 w-28 mb-1.5" />
            )}
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-80">
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
  // In the header it's used as a hamburger (label=""), in bottom nav as "More"
  const isHamburger = label === "";
  return (
    <button
      onClick={() => setOpenMobile(true)}
      className={cn(
        "flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors active:scale-95",
        isHamburger
          ? "w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          : "flex-1 flex-col gap-1 h-full text-slate-400 dark:text-slate-500"
      )}
    >
      <Menu className="w-5 h-5" />
      {!isHamburger && (
        <span className="text-[10px] font-medium leading-none">{label}</span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface LayoutProps {
  children: ReactNode;
}

function MobileSidebarCloser() {
  const { setOpenMobile, isMobile } = useSidebar();
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = () => {
      if (isMobile) setOpenMobile(false);
    };
    
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events, isMobile, setOpenMobile]);

  return null;
}

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const language = useLanguage();
  const { currentBranch, branches, isLoading: branchesLoading, setCurrentBranchById, clearBranches } = useBranch();
  const { settings, loading: settingsLoading } = useSettings();
  const [subInfo, setSubInfo] = useState<SubInfo | null>(null);
  // SidebarProvider (components/ui/sidebar.tsx) treats passing onOpenChange
  // as "the parent fully controls this" — if `open` isn't also passed back
  // in, its internal setOpen() only calls onOpenChange and never updates its
  // own state, so the sidebar never visually toggles until a reload re-seeds
  // defaultOpen from localStorage. Keeping the boolean here and passing both
  // open+onOpenChange makes it properly controlled.
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("sidebarOpen") !== "false" : true
  );

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
      const alreadySet = getStoredBranchId() === currentUser.branchId;
      if (userBranch && !alreadySet) {
        setCurrentBranchById(currentUser.branchId);
      }
    }
  }, [router.pathname, router, branches, setCurrentBranchById]);

  // A freshly-verified admin has no branch yet — registration no longer
  // manufactures one with fake placeholder address/phone (see auth_service's
  // CompleteRegistration). Every branch-scoped page would otherwise render
  // nothing but empty states, so send them to the mandatory setup step
  // instead. Single centralized guard rather than touching all 25 pages.
  useEffect(() => {
    if (user && user.role === "admin" && !branchesLoading && branches.length === 0) {
      router.push("/onboarding-branch");
    }
  }, [user, branchesLoading, branches.length, router]);

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
            const msLeft = sub.end_date
              ? new Date(sub.end_date).getTime() - Date.now()
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
    // logout() now performs a hard navigation to /login itself
    // (drops React Query cache + component state).
    logout();
  };

  const setLanguage = useSetLanguage();
  const handleBranchChange = (branchId: string) => setCurrentBranchById(branchId);

  const cycleLanguage = () => {
    const idx = LANGUAGES.findIndex((l) => l.value === language);
    const next = LANGUAGES[(idx + 1) % LANGUAGES.length]!;
    setLanguage(next.value);
  };

  const t = (key: string) => getTranslation(key, language);

  const isTeacher = user?.role === "teacher";

  // Redirect teacher away from admin pages
  if (user && isTeacher && router.pathname === "/") {
    router.replace("/teacher-portal");
    return null;
  }
  if (!user && router.pathname !== "/login") return null;
  if (router.pathname === "/login") return <>{children}</>;

  // ── Navigation structure ────────────────────────────────────────────────────

  const navigationGroups = isTeacher
    ? [
        {
          title: t("teacherPortal"),
          items: [
            { name: t("teacherPortal"), href: "/teacher-portal", icon: PortalIcon, show: true },
            { name: t("timetable"), href: "/schedule", icon: Calendar, show: true },
            { name: t("assignments"), href: "/assignments", icon: ClipboardCheck, show: true },
            { name: t("help"), href: "/help", icon: HelpCircle, show: true },
          ],
        },
      ]
    : [
        {
          title: t("main"),
          items: [
            { name: t("dashboard"), href: "/", icon: LayoutDashboard, show: true },
            // students/teachers/classes have dedicated canView* flags in the
            // Permission model (see @/types), same as canViewReports below —
            // but these were hardcoded `show: true` regardless, so a manager
            // whose permissions explicitly withheld view access still saw
            // and could navigate into these pages. Attendance/schedule/
            // assignments/messaging have no such flag in the model (every
            // branch member gets them) — that's unchanged.
            { name: t("students"), href: "/students", icon: Users, show: hasPermission("canViewStudents") },
            { name: t("teachers"), href: "/teachers", icon: GraduationCap, show: hasPermission("canViewTeachers") },
            { name: t("classes"), href: "/classes", icon: BookOpen, show: hasPermission("canViewClasses") },
            { name: t("attendance"), href: "/attendance", icon: ClipboardList, show: true },
            { name: t("timetable"), href: "/schedule", icon: Calendar, show: true },
            { name: t("assignments"), href: "/assignments", icon: ClipboardCheck, show: true },
            { name: t("messaging"), href: "/messaging", icon: MessageSquare, show: true },
          ],
        },
        {
          title: t("finance"),
          items: [
            { name: t("payments"), href: "/payments", icon: DollarSign, show: hasPermission("canViewPayments") },
            { name: t("quickPayment"), href: "/quick-pay", icon: Zap, show: hasPermission("canViewPayments") },
            { name: t("salaries"), href: "/salaries", icon: Wallet, show: hasPermission("canViewSalaries") },
            { name: t("expenses"), href: "/expenses", icon: TrendingDown, show: hasPermission("canViewExpenses") },
          ],
        },
        {
          title: t("administration"),
          items: [
            { name: t("reports"), href: "/reports", icon: FileText, show: hasPermission("canViewReports") },
            { name: t("branchesOverview"), href: "/branches-overview", icon: BarChart2, show: user?.role === "admin" },
            { name: t("auditLog"), href: "/audit-log", icon: Shield, show: user?.role === "admin" },
            { name: t("branches"), href: "/branches", icon: Building2, show: user?.role === "admin" },
            { name: t("managers"), href: "/managers", icon: UserCog, show: user?.role === "admin" || user?.role === "branch_admin" },
            { name: t("settings"), href: "/settings", icon: Settings, show: user?.role === "admin" },
          ],
        },
        {
          title: t("support"),
          items: [
            { name: t("help"), href: "/help", icon: HelpCircle, show: true },
          ],
        },
      ];

  // Bottom nav — role-aware
  // Short labels: a bottom-bar tab is ~56px wide, so the full page names were
  // being truncated mid-word ("Asosiy pa…").
  const bottomNavItems = isTeacher
    ? [
        { name: t("teacherPortalShort"), href: "/teacher-portal", icon: PortalIcon },
        { name: t("timetable"), href: "/schedule", icon: Calendar },
        { name: t("assignments"), href: "/assignments", icon: ClipboardCheck },
        { name: t("help"), href: "/help", icon: HelpCircle },
      ]
    : [
        { name: t("dashboardShort"), href: "/", icon: LayoutDashboard, show: true },
        // Same gap as navigationGroups above, just for the mobile shortcut
        // bar: a manager without canViewStudents/canViewPayments/
        // canViewClasses still got tab buttons straight to those pages.
        { name: t("students"), href: "/students", icon: Users, show: hasPermission("canViewStudents") },
        { name: t("payments"), href: "/payments", icon: DollarSign, show: hasPermission("canViewPayments") },
        { name: t("classes"), href: "/classes", icon: BookOpen, show: hasPermission("canViewClasses") },
        { name: t("teachers"), href: "/teachers", icon: GraduationCap, show: hasPermission("canViewTeachers") },
      ].filter((item) => item.show).slice(0, 4);

  // The brand slot shows the SCHOOL, not the branch: the branch name already
  // appears in the switcher directly below it, so showing it here too printed
  // the same string twice. While settings load we pass an empty string and
  // render a skeleton rather than the literal "Maktab nomi" placeholder the
  // old `t("schoolName")` fallback put on screen on every page load.
  const schoolDisplayName = settingsLoading
    ? ""
    : settings?.organizationName || settings?.name || t("schoolName");
  // Still needed for the mobile top bar, where non-admins see the branch as
  // plain text instead of the switcher.
  const branchDisplayName = currentBranch?.name || t("schoolName");

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={(open) => {
        setSidebarOpen(open);
        localStorage.setItem("sidebarOpen", String(open));
      }}
    >
      <MobileSidebarCloser />
      <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-950">

        {/* ────────────────────────────────── SIDEBAR ── */}
        <Sidebar
          variant="inset"
          collapsible="icon"
          className="hidden md:flex border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
          {/* Header */}
          <SidebarHeaderSection
            currentBranchName={schoolDisplayName}
            schoolName="Management"
          />

          {/* Content */}
          <SidebarContent className="px-2 py-3 gap-0">

            {/* Branch switcher — admin, expanded only */}
            {branches.length > 0 && user?.role === "admin" && (
              <div className="mb-3 px-1 group-data-[collapsible=icon]:hidden">
                <Select value={currentBranch?.id || "__none__"} onValueChange={(v) => v !== "__none__" && handleBranchChange(v)}>
                  <SelectTrigger className="w-full h-9 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-xs rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
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

            {/* Navigation groups — no collapsible, always visible */}
            {navigationGroups.map((group, groupIdx) => {
              const visibleItems = group.items.filter((i) => i.show);
              if (visibleItems.length === 0) return null;
              return (
                <SidebarGroup key={group.title} className="px-0 py-0 mb-1">
                  {/* Group label — hidden in icon mode, hidden for first group if teacher */}
                  <SidebarGroupLabel className="px-2 mb-1 h-7 flex items-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest group-data-[collapsible=icon]:hidden">
                    {group.title}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {visibleItems.map((item) => {
                        const isActive = item.href === "/"
                          ? router.pathname === "/"
                          : router.pathname === item.href || router.pathname.startsWith(item.href + "/");
                        const Icon = item.icon;
                        return (
                          <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              tooltip={item.name}
                              className={cn(
                                "h-9 rounded-lg px-2.5 gap-2.5 transition-colors duration-150 group/item relative",
                                isActive
                                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold group-data-[collapsible=icon]:ring-2 group-data-[collapsible=icon]:ring-indigo-500/40"
                                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                              )}
                            >
                              <Link href={item.href} className="flex items-center gap-2.5 w-full">
                                {/* Active left bar */}
                                {isActive && (
                                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-indigo-500 group-data-[collapsible=icon]:hidden" />
                                )}
                                <Icon className={cn(
                                  "w-4 h-4 flex-shrink-0",
                                  isActive ? "text-indigo-500" : "text-slate-400 group-hover/item:text-slate-600 dark:group-hover/item:text-slate-300"
                                )} />
                                <span className="text-sm group-data-[collapsible=icon]:hidden truncate">
                                  {item.name}
                                </span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                  {/* Divider between groups */}
                  {groupIdx < navigationGroups.length - 1 && (
                    <div className="my-2 mx-2 border-t border-slate-100 dark:border-slate-800 group-data-[collapsible=icon]:hidden" />
                  )}
                </SidebarGroup>
              );
            })}

            {/* Subscription badge */}
            {user?.role === "admin" && subInfo && (
              <SidebarSubscriptionBadgeSection subInfo={subInfo} />
            )}
          </SidebarContent>

          {/* Footer — notification bell + user */}
          <SidebarFooter className="p-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-1 px-1 mb-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <NotificationBell align="left" />
            </div>
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
                    {t("theme")}
                  </span>
                  <ThemeSwitch />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/profile")}
                  className="rounded-md gap-2 cursor-pointer py-2"
                >
                  <UserCog className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium">{t("account")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={cycleLanguage} className="rounded-md gap-2 cursor-pointer py-2">
                  <Globe className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium flex-1">{t("language")}</span>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                    {LANGUAGES.find((l) => l.value === language)?.label ?? language}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="rounded-md gap-2 cursor-pointer py-2 text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm font-medium">{t("logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* ──────────────────────────── MAIN CONTENT ── */}
        <SidebarInset className="flex-1 flex flex-col min-w-0">

          {/* ── Mobile top bar — FIXED (not sticky, fixes stacking context bug) ── */}
          <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-4">

            {/* Hamburger — opens sidebar drawer */}
            <MobileMoreButton label="" />

            {/* Branch name / selector */}
            <div className="flex-1 min-w-0">
              {user?.role === "admin" && branches.length > 1 ? (
                <Select
                  value={currentBranch?.id || "__none__"}
                  onValueChange={(v) => v !== "__none__" && handleBranchChange(v)}
                >
                  <SelectTrigger className="h-8 border-none bg-transparent shadow-none focus:ring-0 px-0 min-w-0 w-full text-left">
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                      <SelectValue placeholder={t("selectBranch")} />
                    </span>
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
              ) : (
                <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {branchDisplayName}
                </p>
              )}
            </div>

            {/* Right: subscription status + notification + avatar */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* The full subscription badge only lives in the desktop
                  sidebar (`hidden md:flex`), so on mobile a trial running out
                  — or already expired — was invisible until the admin
                  happened to open Billing. This is the same collapsed
                  (dot-only) badge the desktop sidebar shows when collapsed,
                  reused here so mobile gets at least a coloured status dot
                  that links to /billing. */}
              {user?.role === "admin" && subInfo && (
                <SubscriptionBadge {...subInfo} collapsed />
              )}
              <NotificationBell direction="down" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold active:scale-95 transition-transform">
                    {user?.fullName.charAt(0).toUpperCase()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52 p-1.5 shadow-lg border-slate-200 dark:border-slate-800" align="end" sideOffset={8}>
                  <div className="px-2 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.fullName}</p>
                    <p className="text-xs text-slate-400 capitalize">{user?.role?.replace("_", " ")}</p>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-xs text-slate-500">{t("theme")}</span>
                    <ThemeSwitch />
                  </div>
                  <DropdownMenuItem onClick={cycleLanguage} className="gap-2 cursor-pointer py-1.5">
                    <Globe className="h-4 w-4 text-slate-400" />
                    <span className="text-sm flex-1">{t("language")}</span>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                      {LANGUAGES.find((l) => l.value === language)?.label ?? language}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/profile")} className="gap-2 cursor-pointer py-1.5">
                    <UserCog className="h-4 w-4 text-slate-400" />
                    <span className="text-sm">{t("account")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer py-1.5 text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20">
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm">{t("logout")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content — pt-14 on mobile offsets the fixed header */}
          <div className="flex-1 w-full pt-14 md:pt-0 overflow-x-hidden">
            <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-20 md:pb-8">
              {children}
            </div>
          </div>

        {/* ──────────────────────── MOBILE BOTTOM NAV ── */}
        {/* Flat bar pinned to the bottom — no floating pill */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom,0)]">
          <div className="flex items-stretch h-16">
            {bottomNavItems.map((item) => {
              const isActive = item.href === "/"
                ? router.pathname === "/"
                : router.pathname === item.href || router.pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center gap-1 transition-colors active:scale-95",
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                >
                  {/* Active top indicator */}
                  <span className={cn(
                    "absolute top-0 h-0.5 w-8 rounded-b-full transition-all duration-200",
                    isActive ? "bg-indigo-500" : "bg-transparent"
                  )} />
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium leading-none truncate max-w-[56px] text-center">
                    {item.name}
                  </span>
                </Link>
              );
            })}
            {/* More — opens sidebar sheet */}
            <MobileMoreButton label={t("more")} />
          </div>
        </nav>
      </SidebarInset>

      {/* Upgrade modal */}
      <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold text-lg text-slate-900 dark:text-slate-100">
              {t("subscriptionLimitReached")}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {upgradeMessage ||
                t("subscriptionLimitDetail")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 border-t pt-4 mt-2">
            <Button
              variant="ghost"
              onClick={() => setUpgradeModalOpen(false)}
              className="text-sm font-medium"
            >
              {t("close")}
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold transition-transform active:scale-95"
              onClick={() => {
                setUpgradeModalOpen(false);
                router.push("/billing");
              }}
            >
              {t("upgradePlan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </SidebarProvider>
  );
}
