import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { useQueryClient } from "@tanstack/react-query";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDialog } from "@/components/FormDialog";
import { Field } from "@/components/Field";
import {
  Payment,
  PaymentStatus,
  StudentPaymentMethod,
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
import {
  createPayment as apiCreatePayment,
  updatePayment as apiUpdatePayment,
  deletePayment as apiDeletePayment,
  searchStudentsWithPayments,
} from "@/lib/api";
import { Branch } from "@/types";
import { usePaymentsConsolidatedQuery, useBranchQuery, useClassesQuery } from "@/hooks/queries";
import { useBranch } from "@/context/BranchContext";
import MonthYearSelector from "@/components/MonthYearSelector";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { formatNumberWithSpaces, removeNumberFormatting, toTitleCase } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";
import { formatDateTimeInTashkent } from "@/lib/timezone";
import { searchMatchesCrossScript } from "@/lib/transliterate";
import { PageHeader } from "@/components/PageHeader";

export default function PaymentsPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const { currentBranch } = useBranch();
  const branchId = currentBranch?.id || null;
  const qc = useQueryClient();

  // Derived payment list state (populated from query result via useEffect)
  const [payments, setPayments] = useState<Payment[]>([]);
  const [originalPayments, setOriginalPayments] = useState<Payment[]>([]);
  const [consolidatedPaymentMap, setConsolidatedPaymentMap] = useState<
    Map<string, string[]>
  >(new Map());
  const [students, setStudents] = useState<Student[]>([]);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    studentId: "",
    amount: "",
    month: getDefaultMonth(),
    year: getDefaultYear().toString(),
    status: "partial" as PaymentStatus,
    paymentMethod: "cash" as StudentPaymentMethod,
    notes: "",
  });
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<{
    paidTotal: number;
    remaining: number;
    status: "paid" | "partial" | "none";
  } | null>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [filteredStudentsForModal, setFilteredStudentsForModal] = useState<
    Array<{
      id: string;
      fullName: string;
      phone: string;
      classId: string;
      className: string;
      monthlyPayment: number;
      paidAmount: number;
      status: "paid" | "partial" | "none";
      branchId: string;
    }>
  >([]);
  const [selectedStudentInfo, setSelectedStudentInfo] = useState<{
    id: string;
    fullName: string;
    phone: string;
    classId: string;
    className: string;
    monthlyPayment: number;
  } | null>(null);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
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

  const [formSubmitted, setFormSubmitted] = useState(false);

  const language = useLanguage();
  const { toast } = useToast();
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

  const isMonthVisible = (month: string, year: number): boolean => {
    // The backend API handles filtering of archived months per branch
    // So we allow all months here and let the backend handle visibility
    return true;
  };

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
    setTotalPages(Math.ceil((paymentsQueryData?.total || 0) / itemsPerPage));
    setOriginalPayments(paymentsList);
    setPayments(paymentsList);
    setIndicators(paymentIndicators);
    setClasses(classesList);
    setConsolidatedPaymentMap(new Map());
    setStudents([]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setIsSubmitting(true);
    const user = getCurrentUser();
    if (!user) {
      setIsSubmitting(false);
      return;
    }

    const invoiceNumber = `INV-${Date.now()}`;

    const monthlyPaymentValue = (() => {
      // Use selectedStudentInfo which is set when a student is selected
      if (selectedStudentInfo && selectedStudentInfo.id === formData.studentId) {
        return selectedStudentInfo.monthlyPayment || 0;
      }
      // Fallback to searching in filteredStudentsForModal
      const student = filteredStudentsForModal.find(
        (s) => s.id === formData.studentId,
      );
      return student?.monthlyPayment || 0;
    })();

    const newAmount = parseFloat(formData.amount);

    if (editingPaymentId) {
      // Update existing payment
      const existingPayment = payments.find((p) => p.id === editingPaymentId);
      if (existingPayment) {
        const targetMonth = formData.month;
        const targetYear = parseInt(formData.year);

        // Calculate total excluding this payment to check if new amount exceeds remaining
        const paidTotalExcludingCurrent = payments
          .filter(
            (p) =>
              p.studentId === formData.studentId &&
              p.month === targetMonth &&
              p.year === targetYear &&
              p.id !== editingPaymentId,
          )
          .reduce((sum, p) => sum + p.amount, 0);

        // Allow if: existing other payments + new amount <= monthly payment
        if (paidTotalExcludingCurrent + newAmount > monthlyPaymentValue) {
          toast({
            title: t("error"),
            description: `Amount exceeds remaining balance. Remaining: ${formatCurrency(
              monthlyPaymentValue - paidTotalExcludingCurrent,
            )}`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Update via backend API
      try {
        await apiUpdatePayment(editingPaymentId, {
          amount: newAmount,
          status: formData.status as PaymentStatus,
          paymentMethod: formData.paymentMethod,
          notes: formData.notes || undefined,
          paidDate: new Date().toISOString(), // Set paidDate for both "paid" and "partial"
        });
        setEditingPaymentId(null);

        toast({
          title: t("paymentUpdated") || "Payment Updated",
          description:
            t("paymentUpdatedDescription") ||
            "Payment has been updated successfully",
          variant: "default",
        });
      } catch (error) {
        console.error("Failed to update payment:", error);
        toast({
          title: t("error"),
          description: t("failedToUpdatePayment"),
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
    } else {
      // Create new payment
      // Use backend payments instead of localStorage
      const periodPaidTotal = payments
        .filter(
          (p) =>
            p.studentId === formData.studentId &&
            p.month === formData.month &&
            p.year === parseInt(formData.year),
        )
        .reduce((sum, p) => sum + p.amount, 0);

      // Allow if: existing payments + new amount <= monthly payment
      if (periodPaidTotal + newAmount > monthlyPaymentValue) {
        toast({
          title: t("error"),
          description: `Amount exceeds remaining balance. Remaining: ${formatCurrency(
            monthlyPaymentValue - periodPaidTotal,
          )}`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Determine final status: if total will equal monthly payment, mark as "paid"
      const totalAfterPayment = periodPaidTotal + newAmount;
      const finalStatus =
        totalAfterPayment >= monthlyPaymentValue ? "paid" : "partial";

      // Create via backend API
      try {
        const student = filteredStudentsForModal.find(
          (s) => s.id === formData.studentId,
        );

        // Create the new payment
        await apiCreatePayment({
          studentId: formData.studentId,
          amount: newAmount,
          month: formData.month,
          year: parseInt(formData.year),
          status: finalStatus as PaymentStatus,
          paymentMethod: formData.paymentMethod,
          invoiceNumber,
          notes: formData.notes || undefined,
          paidDate: new Date().toISOString(), // Set paidDate for both "paid" and "partial"
          branchId: student?.branchId || branchId || user.branchId || "",
        });

        // If this payment completes the month, update all related partial payments to "paid"
        if (finalStatus === "paid") {
          const relatedPartialPayments = payments.filter(
            (p) =>
              p.studentId === formData.studentId &&
              p.month === formData.month &&
              p.year === parseInt(formData.year) &&
              p.status === "partial",
          );

          // Update all partial payments to paid
          for (const payment of relatedPartialPayments) {
            try {
              await apiUpdatePayment(payment.id, { status: "paid" });
            } catch (error) {
              console.error(`Failed to update payment ${payment.id}:`, error);
            }
          }
        }

        toast({
          title: t("paymentCreated") || "Payment Created",
          description:
            t("paymentCreatedDescription") ||
            "Payment has been created successfully",
          variant: "default",
        });
      } catch (error) {
        console.error("Failed to create payment:", error);
        toast({
          title: t("error"),
          description: "Failed to create payment",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
    }

    resetForm();
    setEditingPaymentId(null);
    qc.invalidateQueries({ queryKey: ["payments"] });
    setIsDialogOpen(false);
    setIsSubmitting(false);
  };

  const handleEdit = (payment: Payment) => {
    // Check if this is a consolidated payment using the map
    const consolidatedIds = consolidatedPaymentMap.get(payment.id);

    if (consolidatedIds && consolidatedIds.length > 0) {
      // For consolidated payments, edit the first individual partial payment
      const paymentToEdit = originalPayments.find(
        (p) => p.id === consolidatedIds[0],
      );

      if (paymentToEdit) {
        setEditingPaymentId(paymentToEdit.id);
        setFormData({
          studentId: paymentToEdit.studentId,
          amount: paymentToEdit.amount.toString(),
          month: paymentToEdit.month,
          year: paymentToEdit.year.toString(),
          status: paymentToEdit.status,
          paymentMethod: paymentToEdit.paymentMethod,
          notes: paymentToEdit.notes || "",
        });
        setIsDialogOpen(true);
        return;
      }
    }

    // For non-consolidated payments, use the payment directly or find its original
    const originalPayment =
      originalPayments.find((p) => p.id === payment.id) || payment;

    setEditingPaymentId(originalPayment.id);
    setFormData({
      studentId: originalPayment.studentId,
      amount: originalPayment.amount.toString(),
      month: originalPayment.month,
      year: originalPayment.year.toString(),
      status: originalPayment.status,
      paymentMethod: originalPayment.paymentMethod,
      notes: originalPayment.notes || "",
    });
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
      toast({ title: t("paymentDeleted"), variant: "success" });
    } catch (error) {
      console.error("Failed to delete payment:", error);

      // Check if payment still exists in state
      const paymentExists = payments.some((p) => p.id === id);
      if (!paymentExists) {
        toast({
          title: t("info"),
          description: "Payment was already removed",
          variant: "default",
        });
        qc.invalidateQueries({ queryKey: ["payments"] });
      } else {
        toast({
          title: t("error"),
          description: "Failed to delete payment",
          variant: "destructive",
        });
      }
    } finally {
      setProcessingPaymentId(null);
      setDeleteConfirmDialog({ isOpen: false, paymentId: null });
    }
  };

  const resetForm = () => {
    // Use branch's current financial month, fallback to current date
    const defaultMonth =
      branchData?.currentFinancialMonth?.month?.toString().padStart(2, "0") ||
      getDefaultMonth();
    const defaultYear =
      branchData?.currentFinancialMonth?.year?.toString() ||
      getDefaultYear().toString();

    setFormData({
      studentId: "",
      amount: "",
      month: defaultMonth,
      year: defaultYear,
      status: "partial",
      paymentMethod: "cash",
      notes: "",
    });
    setSelectedStudentInfo(null);
    setStudentSearchTerm("");
    setPaymentSummary(null);
    setFormSubmitted(false);
  };

  const recomputePaymentStatus = (
    studentId: string,
    month: string,
    year: number,
  ) => {
    // This function is kept for compatibility but no longer modifies individual payment statuses
    // Each payment record maintains its own status based on what was recorded
    // Aggregated status is calculated on-the-fly for display purposes in student pages
    return;
  };

  // Close student dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-student-search-container]")) {
        setShowStudentDropdown(false);
      }
    };

    if (showStudentDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showStudentDropdown]);

  useEffect(() => {
    // recompute payment summary when student / month / year changes in modal
    // Only update when modal is open (check by formData.studentId)
    const { studentId, month, year } = formData;
    if (!studentId || !month) {
      setPaymentSummary(null);
      return;
    }

    // Get student info from selected info first, then search results
    let monthly = 0;
    if (selectedStudentInfo?.id === studentId) {
      monthly = selectedStudentInfo.monthlyPayment;
    } else {
      const student = filteredStudentsForModal.find((s) => s.id === studentId);
      monthly = student?.monthlyPayment || 0;
    }

    // Use backend payments instead of localStorage
    // When editing, exclude the current payment from the total so remaining is calculated correctly
    const paidTotal = payments
      .filter(
        (p) =>
          p.studentId === studentId &&
          p.month === month &&
          p.year === parseInt(year) &&
          p.id !== editingPaymentId, // Exclude the payment being edited
      )
      .reduce((sum, p) => sum + p.amount, 0);

    // When editing, don't override the amount - keep the original payment amount
    if (editingPaymentId) {
      // Just update the summary for display, don't change form amount
      const remaining = parseFloat((monthly - paidTotal).toFixed(2));
      if (paidTotal >= monthly) {
        setPaymentSummary({ paidTotal, remaining: 0, status: "paid" });
      } else if (paidTotal > 0) {
        setPaymentSummary({ paidTotal, remaining, status: "partial" });
      } else {
        setPaymentSummary({ paidTotal: 0, remaining: monthly, status: "none" });
      }
      return;
    }

    // For new payments, auto-fill amount as before
    // Always use "partial" status for individual payments - the overall status is calculated separately
    if (paidTotal >= monthly) {
      setPaymentSummary({ paidTotal, remaining: 0, status: "paid" });
      setFormData((prev) => ({
        ...prev,
        amount: monthly.toString(),
        status: "partial",
      }));
    } else if (paidTotal > 0) {
      const remaining = parseFloat((monthly - paidTotal).toFixed(2));
      setPaymentSummary({ paidTotal, remaining, status: "partial" });
      setFormData((prev) => ({
        ...prev,
        amount: remaining.toString(),
        status: "partial",
      }));
    } else {
      setPaymentSummary({ paidTotal: 0, remaining: monthly, status: "none" });
      setFormData((prev) => ({
        ...prev,
        amount: monthly.toString(),
        status: "partial",
      }));
    }
    // Only depend on modal form data and selected student info, not all payments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.studentId, formData.month, formData.year, selectedStudentInfo, editingPaymentId]);

  const getStudentName = (studentId: string) => {
    // First check selected student from modal
    if (selectedStudentInfo?.id === studentId) {
      return selectedStudentInfo.fullName;
    }

    // Then try consolidated data (loaded with payments)
    const studentInfo = studentInfoMap.get(studentId);
    if (studentInfo?.fullName) return studentInfo.fullName;

    // Fall back to filtered students from search
    const student = filteredStudentsForModal.find((s) => s.id === studentId);
    if (student?.fullName) return student.fullName;

    // If student not found, return Unknown
    return "Unknown";
  };

  const getClassName = (studentId: string) => {
    // First check selected student from modal
    if (selectedStudentInfo?.id === studentId) {
      return selectedStudentInfo.className;
    }

    // Then try consolidated data (loaded with payments)
    const studentInfo = studentInfoMap.get(studentId);
    if (studentInfo?.className) return studentInfo.className;

    // Fall back to filtered students from search
    const student = filteredStudentsForModal.find((s) => s.id === studentId);
    if (student?.className) return student.className;

    // If not found, return N/A
    return "N/A";
  };

  const getFilteredStudentsForPayment = () => {
    // Return the filtered students from search endpoint, default to empty array
    return filteredStudentsForModal || [];
  };

  // Handle student search in payment modal
  useEffect(() => {
    const handleStudentSearch = async () => {
      const selectedBranchId = branchId;
      if (!selectedBranchId || !studentSearchTerm.trim()) {
        setFilteredStudentsForModal([]);
        return;
      }

      setIsSearchingStudents(true);
      try {
        const results = await searchStudentsWithPayments(
          selectedBranchId,
          studentSearchTerm,
          formData.month,
          formData.year,
        );
        setFilteredStudentsForModal(results || []);
      } catch (error) {
        console.error("Failed to search students:", error);
        setFilteredStudentsForModal([]);
      } finally {
        setIsSearchingStudents(false);
      }
    };

    const timer = setTimeout(() => {
      handleStudentSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [studentSearchTerm, formData.month, formData.year]);

  // Update payment summary when month/year changes while a student is selected in the modal
  useEffect(() => {
    // Only run when modal is open and a student is selected
    if (!isDialogOpen || !formData.studentId || !selectedStudentInfo) return;

    const handleMonthChange = async () => {
      const selectedBranchId = branchId;
      if (!selectedBranchId) return;

      try {
        const results = await searchStudentsWithPayments(
          selectedBranchId,
          selectedStudentInfo.fullName,
          formData.month,
          formData.year,
        );

        const studentData = results.find((s) => s.id === formData.studentId);
        if (studentData) {
          const monthly = studentData.monthlyPayment || 0;
          const paidTotal = studentData.paidAmount || 0;

          if (paidTotal >= monthly) {
            setPaymentSummary({
              paidTotal,
              remaining: 0,
              status: "paid",
            });
          } else if (paidTotal > 0) {
            const remaining = parseFloat((monthly - paidTotal).toFixed(2));
            setPaymentSummary({
              paidTotal,
              remaining,
              status: "partial",
            });
          } else {
            setPaymentSummary({
              paidTotal: 0,
              remaining: monthly,
              status: "none",
            });
          }
        }
      } catch (error) {
        console.error("Failed to update payment summary:", error);
      }
    };

    const timer = setTimeout(() => {
      handleMonthChange();
    }, 300); // Add debounce to prevent excessive API calls

    return () => clearTimeout(timer);
  }, [
    isDialogOpen,
    formData.month,
    formData.year,
    formData.studentId,
    selectedStudentInfo,
  ]);

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
    const student = filteredStudentsForModal.find(
      (s) => s.id === payment.studentId,
    );
    if (!student) return payment.status;

    // If payment amount >= monthly payment, it's fully paid
    if (payment.amount >= student.monthlyPayment) {
      return "paid";
    }
    // If payment amount < monthly payment, it's partial
    return "partial";
  };

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "partial":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "";
    }
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
        const name = getStudentName(p.studentId);
        return (
          <div className="flex items-center gap-3">
            <InitialsAvatar name={name} size="md" />
            <div className="min-w-0">
              <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                {toTitleCase(name)}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{getClassName(p.studentId)}</p>
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
                  fullName: studentInfo?.fullName || getStudentName(p.studentId),
                  phone: studentInfo?.phone || "",
                  classId: studentInfo?.classId || "",
                  monthlyPayment: studentInfo?.monthlyPayment || 0,
                  branchId: selectedBranchId,
                  status: "active",
                  parentPhone: "",
                  enrollmentDate: undefined,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
                className: studentInfo?.className || getClassName(p.studentId),
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
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
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

          <FormDialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setStudentSearchTerm("");
                setShowStudentDropdown(false);
                setEditingPaymentId(null);
                resetForm();
              }
            }}
            title={t("recordNewPayment")}
            onSubmit={handleSubmit}
            submitLabel={t("recordPayment")}
            submittingLabel={t("recording")}
            isPending={isSubmitting}
            maxWidth="max-w-2xl"
          >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="studentSearch">{t("student")} *</Label>
                    <div className="relative" data-student-search-container>
                      <div className="relative">
                        <Input
                          id="studentSearch"
                          type="text"
                          placeholder={
                            t("searchStudent") ||
                            "Search student name, class, or phone..."
                          }
                          value={studentSearchTerm}
                          onChange={(e) => {
                            const value = e.target.value;
                            setStudentSearchTerm(value);
                            setShowStudentDropdown(true);
                            // Clear student selection if user manually clears the field
                            if (value === "" && formData.studentId) {
                              setFormData({
                                ...formData,
                                studentId: "",
                                amount: "",
                              });
                              setPaymentSummary(null);
                            }
                          }}
                          onFocus={() => setShowStudentDropdown(true)}
                          className="w-full pr-10"
                        />
                        {formData.studentId && !studentSearchTerm && (
                          <div className="absolute inset-0 flex items-center px-3 pointer-events-none bg-slate-50 dark:bg-slate-900/50 rounded-md">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {getStudentName(formData.studentId)} -{" "}
                              {getClassName(formData.studentId)}
                            </span>
                          </div>
                        )}
                        {(studentSearchTerm || formData.studentId) && (
                          <button
                            type="button"
                            onClick={() => {
                              setStudentSearchTerm("");
                              setSelectedStudentInfo(null);
                              setFormData({
                                ...formData,
                                studentId: "",
                                amount: "",
                              });
                              setPaymentSummary(null);
                              setShowStudentDropdown(false);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                            title={t("clear") || "Clear selection"}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                      {showStudentDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                          {isSearchingStudents ? (
                            <div className="px-3 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  {t("searching") || "Searching..."}
                                </span>
                              </div>
                            </div>
                          ) : getFilteredStudentsForPayment().length > 0 ? (
                            getFilteredStudentsForPayment().map((student) => (
                              <button
                                key={student.id}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-b-0 flex justify-between items-center"
                                onClick={() => {
                                  const monthly = student.monthlyPayment || 0;
                                  const paidTotal = student.paidAmount || 0;

                                  // Store selected student info for later retrieval
                                  setSelectedStudentInfo({
                                    id: student.id,
                                    fullName: student.fullName,
                                    phone: student.phone,
                                    classId: student.classId,
                                    className: student.className,
                                    monthlyPayment: student.monthlyPayment,
                                  });

                                  setFormData({
                                    ...formData,
                                    studentId: student.id,
                                    amount: monthly.toString(),
                                  });
                                  setStudentSearchTerm("");
                                  setShowStudentDropdown(false);

                                  // Use payment info from search response
                                  if (paidTotal >= monthly) {
                                    setPaymentSummary({
                                      paidTotal,
                                      remaining: 0,
                                      status: "paid",
                                    });
                                    setFormData((prev) => ({
                                      ...prev,
                                      amount: monthly.toString(),
                                      status: "paid",
                                    }));
                                  } else if (paidTotal > 0) {
                                    const remaining = parseFloat(
                                      (monthly - paidTotal).toFixed(2),
                                    );
                                    setPaymentSummary({
                                      paidTotal,
                                      remaining,
                                      status: "partial",
                                    });
                                    setFormData((prev) => ({
                                      ...prev,
                                      amount: remaining.toString(),
                                      status: "partial",
                                    }));
                                  } else {
                                    setPaymentSummary({
                                      paidTotal: 0,
                                      remaining: monthly,
                                      status: "none",
                                    });
                                    setFormData((prev) => ({
                                      ...prev,
                                      amount: monthly.toString(),
                                      status: "partial",
                                    }));
                                  }
                                }}
                              >
                                <div>
                                  <div className="font-medium text-sm">
                                    {student.fullName}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {student.className} • {student.phone}
                                    {student.paidAmount > 0 && (
                                      <span className="ml-2 text-xs">
                                        ({t(student.status) || student.status}:{" "}
                                        {formatCurrency(student.paidAmount)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : studentSearchTerm ? (
                            <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                              {t("noStudentsFound") || "No students found"}
                            </div>
                          ) : (
                            <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                              {t("typeToSearch") ||
                                "Type to search for a student"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {formSubmitted && !formData.studentId && (
                      <p className="text-red-500 text-sm mt-1">
                        {t("studentRequired") || "Student is required"}
                      </p>
                    )}
                  </div>

                  {/* Payment summary for selected student / period */}
                  {formData.studentId && formData.month && paymentSummary && (
                    <div className="md:col-span-2 p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
                      {paymentSummary.status === "paid" && (
                        <p className="text-sm text-green-700 dark:text-green-300">
                          {t("alreadyPaid")}
                        </p>
                      )}

                      {paymentSummary.status === "partial" && (
                        <p className="text-sm text-orange-700 dark:text-orange-300">
                          {t("partialPaid")}:{" "}
                          {formatCurrency(paymentSummary.paidTotal)} •{" "}
                          {t("remainingAmount")}:{" "}
                          {formatCurrency(paymentSummary.remaining)}
                        </p>
                      )}

                      {paymentSummary.status === "none" && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {t("noPaymentsYet")}
                        </p>
                      )}
                    </div>
                  )}

                  <Field
                    id="amount"
                    label={`${t("amount")} *`}
                    type="text"
                    value={formatNumberWithSpaces(formData.amount)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({
                        ...formData,
                        amount: removeNumberFormatting(e.target.value),
                      })
                    }
                    placeholder="0"
                  />

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
                        <SelectItem value="partial">{t("partial")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">
                      {t("paymentMethod")} *
                    </Label>
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(value: StudentPaymentMethod) =>
                        setFormData({ ...formData, paymentMethod: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="click">{t("click")}</SelectItem>
                        <SelectItem value="cash">{t("cash")}</SelectItem>
                        <SelectItem value="terminal">{t("terminal")}</SelectItem>
                        <SelectItem value="bank">
                          {t("bankTransfer")}
                        </SelectItem>
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

                  <Field
                    id="year"
                    label={`${t("year")} *`}
                    type="number"
                    value={formData.year}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, year: e.target.value })
                    }
                  />

                  <Field
                    id="notes"
                    as="textarea"
                    label={t("notes")}
                    value={formData.notes}
                    className="md:col-span-2"
                    placeholder={t("additionalNotes")}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
                </div>
          </FormDialog>
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
                      {toTitleCase(getStudentName(p.studentId))}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {getClassName(p.studentId)} · {getMonthName(p.month)} {p.year}
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
                        setPosPreviewData({ payment: p, student: { id: p.studentId, fullName: studentInfo?.fullName || getStudentName(p.studentId), phone: studentInfo?.phone || "", classId: studentInfo?.classId || "", monthlyPayment: studentInfo?.monthlyPayment || 0, branchId: selectedBranchId, status: "active", parentPhone: "", enrollmentDate: undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, className: studentInfo?.className || getClassName(p.studentId) });
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
