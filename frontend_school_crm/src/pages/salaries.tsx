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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { salariesDB, teachersDB, usersDB, monthArchivesDB, branchesDB } from "@/lib/storage";
import { Salary, PaymentStatus, Teacher, PaymentMethod, Branch } from "@/types";
import { Plus, Search, Wallet, AlertCircle, CheckCircle, CreditCard, Banknote, Building2, Edit2, Trash2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import MonthYearSelector from "@/components/MonthYearSelector";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { listSalaries, getBranch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { formatNumberWithSpaces, removeNumberFormatting } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";
import { searchMatchesCrossScript } from "@/lib/transliterate";

export default function SalariesPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const [isLoading, setIsLoading] = useState(true);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSalaryId, setEditingSalaryId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [branchData, setBranchData] = useState<Branch | null>(null);
  const language = useLanguage();
  const { toast } = useToast();
  const canCreateSalaries = hasPermission("canCreateSalaries");
  const canEditSalaries = hasPermission("canEditSalaries");
  const canDeleteSalaries = hasPermission("canDeleteSalaries");

  const getDefaultYear = () => {
    return new Date().getFullYear().toString();
  };

  const getDefaultMonth = () => {
    const month = new Date().getMonth() + 1;
    return month.toString().padStart(2, "0");
  };

  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "branch_admin";

  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(0);

  const isMonthVisible = (month: string, year: number): boolean => {
    // The backend API handles filtering of archived months per branch
    // So we allow all months here and let the backend handle visibility
    return true;
  };

  const [formData, setFormData] = useState({
    teacherId: "",
    amount: "",
    month: getDefaultMonth(),
    year: getDefaultYear(),
    status: "partial" as PaymentStatus,
    paymentMethod: "bank" as PaymentMethod,
    notes: "",
  });

  useEffect(() => {
    // Set currentPage from URL query params
    if (router.isReady) {
      const page = router.query.page ? parseInt(router.query.page as string, 10) : 1;
      setCurrentPage(Math.max(1, page));
    }
  }, [router.isReady, router.query.page]);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      loadData();
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Reload data when branch changes
  useEffect(() => {
    const handleBranchChange = async () => {
      setIsLoading(true);
      setCurrentPage(1);
      // Reset selectedMonth to force reload from new branch
      setSelectedMonth("");
      loadData().finally(() => setIsLoading(false));
    };
    window.addEventListener("branchChange", handleBranchChange);
    return () => window.removeEventListener("branchChange", handleBranchChange);
  }, []);

  // Reload data when month/year changes
  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  const t = (key: string) => getTranslation(key, language);

  const handleMonthChange = (month: string, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    setCurrentPage(1);
  };

  const loadData = async (month?: string, year?: number) => {
    try {
      const branchId = localStorage.getItem("selectedBranchId") || "";

      // Load branch data to get current month
      if (branchId) {
        const branch = await getBranch(branchId);
        setBranchData(branch);

        // Use financial month data if available, otherwise fall back to current date
        const currentMonth = branch.currentFinancialMonth?.month?.toString().padStart(2, '0') || String(new Date().getMonth() + 1).padStart(2, '0');
        const currentYear = branch.currentFinancialMonth?.year || new Date().getFullYear();

        // Set selected month to branch's current month if not already set and not provided
        const targetMonth = month || selectedMonth || currentMonth;
        const targetYear = year || selectedYear || currentYear;

        if (!selectedMonth) {
          setSelectedMonth(currentMonth);
          setSelectedYear(currentYear);
        }

        // Fetch salaries from API filtered by branch and month
        const data = await listSalaries(branchId, targetMonth, targetYear);
        setSalaries(data);
      }

      setTeachers(teachersDB.getAll());
    } catch (error) {
      console.error("Failed to load salaries:", error);
      toast({
        title: t("error"),
        description: t("failedToLoadSalaries"),
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const user = getCurrentUser();
    if (!user) {
      setIsSubmitting(false);
      return;
    }

    try {
      if (editingSalaryId) {
        salariesDB.update(editingSalaryId, {
          teacherId: formData.teacherId,
          amount: parseFloat(formData.amount),
          month: formData.month,
          year: parseInt(formData.year),
          status: formData.status,
          paymentMethod: formData.paymentMethod,
          notes: formData.notes || undefined,
          paidDate: formData.status === "paid" ? new Date().toISOString() : undefined,
        });
        setEditingSalaryId(null);
      } else {
        salariesDB.create({
          teacherId: formData.teacherId,
          amount: parseFloat(formData.amount),
          month: formData.month,
          year: parseInt(formData.year),
          status: formData.status,
          paymentMethod: formData.paymentMethod,
          notes: formData.notes || undefined,
          paidDate: formData.status === "paid" ? new Date().toISOString() : undefined,
          branchId: user.branchId || "",
        });
      }

      resetForm();
      loadData();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Failed to save salary:", error);
      toast({
        title: t("error"),
        description: t("failedToSaveSalary"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkPaid = (id: string) => {
    salariesDB.update(id, {
      status: "paid",
      paidDate: new Date().toISOString(),
    });
    loadData();
    toast({ title: t("success") || "Success", description: "Salary marked as paid", variant: "success" });
  };

  const handleEdit = (salary: Salary) => {
    setEditingSalaryId(salary.id);
    setFormData({
      teacherId: salary.teacherId,
      amount: salary.amount.toString(),
      month: salary.month,
      year: salary.year.toString(),
      status: salary.status,
      paymentMethod: salary.paymentMethod,
      notes: salary.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      setIsDeleteLoading(true);
      try {
        salariesDB.delete(deleteConfirmId);
        await loadData();
        toast({ title: t("deleted") || "Deleted", description: t("salaryRecordDeleted"), variant: "success" });
      } catch (error) {
        toast({ title: "Error", description: "Failed to delete salary", variant: "destructive" });
      } finally {
        setIsDeleteLoading(false);
        setDeleteConfirmId(null);
      }
    }
  };

  const resetForm = () => {
    // Use branch's current financial month, fallback to current date
    const defaultMonth = branchData?.currentFinancialMonth?.month?.toString().padStart(2, '0') || getDefaultMonth();
    const defaultYear = branchData?.currentFinancialMonth?.year?.toString() || getDefaultYear();

    setFormData({
      teacherId: "",
      amount: "",
      month: defaultMonth,
      year: defaultYear,
      status: "partial",
      paymentMethod: "bank",
      notes: "",
    });
    setEditingSalaryId(null);
  };

  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    return teacher?.fullName || "Unknown";
  };

  const getUserName = (userId: string) => {
    const user = usersDB.getAll().find((u) => u.id === userId);
    return user?.fullName || "-";
  };

  const filteredSalaries = salaries.filter((salary) => {
    const teacherName = getTeacherName(salary.teacherId);
    const matchesSearch = searchMatchesCrossScript(teacherName, searchTerm);

    const matchesStatus =
      filterStatus === "all" || salary.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredSalaries.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSalaries = filteredSalaries.slice(startIndex, startIndex + itemsPerPage);

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "partial":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "partial":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "";
    }
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case "card":
        return <CreditCard className="w-3 h-3" />;
      case "cash":
        return <Banknote className="w-3 h-3" />;
      case "bank":
        return <Building2 className="w-3 h-3" />;
    }
  };

  const getPaymentMethodColor = (method: PaymentMethod) => {
    switch (method) {
      case "card":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "cash":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "bank":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    }
  };

  const totalPaid = salaries
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + s.amount, 0);

  const totalPending = salaries
    .filter((s) => s.status === "partial")
    .reduce((sum, s) => sum + s.amount, 0);

  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

  const getMonthName = (monthNumber: string) => {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const index = parseInt(monthNumber) - 1;
    return t(monthNames[index] ? monthNames[index].toLowerCase() : "unknown") || monthNames[index] || "Unknown";
  };

  if (isLoading) {
    return (

      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
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

        {/* Action Button Skeleton */}
        <Skeleton className="h-10 w-32" />

        {/* Search and Filter Skeleton */}
        <div className="flex gap-4 flex-col sm:flex-row">
          <Skeleton className="h-10 w-full sm:flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Table Skeleton */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-4 border-b">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

    );
  }

  return (

    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {t("salaries")}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t("trackTeacherSalaries")}
          </p>
        </div>

        {isAdmin && branchData && selectedMonth && (
          <div className="flex-1 flex justify-center">
            <MonthYearSelector
              month={selectedMonth}
              year={selectedYear}
              onChange={handleMonthChange}
              currentBranchMonth={branchData.currentFinancialMonth?.month?.toString().padStart(2, '0')}
              currentBranchYear={branchData.currentFinancialMonth?.year}
            />
          </div>
        )}

        <div className="flex-1 flex justify-end">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                onClick={() => resetForm()}
                disabled={!canCreateSalaries}
                title={!canCreateSalaries ? t("noPermission") || "No permission to create salaries" : ""}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("recordSalaryPayment")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingSalaryId ? t("edit") || "Edit" : t("recordSalaryPayment")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="teacherId">{t("teacher")} *</Label>
                    <Select
                      value={formData.teacherId}
                      onValueChange={(value) => {
                        const teacher = teachers.find((t) => t.id === value);
                        setFormData({
                          ...formData,
                          teacherId: value,
                          amount: teacher?.monthlySalary.toString() || "",
                        });
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectTeacher")} />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">{t("amount")} *</Label>
                    <Input
                      id="amount"
                      type="text"
                      value={formatNumberWithSpaces(formData.amount)}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: removeNumberFormatting(e.target.value) })
                      }
                      required
                      placeholder="0"
                      step="500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">{t("paymentStatusLabel")} *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: PaymentStatus) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">{t("paid")}</SelectItem>
                        <SelectItem value="partial">{t("partialPaid")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="month">{t("month")} *</Label>
                    <Select
                      value={formData.month}
                      onValueChange={(value) =>
                        setFormData({ ...formData, month: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectMonth")} />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={month} value={month}>
                            {getMonthName(month)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="year">{t("year")} *</Label>
                    <Input
                      id="year"
                      type="number"
                      value={formData.year}
                      onChange={(e) =>
                        setFormData({ ...formData, year: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="paymentMethod">{t("paymentMethodLabel")} *</Label>
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(value: PaymentMethod) =>
                        setFormData({ ...formData, paymentMethod: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card">{t("card")}</SelectItem>
                        <SelectItem value="cash">{t("cash")}</SelectItem>
                        <SelectItem value="bank">{t("bankTransfer")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notes">{t("description")}</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder={t("notesPlaceholder")}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    {t("cancel")}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin mr-2" />
                        {t("recording")}
                      </>
                    ) : (
                      t("recordSalaryPayment")
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              {t("totalPaid")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(totalPaid)}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("salariesPaidOut")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {t("pendingLabel")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(totalPending)}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("unpaidSalariesLabel")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {t("totalRecords")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {salaries.length}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("salaryRecords")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder={t("searchSalaries")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatus")}</SelectItem>
                <SelectItem value="paid">{t("paid")}</SelectItem>
                <SelectItem value="partial">{t("partialPaid")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("teacher")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("period")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("amount")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("status")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("paymentMethod")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("paidDate")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("whoAddedSalaries")}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedSalaries.map((salary) => (
                  <tr
                    key={salary.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {getTeacherName(salary.teacherId)}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                      {getMonthName(salary.month)} {salary.year}
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                      {formatCurrency(salary.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getStatusColor(salary.status)}>
                        {salary.status === "partial" ? t("partialPaid") : t(salary.status)}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={`gap-1 ${getPaymentMethodColor(salary.paymentMethod)}`}>
                        {getPaymentMethodIcon(salary.paymentMethod)}
                        <span>{t(salary.paymentMethod === "bank" ? "bankTransfer" : salary.paymentMethod)}</span>
                        <span className="ml-1 font-medium">{formatCurrency(salary.amount)}</span>
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                      {salary.paidDate
                        ? new Date(salary.paidDate).toLocaleDateString('en-GB')
                        : "-"}
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                      <span className="text-sm">{salary.createdBy ? getUserName(salary.createdBy) : "-"}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {salary.status === "partial" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600"
                            onClick={() => handleMarkPaid(salary.id)}
                          >
                            {t("markPaid")}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(salary)}
                          disabled={!canEditSalaries}
                          title={canEditSalaries ? "" : "No permission"}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(salary.id)}
                          disabled={!canDeleteSalaries}
                          title={canDeleteSalaries ? "" : "No permission"}
                        >
                          <Trash2 className="w-4 h-4 text-red-200" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredSalaries.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  {t("noSalaryRecordsFound")}
                </p>
              </div>
            )}

            {/* Pagination */}
            {filteredSalaries.length > 0 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {t("showing")} {startIndex + 1} – {Math.min(startIndex + itemsPerPage, filteredSalaries.length)} {t("of")} {filteredSalaries.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/salaries?page=${Math.max(1, currentPage - 1)}`)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {t("previous")}
                  </Button>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => router.push(`/salaries?page=${page}`)}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/salaries?page=${Math.min(totalPages, currentPage + 1)}`)}
                    disabled={currentPage === totalPages}
                  >
                    {t("next")}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteSalary")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400 py-4">
            {t("deleteWarning")}
          </p>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              disabled={isDeleteLoading}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleteLoading}
            >
              {isDeleteLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("deleting") || "Deleting..."}
                </>
              ) : (
                t("delete") || "Delete"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>

  );
}
