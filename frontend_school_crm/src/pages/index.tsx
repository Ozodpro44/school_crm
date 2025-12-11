import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import { Payment, Salary } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import {
  Users,
  GraduationCap,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Wallet,
} from "lucide-react";
import { FinancialChart } from "@/components/FinancialChart";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";

export default function HomePage() {
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
   });

   const [chartData, setChartData] = useState<Array<{ label: string; income: number; expenses: number }>>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
     if (!isMounted) return;
     
     setIsLoading(true);
     
     const loadData = async () => {
       await Promise.all([calculateStats(), generateChartData()]);
       setIsLoading(false);
     };
     
     loadData();
     
     // Refresh stats every 5 seconds to reflect changes
     const refreshInterval = setInterval(() => {
       calculateStats();
       generateChartData();
     }, 5000);

    // Listen for storage changes (when data is updated in other components)
    const handleStorageChange = () => {
      loadData();
    };
    
    window.addEventListener("storage", handleStorageChange);

    // Refresh when page regains focus
    const handleFocus = () => {
      loadData();
    };
    
    window.addEventListener("focus", handleFocus);
    
    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleFocus);
    };
    }, [isMounted]);

  useEffect(() => {
    generateChartData();
  }, [chartView]);

  const getShortMonthName = (monthName: string) => {
    const shortNames: { [key: string]: string } = {
      "January": "Jan",
      "February": "Feb",
      "March": "Mar",
      "April": "Apr",
      "May": "May",
      "June": "Jun",
      "July": "Jul",
      "August": "Aug",
      "September": "Sep",
      "October": "Oct",
      "November": "Nov",
      "December": "Dec",
    };
    return t(shortNames[monthName] || monthName) || monthName;
  };

  const generateChartData = async () => {
    try {
      const user = getCurrentUser();
      if (!user?.branchId) return;

      const payments = await api.listPayments({ branchId: user.branchId });
      const salaries = await api.listSalaries(user.branchId);
    
    if (chartView === "daily") {
      // Daily view: show last 14 days
      const dailyData = [];
      const today = new Date();
      for (let i = 13; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayPayments = payments.filter(
          (p: Payment) => p.paidDate && p.paidDate.split('T')[0] === dateStr && p.status === "paid"
        );
        const daySalaries = salaries.filter(
          (s: Salary) => s.paidDate && s.paidDate.split('T')[0] === dateStr && s.status === "paid"
        );
        
        dailyData.push({
          label: date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
          income: dayPayments.reduce((sum, p) => sum + p.amount, 0),
          expenses: daySalaries.reduce((sum, s) => sum + s.amount, 0),
        });
      }
      setChartData(dailyData);
    } else {
      // Monthly view: show last 6 months
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const currentYear = new Date().getFullYear();
      
      const monthlyData = months.map((month, index) => {
        const monthPayments = payments.filter(
          (p: Payment) => p.year === currentYear && months.indexOf(p.month.substring(0, 3)) === index && p.status === "paid"
        );
        const monthSalaries = salaries.filter(
          (s: Salary) => s.year === currentYear && months.indexOf(s.month.substring(0, 3)) === index && s.status === "paid"
        );
        
        return {
          label: t(month) || month,
          income: monthPayments.reduce((sum, p) => sum + p.amount, 0),
          expenses: monthSalaries.reduce((sum, s) => sum + s.amount, 0),
        };
      });
      
      setChartData(monthlyData.slice(0, 6));
      }
      } catch (error) {
      console.error("Error loading chart data:", error);
      }
      };

  const calculateStats = async () => {
    try {
      const user = getCurrentUser();
      if (!user?.branchId) return;

      const students = await api.listStudents(user.branchId);
      const teachers = await api.listTeachers(user.branchId);
      const payments = await api.listPayments({ branchId: user.branchId });
      const salaries = await api.listSalaries(user.branchId);

      const activeStudents = students.filter((s) => s.status === "active");
    
    const totalIncome = payments
      .filter((p: Payment) => p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);

    const totalExpenses = salaries
      .filter((s: Salary) => s.status === "paid")
      .reduce((sum, s) => sum + s.amount, 0);

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const debtors = activeStudents.filter((s) => {
      const studentPayments = payments.filter((p: Payment) => 
        p.studentId === s.id && 
        Number(p.month) === currentMonth && 
        Number(p.year) === currentYear
      );
      // Student is debtor if no payment exists OR payment is unpaid
      const hasNoPaidPayment = studentPayments.length === 0 || !studentPayments.some((p) => p.status === "paid");
      return hasNoPaidPayment;
    });

    const unpaidSalaries = teachers.filter((teacher) => {
      const teacherSalaries = salaries.filter((s: Salary) => 
        s.teacherId === teacher.id && 
        Number(s.month) === currentMonth && 
        Number(s.year) === currentYear
      );
      // Salary is unpaid if no record exists OR status is unpaid
      const hasNoPaidSalary = teacherSalaries.length === 0 || !teacherSalaries.some((s) => s.status === "paid");
      return hasNoPaidSalary;
    }).length;

    setStats({
      totalStudents: students.length,
      activeStudents: activeStudents.length,
      totalTeachers: teachers.length,
      totalIncome,
      totalExpenses,
      profit: totalIncome - totalExpenses,
      debtorsCount: debtors.length,
      unpaidSalariesCount: unpaidSalaries,
      });
      } catch (error) {
      console.error("Error loading stats:", error);
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
          <Card className="border-l-4 border-l-indigo-500 hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: "0.1s" }}>
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

          <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: "0.2s" }}>
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

          <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
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

          <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-all duration-300 animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                {t("netProfit")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl md:text-3xl font-bold ${stats.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {formatCurrency(stats.profit)}
              </div>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t("incomeMinusExpenses")}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 animate-fade-in" style={{ animationDelay: "0.5s" }}>
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
                      {t("studentsWithUnpaidFees")}
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
                      {t("unpaidSalaries")}
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

        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-200 dark:border-indigo-800 animate-fade-in" style={{ animationDelay: "0.6s" }}>
           <CardHeader className="flex flex-row items-center justify-between">
             <CardTitle className="text-indigo-900 dark:text-indigo-100 text-base md:text-lg">
               {chartView === "daily" ? t("dailyFourteenDays") : t("financialOverviewLastSixMonths")}
             </CardTitle>
             <div className="flex gap-2">
               <Button
                 variant={chartView === "monthly" ? "default" : "outline"}
                 size="sm"
                 onClick={() => setChartView("monthly")}
                 className={chartView === "monthly" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
               >
                 {t("monthly")}
               </Button>
               <Button
                 variant={chartView === "daily" ? "default" : "outline"}
                 size="sm"
                 onClick={() => setChartView("daily")}
                 className={chartView === "daily" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
               >
                 {t("daily")}
               </Button>
             </div>
           </CardHeader>
          <CardContent className="px-2 md:px-6">
            <FinancialChart data={chartData} />
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-200 dark:border-indigo-800 animate-fade-in" style={{ animationDelay: "0.7s" }}>
          <CardHeader>
            <CardTitle className="text-indigo-900 dark:text-indigo-100 text-base md:text-lg">
              {t("quickStatsSummary")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <div className="p-3 md:p-4 bg-white/60 dark:bg-slate-900/60 rounded-lg backdrop-blur">
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">{t("totalIncome")}</p>
                <p className="text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(stats.totalIncome)}
                </p>
              </div>
              <div className="p-3 md:p-4 bg-white/60 dark:bg-slate-900/60 rounded-lg backdrop-blur">
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">{t("totalExpenses")}</p>
                <p className="text-xl md:text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(stats.totalExpenses)}
                </p>
              </div>
              <div className="p-3 md:p-4 bg-white/60 dark:bg-slate-900/60 rounded-lg backdrop-blur">
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">{t("netProfit")}</p>
                <p className={`text-xl md:text-2xl font-bold ${stats.profit >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(stats.profit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    
  );
}
