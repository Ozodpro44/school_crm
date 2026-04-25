import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import * as api from "@/lib/api";
import { Payment, Salary } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import {
  Users,
  GraduationCap,
  TrendingUp,
  AlertCircle,
  Wallet,
  CreditCard,
  Building2,
  DollarSign,
  TrendingDown,
  Award,
  UserMinus,
} from "lucide-react";
import { FinancialChart } from "@/components/FinancialChart";
import { StatCard } from "@/components/StatCard";
import { PaymentMethodBreakdown } from "@/components/PaymentMethodBreakdown";
import { RecentActivityFeed } from "@/components/RecentActivityFeed";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "@/lib/api";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [chartView, setChartView] = useState<"daily" | "monthly">("monthly");
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);

  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    totalTeachers: 0,
    totalIncome: 0,
    totalExpenses: 0,
    profit: 0,
    debtorsCount: 0,
    unpaidSalariesCount: 0,
    cashIncome: 0,
    cashExpenses: 0,
    cashProfit: 0,
    cardIncome: 0,
    cardExpenses: 0,
    cardProfit: 0,
    bankIncome: 0,
    bankExpenses: 0,
    bankProfit: 0,
    collectionRate: 0,
    churnedStudents: 0,
    prevChurnedStudents: 0,
    salaryPayoutPct: 0,
    unpaidByClass: [] as { classId: string; className: string; count: number }[],
    topDebtors: [] as { studentId: string; studentName: string; className: string; outstanding: number }[],
  });

  const [chartData, setChartData] = useState<
    Array<{ label: string; income: number; expenses: number }>
  >([]);

  // Recent activity (audit log) — last 5 entries
  const { data: auditLogData, isLoading: isAuditLoading } = useQuery({
    queryKey: ["dashboard-recent-activity"],
    queryFn: () => getAuditLogs({ page: 1, limit: 5 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const recentActivity = auditLogData?.data ?? [];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Refetch data when navigating to dashboard
  useEffect(() => {
    if (!router.isReady || !isMounted) return;

    const handleRouteChange = (url: string) => {
      if (url === "/" || url.startsWith("/?")) {
        setIsLoading(true);
        Promise.all([calculateStats(), generateChartData()]).then(() => {
          setIsLoading(false);
        });
      }
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router, isMounted]);

  const performLoadData = async () => {
    // Wait for selectedBranchId to be available in localStorage
    // This is needed after login when BranchContext is still loading
    let retries = 0;
    const maxRetries = 20; // 2 seconds max wait

    while (
      !localStorage.getItem("selectedBranchId") &&
      retries < maxRetries
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    if (!localStorage.getItem("selectedBranchId")) {
      console.warn("[Dashboard] No branch ID found after waiting");
      return;
    }

    // Clear old stats to show loading state immediately
    setStats({
      totalStudents: 0,
      activeStudents: 0,
      totalTeachers: 0,
      totalIncome: 0,
      totalExpenses: 0,
      profit: 0,
      debtorsCount: 0,
      unpaidSalariesCount: 0,
      cashIncome: 0,
      cashExpenses: 0,
      cashProfit: 0,
      cardIncome: 0,
      cardExpenses: 0,
      cardProfit: 0,
      bankIncome: 0,
      bankExpenses: 0,
      bankProfit: 0,
      collectionRate: 0,
      churnedStudents: 0,
      prevChurnedStudents: 0,
      salaryPayoutPct: 0,
      unpaidByClass: [],
      topDebtors: [],
    });
    setChartData([]);

    await Promise.all([calculateStats(), generateChartData()]);
  };

  useEffect(() => {
    if (!isMounted) return;

    setIsLoading(true);
    performLoadData().finally(() => setIsLoading(false));

    // Listen for storage changes (when data is updated in other components)
    const handleStorageChange = () => {
      setIsLoading(true);
      performLoadData().finally(() => setIsLoading(false));
    };

    window.addEventListener("storage", handleStorageChange);

    // Listen for branch change events
    const handleBranchChange = () => {
      setIsLoading(true);
      performLoadData().finally(() => setIsLoading(false));
    };

    window.addEventListener("branchChange", handleBranchChange);

    // Refresh when page regains focus
    const handleFocus = () => {
      setIsLoading(true);
      performLoadData().finally(() => setIsLoading(false));
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("branchChange", handleBranchChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isMounted]);

  useEffect(() => {
    generateChartData();
  }, [chartView]);

  const getShortMonthName = (monthName: string) => {
    const shortNames: { [key: string]: string } = {
      January: "Jan",
      February: "Feb",
      March: "Mar",
      April: "Apr",
      May: "May",
      June: "Jun",
      July: "Jul",
      August: "Aug",
      September: "Sep",
      October: "Oct",
      November: "Nov",
      December: "Dec",
    };
    return t(shortNames[monthName] || monthName) || monthName;
  };

  const generateChartData = async (
    payments?: Payment[],
    salaries?: Salary[],
    expenses?: any[],
  ) => {
    try {
      // Use provided data (from getDashboardData) - don't fetch independently
      const paymentsData = payments || [];
      const salariesData = salaries || [];
      const expensesData = expenses || [];

      if (chartView === "daily") {
        // Daily view: show last 14 days
        const dailyData = [];
        const today = new Date();
        for (let i = 13; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split("T")[0];

          const dayPayments = paymentsData.filter(
            (p: Payment) =>
              p.paidDate &&
              p.paidDate.split("T")[0] === dateStr &&
              p.status === "paid",
          );
          const daySalaries = salariesData.filter(
            (s: Salary) =>
              s.paidDate &&
              s.paidDate.split("T")[0] === dateStr &&
              s.status === "paid",
          );
          const dayExpenses = expensesData.filter(
            (e: any) => e.date && e.date.split("T")[0] === dateStr,
          );

          dailyData.push({
            label: date.toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
            }),
            income: dayPayments.reduce((sum, p) => sum + p.amount, 0),
            expenses:
              daySalaries.reduce((sum, s) => sum + s.amount, 0) +
              dayExpenses.reduce((sum, e) => sum + e.amount, 0),
          });
        }
        setChartData(dailyData);
      } else {
        // Monthly view: show last 6 months
        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11

        // Calculate last 6 months
        const monthlyData = [];
        for (let i = 5; i >= 0; i--) {
          const date = new Date(currentYear, currentMonth - i, 1);
          const monthIndex = date.getMonth();
          const monthYear = date.getFullYear();
          const monthStr = (months[monthIndex] ?? "").substring(0, 3);
          const monthNum = monthIndex + 1; // 1-12

          const monthPayments = paymentsData.filter(
            (p: Payment) =>
              p.year === monthYear &&
              parseInt(p.month) === monthNum &&
              p.status === "paid",
          );
          const monthSalaries = salariesData.filter(
            (s: Salary) =>
              s.year === monthYear &&
              parseInt(s.month) === monthNum &&
              s.status === "paid",
          );
          const monthExpenses = expensesData.filter((e: any) => {
            const expenseDate = new Date(e.date);
            return (
              expenseDate.getFullYear() === monthYear &&
              expenseDate.getMonth() === monthIndex
            );
          });

          monthlyData.push({
            label: t(months[monthIndex] ?? "") || (months[monthIndex] ?? ""),
            income: monthPayments.reduce((sum, p) => sum + p.amount, 0),
            expenses:
              monthSalaries.reduce((sum, s) => sum + s.amount, 0) +
              monthExpenses.reduce((sum, e) => sum + e.amount, 0),
          });
        }

        setChartData(monthlyData);
      }
    } catch (error) {
      console.error("[Dashboard.generateChartData] Error:", error);
    }
  };

  const calculateStats = async () => {
    try {
      const branchId = localStorage.getItem("selectedBranchId");
      if (!branchId) {
        console.warn("[Dashboard] No branch ID found");
        return;
      }

      // Fetch branch data to get current financial month
      const branch = await api.getBranch(branchId);
      const branchMonth =
        branch?.currentFinancialMonth?.month || new Date().getMonth() + 1;
      const branchYear =
        branch?.currentFinancialMonth?.year || new Date().getFullYear();

      // Fetch all dashboard data in a single API call
      const dashboardData = await api.getDashboardData(branchId, branchMonth, branchYear);

      // Generate chart with the data
      generateChartData(
        dashboardData.payments,
        dashboardData.salaries,
        dashboardData.expenses,
      );

      setStats({
        totalStudents: dashboardData.totalStudents,
        activeStudents: dashboardData.activeStudents,
        totalTeachers: dashboardData.totalTeachers,
        totalIncome: dashboardData.totalIncome,
        totalExpenses: dashboardData.totalExpenses,
        profit: dashboardData.profit,
        debtorsCount: dashboardData.debtorsCount,
        unpaidSalariesCount: dashboardData.unpaidSalariesCount,
        cashIncome: dashboardData.cashIncome,
        cashExpenses: dashboardData.cashExpenses,
        cashProfit: dashboardData.cashProfit,
        cardIncome: dashboardData.cardIncome,
        cardExpenses: dashboardData.cardExpenses,
        cardProfit: dashboardData.cardProfit,
        bankIncome: dashboardData.bankIncome,
        bankExpenses: dashboardData.bankExpenses,
        bankProfit: dashboardData.bankProfit,
        collectionRate: dashboardData.collectionRate ?? 0,
        churnedStudents: dashboardData.churnedStudents ?? 0,
        prevChurnedStudents: dashboardData.prevChurnedStudents ?? 0,
        salaryPayoutPct: dashboardData.salaryPayoutPct ?? 0,
        unpaidByClass: dashboardData.unpaidByClass ?? [],
        topDebtors: dashboardData.topDebtors ?? [],
      });
    } catch (error) {
      console.error("[Dashboard.calculateStats] Error:", error);
    }
  };

  // Block render only until the component mounts (avoids SSR/CSR mismatch).
  // The actual data loading state is now passed down via `loading` props on
  // each widget (StatCard, RecentActivityFeed) so the layout doesn't shift.
  if (!isMounted) {
    return (
      <div className="space-y-6 md:space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-3 w-24 mb-3" />
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="animate-fade-in">
        <h1 className="text-3xl md:text-4xl font-bold text-brand-gradient">
          {t("dashboard")}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm md:text-base">
          {t("welcomeToSchoolManagement")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          icon={Users}
          tone="indigo"
          label={t("students")}
          value={stats.activeStudents}
          hint={`${stats.totalStudents} ${t("totalEnrolled")}`}
          loading={isLoading}
        />
        <StatCard
          icon={GraduationCap}
          tone="purple"
          label={t("teachers")}
          value={stats.totalTeachers}
          hint={t("activeTeachers") || "Faol o'qituvchilar"}
          loading={isLoading}
        />
        <StatCard
          icon={Wallet}
          tone="green"
          label={t("totalIncome")}
          value={formatCurrency(stats.totalIncome)}
          hint={t("ushbuOyUchun") || "Ushbu oy uchun"}
          loading={isLoading}
        />
        <StatCard
          icon={TrendingUp}
          tone={stats.profit >= 0 ? "green" : "red"}
          label={t("netProfit")}
          value={formatCurrency(stats.profit)}
          hint={t("incomeMinusExpenses")}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <PaymentMethodBreakdown
          icon={DollarSign}
          iconColor="text-green-500"
          title={t("cashPayments")}
          income={stats.cashIncome}
          expenses={stats.cashExpenses}
          profit={stats.cashProfit}
          labels={{ income: t("income"), expenses: t("expenses"), profit: t("profit") }}
          format={formatCurrency}
        />
        <PaymentMethodBreakdown
          icon={CreditCard}
          iconColor="text-blue-500"
          title={t("cardPayments")}
          income={stats.cardIncome}
          expenses={stats.cardExpenses}
          profit={stats.cardProfit}
          labels={{ income: t("income"), expenses: t("expenses"), profit: t("profit") }}
          format={formatCurrency}
        />
        <PaymentMethodBreakdown
          icon={Building2}
          iconColor="text-cyan-500"
          title={t("bankPayments")}
          income={stats.bankIncome}
          expenses={stats.bankExpenses}
          profit={stats.bankProfit}
          labels={{ income: t("income"), expenses: t("expenses"), profit: t("profit") }}
          format={formatCurrency}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Pending payments */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              {t("pendingPayments")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
              <div>
                <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                  {t("studentDebtors")}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {t("pendingStudentPayments")}
                </p>
              </div>
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {stats.debtorsCount}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending salaries */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
              <Wallet className="w-4 h-4 text-blue-500" />
              {t("pendingExpenses")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <div>
                <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                  {t("pendingSalaries")}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {t("teacherSalaryPaymentsDue")}
                </p>
              </div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {stats.unpaidSalariesCount}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent activity feed */}
        <SectionErrorBoundary label={t("recentActivity") || "Recent activity"}>
          <RecentActivityFeed
            entries={recentActivity}
            loading={isAuditLoading}
            title={t("recentActivity") || "Recent activity"}
            emptyLabel={t("noRecentActivity") || "No recent activity yet"}
            limit={5}
          />
        </SectionErrorBoundary>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 animate-fade-in"
        style={{ animationDelay: "0.65s" }}
      >
        {/* Collection Rate */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              {t("collectionRate") || "Collection Rate"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.collectionRate.toFixed(1)}%
            </div>
            <Progress
              value={stats.collectionRate}
              className="mt-2 h-2"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("collectionRateDesc") || "Paid / Expected"}
            </p>
          </CardContent>
        </Card>

        {/* Student Churn */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
              <UserMinus className="w-4 h-4 text-red-500" />
              {t("studentChurn") || "Students Left"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {stats.churnedStudents}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("churnThisMonth") || "This month"}
              {" · "}
              <span className="text-slate-400">
                {stats.prevChurnedStudents} {t("churnLastMonth") || "last month"}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Salary Payout % */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
              <Award className="w-4 h-4 text-purple-500" />
              {t("salaryPayoutPct") || "Salary Payout"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {stats.salaryPayoutPct.toFixed(1)}%
            </div>
            <Progress
              value={stats.salaryPayoutPct}
              className="mt-2 h-2"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("salaryPayoutDesc") || "Paid / Total salaries"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Debtors Detail Row ───────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 animate-fade-in"
        style={{ animationDelay: "0.68s" }}
      >
        {/* Top Debtors */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <TrendingDown className="w-5 h-5 text-red-500" />
              {t("topDebtors") || "Top Debtors"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topDebtors.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                —
              </p>
            ) : (
              <div className="space-y-2">
                {stats.topDebtors.map((d) => (
                  <div
                    key={d.studentId}
                    className="flex items-center justify-between py-1.5 border-b last:border-0 border-slate-100 dark:border-slate-800"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {d.studentName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {d.className}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(d.outstanding)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unpaid by Class */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Users className="w-5 h-5 text-orange-500" />
              {t("unpaidByClass") || "Debtors by Class"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.unpaidByClass.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                —
              </p>
            ) : (
              <div className="space-y-2">
                {stats.unpaidByClass.map((c) => (
                  <div
                    key={c.classId}
                    className="flex items-center justify-between py-1.5 border-b last:border-0 border-slate-100 dark:border-slate-800"
                  >
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {c.className}
                    </p>
                    <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      {c.count} {t("debtors") || "debtors"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card
        className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-200 dark:border-indigo-800 animate-fade-in"
        style={{ animationDelay: "0.70s" }}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-indigo-900 dark:text-indigo-100 text-base md:text-lg">
            {chartView === "daily"
              ? t("dailyFourteenDays")
              : t("financialOverviewLastSixMonths")}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={chartView === "monthly" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartView("monthly")}
              className={
                chartView === "monthly"
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : ""
              }
            >
              {t("monthly")}
            </Button>
            <Button
              variant={chartView === "daily" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartView("daily")}
              className={
                chartView === "daily" ? "bg-indigo-600 hover:bg-indigo-700" : ""
              }
            >
              {t("daily")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          <SectionErrorBoundary label={t("financialOverview") || "Chart"}>
            <FinancialChart data={chartData} />
          </SectionErrorBoundary>
        </CardContent>
      </Card>

      <Card
        className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-200 dark:border-indigo-800 animate-fade-in"
        style={{ animationDelay: "0.7s" }}
      >
        <CardHeader>
          <CardTitle className="text-indigo-900 dark:text-indigo-100 text-base md:text-lg">
            {t("quickStatsSummary")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <div className="p-3 md:p-4 bg-white/60 dark:bg-slate-900/60 rounded-lg backdrop-blur">
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                {t("totalIncome")}
              </p>
              <p className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(stats.totalIncome)}
              </p>
            </div>
            <div className="p-3 md:p-4 bg-white/60 dark:bg-slate-900/60 rounded-lg backdrop-blur">
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                {t("totalExpenses")}
              </p>
              <p className="text-xl md:text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(stats.totalExpenses)}
              </p>
            </div>
            <div className="p-3 md:p-4 bg-white/60 dark:bg-slate-900/60 rounded-lg backdrop-blur">
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                {t("netProfit")}
              </p>
              <p
                className={`text-xl md:text-2xl font-bold ${
                  stats.profit >= 0
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatCurrency(stats.profit)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
