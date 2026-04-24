import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FormDialog } from "@/components/FormDialog";
import { Field } from "@/components/Field";
import { Salary, PaymentStatus, Teacher, PaymentMethod, Branch } from "@/types";
import { Plus, Search, Wallet, AlertCircle, CheckCircle, CreditCard, Banknote, Building2, Edit2, Trash2, Loader2 } from "lucide-react";
import MonthYearSelector from "@/components/MonthYearSelector";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { listSalaries, getBranch, listTeachers, createSalary, updateSalary, deleteSalary } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { formatNumberWithSpaces, removeNumberFormatting } from "@/lib/utils";
import { searchMatchesCrossScript } from "@/lib/transliterate";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, Column } from "@/components/DataTable";

export default function SalariesPage() {
  const router = useRouter();
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

      if (branchId) {
        const branch = await getBranch(branchId);
        setBranchData(branch);

        const currentMonth = branch.currentFinancialMonth?.month?.toString().padStart(2, '0') || String(new Date().getMonth() + 1).padStart(2, '0');
        const currentYear = branch.currentFinancialMonth?.year || new Date().getFullYear();

        const targetMonth = month || selectedMonth || currentMonth;
        const targetYear = year || selectedYear || currentYear;

        if (!selectedMonth) {
          setSelectedMonth(currentMonth);
          setSelectedYear(currentYear);
        }

        const [data, teacherList] = await Promise.all([
          listSalaries(branchId, targetMonth, targetYear),
          listTeachers(branchId),
        ]);
        setSalaries(data);
        setTeachers(teacherList);
      }
    } catch (error) {
      console.error("Failed to load salaries:", error);
      toast({
        title: t("error"),
        description: t("failedToLoadSalaries"),
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const user = getCurrentUser();
    if (!user) { setIsSubmitting(false); return; }

    const branchId = localStorage.getItem("selectedBranchId") || user.branchId || "";
    try {
      if (editingSalaryId) {
        await updateSalary(editingSalaryId, {
          amount: parseFloat(formData.amount),
          status: formData.status,
          paymentMethod: formData.paymentMethod,
          notes: formData.notes || undefined,
          paidDate: formData.status === "paid" ? new Date().toISOString() : undefined,
        });
        setEditingSalaryId(null);
      } else {
        await createSalary({
          teacherId: formData.teacherId,
          amount: parseFloat(formData.amount),
          month: formData.month,
          year: parseInt(formData.year),
          status: formData.status,
          paymentMethod: formData.paymentMethod,
          notes: formData.notes || undefined,
          paidDate: formData.status === "paid" ? new Date().toISOString() : undefined,
          branchId,
        });
      }
      resetForm();
      await loadData();
      setIsDialogOpen(false);
      toast({ title: t("success"), variant: "success" });
    } catch (error) {
      console.error("Failed to save salary:", error);
      toast({ title: t("error"), description: t("failedToSaveSalary"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await updateSalary(id, { status: "paid", paidDate: new Date().toISOString() });
      await loadData();
      toast({ title: t("success") || "Success", description: "Salary marked as paid", variant: "success" });
    } catch {
      toast({ title: t("error"), variant: "destructive" });
    }
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
        await deleteSalary(deleteConfirmId);
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

  const filteredSalaries = salaries.filter((salary) => {
    const teacherName = getTeacherName(salary.teacherId);
    const matchesSearch = searchMatchesCrossScript(teacherName, searchTerm);
    const matchesStatus = filterStatus === "all" || salary.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSalaries = filteredSalaries.slice(startIndex, startIndex + itemsPerPage);

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "partial":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
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

  // ── Column definitions ────────────────────────────────────────────────────────
  const columns: Column<Salary>[] = [
    {
      key: "teacher",
      header: t("teacher"),
      render: (salary) => (
        <p className="font-medium text-slate-900 dark:text-slate-100">
          {getTeacherName(salary.teacherId)}
        </p>
      ),
    },
    {
      key: "period",
      header: t("period"),
      hideOnMobile: true,
      render: (salary) => (
        <span className="text-slate-900 dark:text-slate-100">
          {getMonthName(salary.month)} {salary.year}
        </span>
      ),
    },
    {
      key: "amount",
      header: t("amount"),
      render: (salary) => (
        <span className="text-slate-900 dark:text-slate-100">
          {formatCurrency(salary.amount)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("status"),
      render: (salary) => (
        <Badge className={getStatusColor(salary.status)}>
          {salary.status === "partial" ? t("partialPaid") : t(salary.status)}
        </Badge>
      ),
    },
    {
      key: "paymentMethod",
      header: t("paymentMethod"),
      hideOnMobile: true,
      render: (salary) => (
        <Badge className={`gap-1 ${getPaymentMethodColor(salary.paymentMethod)}`}>
          {getPaymentMethodIcon(salary.paymentMethod)}
          <span>{t(salary.paymentMethod === "bank" ? "bankTransfer" : salary.paymentMethod)}</span>
          <span className="ml-1 font-medium">{formatCurrency(salary.amount)}</span>
        </Badge>
      ),
    },
    {
      key: "paidDate",
      header: t("paidDate"),
      hideOnMobile: true,
      render: (salary) => (
        <span className="text-slate-900 dark:text-slate-100">
          {salary.paidDate
            ? new Date(salary.paidDate).toLocaleDateString('en-GB').replace(/\//g, ".")
            : "-"}
        </span>
      ),
    },
    {
      key: "createdBy",
      header: t("whoAddedSalaries"),
      hideOnMobile: true,
      render: (salary) => (
        <span className="text-sm text-slate-900 dark:text-slate-100">{salary.createdBy || "-"}</span>
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (salary) => (
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
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1">
          <PageHeader title={t("salaries")} subtitle={t("trackTeacherSalaries")} />
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
          <Button
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            disabled={!canCreateSalaries}
            title={!canCreateSalaries ? t("noPermission") || "No permission to create salaries" : ""}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("recordSalaryPayment")}
          </Button>

          <FormDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            title={editingSalaryId ? t("edit") || "Edit" : t("recordSalaryPayment")}
            onSubmit={handleSubmit}
            submitLabel={editingSalaryId ? t("update") : t("recordSalaryPayment")}
            submittingLabel={t("recording")}
            isPending={isSubmitting}
            maxWidth="max-w-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
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

              <Field
                id="amount"
                label={`${t("amount")} *`}
                type="text"
                value={formatNumberWithSpaces(formData.amount)}
                placeholder="0"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, amount: removeNumberFormatting(e.target.value) })
                }
              />

              <div className="space-y-1.5">
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

              <div className="space-y-1.5">
                <Label htmlFor="month">{t("month")} *</Label>
                <Select
                  value={formData.month}
                  onValueChange={(value) =>
                    setFormData({ ...formData, month: value })
                  }
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

              <Field
                id="year"
                label={`${t("year")} *`}
                type="number"
                value={formData.year}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, year: e.target.value })
                }
              />

              <div className="space-y-1.5 md:col-span-2">
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

              <Field
                id="notes"
                label={t("description")}
                as="textarea"
                value={formData.notes}
                placeholder={t("notesPlaceholder")}
                className="md:col-span-2"
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
          </FormDialog>
        </div>
      </div>

      {/* Stats cards */}
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

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder={t("searchSalaries")}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}>
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paginatedSalaries}
            loading={isLoading}
            emptyTitle={t("noSalaryRecordsFound")}
            pagination={{
              page: currentPage,
              limit: itemsPerPage,
              total: filteredSalaries.length,
            }}
            onPageChange={(page) => {
              setCurrentPage(page);
              router.push(`/salaries?page=${page}`, undefined, { shallow: true });
            }}
            renderCard={(salary) => (
              <div
                key={salary.id}
                className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {getTeacherName(salary.teacherId)}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {getMonthName(salary.month)} {salary.year}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(salary.amount)}
                    </span>
                    <Badge className={getStatusColor(salary.status)}>
                      {salary.status === "partial" ? t("partialPaid") : t(salary.status)}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`gap-1 ${getPaymentMethodColor(salary.paymentMethod)}`}>
                      {getPaymentMethodIcon(salary.paymentMethod)}
                      <span>{t(salary.paymentMethod === "bank" ? "bankTransfer" : salary.paymentMethod)}</span>
                    </Badge>
                    {salary.paidDate && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(salary.paidDate).toLocaleDateString("en-GB").replace(/\//g, ".")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {salary.status === "partial" && (
                      <Button size="sm" variant="outline" className="text-green-600 h-7 text-xs px-2" onClick={() => handleMarkPaid(salary.id)}>
                        {t("markPaid")}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(salary)} disabled={!canEditSalaries}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(salary.id)} disabled={!canDeleteSalaries}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
                {salary.createdBy && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">{t("whoAddedSalaries")}: {salary.createdBy}</p>
                )}
              </div>
            )}
          />
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
