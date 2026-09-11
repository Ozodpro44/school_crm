import { useEffect, useRef, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import MonthYearSelector from "@/components/MonthYearSelector";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { listSalaries, getBranch, listTeachers, createSalary, updateSalary, deleteSalary, getUser } from "@/lib/api";
import { useNotify } from "@/hooks/use-notify";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { formatNumberWithSpaces, removeNumberFormatting } from "@/lib/utils";
import { searchMatchesCrossScript } from "@/lib/transliterate";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, Column } from "@/components/DataTable";
import { FilterBar, FilterSearch, FilterReset, filterSelectClass } from "@/components/FilterBar";
import { useBranch } from "@/context/BranchContext";

export default function SalariesPage() {
  const router = useRouter();
  const { currentBranch } = useBranch();
  const [isLoading, setIsLoading] = useState(true);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSalaryId, setEditingSalaryId] = useState<string | null>(null);
  const [editingSalaryOriginal, setEditingSalaryOriginal] = useState<Salary | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [branchData, setBranchData] = useState<Branch | null>(null);
  const [userCache, setUserCache] = useState<{ [key: string]: string }>({});
  const language = useLanguage();
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
    status: "paid" as PaymentStatus,
    paymentMethod: "bank" as PaymentMethod,
    notes: "",
  });
  const [formErrors, setFormErrors] = useState<{ teacherId?: string; amount?: string }>({});

  const firstBranchLoadRef = useRef(true);
  // Set by the branch-change effect right before it resets selectedMonth to
  // "" to force recomputing the new branch's default month — without this,
  // that reset ALSO triggers the month-change effect below (selectedMonth
  // is one of its dependencies), so a single branch switch fired loadData()
  // twice, racing each other.
  const skipNextMonthEffectRef = useRef(false);
  // Guards against whichever of the two loadData() calls resolves last
  // winning regardless of which one was actually requested most recently.
  const loadRequestIdRef = useRef(0);
  const financialMonthKey = currentBranch?.currentFinancialMonth
    ? `${currentBranch.currentFinancialMonth.year}-${currentBranch.currentFinancialMonth.month}`
    : undefined;

  useEffect(() => {
    if (router.isReady) {
      const page = router.query.page ? parseInt(router.query.page as string, 10) : 1;
      setCurrentPage(Math.max(1, page));
    }
  }, [router.isReady, router.query.page]);

  useEffect(() => {
    if (!currentBranch?.id) return;
    setIsLoading(true);
    if (!firstBranchLoadRef.current) {
      setCurrentPage(1);
      skipNextMonthEffectRef.current = true;
      setSelectedMonth("");
    }
    firstBranchLoadRef.current = false;
    const myId = ++loadRequestIdRef.current;
    loadData().finally(() => {
      if (myId === loadRequestIdRef.current) setIsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBranch?.id, financialMonthKey]);

  // Reload data when the user picks a different month/year. Skipped once
  // right after a branch switch — that reset already triggers its own fetch
  // in the effect above (see skipNextMonthEffectRef), so without this guard
  // a single branch switch fired loadData() twice, racing each other, and
  // this effect never showed a loading state of its own (switching months
  // used to flash the previous month's figures with no indicator).
  useEffect(() => {
    if (skipNextMonthEffectRef.current) {
      skipNextMonthEffectRef.current = false;
      return;
    }
    setIsLoading(true);
    const myId = ++loadRequestIdRef.current;
    loadData().finally(() => {
      if (myId === loadRequestIdRef.current) setIsLoading(false);
    });
  }, [selectedMonth, selectedYear]);

  const t = (key: string) => getTranslation(key, language);
  const notify = useNotify();

  const handleMonthChange = (month: string, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    setCurrentPage(1);
  };

  const loadData = async (month?: string, year?: number) => {
    try {
      const branchId = currentBranch?.id || "";

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

        // teacher_service.Salary.createdBy is a raw X-User-ID UUID, never
        // joined against the users table — resolve it to a display name the
        // same way expenses.tsx does, otherwise the "Added by" column shows
        // a bare UUID.
        const creatorIds = [...new Set(data.map((s) => s.createdBy).filter(Boolean))] as string[];
        for (const userId of creatorIds) {
          await fetchAndCacheUserName(userId);
        }
      }
    } catch (error) {
      console.error("Failed to load salaries:", error);
      notify.error(t("error"), t("failedToLoadSalaries"));
    }
  };

  const getUserName = (userId: string) => {
    if (!userId) return "-";
    return userCache[userId] || "-";
  };

  const fetchAndCacheUserName = async (userId: string) => {
    if (!userId || userCache[userId]) return;
    try {
      const user = await getUser(userId);
      setUserCache((prev) => ({ ...prev, [userId]: user.fullName }));
    } catch {
      setUserCache((prev) => ({ ...prev, [userId]: "Unknown" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Previously unvalidated: teacherId could be submitted empty (creating
    // a salary record with no teacher) and amount could be blank/negative/
    // zero (parseFloat("") is NaN, sent straight to the API).
    const errors: typeof formErrors = {};
    if (!editingSalaryId && !formData.teacherId) errors.teacherId = t("fieldRequired");
    if (!formData.amount.trim() || !(parseFloat(formData.amount) > 0)) {
      errors.amount = formData.amount.trim() ? t("mustBePositive") : t("fieldRequired");
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    const user = getCurrentUser();
    if (!user) { setIsSubmitting(false); return; }

    const branchId = currentBranch?.id || user.branchId || "";
    try {
      if (editingSalaryId) {
        // A salary already marked "paid" is a reconciled record — the
        // backend now rejects changing its amount/paidDate while it stays
        // paid. Only send those fields when they're actually changing (a
        // fresh amount, or a genuine transition into "paid" for the first
        // time), so editing e.g. just the notes on an already-paid salary
        // doesn't get rejected for silently re-sending the old amount and
        // today's date as if they were new values.
        const wasAlreadyPaid = editingSalaryOriginal?.status === "paid";
        const newAmount = parseFloat(formData.amount);
        const amountChanged = !editingSalaryOriginal || newAmount !== editingSalaryOriginal.amount;
        const transitioningToPaid = formData.status === "paid" && !wasAlreadyPaid;
        await updateSalary(editingSalaryId, {
          ...(!wasAlreadyPaid || amountChanged ? { amount: newAmount } : {}),
          status: formData.status,
          paymentMethod: formData.paymentMethod,
          notes: formData.notes || undefined,
          ...(!wasAlreadyPaid || transitioningToPaid
            ? { paidDate: formData.status === "paid" ? new Date().toISOString() : undefined }
            : {}),
        });
        setEditingSalaryId(null);
        setEditingSalaryOriginal(null);
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
      notify.success(t("success"));
    } catch (error) {
      console.error("Failed to save salary:", error);
      notify.error(t("error"), error instanceof Error ? error.message : t("failedToSaveSalary"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await updateSalary(id, { status: "paid", paidDate: new Date().toISOString() });
      await loadData();
      notify.success(t("success"), "Salary marked as paid");
    } catch (error) {
      notify.error(t("error"), error instanceof Error ? error.message : undefined);
    }
  };

  const handleEdit = (salary: Salary) => {
    setEditingSalaryId(salary.id);
    setEditingSalaryOriginal(salary);
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
        notify.success(t("deleted"), t("salaryRecordDeleted"));
      } catch (error) {
        notify.error(t("error"), t("failedToDeleteSalary"));
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
      status: "paid",
      paymentMethod: "bank",
      notes: "",
    });
    setEditingSalaryId(null);
    setEditingSalaryOriginal(null);
    setFormErrors({});
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
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
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

  // Teachers who have no salary record for this month — their salary is still owed
  const unpaidTeacherIds = new Set(salaries.map((s) => s.teacherId));
  const unpaidTeacherTotal = teachers
    .filter((t) => !unpaidTeacherIds.has(t.id))
    .reduce((sum, t) => sum + (t.monthlySalary || 0), 0);

  // Pending = partial records + teachers with no record at all
  const totalPending =
    salaries.filter((s) => s.status === "partial").reduce((sum, s) => sum + s.amount, 0) +
    unpaidTeacherTotal;

  // Count of teachers not yet paid (for the subtitle)
  const unpaidTeacherCount = teachers.filter((t) => !unpaidTeacherIds.has(t.id)).length;

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
        <span className="text-slate-900 dark:text-slate-100 tabular-nums">
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
        <span className="text-sm text-slate-900 dark:text-slate-100">
          {salary.createdBy ? getUserName(salary.createdBy) : "-"}
        </span>
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
            className="bg-brand hover:bg-brand-hover"
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            disabled={!canCreateSalaries}
            title={!canCreateSalaries ? t("noPermission") : ""}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("recordSalaryPayment")}
          </Button>

          <FormDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            title={editingSalaryId ? t("edit") : t("recordSalaryPayment")}
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
                    if (formErrors.teacherId) setFormErrors((e) => ({ ...e, teacherId: undefined }));
                  }}
                >
                  <SelectTrigger className={formErrors.teacherId ? "border-red-500 focus:ring-red-500" : ""}>
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
                {formErrors.teacherId && (
                  <p className="text-xs text-red-500">{formErrors.teacherId}</p>
                )}
              </div>

              <Field
                id="amount"
                label={`${t("amount")} *`}
                type="text"
                value={formatNumberWithSpaces(formData.amount)}
                error={formErrors.amount}
                placeholder="0"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFormData({ ...formData, amount: removeNumberFormatting(e.target.value) });
                  if (formErrors.amount) setFormErrors((er) => ({ ...er, amount: undefined }));
                }}
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              {t("totalPaid")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-9 w-36 mb-1" /> : (
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalPaid)}</div>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("salariesPaidOut")}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {t("pendingLabel")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-9 w-36 mb-1" /> : (
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(totalPending)}</div>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {!isLoading && unpaidTeacherCount > 0
                ? `${unpaidTeacherCount} ${t("teachersNotPaid")}`
                : t("unpaidSalariesLabel")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {t("totalRecords")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-9 w-16 mb-1" /> : (
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{salaries.length}</div>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("salaryRecords")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and filter */}
      <FilterBar>
        <FilterSearch
          value={searchTerm}
          onChange={(v) => { setSearchTerm(v); setCurrentPage(1); }}
          placeholder={t("searchSalaries")}
        />
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}>
          <SelectTrigger className={filterSelectClass("w-40")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatus")}</SelectItem>
            <SelectItem value="paid">{t("paid")}</SelectItem>
            <SelectItem value="partial">{t("partialPaid")}</SelectItem>
          </SelectContent>
        </Select>
        <FilterReset onClick={() => { setSearchTerm(""); setFilterStatus("all"); setCurrentPage(1); }} show={searchTerm !== "" || filterStatus !== "all"} label={t("reset")} />
      </FilterBar>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paginatedSalaries}
            loading={isLoading}
            emptyIcon={Wallet}
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
                    <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
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
                  <p className="text-xs text-slate-400 dark:text-slate-500">{t("whoAddedSalaries")}: {getUserName(salary.createdBy)}</p>
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
                  {t("deleting")}
                </>
              ) : (
                t("delete")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
