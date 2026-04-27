import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Payment,
  PaymentStatus,
  Student,
  Class,
} from "@/types";
import {
  Plus,
  Search,
  AlertCircle,
  CheckCircle,
  CreditCard,
  Banknote,
  Building2,
  Printer,
  Trash2,
  Edit2,
  Loader2,
  DollarSign,
} from "lucide-react";
import { DataTable, Column } from "@/components/DataTable";
import { PaymentStatusBadge } from "@/components/PaymentStatusBadge";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { StatCard } from "@/components/StatCard";
import { PosReceiptDialog } from "@/components/PosReceiptDialog";
import { BulkPaymentDialog } from "@/components/BulkPaymentDialog";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { deletePayment as apiDeletePayment } from "@/lib/api";
import { PaymentFormDialog } from "@/components/PaymentFormDialog";
import { usePaymentsConsolidatedQuery, useBranchQuery, useClassesQuery } from "@/hooks/queries";
import { useBranch } from "@/context/BranchContext";
import MonthYearSelector from "@/components/MonthYearSelector";
import { useNotify } from "@/hooks/use-notify";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { toTitleCase } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

export default function PaymentsPage() {
  const router = useRouter();
  const { currentBranch } = useBranch();
  const branchId = currentBranch?.id || null;
  const qc = useQueryClient();

  // Derived payment list state (populated from query result via useEffect)
  const [payments, setPayments] = useState<Payment[]>([]);
  const [originalPayments, setOriginalPayments] = useState<Payment[]>([]);
  const [consolidatedPaymentMap, setConsolidatedPaymentMap] = useState<
    Map<string, string[]>
  >(new Map());
  const [studentInfoMap, setStudentInfoMap] = useState<
    Map<
      string,
      {
        fullName: string;
        phone: string;
        classId: string;
        className: string;
        monthlyPayment: number;
      }
    >
  >(new Map());
  const [classes, setClasses] = useState<Class[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");
  const [filterClassId, setFilterClassId] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const getDefaultMonth = () => {
    const month = new Date().getMonth() + 1;
    return month.toString().padStart(2, "0");
  };

  const getDefaultYear = () => {
    return new Date().getFullYear();
  };

  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPayments, setTotalPayments] = useState(0);

  const [posPreviewData, setPosPreviewData] = useState<{
    payment: Payment;
    student: Student;
    className: string;
  } | null>(null);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(
    null,
  );
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    isOpen: boolean;
    paymentId: string | null;
  }>({
    isOpen: false,
    paymentId: null,
  });
  const [indicators, setIndicators] = useState<{
    totalPaid?: number;
    totalUnpaid?: number;
    totalPartial?: number;
    byMethod?: {
      click: number;
      cash: number;
      bank: number;
      terminal: number;
    };
  } | null>(null);

  const language = useLanguage();
  const notify = useNotify();
  const t = (key: string) => getTranslation(key, language);

  // Get permissions once per component lifecycle
  const currentUser = useMemo(() => getCurrentUser(), []);
  const canCreatePayments = useMemo(
    () => hasPermission("canCreatePayments"),
    [],
  );
  const canEditPayments = useMemo(() => hasPermission("canEditPayments"), []);
  const canDeletePayments = useMemo(() => hasPermission("canDeletePayments"), []);
  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "branch_admin";

  // ── React Query data fetching ──────────────────────────────────────────

  const { data: branchData } = useBranchQuery(branchId);
  const { data: classesFromQuery } = useClassesQuery(branchId);

  // Initialize selectedMonth/Year from branch's financial month (once)
  const financialMonth = branchData?.currentFinancialMonth?.month
    ?.toString()
    .padStart(2, "0");
  const financialYear = branchData?.currentFinancialMonth?.year;

  useEffect(() => {
    if (financialMonth && financialYear && !selectedMonth) {
      setSelectedMonth(financialMonth);
      setSelectedYear(financialYear);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financialMonth, financialYear]);

  // Initialize state from URL params (React Query auto-fires when state changes)
  useEffect(() => {
    if (!router.isReady) return;
    const { page, limit, search, status, month, year, paymentMethod, classId } = router.query;
    if (page) setCurrentPage(parseInt(page as string) || 1);
    if (limit) setItemsPerPage(parseInt(limit as string) || 10);
    if (search) { setSearchTerm(search as string); setSearchInput(search as string); }
    if (status) setFilterStatus(status as string);
    if (paymentMethod) setFilterPaymentMethod(paymentMethod as string);
    if (classId) setFilterClassId(classId as string);
    if (month) setSelectedMonth(month as string);
    if (year) setSelectedYear(parseInt(year as string) || new Date().getFullYear());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // Sync URL params when filters/page change
  useEffect(() => {
    if (!router.isReady || !selectedMonth) return;
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
    if (filterClassId !== "all") params.set("classId", filterClassId);
    params.set("month", selectedMonth);
    params.set("year", selectedYear.toString());
    params.set("page", currentPage.toString());
    params.set("limit", itemsPerPage.toString());
    router.push(`/payments?${params.toString()}`, undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterStatus, filterPaymentMethod, filterClassId, currentPage, itemsPerPage, selectedMonth, selectedYear]);

  const queryFilters = useMemo(() => ({
    search: searchTerm || undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
    paymentMethod: filterPaymentMethod !== "all" ? filterPaymentMethod : undefined,
    classId: filterClassId !== "all" ? filterClassId : undefined,
    month: selectedMonth || undefined,
    year: selectedYear ? selectedYear.toString() : undefined,
  }), [searchTerm, filterStatus, filterPaymentMethod, filterClassId, selectedMonth, selectedYear]);

  const {
    data: paymentsQueryData,
    isLoading,
  } = usePaymentsConsolidatedQuery(branchId, currentPage, itemsPerPage, queryFilters, {
    enabled: !!branchId && !!selectedMonth,
    refetchOnWindowFocus: true,
  });

  // Process query response into component state
  useEffect(() => {
    if (!paymentsQueryData) return;
    const paymentsList = paymentsQueryData?.items || paymentsQueryData?.data || [];
    const studentsList = paymentsQueryData?.students || [];
    const classesList = classesFromQuery?.length
      ? classesFromQuery
      : paymentsQueryData?.classes || [];
    const paymentIndicators = paymentsQueryData?.indicators || null;

    setTotalPayments(paymentsQueryData?.total || 0);
    setOriginalPayments(paymentsList);
    setPayments(paymentsList);
    setIndicators(paymentIndicators);
    setClasses(classesList);
    setConsolidatedPaymentMap(new Map());

    const studentMap = new Map<string, { fullName: string; phone: string; classId: string; className: string; monthlyPayment: number }>();
    studentsList.forEach((s: any) => {
      studentMap.set(s.id, { fullName: s.fullName, phone: s.phone, classId: s.classId, className: s.className, monthlyPayment: s.monthlyPayment });
    });
    setStudentInfoMap(studentMap);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsQueryData, classesFromQuery, itemsPerPage]);

  const handleMonthChange = (month: string, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    setCurrentPage(1);
  };

  const handleEdit = (payment: Payment) => {
    const consolidatedIds = consolidatedPaymentMap.get(payment.id);
    if (consolidatedIds && consolidatedIds.length > 0) {
      const paymentToEdit = originalPayments.find((p) => p.id === consolidatedIds[0]);
      if (paymentToEdit) {
        setEditPayment(paymentToEdit);
        setIsDialogOpen(true);
        return;
      }
    }
    const resolved = originalPayments.find((p) => p.id === payment.id) || payment;
    setEditPayment(resolved);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmDialog({
      isOpen: true,
      paymentId: id,
    });
  };

  const confirmDelete = async () => {
    const id = deleteConfirmDialog.paymentId;
    if (!id) return;

    // Prevent duplicate requests
    if (processingPaymentId === id) return;

    setProcessingPaymentId(id);
    try {
      await apiDeletePayment(id);
      qc.invalidateQueries({ queryKey: ["payments"] });
      notify.success(t("paymentDeleted"));
    } catch (error) {
      console.error("Failed to delete payment:", error);

      // Check if payment still exists in state
      const paymentExists = payments.some((p) => p.id === id);
      if (!paymentExists) {
        notify.warning(t("info"), "Payment was already removed");
        qc.invalidateQueries({ queryKey: ["payments"] });
      } else {
        notify.error(t("error"), "Failed to delete payment");
      }
    } finally {
      setProcessingPaymentId(null);
      setDeleteConfirmDialog({ isOpen: false, paymentId: null });
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    setSearchTerm(searchInput);
    // Update URL with search - always include month/year for consistency
    const params = new URLSearchParams();
    if (searchInput) params.set("search", searchInput);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
    if (filterClassId !== "all") params.set("classId", filterClassId);
    params.set("month", selectedMonth);
    params.set("year", selectedYear.toString());
    params.set("page", "1");
    params.set("limit", itemsPerPage.toString());
    router.push(`/payments?${params.toString()}`, undefined, { shallow: true });
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    // Mark filter change in progress to prevent duplicate API calls
    setSearchInput("");
    setCurrentPage(1);
    setSearchTerm("");
    // Update URL to clear search - always include month/year for consistency
    const params = new URLSearchParams();
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
    if (filterClassId !== "all") params.set("classId", filterClassId);
    params.set("month", selectedMonth);
    params.set("year", selectedYear.toString());
    params.set("page", "1");
    params.set("limit", itemsPerPage.toString());
    router.push(`/payments?${params.toString()}`, undefined, { shallow: true });
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "click":
      case "card":
        return <CreditCard className="w-3 h-3" />;
      case "cash":
        return <Banknote className="w-3 h-3" />;
      case "bank":
        return <Building2 className="w-3 h-3" />;
      case "terminal":
        return <Printer className="w-3 h-3" />;
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case "click":
      case "card":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "cash":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "bank":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "terminal":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    }
  };

  // Server-side search and filtering already applied via API
  // No client-side filtering needed
  const paginatedPayments = payments;

  // Calculate effective status based on actual payment amount vs monthly payment
  const getEffectivePaymentStatus = (payment: Payment): PaymentStatus => {
    const student = studentInfoMap.get(payment.studentId);
    if (!student) return payment.status;
    if (payment.amount >= student.monthlyPayment) return "paid";
    return "partial";
  };

  // Use API indicators if available, otherwise calculate from payments
  const totalIncome = indicators?.totalPaid || 0;
  const totalPending = indicators?.totalUnpaid || 0;
  const totalByMethod = {
    click: indicators?.byMethod?.click || 0,
    cash: indicators?.byMethod?.cash || 0,
    bank: indicators?.byMethod?.bank || 0,
    terminal: indicators?.byMethod?.terminal || 0,
  };

  const months = [
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "10",
    "11",
    "12",
  ];

  const getMonthName = (monthNumber: string) => {
    const monthNames = [
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
    ];
    const index = parseInt(monthNumber) - 1;
    return (
      t(monthNames[index] ? monthNames[index].toLowerCase() : "unknown") ||
      monthNames[index] ||
      "Unknown"
    );
  };

  const getPaymentStatusLabel = (status: string) => {
    const statusMap: { [key: string]: string } = {
      paid: "paid",
      unpaid: "unpaid",
      partial: "partial",
    };
    return t(statusMap[status] || status) || status;
  };

  const getPaymentMethodLabel = (method: string) => {
    const methodMap: { [key: string]: string } = {
      click: "click",
      card: "click",
      cash: "cash",
      bank: "bankTransfer",
      terminal: "terminal",
    };
    return t(methodMap[method] || method) || method;
  };

  // Show full page skeleton only on initial load
  // Column definitions for DataTable
  const paymentColumns: Column<Payment>[] = [
    {
      key: "invoice",
      header: t("invoice"),
      render: (p) => (
        <p className="font-mono text-sm text-slate-900 dark:text-slate-100">{p.invoiceNumber}</p>
      ),
    },
    {
      key: "student",
      header: t("student"),
      render: (p) => {
        const info = studentInfoMap.get(p.studentId);
        const name = info?.fullName ?? "Unknown";
        return (
          <div className="flex items-center gap-3">
            <InitialsAvatar name={name} size="md" />
            <div className="min-w-0">
              <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                {toTitleCase(name)}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{info?.className ?? "N/A"}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "period",
      header: t("period"),
      hideOnMobile: true,
      render: (p) => <span className="text-slate-900 dark:text-slate-100">{getMonthName(p.month)} {p.year}</span>,
    },
    {
      key: "amount",
      header: t("amount"),
      sortable: true,
      render: (p) => <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(p.amount)}</span>,
    },
    {
      key: "method",
      header: t("method"),
      hideOnMobile: true,
      render: (p) =>
        p.paymentMethod ? (
          <Badge className={`gap-1 ${getPaymentMethodColor(p.paymentMethod)}`}>
            {getPaymentMethodIcon(p.paymentMethod)}
            <span>{getPaymentMethodLabel(p.paymentMethod)}</span>
          </Badge>
        ) : null,
    },
    {
      key: "status",
      header: t("status"),
      render: (p) => (
        <PaymentStatusBadge
          status={getEffectivePaymentStatus(p)}
          label={getPaymentStatusLabel(getEffectivePaymentStatus(p))}
        />
      ),
    },
    {
      key: "paidDate",
      header: t("paidDate"),
      hideOnMobile: true,
      render: (p) =>
        p.paidDate
          ? new Date(p.paidDate)
              .toLocaleDateString("en-GB", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" })
              .replace(/\//g, ".")
          : "-",
    },
    {
      key: "createdBy",
      header: t("whoAddedPayment"),
      hideOnMobile: true,
      render: (p) => <span className="text-sm text-slate-900 dark:text-slate-100">{p.createdByName || "-"}</span>,
    },
    {
      key: "actions",
      header: t("actions"),
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm" variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              const studentInfo = studentInfoMap.get(p.studentId);
              const selectedBranchId = localStorage.getItem("selectedBranchId") || "";
              setPosPreviewData({
                payment: p,
                student: {
                  id: p.studentId,
                  fullName: studentInfo?.fullName ?? "Unknown",
                  phone: studentInfo?.phone ?? "",
                  classId: studentInfo?.classId ?? "",
                  monthlyPayment: studentInfo?.monthlyPayment ?? 0,
                  branchId: selectedBranchId,
                  status: "active",
                  parentPhone: "",
                  enrollmentDate: undefined,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
                className: studentInfo?.className ?? "N/A",
              });
            }}
            title={t("printReceipt")}
          >
            <Printer className="w-4 h-4" />
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={(e) => { e.stopPropagation(); handleEdit(p); }}
            disabled={!canEditPayments || processingPaymentId === p.id}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm" variant="destructive"
            onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
            disabled={!canDeletePayments || processingPaymentId === p.id}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title={t("payments")} subtitle={t("trackStudentFees")} />

        {/* Month Selector for Admin */}
        {isAdmin && branchData && selectedMonth && (
          <MonthYearSelector
            month={selectedMonth}
            year={selectedYear}
            onChange={handleMonthChange}
            currentBranchMonth={branchData.currentFinancialMonth?.month
              ?.toString()
              .padStart(2, "0")}
            currentBranchYear={branchData.currentFinancialMonth?.year}
          />
        )}

        <div className="flex items-center gap-2">
          <BulkPaymentDialog
            branchId={branchId}
            existingPayments={payments}
            defaultYear={selectedYear.toString()}
            months={months}
            t={t}
            getMonthName={getMonthName}
            onSuccess={() => qc.invalidateQueries({ queryKey: ["payments"] })}
          />

          <Button
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            onClick={() => { setEditPayment(null); setIsDialogOpen(true); }}
            disabled={!canCreatePayments}
            title={
              !canCreatePayments
                ? t("noPermission") || "No permission to create payments"
                : ""
            }
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("addPayment")}
          </Button>

          <PaymentFormDialog
            isOpen={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setEditPayment(null);
            }}
            editPayment={editPayment}
            branchId={branchId}
            existingPayments={payments}
            defaultMonth={
              branchData?.currentFinancialMonth?.month?.toString().padStart(2, "0") ||
              getDefaultMonth()
            }
            defaultYear={
              branchData?.currentFinancialMonth?.year?.toString() ||
              getDefaultYear().toString()
            }
            months={months}
            getMonthName={getMonthName}
            studentInfoMap={studentInfoMap}
            onSuccess={() => {}}
            t={t}
          />
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard
          icon={CheckCircle}
          tone="green"
          label={t("totalIncome")}
          value={formatCurrency(totalIncome)}
          hint={t("fromPaidFees")}
          loading={isLoading && !indicators}
        />
        <StatCard
          icon={AlertCircle}
          tone="orange"
          label={t("pendingPayments")}
          value={formatCurrency(totalPending)}
          hint={`${t("unpaidFees")} ${t("thisMonth")}`}
          loading={isLoading && !indicators}
        />
        <StatCard
          icon={CreditCard}
          tone="blue"
          label={t("click")}
          value={formatCurrency(totalByMethod.click)}
          loading={isLoading && !indicators}
        />
        <StatCard
          icon={Banknote}
          tone="indigo"
          label={t("cash")}
          value={formatCurrency(totalByMethod.cash)}
          loading={isLoading && !indicators}
        />
        <StatCard
          icon={Printer}
          tone="slate"
          label={t("terminal")}
          value={formatCurrency(totalByMethod.terminal)}
          loading={isLoading && !indicators}
        />
        <StatCard
          icon={Building2}
          tone="purple"
          label={t("bank")}
          value={formatCurrency(totalByMethod.bank)}
          loading={isLoading && !indicators}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="w-full">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder={t("searchPayments")}
                    value={searchInput}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchInput(value);
                      // Auto-clear search when input is empty
                      if (value === "" && searchTerm !== "") {
                        // Mark filter change in progress to prevent duplicate API calls
                        setCurrentPage(1);
                        setSearchTerm("");
                        qc.invalidateQueries({ queryKey: ["payments"] });;
                        // Update URL to clear search
                        const params = new URLSearchParams();
                        if (filterStatus !== "all") params.set("status", filterStatus);
                        if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
                        params.set("month", selectedMonth);
                        params.set("year", selectedYear.toString());
                        params.set("page", "1");
                        params.set("limit", itemsPerPage.toString());
                        router.push(`/payments?${params.toString()}`, undefined, { shallow: true });
                      }
                    }}
                    onKeyPress={handleSearchKeyPress}
                    className="pl-10 w-full"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleSearch}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  {t("search") || "Search"}
                </Button>
                {searchInput && (
                  <Button
                    onClick={handleClearSearch}
                    variant="outline"
                    size="sm"
                  >
                    {t("clear") || "Clear"}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Select
                  value={filterStatus}
                  onValueChange={(value) => {
                    // Mark filter change in progress to prevent duplicate API calls
                    setFilterStatus(value);
                    // Apply filter immediately when status changes
                    setCurrentPage(1);
                    qc.invalidateQueries({ queryKey: ["payments"] });;
                    const params = new URLSearchParams();
                    if (searchTerm) params.set("search", searchTerm);
                    if (value !== "all") params.set("status", value);
                    if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
                    params.set("month", selectedMonth);
                    params.set("year", selectedYear.toString());
                    params.set("page", "1");
                    params.set("limit", itemsPerPage.toString());
                    router.push(`/payments?${params.toString()}`, undefined, {
                      shallow: true,
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allStatus")}</SelectItem>
                    <SelectItem value="paid">{t("paid")}</SelectItem>
                    <SelectItem value="partial">{t("partial")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filterPaymentMethod}
                  onValueChange={(value) => {
                    // Mark filter change in progress to prevent duplicate API calls
                    setFilterPaymentMethod(value);
                    // Apply filter immediately when payment method changes
                    setCurrentPage(1);
                    qc.invalidateQueries({ queryKey: ["payments"] });;
                    const params = new URLSearchParams();
                    if (searchTerm) params.set("search", searchTerm);
                    if (filterStatus !== "all") params.set("status", filterStatus);
                    if (value !== "all") params.set("paymentMethod", value);
                    params.set("month", selectedMonth);
                    params.set("year", selectedYear.toString());
                    params.set("page", "1");
                    params.set("limit", itemsPerPage.toString());
                    router.push(`/payments?${params.toString()}`, undefined, {
                      shallow: true,
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allPaymentMethods")}</SelectItem>
                    <SelectItem value="cash">{t("cash")}</SelectItem>
                    <SelectItem value="click">{t("click")}</SelectItem>
                    <SelectItem value="bank">{t("bank")}</SelectItem>
                    <SelectItem value="terminal">{t("terminal")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filterClassId}
                  onValueChange={(value) => {
                    setFilterClassId(value);
                    setCurrentPage(1);
                    qc.invalidateQueries({ queryKey: ["payments"] });;
                    const params = new URLSearchParams();
                    if (searchTerm) params.set("search", searchTerm);
                    if (filterStatus !== "all") params.set("status", filterStatus);
                    if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
                    if (value !== "all") params.set("classId", value);
                    params.set("month", selectedMonth);
                    params.set("year", selectedYear.toString());
                    params.set("page", "1");
                    params.set("limit", itemsPerPage.toString());
                    router.push(`/payments?${params.toString()}`, undefined, {
                      shallow: true,
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("allClasses")} />
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
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(val) => {
                    const limit = parseInt(val);
                    setItemsPerPage(limit);
                    setCurrentPage(1);
                    // The useEffect for pagination changes will handle URL update and data load
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 {t("perPage")}</SelectItem>
                    <SelectItem value="20">20 {t("perPage")}</SelectItem>
                    <SelectItem value="50">50 {t("perPage")}</SelectItem>
                    <SelectItem value="100">100 {t("perPage")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={paymentColumns}
            data={paginatedPayments}
            loading={isLoading}
            emptyIcon={DollarSign}
            emptyTitle={t("noPaymentsFound")}
            pagination={{ page: currentPage, limit: itemsPerPage, total: totalPayments }}
            onPageChange={(p) => {
              setCurrentPage(p);
              const params = new URLSearchParams();
              if (searchTerm) params.set("search", searchTerm);
              if (filterStatus !== "all") params.set("status", filterStatus);
              if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
              params.set("month", selectedMonth);
              params.set("year", selectedYear.toString());
              params.set("page", p.toString());
              params.set("limit", itemsPerPage.toString());
              router.push(`/payments?${params.toString()}`, undefined, { shallow: true });
            }}
            onLimitChange={(l) => {
              setItemsPerPage(l);
              setCurrentPage(1);
            }}
            limitOptions={[10, 20, 50, 100]}
            renderCard={(p) => (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {toTitleCase(studentInfoMap.get(p.studentId)?.fullName ?? "Unknown")}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {studentInfoMap.get(p.studentId)?.className ?? "N/A"} · {getMonthName(p.month)} {p.year}
                    </p>
                    <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                      {p.invoiceNumber}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(p.amount)}
                    </span>
                    <PaymentStatusBadge
                      status={getEffectivePaymentStatus(p)}
                      label={getPaymentStatusLabel(getEffectivePaymentStatus(p))}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.paymentMethod && (
                      <Badge className={`gap-1 text-xs ${getPaymentMethodColor(p.paymentMethod)}`}>
                        {getPaymentMethodIcon(p.paymentMethod)}
                        <span>{getPaymentMethodLabel(p.paymentMethod)}</span>
                      </Badge>
                    )}
                    {p.paidDate && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(p.paidDate).toLocaleDateString("en-GB", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, ".")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => {
                        const studentInfo = studentInfoMap.get(p.studentId);
                        const selectedBranchId = localStorage.getItem("selectedBranchId") || "";
                        setPosPreviewData({ payment: p, student: { id: p.studentId, fullName: studentInfo?.fullName ?? "Unknown", phone: studentInfo?.phone ?? "", classId: studentInfo?.classId ?? "", monthlyPayment: studentInfo?.monthlyPayment ?? 0, branchId: selectedBranchId, status: "active", parentPhone: "", enrollmentDate: undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, className: studentInfo?.className ?? "N/A" });
                      }}><Printer className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => handleEdit(p)} disabled={!canEditPayments || processingPaymentId === p.id}>
                      <Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => handleDelete(p.id)} disabled={!canDeletePayments || processingPaymentId === p.id}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                </div>
                {p.createdByName && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {t("whoAddedPayment")}: {p.createdByName}
                  </p>
                )}
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* POS Terminal Receipt Preview Dialog */}
      <PosReceiptDialog
        data={posPreviewData}
        onClose={() => setPosPreviewData(null)}
        branchName={branchData?.name}
        t={t}
        formatMonth={(m) => getMonthName(String(m))}
        formatMethod={getPaymentMethodLabel}
        formatStatus={getPaymentStatusLabel}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmDialog({ isOpen: false, paymentId: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deletePayment")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400 py-4">
            {t("deletePaymentConfirmation")}
          </p>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDeleteConfirmDialog({ isOpen: false, paymentId: null })
              }
              disabled={processingPaymentId === deleteConfirmDialog.paymentId}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={processingPaymentId === deleteConfirmDialog.paymentId}
            >
              {processingPaymentId === deleteConfirmDialog.paymentId ? (
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
