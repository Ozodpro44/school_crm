import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import * as api from "@/lib/api";
import { Payment, Salary } from "@/lib/api";
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
import { EmptyState } from "@/components/EmptyState";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "@/lib/api";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { useBranch } from "@/context/BranchContext";

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [chartView, setChartView] = useState<"daily" | "monthly">("monthly");
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const { currentBranch, isLoading: branchLoading } = useBranch();

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

  // Cache raw transactions so toggling daily/monthly doesn't lose the data
  // (the previous implementation called generateChartData() with no args from
  // the chartView effect, which produced empty bars in daily mode).
  const rawDataRef = useRef<{ payments: Payment[]; salaries: Salary[]; expenses: any[] }>({
    payments: [],
    salaries: [],
    expenses: [],
  });

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
        // Silent refresh — keep previous values visible to avoid blinking.
        Promise.all([calculateStats(), generateChartData()]);
      }
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router, isMounted]);

  const performLoadData = async () => {
    if (!currentBranch?.id) return;
    // NOTE: We intentionally do NOT reset stats/chartData here on refetch.
    // The previous values stay visible while the next request is in flight,
    // which prevents the "UZS 0" / blank-card flash on focus/branch-change/storage events.
    await Promise.all([calculateStats(), generateChartData()]);
  };

  useEffect(() => {
    if (!isMounted || branchLoading) return;
    if (!currentBranch?.id) {
      setIsLoading(false);
      return;
    }

    // Initial load — show full skeleton.
    setIsLoading(true);
    performLoadData().finally(() => setIsLoading(false));

    // Background refetches: refresh data silently. Don't toggle isLoading,
    // so StatCards keep showing the previous numbers instead of blinking
    // back to skeleton placeholders.
    const refreshSilently = () => {
      performLoadData();
    };

    // Branch change is the one event that DOES warrant a fresh skeleton —
    // the previous numbers are no longer relevant.
    const handleBranchChange = () => {
      setIsLoading(true);
      performLoadData().finally(() => setIsLoading(false));
    };

    window.addEventListener("storage", refreshSilently);
    window.addEventListener("branchChange", handleBranchChange);
    window.addEventListener("focus", refreshSilently);

    return () => {
      window.removeEventListener("storage", refreshSilently);
      window.removeEventListener("branchChange", handleBranchChange);
      window.removeEventListener("focus", refreshSilently);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, branchLoading, currentBranch?.id]);

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
      // If caller passed fresh data, cache it. Otherwise fall back to the
      // cached data so the chartView toggle effect can re-aggregate.
      if (payments || salaries || expenses) {
        rawDataRef.current = {
          payments: payments ?? rawDataRef.current.payments,
          salaries: salaries ?? rawDataRef.current.salaries,
          expenses: expenses ?? rawDataRef.current.expenses,
        };
      }
      const paymentsData = rawDataRef.current.payments;
      const salariesData = rawDataRef.current.salaries;
      const expensesData = rawDataRef.current.expenses;

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
      const branchId = currentBranch?.id;
      if (!branchId) return;

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
        <h1 className="text-display text-brand-gradient">
          {t("dashboard")}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm md:text-base">
          {t("welcomeToSchoolManagement")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Counts are neutral; only the money tiles carry good/bad colour.
            Giving every tile its own hue made the row read as decoration
            rather than signal. */}
        <StatCard
          icon={Users}
          tone="slate"
          label={t("students")}
          value={stats.activeStudents}
          hint={`${stats.totalStudents} ${t("totalEnrolled")}`}
          loading={isLoading}
        />
        <StatCard
          icon={GraduationCap}
          tone="slate"
          label={t("teachers")}
          value={stats.totalTeachers}
          hint={t("activeTeachers")}
          loading={isLoading}
        />
        <StatCard
          icon={Wallet}
          tone="green"
          label={t("totalIncome")}
          value={formatCurrency(stats.totalIncome)}
          hint={t("ushbuOyUchun")}
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

      {/* Payment-method icons are neutral rather than green/blue/cyan: they
          label a channel, not a status, and three more hues here was a large
          part of the dashboard's rainbow. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <PaymentMethodBreakdown
          icon={DollarSign}
          iconColor="text-slate-400 dark:text-slate-500"
          title={t("cashPayments")}
          income={stats.cashIncome}
          expenses={stats.cashExpenses}
          profit={stats.cashProfit}
          labels={{ income: t("income"), expenses: t("expenses"), profit: t("profit") }}
          format={formatCurrency}
          loading={isLoading}
        />
        <PaymentMethodBreakdown
          icon={CreditCard}
          iconColor="text-slate-400 dark:text-slate-500"
          title={t("cardPayments")}
          income={stats.cardIncome}
          expenses={stats.cardExpenses}
          profit={stats.cardProfit}
          labels={{ income: t("income"), expenses: t("expenses"), profit: t("profit") }}
          format={formatCurrency}
          loading={isLoading}
        />
        <PaymentMethodBreakdown
          icon={Building2}
          iconColor="text-slate-400 dark:text-slate-500"
          title={t("bankPayments")}
          income={stats.bankIncome}
          expenses={stats.bankExpenses}
          profit={stats.bankProfit}
          labels={{ income: t("income"), expenses: t("expenses"), profit: t("profit") }}
          format={formatCurrency}
          loading={isLoading}
        />
      </div>

      {/* `items-start` stops the grid from stretching the two short cards to
          match the activity feed's height — they used to end with ~120px of
          dead space below a single number. Both pending tiles now share one
          card, so the row is two balanced columns instead of three ragged
          ones. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              {t("pendingPayments")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
              <div className="min-w-0">
                <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                  {t("studentDebtors")}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {t("pendingStudentPayments")}
                </p>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-10 shrink-0" />
              ) : (
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
                  {stats.debtorsCount}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="min-w-0">
                <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                  {t("pendingSalaries")}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {t("teacherSalaryPaymentsDue")}
                </p>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-10 shrink-0" />
              ) : (
                <div className="text-3xl font-bold text-slate-700 dark:text-slate-200 tabular-nums shrink-0">
                  {stats.unpaidSalariesCount}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent activity feed */}
        <SectionErrorBoundary label={t("recentActivity")}>
          <RecentActivityFeed
            entries={recentActivity}
            loading={isAuditLoading}
            title={t("recentActivity")}
            emptyLabel={t("noRecentActivity")}
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
              {t("collectionRate")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {stats.collectionRate.toFixed(1)}%
              </div>
            )}
            <Progress
              value={stats.collectionRate}
              className="mt-2 h-2"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("collectionRateDesc")}
            </p>
          </CardContent>
        </Card>

        {/* Student Churn */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
              <UserMinus className="w-4 h-4 text-red-500" />
              {t("studentChurn")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <div className="text-3xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                {stats.churnedStudents}
              </div>
            )}
            {/* Spacer matching the sibling cards' progress bar, so all three
                captions in this row sit on the same baseline. */}
            <div className="mt-2 h-2" aria-hidden="true" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("churnThisMonth")}
              {" · "}
              <span className="text-slate-400">
                {stats.prevChurnedStudents} {t("churnLastMonth")}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Salary Payout % */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
              <Award className="w-4 h-4 text-purple-500" />
              {t("salaryPayoutPct")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <div className="text-3xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {stats.salaryPayoutPct.toFixed(1)}%
              </div>
            )}
            <Progress
              value={stats.salaryPayoutPct}
              className="mt-2 h-2"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("salaryPayoutDesc")}
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
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              {t("topDebtors")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topDebtors.length === 0 ? (
              <EmptyState icon={TrendingDown} title={t("noDebtors")} compact />
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
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              {t("unpaidByClass")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.unpaidByClass.length === 0 ? (
              <EmptyState icon={Users} title={t("noUnpaidClasses")} compact />
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
                      {c.count} {t("debtors")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Neutral surface like every other card. The indigo/purple tint and
          indigo title colour singled this card out for no reason the content
          justified. */}
      <Card className="animate-fade-in">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>
            {chartView === "daily"
              ? t("dailyFourteenDays")
              : t("financialOverviewLastSixMonths")}
          </CardTitle>
          {/* Segmented control: the active view is the filled button, the
              other is outline. Previously both overrode the Button system
              with a hardcoded indigo. */}
          <div className="flex gap-2 shrink-0">
            <Button
              variant={chartView === "monthly" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartView("monthly")}
            >
              {t("monthly")}
            </Button>
            <Button
              variant={chartView === "daily" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartView("daily")}
            >
              {t("daily")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          <SectionErrorBoundary label={t("financialOverview")}>
            <FinancialChart data={chartData} />
          </SectionErrorBoundary>
        </CardContent>
      </Card>

      {/* The "quick stats summary" card that used to sit here repeated
          Total income / Total expenses / Net profit — all three already
          appear above, in the StatCard row and the per-method breakdown.
          Removed rather than restyled: it added a screenful of height and
          no new information. */}
    </div>
  );
}
