import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
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
  UserCog,
  Calendar,
  Clock,
} from "lucide-react";
import { getCurrentUser, logout, hasPermission } from "@/lib/auth";
import { User, Language } from "@/types";
import { getTranslation } from "@/lib/translations";
import { useLanguage, useSetLanguage } from "@/hooks/use-language";
import { useBranch } from "@/context/BranchContext";

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
      if (userBranch) {
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
    // Refresh the page data without full reload
    router.replace(router.asPath);
  };

  const t = (key: string) => getTranslation(key, language);

  if (!user && router.pathname !== "/login") {
    return null;
  }

  if (router.pathname === "/login") {
    return <>{children}</>;
  }

  const navigation = [
    { name: t("dashboard"), href: "/", icon: LayoutDashboard, show: true },
    { name: t("students"), href: "/students", icon: Users, show: true },
    { name: t("teachers"), href: "/teachers", icon: GraduationCap, show: true },
    { name: t("classes"), href: "/classes", icon: BookOpen, show: true },
    { name: t("payments"), href: "/payments", icon: DollarSign, show: true },
    { name: t("salaries"), href: "/salaries", icon: Wallet, show: true },
    { name: t("expenses"), href: "/expenses", icon: TrendingDown, show: true },
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
    { name: t("help"), href: "/help", icon: HelpCircle, show: true },
  ].filter((item) => item.show);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      {/* Desktop Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 z-40 hidden lg:block ${
          sidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Toggle */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
            {sidebarOpen && (
              <Link href="/" className="flex items-center gap-2 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold text-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  School
                </span>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="ml-auto"
            >
              <ChevronLeft
                className={`w-5 h-5 transition-transform ${
                  !sidebarOpen && "rotate-180"
                }`}
              />
            </Button>
          </div>

          {/* Branch Selector */}
          {branches.length > 0 && sidebarOpen && (
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              {branches.length === 1 ? (
                // For managers with single branch, show as info
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="w-4 h-4" />
                    {currentBranch?.name}
                  </div>
                  {currentBranch && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {currentBranch.address}
                    </p>
                  )}
                </div>
              ) : (
                // For admins with multiple branches, show dropdown
                <>
                  <Select
                    value={currentBranch?.id || ""}
                    onValueChange={handleBranchChange}
                  >
                    <SelectTrigger className="w-full">
                      <Building2 className="w-4 h-4 mr-2" />
                      <SelectValue placeholder={t("selectBranch")} />
                    </SelectTrigger>
                    <SelectContent>
                      {[...branches]
                        .sort(
                          (a, b) =>
                            new Date(a.createdAt).getTime() -
                            new Date(b.createdAt).getTime()
                        )
                        .map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {currentBranch && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      {currentBranch.address}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Current Date & Time Display */}
          {sidebarOpen && (
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">
                  {(() => {
                    const months = {
                      en: [
                        "January",
                        "February",
                        "March",
                        "April",
                        "May",
                        "June",
                        "July",
                        "August",
                        "September",
                        "October",
                        "November",
                        "December",
                      ],
                      uz: [
                        "Yanvar",
                        "Fevral",
                        "Mart",
                        "Aprel",
                        "May",
                        "Iyun",
                        "Iyul",
                        "Avgust",
                        "Sentabr",
                        "Oktabr",
                        "Noyabr",
                        "Dekabr",
                      ],
                    };
                    const day = currentDate.getDate();
                    const month =
                      months[language === "en" ? "en" : "uz"][
                        currentDate.getMonth()
                      ];
                    const year = currentDate.getFullYear();
                    return `${day} ${month} ${year}`;
                  })()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>
                  {(() => {
                    const weekdays = {
                      en: [
                        "Sunday",
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                      ],
                      uz: [
                        "Yakshanba",
                        "Dushanba",
                        "Seshanba",
                        "Chorshanba",
                        "Payshanba",
                        "Juma",
                        "Shanba",
                      ],
                    };
                    const dayName =
                      weekdays[language === "en" ? "en" : "uz"][
                        currentDate.getDay()
                      ];
                    const hours = String(currentDate.getHours()).padStart(
                      2,
                      "0"
                    );
                    const minutes = String(currentDate.getMinutes()).padStart(
                      2,
                      "0"
                    );
                    const seconds = String(currentDate.getSeconds()).padStart(
                      2,
                      "0"
                    );
                    return `${dayName}, ${hours}:${minutes}:${seconds}`;
                  })()}
                </span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = router.pathname === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={`w-full justify-start gap-3 ${
                        !sidebarOpen && "justify-center px-2"
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {sidebarOpen && <span>{item.name}</span>}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            {sidebarOpen ? (
              <div className="space-y-3">
                <button
                  onClick={() =>
                    user?.role === "admin" && router.push("/admin-profile")
                  }
                  className={`w-full flex items-center gap-3 ${
                    user?.role === "admin"
                      ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-lg p-2 -m-2"
                      : ""
                  }`}
                  title={
                    user?.role === "admin" ? "Click to view admin profile" : ""
                  }
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {user?.fullName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {user?.fullName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                      {user?.role?.replace("_", " ")}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <Select
                    value={language}
                    onValueChange={(value) =>
                      handleLanguageChange(value as Language)
                    }
                  >
                    <SelectTrigger className="flex-1 h-9 text-xs">
                      <Globe className="w-4 h-4 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uz-cyrl">Ўзбек</SelectItem>
                      <SelectItem value="uz-latn">O'zbek</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                  <ThemeSwitch />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    title={t("logout")}
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                  {user?.fullName.charAt(0)}
                </div>
                <ThemeSwitch />
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-base bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              School
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeSwitch />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="relative"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 lg:hidden transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Mobile Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t("dashboard")}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Mobile Menu Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* User Info Mobile */}
              <button
                onClick={() => {
                  if (user?.role === "admin") {
                    router.push("/admin-profile");
                    setMobileMenuOpen(false);
                  }
                }}
                className={`w-full p-4 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900 ${
                  user?.role === "admin"
                    ? "hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
                    : ""
                }`}
                title={
                  user?.role === "admin" ? "Click to view admin profile" : ""
                }
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                    {user?.fullName.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {user?.fullName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                      {user?.role?.replace("_", " ")}
                    </p>
                  </div>
                </div>
              </button>

              {/* Branch Selector Mobile */}
              {branches.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {t("selectBranch")}
                  </label>
                  <Select
                    value={currentBranch?.id || ""}
                    onValueChange={handleBranchChange}
                  >
                    <SelectTrigger className="w-full h-11">
                      <Building2 className="w-4 h-4 mr-2" />
                      <SelectValue placeholder={t("selectBranch")} />
                    </SelectTrigger>
                    <SelectContent>
                      {[...branches]
                        .sort(
                          (a, b) =>
                            new Date(a.createdAt).getTime() -
                            new Date(b.createdAt).getTime()
                        )
                        .map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Language Selector Mobile */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {t("language")}
                </label>
                <Select
                  value={language}
                  onValueChange={(value) =>
                    handleLanguageChange(value as Language)
                  }
                >
                  <SelectTrigger className="w-full h-11">
                    <Globe className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uz-cyrl">Ўзбек (Кирилл)</SelectItem>
                    <SelectItem value="uz-latn">O'zbek (Lotin)</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Navigation Links Mobile */}
              <div className="space-y-1 pt-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide px-3 pb-2 block">
                  Navigation
                </label>
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = router.pathname === item.href;
                  return (
                    <Link key={item.name} href={item.href}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className="w-full justify-start gap-3 h-11 text-base"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span>{item.name}</span>
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile Menu Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="outline"
              className="w-full justify-center gap-2 h-11"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              {t("logout")}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`transition-all duration-300 ${
          sidebarOpen ? "lg:ml-64" : "lg:ml-20"
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
