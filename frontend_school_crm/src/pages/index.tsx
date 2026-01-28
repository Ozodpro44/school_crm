import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { FinancialChart } from "@/components/FinancialChart";
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
  });

  const [chartData, setChartData] = useState<
    Array<{ label: string; income: number; expenses: number }>
  >([]);

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
      let paymentsData = payments || [];
      let salariesData = salaries || [];
      let expensesData = expenses || [];

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
          const monthStr = months[monthIndex].substring(0, 3);
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
            label: t(months[monthIndex]) || months[monthIndex],
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
      });
    } catch (error) {
      console.error("[Dashboard.calculateStats] Error:", error);
    }
  };

  if (isLoading || !isMounted) {
    return (
      <div className="space-y-6 md:space-y-8">
        {/* Header Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>

        {/* Summary Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="animate-fade-in">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          {t("dashboard")}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm md:text-base">
          {t("welcomeToSchoolManagement")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card
          className="border-l-4 border-l-indigo-500 hover:shadow-lg transition-all duration-300 animate-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t("students")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              {stats.activeStudents}
            </div>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {stats.totalStudents} {t("totalEnrolled")}
            </p>
          </CardContent>
        </Card>

        <Card
          className="border-l-4 border-l-purple-500 hover:shadow-lg transition-all duration-300 animate-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              {t("teachers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              {stats.totalTeachers}
            </div>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("activeFacultyMembers")}
            </p>
          </CardContent>
        </Card>

        <Card
          className="border-l-4 border-l-green-500 hover:shadow-lg transition-all duration-300 animate-slide-up"
          style={{ animationDelay: "0.3s" }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              {t("totalIncome")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(stats.totalIncome)}
            </div>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("fromStudentPayments")}
            </p>
          </CardContent>
        </Card>

        <Card
          className="border-l-4 border-l-blue-500 hover:shadow-lg transition-all duration-300 animate-slide-up"
          style={{ animationDelay: "0.4s" }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {t("netProfit")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl md:text-3xl font-bold ${
                stats.profit >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(stats.profit)}
            </div>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("incomeMinusExpenses")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div
       className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-fade-in"
       style={{ animationDelay: "0.5s" }}
      >
       <Card className="hover:shadow-lg transition-shadow">
         <CardHeader>
           <CardTitle className="flex items-center gap-2 text-base md:text-lg">
             <DollarSign className="w-5 h-5 text-green-500" />
             {t("cashPayments")}
           </CardTitle>
         </CardHeader>
         <CardContent>
           <div className="space-y-2">
             <div className="flex items-center justify-between">
               <p className="text-sm text-slate-600 dark:text-slate-400">{t("income")}</p>
               <div className="text-lg font-bold text-green-600 dark:text-green-400">
                 {formatCurrency(stats.cashIncome)}
               </div>
             </div>
             <div className="flex items-center justify-between">
               <p className="text-sm text-slate-600 dark:text-slate-400">{t("expenses")}</p>
               <div className="text-lg font-bold text-red-600 dark:text-red-400">
                 {formatCurrency(stats.cashExpenses)}
               </div>
             </div>
             <div className="border-t pt-2 flex items-center justify-between">
               <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("profit")}</p>
               <div
                 className={`text-lg font-bold ${
                   stats.cashProfit >= 0
                     ? "text-green-600 dark:text-green-400"
                     : "text-red-600 dark:text-red-400"
                 }`}
               >
                 {formatCurrency(stats.cashProfit)}
               </div>
             </div>
           </div>
         </CardContent>
       </Card>

       <Card className="hover:shadow-lg transition-shadow">
         <CardHeader>
           <CardTitle className="flex items-center gap-2 text-base md:text-lg">
             <CreditCard className="w-5 h-5 text-blue-500" />
             {t("cardPayments")}
           </CardTitle>
         </CardHeader>
         <CardContent>
           <div className="space-y-2">
             <div className="flex items-center justify-between">
               <p className="text-sm text-slate-600 dark:text-slate-400">{t("income")}</p>
               <div className="text-lg font-bold text-green-600 dark:text-green-400">
                 {formatCurrency(stats.cardIncome)}
               </div>
             </div>
             <div className="flex items-center justify-between">
               <p className="text-sm text-slate-600 dark:text-slate-400">{t("expenses")}</p>
               <div className="text-lg font-bold text-red-600 dark:text-red-400">
                 {formatCurrency(stats.cardExpenses)}
               </div>
             </div>
             <div className="border-t pt-2 flex items-center justify-between">
               <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("profit")}</p>
               <div
                 className={`text-lg font-bold ${
                   stats.cardProfit >= 0
                     ? "text-green-600 dark:text-green-400"
                     : "text-red-600 dark:text-red-400"
                 }`}
               >
                 {formatCurrency(stats.cardProfit)}
               </div>
             </div>
           </div>
         </CardContent>
       </Card>

       <Card className="hover:shadow-lg transition-shadow">
         <CardHeader>
           <CardTitle className="flex items-center gap-2 text-base md:text-lg">
             <Building2 className="w-5 h-5 text-cyan-500" />
             {t("bankPayments")}
           </CardTitle>
         </CardHeader>
         <CardContent>
           <div className="space-y-2">
             <div className="flex items-center justify-between">
               <p className="text-sm text-slate-600 dark:text-slate-400">{t("income")}</p>
               <div className="text-lg font-bold text-green-600 dark:text-green-400">
                 {formatCurrency(stats.bankIncome)}
               </div>
             </div>
             <div className="flex items-center justify-between">
               <p className="text-sm text-slate-600 dark:text-slate-400">{t("expenses")}</p>
               <div className="text-lg font-bold text-red-600 dark:text-red-400">
                 {formatCurrency(stats.bankExpenses)}
               </div>
             </div>
             <div className="border-t pt-2 flex items-center justify-between">
               <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("profit")}</p>
               <div
                 className={`text-lg font-bold ${
                   stats.bankProfit >= 0
                     ? "text-green-600 dark:text-green-400"
                     : "text-red-600 dark:text-red-400"
                 }`}
               >
                 {formatCurrency(stats.bankProfit)}
               </div>
             </div>
           </div>
         </CardContent>
       </Card>
      </div>

      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 animate-fade-in"
        style={{ animationDelay: "0.60s" }}
      >
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              {t("pendingPayments")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 md:p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                <div>
                  <p className="font-medium text-sm md:text-base text-slate-900 dark:text-slate-100">
                    {t("studentDebtors")}
                  </p>
                  <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                    {t("pendingStudentPayments")}
                  </p>
                </div>
                <div className="text-2xl md:text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {stats.debtorsCount}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Wallet className="w-5 h-5 text-blue-500" />
              {t("pendingExpenses")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 md:p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div>
                  <p className="font-medium text-sm md:text-base text-slate-900 dark:text-slate-100">
                    {t("pendingSalaries")}
                  </p>
                  <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                    {t("teacherSalaryPaymentsDue")}
                  </p>
                </div>
                <div className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.unpaidSalariesCount}
                </div>
              </div>
            </div>
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
          <FinancialChart data={chartData} />
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
