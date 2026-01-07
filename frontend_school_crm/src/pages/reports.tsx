import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  studentsDB,
  paymentsDB,
  salariesDB,
  teachersDB,
  classesDB,
  monthArchivesDB,
  usersDB,
} from "@/lib/storage";
import * as api from "@/lib/api";
import {
  getPaymentReport,
  getSalaryReport,
  getDebtorsReport,
  getExpensesReport,
  getFinancialSummary,
  getBranch,
  listClasses,
} from "@/lib/api";
import { Payment, Salary, Branch } from "@/types";
import { Download, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type ReportType = "payment" | "salary" | "debtors" | "income" | "expenses";

export default function ReportsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [reportType, setReportType] = useState<ReportType>("payment");
  const [classId, setClassId] = useState("all");
  const [paymentMonth, setPaymentMonth] = useState("");
  const [paymentYear, setPaymentYear] = useState("");
  const [debtorMonth, setDebtorMonth] = useState("");
  const [debtorYear, setDebtorYear] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total: 0, count: 0, avg: 0 });
  const [branchData, setBranchData] = useState<Branch | null>(null);
  const language = useLanguage();
  const t = (key: string) => getTranslation(key, language);
  const canViewReports = hasPermission("canViewReports");
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (!canViewReports) {
      router.push("/");
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      loadClasses();
      loadStudents();
      loadUsers();
      await loadBranch();
      setDefaultDates();
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [canViewReports, router]);

  // Apply default dates when branch data loads
  useEffect(() => {
    if (branchData && !debtorMonth) {
      console.log("Setting default dates with branchData:", branchData);
      setDefaultDates();
    }
  }, [branchData]);

  useEffect(() => {
    generateReport();
  }, [reportType, paymentMonth, paymentYear, classId, debtorMonth, debtorYear]);

  const setDefaultDates = () => {
    // Use branch's current financial month if available, fallback to current date
    const currentMonth =
      branchData?.currentFinancialMonth?.month?.toString().padStart(2, "0") ||
      (new Date().getMonth() + 1).toString().padStart(2, "0");
    const currentYear =
      branchData?.currentFinancialMonth?.year || new Date().getFullYear();

    setPaymentMonth(currentMonth);
    setPaymentYear(currentYear.toString());
    setDebtorMonth(currentMonth);
    setDebtorYear(currentYear.toString());
  };

  const loadBranch = async () => {
    try {
      const branchId = localStorage.getItem("selectedBranchId");
      if (branchId) {
        const branch = await getBranch(branchId);
        setBranchData(branch);
      }
    } catch (error) {
      console.error("Failed to load branch data:", error);
    }
  };

  const loadClasses = async () => {
    try {
      const branchId = localStorage.getItem("selectedBranchId");
      if (branchId) {
        const classesData = await listClasses(branchId);
        setClasses(classesData);
      }
    } catch (error) {
      console.error("Failed to load classes:", error);
      // Fallback to localStorage
      setClasses(classesDB.getAll());
    }
  };

  const loadStudents = () => {
    setStudents(studentsDB.getAll());
  };

  const loadUsers = () => {
    setUsers(usersDB.getAll());
  };

  const getUserName = (userId: string) => {
    if (!userId) return "N/A";
    const user = users.find((u) => u.id === userId);
    return user?.fullName || userId;
  };

  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "branch_admin";

  const isMonthVisible = (
    month: string | number,
    year: string | number
  ): boolean => {
    // Admins can see all data including archived
    if (isAdmin) return true;

    // Non-admins can't see archived months
    const monthStr = month.toString().padStart(2, "0");
    const yearNum = parseInt(year.toString());
    return !monthArchivesDB.isMonthArchived(monthStr, yearNum);
  };

  const getStatusLabel = (status: string) => {
    const statusMap: { [key: string]: string } = {
      paid: "paid",
      unpaid: "unpaid",
      partial: "partial",
      approved: "approved",
      pending: "pending",
    };
    return t(statusMap[status] || status) || status;
  };

  const generateReport = async () => {
    switch (reportType) {
      case "payment":
        if (!paymentMonth || !paymentYear) {
          setReportData([]);
          return;
        }
        await generatePaymentReport();
        break;
      case "salary":
        if (!paymentMonth || !paymentYear) {
          setReportData([]);
          return;
        }
        await generateSalaryReport();
        break;
      case "debtors":
        if (!debtorMonth || !debtorYear) {
          setReportData([]);
          return;
        }
        generateDebtorsReport();
        break;
      case "income":
        if (!paymentMonth || !paymentYear) {
          setReportData([]);
          return;
        }
        await generateIncomeReport();
        break;
      case "expenses":
        if (!paymentMonth || !paymentYear) {
          setReportData([]);
          return;
        }
        await generateExpensesReport();
        break;
    }
  };

  const generatePaymentReport = async () => {
    try {
      const branchId = localStorage.getItem("selectedBranchId");
      if (!branchId) {
        toast({
          title: t("error"),
          description: "No branch selected",
          variant: "destructive",
        });
        return;
      }

      const items = await getPaymentReport(
        branchId,
        paymentMonth,
        paymentYear,
        classId
      );

      const data = items.map((item) => ({
        id: item.id,
        studentName: item.studentName,
        className: item.className,
        amount: item.amount,
        month: item.month,
        year: item.year,
        status: item.status,
        paidDate: item.paidDate
          ? new Date(item.paidDate).toLocaleString("uz-UZ", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "N/A",
        addedBy: getUserName(item.createdBy || ""),
      }));

      const total = data.reduce((sum, item) => sum + item.amount, 0);
      setSummary({
        total,
        count: data.length,
        avg: data.length > 0 ? total / data.length : 0,
      });

      setReportData(data);
    } catch (error) {
      console.error("Failed to generate payment report:", error);
      toast({
        title: t("error"),
        description: "Failed to generate payment report",
        variant: "destructive",
      });
      setReportData([]);
    }
  };

  const generateSalaryReport = async () => {
    try {
      const branchId = localStorage.getItem("selectedBranchId");
      if (!branchId) {
        toast({
          title: t("error"),
          description: "No branch selected",
          variant: "destructive",
        });
        return;
      }

      // Convert month/year to dates
      const startYear = parseInt(paymentYear) || new Date().getFullYear();
      const startDateObj = new Date(startYear, parseInt(paymentMonth) - 1, 1);
      const endDateObj = new Date(startYear, parseInt(paymentMonth), 0);

      const newStartDate = startDateObj.toISOString().split("T")[0];
      const newEndDate = endDateObj.toISOString().split("T")[0];

      const items = await getSalaryReport(
        branchId,
        newStartDate,
        newEndDate,
        ""
      );

      const data = items.map((item) => ({
        id: item.id,
        teacherName: item.teacherName,
        amount: item.amount,
        month: item.month,
        year: item.year,
        status: item.status,
        paidDate: item.paidDate
          ? new Date(item.paidDate).toLocaleString("uz-UZ", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "N/A",
        addedBy: getUserName(item.createdBy || ""),
      }));

      const total = data.reduce((sum, item) => sum + item.amount, 0);
      setSummary({
        total,
        count: data.length,
        avg: data.length > 0 ? total / data.length : 0,
      });

      setReportData(data);
    } catch (error) {
      console.error("Failed to generate salary report:", error);
      toast({
        title: t("error"),
        description: "Failed to generate salary report",
        variant: "destructive",
      });
      setReportData([]);
    }
  };

  const generateDebtorsReport = async () => {
    try {
      const branchId = localStorage.getItem("selectedBranchId");
      if (!branchId) {
        toast({
          title: t("error"),
          description: "No branch selected",
          variant: "destructive",
        });
        return;
      }

      if (!debtorMonth || !debtorYear) {
        setReportData([]);
        return;
      }

      const yearNum = parseInt(debtorYear, 10);

      console.log("Debtors Report Query Params:", {
        branchId,
        debtorMonth,
        debtorYear,
        yearNum,
      });

      const items = await getDebtorsReport(
        branchId,
        debtorMonth,
        yearNum,
        classId === "all" ? undefined : classId
      );

      console.log("Debtors Report Response:", items);

      const data = items.map((item) => ({
        id: item.id,
        studentName: item.studentName,
        className: item.className,
        month: item.month,
        year: item.year,
        monthlyPayment: item.monthlyPayment,
        paidAmount: item.paidAmount,
        dueAmount: item.dueAmount,
        status: item.status,
      }));

      console.log("Processed Debtors Data:", data);

      const total = data.reduce((sum, item) => sum + item.dueAmount, 0);
      setSummary({
        total,
        count: data.length,
        avg: 0,
      });

      setReportData(data);
    } catch (error) {
      console.error("Failed to generate debtors report:", error);
      toast({
        title: t("error"),
        description: "Failed to generate debtors report",
        variant: "destructive",
      });
      setReportData([]);
    }
  };

  const generateExpensesReport = async () => {
    try {
      const branchId = localStorage.getItem("selectedBranchId");
      if (!branchId) {
        toast({
          title: t("error"),
          description: "No branch selected",
          variant: "destructive",
        });
        setReportData([]);
        return;
      }

      // Convert month/year to dates
      const startYear = parseInt(paymentYear) || new Date().getFullYear();
      const startDateObj = new Date(startYear, parseInt(paymentMonth) - 1, 1);
      const endDateObj = new Date(startYear, parseInt(paymentMonth), 0);

      const newStartDate = startDateObj.toISOString().split("T")[0];
      const newEndDate = endDateObj.toISOString().split("T")[0];

      const expenses = await getExpensesReport(
        branchId,
        newStartDate,
        newEndDate
      );

      const data = expenses.map((e: any) => {
        return {
          id: e.id,
          title: e.title,
          description: e.description || "-",
          category: e.category,
          amount: e.amount,
          date: e.date
            ? new Date(e.date).toLocaleString("uz-UZ", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "N/A",
          paymentMethod: e.paymentMethod || "unknown",
        };
      });

      const total = data.reduce((sum, item) => sum + item.amount, 0);
      setSummary({
        total,
        count: data.length,
        avg: data.length > 0 ? total / data.length : 0,
      });

      setReportData(data);
    } catch (error) {
      console.error("Failed to generate expenses report:", error);
      toast({
        title: t("error"),
        description: "Failed to generate expenses report",
        variant: "destructive",
      });
      setReportData([]);
    }
  };

  const generateIncomeReport = async () => {
    try {
      const branchId = localStorage.getItem("selectedBranchId");
      if (!branchId) {
        toast({
          title: t("error"),
          description: "No branch selected",
          variant: "destructive",
        });
        return;
      }

      // Convert month/year to dates
      const startYear = parseInt(paymentYear) || new Date().getFullYear();
      const startDateObj = new Date(startYear, parseInt(paymentMonth) - 1, 1);
      const endDateObj = new Date(startYear, parseInt(paymentMonth), 0);

      const newStartDate = startDateObj.toISOString().split("T")[0];
      const newEndDate = endDateObj.toISOString().split("T")[0];

      const financialSummary = await getFinancialSummary(
        branchId,
        newStartDate,
        newEndDate
      );

      const totalExpense =
        financialSummary.totalSalaries + financialSummary.totalExpenses;
      const profit = financialSummary.totalIncome - totalExpense;

      setReportData([
        {
          label: t("totalIncome") || "Total Income",
          amount: financialSummary.totalIncome,
          type: "income",
          count: 0,
        },
        {
          label: t("totalSalaries") || "Total Salaries",
          amount: financialSummary.totalSalaries,
          type: "expense",
          count: 0,
        },
        {
          label: t("totalExpenses") || "Total Expenses",
          amount: financialSummary.totalExpenses,
          type: "expense",
          count: 0,
        },
        {
          label: t("totalExpense") || "Total Expenses",
          amount: totalExpense,
          type: "expense",
          count: 0,
        },
        {
          label: t("netProfit") || "Net Profit",
          amount: profit,
          type: profit >= 0 ? "profit" : "loss",
          count: 0,
        },
      ]);

      setSummary({
        total: profit,
        count: 0,
        avg: 0,
      });
    } catch (error) {
      console.error("Failed to generate income report:", error);
      toast({
        title: t("error"),
        description: "Failed to generate income report",
        variant: "destructive",
      });
      setReportData([]);
    }
  };

  const downloadReport = () => {
    let csv = "";
    const periodLabel = `${paymentMonth}/${paymentYear}`;

    if (reportType === "income") {
      csv = "Financial Summary Report\n";
      csv += `Period: ${periodLabel}\n\n`;
      csv += "Label,Amount\n";
      reportData.forEach((item) => {
        csv += `${item.label},${item.amount}\n`;
      });
    } else {
      let columns: string[] = [];
      if (reportType === "debtors") {
        columns = [
          "Student Name",
          "Class",
          "Month",
          "Year",
          "Monthly Payment",
          "Paid Amount",
          "Due Amount",
          "Status",
        ];
      } else if (reportType === "expenses") {
        columns = [
          "Title",
          "Category",
          "Amount",
          "Payment Method",
          "Date",
          "Notes",
        ];
      } else if (reportType === "salary") {
        columns = [
          "Teacher Name",
          "Amount",
          "Month",
          "Year",
          "Status",
          "Paid Date",
          "Added By",
        ];
      } else {
        columns = [
          "Student Name",
          "Class",
          "Amount",
          "Month",
          "Year",
          "Status",
          "Paid Date",
          "Added By",
        ];
      }

      csv = `${reportType.toUpperCase()} REPORT\n`;
      csv += `Period: ${periodLabel}\n\n`;
      csv += columns.join(",") + "\n";

      reportData.forEach((item) => {
        if (reportType === "debtors") {
          csv += `${item.studentName},${item.className},${item.month},${item.year},${item.monthlyPayment},${item.paidAmount},${item.dueAmount},${item.status}\n`;
        } else if (reportType === "expenses") {
          csv += `${item.title},${item.category},${item.amount},${item.paymentMethod},${item.date},${item.description}\n`;
        } else if (reportType === "salary") {
          csv += `${item.teacherName},${item.amount},${item.month},${item.year},${item.status},${item.paidDate},${item.addedBy}\n`;
        } else {
          csv += `${item.studentName},${item.className},${item.amount},${item.month},${item.year},${item.status},${item.paidDate},${item.addedBy}\n`;
        }
      });
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report-${periodLabel}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          {t("reports") || "Reports"}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Generate detailed reports with custom date ranges
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t("reportFilters")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reportType">{t("reportType")}</Label>
              <Select
                value={reportType}
                onValueChange={(value) => setReportType(value as ReportType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment">
                    {t("studentPayments")}
                  </SelectItem>
                  <SelectItem value="salary">{t("teacherSalaries")}</SelectItem>
                  <SelectItem value="expenses">
                    {t("expensesReport")}
                  </SelectItem>
                  <SelectItem value="debtors">{t("studentDebtors")}</SelectItem>
                  <SelectItem value="income">
                    {t("financialSummary")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportType !== "debtors" && (
              <div className="space-y-2">
                <Label htmlFor="paymentMonth">{t("month") || "Month"}</Label>
                <div className="flex gap-2">
                  <Select value={paymentMonth} onValueChange={setPaymentMonth}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => {
                        const monthNum = (i + 1).toString().padStart(2, "0");
                        const monthNames = [
                          "january",
                          "february",
                          "march",
                          "april",
                          "may",
                          "june",
                          "july",
                          "august",
                          "september",
                          "october",
                          "november",
                          "december",
                        ];
                        return (
                          <SelectItem key={monthNum} value={monthNum}>
                            {t(monthNames[i])}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="2000"
                    max="2099"
                    value={paymentYear}
                    onChange={(e) => setPaymentYear(e.target.value)}
                    className="w-20"
                  />
                </div>
              </div>
            )}

            {reportType !== "salary" &&
              reportType !== "income" &&
              reportType !== "expenses" && (
                <div className="space-y-2">
                  <Label htmlFor="classId">{t("class")}</Label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allClasses")}</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            {reportType === "debtors" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="debtorMonth">{t("month")}</Label>
                  <Select value={debtorMonth} onValueChange={setDebtorMonth}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => {
                        const monthNum = (i + 1).toString().padStart(2, "0");
                        const monthNames = [
                          "january",
                          "february",
                          "march",
                          "april",
                          "may",
                          "june",
                          "july",
                          "august",
                          "september",
                          "october",
                          "november",
                          "december",
                        ];
                        return (
                          <SelectItem key={monthNum} value={monthNum}>
                            {t(monthNames[i])}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="debtorYear">{t("year")}</Label>
                  <Input
                    id="debtorYear"
                    type="number"
                    min="2000"
                    max="2099"
                    value={debtorYear || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      console.log("Debtor year changed to:", val);
                      setDebtorYear(val);
                    }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={downloadReport} disabled={reportData.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              {t("downloadReport")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {reportType !== "income" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("totalAmount")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(summary.total)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("count")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {summary.count}
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("average")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(summary.avg)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Data */}
      {reportType === "income" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {reportData.map((item, idx) => (
            <Card
              key={idx}
              className={`border-l-4 ${
                item.type === "income"
                  ? "border-l-green-500"
                  : item.type === "expense"
                  ? "border-l-red-500"
                  : item.amount >= 0
                  ? "border-l-blue-500"
                  : "border-l-red-500"
              }`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    item.type === "income"
                      ? "text-green-600 dark:text-green-400"
                      : item.type === "expense"
                      ? "text-red-600 dark:text-red-400"
                      : item.amount >= 0
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatCurrency(item.amount)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("reportDetails")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {reportType === "debtors" && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("studentName")}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("class")}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("monthYear")}
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("monthlyPayment")}
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("paid")}
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("due")}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                      >
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {item.studentName}
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {item.className}
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {item.month}/{item.year}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.monthlyPayment)}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 dark:text-green-400 font-medium">
                          {formatCurrency(item.paidAmount)}
                        </td>
                        <td className="py-3 px-4 text-right text-red-600 dark:text-red-400 font-medium">
                          {formatCurrency(item.dueAmount)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge>{getStatusLabel(item.status)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType === "expenses" && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("title")}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("category")}
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("amount")}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("paymentMethod")}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("date")}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("notes")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                      >
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {item.title}
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          <Badge variant="outline">{item.category}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-medium">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100 capitalize">
                          {item.paymentMethod}
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {item.date}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                          {item.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportType !== "debtors" && reportType !== "expenses" && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {reportType === "salary" ? t("teacher") : t("student")}{" "}
                        {t("name")}
                      </th>
                      {reportType === "payment" && (
                        <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                          {t("class")}
                        </th>
                      )}
                      <th className="text-right py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("amount")}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("month")}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("year")}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("status")}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("paidDate")}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600 dark:text-slate-400">
                        {t("addedBy")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                      >
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {reportType === "salary"
                            ? item.teacherName
                            : item.studentName}
                        </td>
                        {reportType === "payment" && (
                          <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                            {item.className}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-medium">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {item.month}
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {item.year}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              item.status === "paid"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            }
                          >
                            {getStatusLabel(item.status)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {item.paidDate}
                        </td>
                        <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                          {item.addedBy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportData.length === 0 && (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">
                    {t("noDataFound")}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
