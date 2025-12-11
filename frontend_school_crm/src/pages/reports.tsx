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
import { studentsDB, paymentsDB, salariesDB, teachersDB, classesDB, expensesDB, finishMonth, monthArchivesDB } from "@/lib/storage";
import { Payment, Salary } from "@/types";
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
     const [startDate, setStartDate] = useState("");
     const [endDate, setEndDate] = useState("");
     const [classId, setClassId] = useState("all");
     const [status, setStatus] = useState("all");
     const [debtorMonth, setDebtorMonth] = useState("");
     const [debtorYear, setDebtorYear] = useState("");
     const [classes, setClasses] = useState<any[]>([]);
     const [reportData, setReportData] = useState<any[]>([]);
     const [summary, setSummary] = useState({ total: 0, count: 0, avg: 0 });
     const [finishMonthOpen, setFinishMonthOpen] = useState(false);
     const [finishingMonth, setFinishingMonth] = useState(false);
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
    const timer = setTimeout(() => {
      loadClasses();
      setDefaultDates();
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [canViewReports, router]);

  useEffect(() => {
    generateReport();
  }, [reportType, startDate, endDate, classId, status, debtorMonth, debtorYear]);

  const setDefaultDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(lastDay.toISOString().split("T")[0]);
    setDebtorMonth((now.getMonth() + 1).toString().padStart(2, "0"));
    setDebtorYear(now.getFullYear().toString());
  };

  const loadClasses = () => {
    setClasses(classesDB.getAll());
  };

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "branch_admin";

  const isMonthVisible = (month: string | number, year: string | number): boolean => {
    // Admins can see all data including archived
    if (isAdmin) return true;
    
    // Non-admins can't see archived months
    const monthStr = month.toString().padStart(2, "0");
    const yearNum = parseInt(year.toString());
    return !monthArchivesDB.isMonthArchived(monthStr, yearNum);
  };

  const handleFinishMonth = async () => {
    if (!currentUser) return;
    
    setFinishingMonth(true);
    try {
      const result = finishMonth(currentUser.id);
      if (result.success) {
        toast({
          title: t("success"),
          description: result.message,
          variant: "success",
        });
      } else {
        toast({
          title: t("error"),
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("error"),
        description: "Error finishing month",
        variant: "destructive",
      });
    } finally {
      setFinishingMonth(false);
      setFinishMonthOpen(false);
    }
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

  const generateReport = () => {
    if (!startDate || !endDate) {
      setReportData([]);
      return;
    }

    switch (reportType) {
      case "payment":
        generatePaymentReport();
        break;
      case "salary":
        generateSalaryReport();
        break;
      case "debtors":
        generateDebtorsReport();
        break;
      case "income":
        generateIncomeReport();
        break;
      case "expenses":
        generateExpensesReport();
        break;
    }
  };

  const generatePaymentReport = () => {
    const payments = paymentsDB.getAll() as Payment[];
    const students = studentsDB.getAll();
    const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));

    const filtered = payments.filter((p) => {
      const paymentDate = new Date(p.paidDate || p.month + "-01");
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59);

      const dateMatch = paymentDate >= start && paymentDate <= end;
      const statusMatch = status === "all" || p.status === status;
      const visibilityMatch = isMonthVisible(p.month, p.year);

      if (classId !== "all") {
        const student = students.find(s => s.id === p.studentId);
        return dateMatch && statusMatch && visibilityMatch && student?.classId === classId;
      }

      return dateMatch && statusMatch && visibilityMatch;
    });

    const data = filtered.map((p) => {
      const student = students.find(s => s.id === p.studentId);
      return {
        id: p.id,
        studentName: student?.fullName || "Unknown",
        className: classMap[student?.classId || ""] || "N/A",
        amount: p.amount,
        month: p.month,
        year: p.year,
        status: p.status,
        paidDate: p.paidDate ? new Date(p.paidDate).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A",
      };
    });

    const total = data.reduce((sum, item) => sum + item.amount, 0);
    setSummary({
      total,
      count: data.length,
      avg: data.length > 0 ? total / data.length : 0,
    });

    setReportData(data);
  };

  const generateSalaryReport = () => {
    const salaries = salariesDB.getAll() as Salary[];
    const teachers = teachersDB.getAll();

    const filtered = salaries.filter((s) => {
      const salaryDate = new Date(s.paidDate || s.month + "-01");
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59);

      const visibilityMatch = isMonthVisible(s.month, s.year);
      return salaryDate >= start && salaryDate <= end && (status === "all" || s.status === status) && visibilityMatch;
    });

    const data = filtered.map((s) => {
      const teacher = teachers.find(t => t.id === s.teacherId);
      return {
        id: s.id,
        teacherName: teacher?.fullName || "Unknown",
        amount: s.amount,
        month: s.month,
        year: s.year,
        status: s.status,
        paidDate: s.paidDate ? new Date(s.paidDate).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A",
      };
    });

    const total = data.reduce((sum, item) => sum + item.amount, 0);
    setSummary({
      total,
      count: data.length,
      avg: data.length > 0 ? total / data.length : 0,
    });

    setReportData(data);
  };

  const generateDebtorsReport = () => {
    const students = studentsDB.getAll();
    const payments = paymentsDB.getAll() as Payment[];
    const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));

    if (!debtorMonth || !debtorYear) {
      setReportData([]);
      return;
    }

    const month = Number(debtorMonth);
    const year = Number(debtorYear);
    
    // Check if this month is visible to the current user
    if (!isMonthVisible(debtorMonth, debtorYear)) {
      setReportData([]);
      setSummary({ total: 0, count: 0, avg: 0 });
      return;
    }

    const data: any[] = [];

    // Check each student's debtor status for selected month
    students.forEach((s) => {
      const studentPayments = payments.filter((p) => 
        p.studentId === s.id && 
        Number(p.month) === month && 
        Number(p.year) === year
      );

      const paidAmount = studentPayments
        .filter(p => p.status === "paid")
        .reduce((sum, p) => sum + p.amount, 0);

      const dueAmount = s.monthlyPayment - paidAmount;
      const isDebtor = paidAmount < s.monthlyPayment;

      if (isDebtor) {
        const classMatch = classId === "all" || s.classId === classId;
        
        if (classMatch) {
          data.push({
            id: `${s.id}-${year}-${month}`,
            studentName: s.fullName,
            className: classMap[s.classId || ""] || "N/A",
            month: debtorMonth,
            year: debtorYear,
            monthlyPayment: s.monthlyPayment,
            paidAmount,
            dueAmount,
            status: s.status,
          });
        }
      }
    });

    const total = data.reduce((sum, item) => sum + item.dueAmount, 0);
    setSummary({
      total,
      count: data.length,
      avg: 0,
    });

    setReportData(data);
  };

  const generateExpensesReport = () => {
    const expenses = expensesDB.getAll();

    const filtered = expenses.filter((e: any) => {
      const expenseDate = new Date(e.date || e.createdAt);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59);

      return expenseDate >= start && expenseDate <= end && (status === "all" || e.status === status);
    });

    const data = filtered.map((e: any) => {
      return {
        id: e.id,
        title: e.title,
        description: e.description || "-",
        category: e.category,
        amount: e.amount,
        status: e.status || "approved",
        date: e.date ? new Date(e.date).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : new Date(e.createdAt).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
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
  };

  const generateIncomeReport = () => {
    const payments = paymentsDB.getAll() as Payment[];
    const salaries = salariesDB.getAll() as Salary[];

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);

    const incomePayments = payments.filter((p) => {
      const paymentDate = new Date(p.paidDate || p.month + "-01");
      return paymentDate >= start && paymentDate <= end && p.status === "paid";
    });

    const expenseSalaries = salaries.filter((s) => {
      const salaryDate = new Date(s.paidDate || s.month + "-01");
      return salaryDate >= start && salaryDate <= end && s.status === "paid";
    });

    const totalIncome = incomePayments.reduce((sum, p) => sum + p.amount, 0);
    const totalExpense = expenseSalaries.reduce((sum, s) => sum + s.amount, 0);
    const profit = totalIncome - totalExpense;

    setReportData([
      {
        label: "Total Income",
        amount: totalIncome,
        type: "income",
        count: incomePayments.length,
      },
      {
        label: "Total Expenses",
        amount: totalExpense,
        type: "expense",
        count: expenseSalaries.length,
      },
      {
        label: "Net Profit",
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
  };

  const downloadReport = () => {
    let csv = "";

    if (reportType === "income") {
      csv = "Financial Summary Report\n";
      csv += `Period: ${startDate} to ${endDate}\n\n`;
      csv += "Label,Amount\n";
      reportData.forEach((item) => {
        csv += `${item.label},${item.amount}\n`;
      });
    } else {
      let columns: string[] = [];
      if (reportType === "debtors") {
        columns = ["Student Name", "Class", "Month", "Year", "Monthly Payment", "Paid Amount", "Due Amount", "Status"];
      } else if (reportType === "expenses") {
        columns = ["Title", "Category", "Amount", "Payment Method", "Date", "Notes"];
      } else if (reportType === "salary") {
        columns = ["Teacher Name", "Amount", "Month", "Year", "Status", "Paid Date"];
      } else {
        columns = ["Student Name", "Class", "Amount", "Month", "Year", "Status", "Paid Date"];
      }

      csv = `${reportType.toUpperCase()} REPORT\n`;
      csv += `Period: ${startDate} to ${endDate}\n\n`;
      csv += columns.join(",") + "\n";

      reportData.forEach((item) => {
        if (reportType === "debtors") {
          csv += `${item.studentName},${item.className},${item.month},${item.year},${item.monthlyPayment},${item.paidAmount},${item.dueAmount},${item.status}\n`;
        } else if (reportType === "expenses") {
          csv += `${item.title},${item.category},${item.amount},${item.paymentMethod},${item.date},${item.description}\n`;
        } else if (reportType === "salary") {
          csv += `${item.teacherName},${item.amount},${item.month},${item.year},${item.status},${item.paidDate}\n`;
        } else {
          csv += `${item.studentName},${item.className},${item.amount},${item.month},${item.year},${item.status},${item.paidDate}\n`;
        }
      });
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report-${startDate}-to-${endDate}.csv`;
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

        {/* Finish Month - Admin/Manager Only */}
        {hasPermission("canFinishMonth") && (
        <Card className="border-orange-200 dark:border-orange-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              {t("finishMonth") || "Finish Month"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {t("finishMonthDescription") || "Archive current month data and reset for next month. Only admin can see archived data in reports."}
            </p>
            <Button
              variant="destructive"
              onClick={() => setFinishMonthOpen(true)}
              disabled={!currentUser}
            >
              {t("finishMonthButton") || "Finish Current Month"}
            </Button>
          </CardContent>
        </Card>
        )}

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
                <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment">{t("studentPayments")}</SelectItem>
                    <SelectItem value="salary">{t("teacherSalaries")}</SelectItem>
                    <SelectItem value="expenses">{t("expensesReport")}</SelectItem>
                    <SelectItem value="debtors">{t("studentDebtors")}</SelectItem>
                    <SelectItem value="income">{t("financialSummary")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {reportType !== "debtors" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">{t("startDate")}</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">{t("endDate")}</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              {reportType !== "salary" && reportType !== "income" && reportType !== "expenses" && (
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
                        <SelectItem value="01">{t("January")}</SelectItem>
                        <SelectItem value="02">{t("February")}</SelectItem>
                        <SelectItem value="03">{t("March")}</SelectItem>
                        <SelectItem value="04">{t("April")}</SelectItem>
                        <SelectItem value="05">{t("May")}</SelectItem>
                        <SelectItem value="06">{t("June")}</SelectItem>
                        <SelectItem value="07">{t("July")}</SelectItem>
                        <SelectItem value="08">{t("August")}</SelectItem>
                        <SelectItem value="09">{t("September")}</SelectItem>
                        <SelectItem value="10">{t("October")}</SelectItem>
                        <SelectItem value="11">{t("November")}</SelectItem>
                        <SelectItem value="12">{t("December")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="debtorYear">{t("year")}</Label>
                    <Select value={debtorYear} onValueChange={setDebtorYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2022">2022</SelectItem>
                        <SelectItem value="2023">2023</SelectItem>
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2026">2026</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {reportType !== "debtors" && (
                <div className="space-y-2">
                  <Label htmlFor="status">{t("status")}</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allStatus")}</SelectItem>
                      <SelectItem value="paid">{t("paid")}</SelectItem>
                      <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                          {reportType === "salary" ? t("teacher") : t("student")} {t("name")}
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
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                        >
                          <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                            {reportType === "salary" ? item.teacherName : item.studentName}
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

          {/* Finish Month Confirmation Dialog */}
          <Dialog open={finishMonthOpen} onOpenChange={setFinishMonthOpen}>
          <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              {t("confirmFinishMonth") || "Confirm Finish Month"}
            </DialogTitle>
            <DialogDescription>
              {t("finishMonthConfirmMessage") || "Are you sure you want to finish the current month? All data will be archived and cleared."}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 my-4">
            <p className="text-sm text-orange-900 dark:text-orange-100">
              {t("finishMonthConfirmWarning") || "This action cannot be undone. All payments, salaries, and expenses for the current month will be archived."}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFinishMonthOpen(false)}
              disabled={finishingMonth}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleFinishMonth}
              disabled={finishingMonth}
            >
              {finishingMonth ? t("loading") || "Processing..." : (t("finishMonthButton") || "Finish Month")}
            </Button>
          </DialogFooter>
          </DialogContent>
          </Dialog>
      </div>
    );
  }
