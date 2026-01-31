import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { useRefetchOnFocus } from "@/hooks/use-refetch-on-focus";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  branchesDB,
} from "@/lib/storage";
import { Payment, PaymentStatus, PaymentMethod, Student, Class } from "@/types";
import {
  Plus,
  Search,
  AlertCircle,
  CheckCircle,
  UserPlus,
  CreditCard,
  Banknote,
  Building2,
  Printer,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import {
  createPayment as apiCreatePayment,
  updatePayment as apiUpdatePayment,
  deletePayment as apiDeletePayment,
  getBranch,
  getPaymentsConsolidatedData,
  searchStudentsWithPayments,
  listClasses,
} from "@/lib/api";
import { Branch } from "@/types";
import MonthYearSelector from "@/components/MonthYearSelector";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { formatNumberWithSpaces, removeNumberFormatting } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";
import { formatDateTimeInTashkent } from "@/lib/timezone";
import { searchMatchesCrossScript } from "@/lib/transliterate";

export default function PaymentsPage() {
  const router = useRouter();
  const { settings } = useSettings();
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
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkPaymentOpen, setIsBulkPaymentOpen] = useState(false);
  const [bulkSearchTerm, setBulkSearchTerm] = useState("");
  const [isBulkSearching, setIsBulkSearching] = useState(false);
  const [bulkStudentsList, setBulkStudentsList] = useState<
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branchData, setBranchData] = useState<Branch | null>(null);
  const getDefaultMonth = () => {
    const month = new Date().getMonth() + 1;
    return month.toString().padStart(2, "0");
  };

  const getDefaultYear = () => {
    return new Date().getFullYear();
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getDefaultMonth());
  const [selectedYear, setSelectedYear] = useState<number>(getDefaultYear());

  const [bulkPaymentData, setBulkPaymentData] = useState({
    month: getDefaultMonth(),
    year: getDefaultYear().toString(),
    paymentMethod: "cash" as PaymentMethod,
  });
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
    paymentMethod: "cash" as PaymentMethod,
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
  const [isLoading, setIsLoading] = useState(true);
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
    byMethod?: { card: number; cash: number; bank: number };
  } | null>(null);

  // Track if initial load has been done to prevent double-loading from filter effects
  const initialLoadDoneRef = useRef(false);
  // Track the current load request to prevent race conditions
  const currentLoadIdRef = useRef<number>(0);
  // Track if filter change is in progress to prevent duplicate API calls
  const filterChangeInProgressRef = useRef(false);

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
  const canDeletePayments = canEditPayments && currentUser?.role !== "manager";
  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "branch_admin";

  const isMonthVisible = (month: string, year: number): boolean => {
    // The backend API handles filtering of archived months per branch
    // So we allow all months here and let the backend handle visibility
    return true;
  };

  const waitForSelectedBranchId = async () => {
    let retries = 0;
    const maxRetries = 20;
    while (!localStorage.getItem("selectedBranchId") && retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }
    return localStorage.getItem("selectedBranchId");
  };

  const loadData = async (
    month?: string,
    year?: number,
    searchOverride?: string,
    statusOverride?: string,
    paymentMethodOverride?: string,
    classIdOverride?: string,
  ) => {
    try {
      // Generate a unique ID for this load request
      const loadId = ++currentLoadIdRef.current;

      setIsLoading(true);
      const user = getCurrentUser();
      if (!user) {
        setPayments([]);
        setStudents([]);
        setClasses([]);
        return;
      }

      const selectedBranchId = await waitForSelectedBranchId();
      if (selectedBranchId) {
        // Load branch data to get current month
        const branch = await getBranch(selectedBranchId);
        setBranchData(branch);

        // Use financial month data if available, otherwise fall back to current date
        const currentMonth =
          branch.currentFinancialMonth?.month?.toString().padStart(2, "0") ||
          String(new Date().getMonth() + 1).padStart(2, "0");
        const currentYear =
          branch.currentFinancialMonth?.year || new Date().getFullYear();

        // Set selected month to branch's current month if not already set
        if (!selectedMonth) {
          setSelectedMonth(currentMonth);
          setSelectedYear(currentYear);
        }

        // Always use passed parameters first, then state, then URL params, then branch defaults
        // This ensures explicit calls with parameters take priority
        const queryMonth =
          month ||
          selectedMonth ||
          (router.query.month as string) ||
          currentMonth;
        const queryYear =
          year ||
          selectedYear ||
          parseInt((router.query.year as string) || "") ||
          currentYear;

        // Use consolidated endpoint instead of multiple calls
        const filters: any = {};
        // Use override values first, then state, then URL params
        const searchValue =
          searchOverride !== undefined
            ? searchOverride
            : searchTerm || (router.query.search as string);
        const statusValue =
          statusOverride !== undefined
            ? statusOverride
            : filterStatus || (router.query.status as string) || "all";
        const paymentMethodValue =
          paymentMethodOverride !== undefined
            ? paymentMethodOverride
            : filterPaymentMethod || (router.query.paymentMethod as string) || "all";
        const classIdValue =
          classIdOverride !== undefined
            ? classIdOverride
            : filterClassId || (router.query.classId as string) || "all";

        if (searchValue) filters.search = searchValue;
        if (statusValue !== "all") filters.status = statusValue;
        if (paymentMethodValue !== "all")
          filters.paymentMethod = paymentMethodValue;
        if (classIdValue !== "all") filters.classId = classIdValue;
        filters.month = queryMonth;
        filters.year = queryYear.toString();

        const consolidated = await getPaymentsConsolidatedData(
          selectedBranchId,
          currentPage,
          itemsPerPage,
          filters,
        );

        // Only update state if this is still the latest request
        if (loadId !== currentLoadIdRef.current) {
          return;
        }

        // Handle response
        const paymentsList = consolidated?.items || consolidated?.data || [];
        let classesList = consolidated?.classes || [];
        if (!classesList || classesList.length === 0) {
          try {
            classesList = await listClasses(selectedBranchId);
          } catch (classError) {
            console.error("Failed to load classes:", classError);
            classesList = [];
          }
        }
        const studentsList = consolidated?.students || [];
        const paymentIndicators = consolidated?.indicators || {
          totalPaid: 0,
          totalUnpaid: 0,
          byMethod: { card: 0, cash: 0, bank: 0 },
        };

        setTotalPayments(consolidated?.total || 0);
        setTotalPages(Math.ceil((consolidated?.total || 0) / itemsPerPage));

        // Store original payments for editing
        setOriginalPayments(paymentsList);
        setIndicators(paymentIndicators);

        // Build student info map for quick lookup
        const studentMap = new Map<
          string,
          {
            fullName: string;
            phone: string;
            classId: string;
            className: string;
            monthlyPayment: number;
          }
        >();
        studentsList.forEach((student: any) => {
          studentMap.set(student.id, {
            fullName: student.fullName,
            phone: student.phone,
            classId: student.classId,
            className: student.className,
            monthlyPayment: student.monthlyPayment,
          });
        });
        setStudentInfoMap(studentMap);

        // Show all payments individually (no consolidation)
        // Each partial payment is displayed with its own amount, method, and date
        setPayments(paymentsList);
        setConsolidatedPaymentMap(new Map());
        setStudents([]);
        setClasses(classesList);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        title: t("error"),
        description: "Failed to load payments",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize state from URL params and load initial data (only on first router ready)
  useEffect(() => {
    if (!router.isReady) return;

    const { page, limit, search, status, month, year, paymentMethod, classId } = router.query;

    // Set state from URL params
    if (page) setCurrentPage(parseInt(page as string) || 1);
    if (limit) setItemsPerPage(parseInt(limit as string) || 10);
    if (search) {
      setSearchTerm(search as string);
      setSearchInput(search as string);
    }
    if (status) setFilterStatus(status as string);
    if (paymentMethod) setFilterPaymentMethod(paymentMethod as string);
    if (classId) setFilterClassId(classId as string);
    if (month) setSelectedMonth(month as string);
    if (year)
      setSelectedYear(parseInt(year as string) || new Date().getFullYear());

    // Load initial data once router is ready
    setIsLoading(true);
    loadData().finally(() => {
      setIsLoading(false);
      // Mark initial load as done AFTER data is loaded to prevent filter effects from running prematurely
      initialLoadDoneRef.current = true;
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // Reload data when branch changes
  useEffect(() => {
    const handleBranchChange = () => {
      setCurrentPage(1);
      setIsLoading(true);
      loadData().finally(() => setIsLoading(false));
    };
    window.addEventListener("branchChange", handleBranchChange);
    return () => window.removeEventListener("branchChange", handleBranchChange);
  }, []);

  // Load data when page or items per page changes (but not on initial load)
  useEffect(() => {
    // Skip if initial load hasn't completed yet
    if (!initialLoadDoneRef.current) return;
    
    // Skip if a filter change is in progress (filter handlers do their own loadData)
    if (filterChangeInProgressRef.current) {
      filterChangeInProgressRef.current = false;
      return;
    }
    
    setIsLoading(true);
    loadData(selectedMonth, selectedYear, searchTerm, filterStatus, filterPaymentMethod, filterClassId).finally(() => setIsLoading(false));
    
    // Update URL with current pagination
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
  }, [currentPage, itemsPerPage]);

  // Refetch data when page regains focus (preserves current filters)
  const refetchData = useCallback(() => {
    setIsLoading(true);
    loadData(selectedMonth, selectedYear, searchTerm, filterStatus, filterPaymentMethod, filterClassId).finally(() => setIsLoading(false));
  }, [searchTerm, filterStatus, filterPaymentMethod, filterClassId, selectedMonth, selectedYear, currentPage, itemsPerPage]);
  useRefetchOnFocus(refetchData);

  const handleMonthChange = (month: string, year: number) => {
    // Mark filter change in progress to prevent duplicate API calls
    filterChangeInProgressRef.current = true;
    setSelectedMonth(month);
    setSelectedYear(year);
    setCurrentPage(1); // Reset to first page when month changes
    setIsLoading(true);
    // Load data with new month/year
    loadData(month, year, searchTerm, filterStatus, filterPaymentMethod, filterClassId).finally(() =>
      setIsLoading(false),
    );
    // Update URL with new month/year
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (filterStatus !== "all") params.set("status", filterStatus);
    if (filterPaymentMethod !== "all")
      params.set("paymentMethod", filterPaymentMethod);
    params.set("month", month);
    params.set("year", year.toString());
    params.set("page", "1");
    params.set("limit", itemsPerPage.toString());
    router.push(`/payments?${params.toString()}`, undefined, { shallow: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          description: "Failed to update payment",
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
          branchId: student?.branchId || user.branchId || "",
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
    loadData(selectedMonth, selectedYear, searchTerm, filterStatus, filterPaymentMethod, filterClassId);
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
      await loadData(selectedMonth, selectedYear, searchTerm, filterStatus, filterPaymentMethod, filterClassId);
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
        await loadData(selectedMonth, selectedYear, searchTerm, filterStatus, filterPaymentMethod, filterClassId);
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

  const handleBulkPayment = async () => {
    if (selectedStudentIds.length === 0) return;
    const user = getCurrentUser();
    if (!user) return;
    const skipped: string[] = [];
    const created: string[] = [];

    // Use backend payments for checking
    for (const studentId of selectedStudentIds) {
      // Try to find student in bulkStudentsList
      const student = bulkStudentsList.find(
        (s) => s.id === studentId,
      );

      // If not found in bulk list, skip
      if (!student) {
        console.warn(`Student ${studentId} not found in bulk list`);
        continue;
      }

      const paidTotal = payments
        .filter(
          (p) =>
            p.studentId === studentId &&
            p.month === bulkPaymentData.month &&
            p.year === parseInt(bulkPaymentData.year),
        )
        .reduce((sum, p) => sum + p.amount, 0);

      const remaining = student.monthlyPayment - paidTotal;

      // Skip if already fully paid
      if (remaining <= 0) {
        skipped.push(studentId);
        continue;
      }

      const invoiceNumber = `INV-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      try {
        // Create payment for remaining amount
        await apiCreatePayment({
          studentId,
          amount: remaining, // Pay only the remaining amount
          month: bulkPaymentData.month,
          year: parseInt(bulkPaymentData.year),
          status: "paid",
          paymentMethod: bulkPaymentData.paymentMethod,
          invoiceNumber,
          paidDate: new Date().toISOString(),
          branchId: student.branchId,
        });
        created.push(studentId);
      } catch (error) {
        console.error(
          `Failed to create payment for student ${studentId}:`,
          error,
        );
        toast({
          title: t("error"),
          description: `Failed to create payment for ${student.fullName}`,
          variant: "destructive",
        });
      }
    }

    if (created.length > 0) {
      toast({
        title: t("success"),
        description: `Created ${created.length} payment(s)`,
        variant: "success",
      });
    }

    if (skipped.length > 0) {
      toast({
        title: t("info"),
        description: `${skipped.length} student(s) already fully paid`,
        variant: "default",
      });
    }

    loadData(selectedMonth, selectedYear, searchTerm, filterStatus, filterPaymentMethod, filterClassId);
    setIsBulkPaymentOpen(false);
    setSelectedStudentIds([]);
    setBulkSearchTerm("");
    setBulkStudentsList([]);
    setBulkPaymentData({
      month: "",
      year: getDefaultYear().toString(),
      paymentMethod: "cash",
    });
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId],
    );
  };

  const toggleSelectAll = () => {
    // Use bulk students list for bulk payment selection
    if (
      selectedStudentIds.length === bulkStudentsList.length &&
      bulkStudentsList.length > 0
    ) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(bulkStudentsList.map((s) => s.id));
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

  // Load students when bulk payment dialog opens or search term changes
  useEffect(() => {
    const loadBulkPaymentStudents = async () => {
      if (!isBulkPaymentOpen) return;

      const selectedBranchId = localStorage.getItem("selectedBranchId");
      if (!selectedBranchId) return;

      setIsBulkSearching(true);
      try {
        // Load students for the bulk payment dialog with search
        const results = await searchStudentsWithPayments(
          selectedBranchId,
          bulkSearchTerm, // Use search term
          bulkPaymentData.month,
          bulkPaymentData.year,
        );
        setBulkStudentsList(results || []);
      } catch (error) {
        console.error("Failed to load students for bulk payment:", error);
        setBulkStudentsList([]);
      } finally {
        setIsBulkSearching(false);
      }
    };

    // Debounce the search
    const timer = setTimeout(() => {
      loadBulkPaymentStudents();
    }, 300);

    return () => clearTimeout(timer);
  }, [isBulkPaymentOpen, bulkPaymentData.month, bulkPaymentData.year, bulkSearchTerm]);

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
      const selectedBranchId = localStorage.getItem("selectedBranchId");
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
      const selectedBranchId = localStorage.getItem("selectedBranchId");
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
    // Mark filter change in progress to prevent duplicate API calls
    filterChangeInProgressRef.current = true;
    setCurrentPage(1);
    setSearchTerm(searchInput);
    setIsLoading(true);
    // Load data immediately with new search term - pass all filter values
    loadData(selectedMonth, selectedYear, searchInput, filterStatus, filterPaymentMethod, filterClassId).finally(() =>
      setIsLoading(false),
    );
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
    filterChangeInProgressRef.current = true;
    setSearchInput("");
    setCurrentPage(1);
    setSearchTerm("");
    setIsLoading(true);
    // Load data immediately with cleared search - pass all filter values
    loadData(selectedMonth, selectedYear, "", filterStatus, filterPaymentMethod, filterClassId).finally(() =>
      setIsLoading(false),
    );
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
    card: indicators?.byMethod?.card || 0,
    cash: indicators?.byMethod?.cash || 0,
    bank: indicators?.byMethod?.bank || 0,
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
      card: "card",
      cash: "cash",
      bank: "bankTransfer",
    };
    return t(methodMap[method] || method) || method;
  };

  // Show full page skeleton only on initial load
  if (isLoading && payments.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

        {/* Action Buttons Skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Search and Filters Skeleton */}
        <div className="flex gap-4">
          <Skeleton className="h-10 w-full sm:w-64" />
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
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {t("payments")}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t("trackStudentFees")}
          </p>
        </div>

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
          <Dialog
            open={isBulkPaymentOpen}
            onOpenChange={(open) => {
              setIsBulkPaymentOpen(open);
              if (!open) setBulkSearchTerm("");
            }}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {t("bulkPayment")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("markMultipleStudentsAsPaid")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bulkMonth">{t("period")} *</Label>
                    <Select
                      value={bulkPaymentData.month}
                      onValueChange={(value) =>
                        setBulkPaymentData({
                          ...bulkPaymentData,
                          month: value,
                        })
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
                    <Label htmlFor="bulkYear">{t("year")} *</Label>
                    <Input
                      id="bulkYear"
                      type="number"
                      value={bulkPaymentData.year}
                      onChange={(e) =>
                        setBulkPaymentData({
                          ...bulkPaymentData,
                          year: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bulkPaymentMethod">
                      {t("paymentMethod")} *
                    </Label>
                    <Select
                      value={bulkPaymentData.paymentMethod}
                      onValueChange={(value: PaymentMethod) =>
                        setBulkPaymentData({
                          ...bulkPaymentData,
                          paymentMethod: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card">
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            {t("card")}
                          </div>
                        </SelectItem>
                        <SelectItem value="cash">
                          <div className="flex items-center gap-2">
                            <Banknote className="w-4 h-4" />
                            {t("cash")}
                          </div>
                        </SelectItem>
                        <SelectItem value="bank">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            {t("bankTransfer")}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50">
                    <Checkbox
                      checked={
                        selectedStudentIds.length === bulkStudentsList.length &&
                        bulkStudentsList.length > 0
                      }
                      onCheckedChange={() => {
                        if (selectedStudentIds.length === bulkStudentsList.length) {
                          setSelectedStudentIds([]);
                        } else {
                          setSelectedStudentIds(bulkStudentsList.map((s) => s.id));
                        }
                      }}
                    />
                    <Label className="cursor-pointer font-medium">
                      {t("selectAllActiveStudents")} ({bulkStudentsList.length})
                    </Label>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder={t("searchStudents") || "Search students..."}
                      value={bulkSearchTerm}
                      onChange={(e) => setBulkSearchTerm(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    {bulkSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setBulkSearchTerm("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                        title={t("clear") || "Clear"}
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

                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                    {isBulkSearching ? (
                      <div className="px-3 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {t("searching") || "Searching..."}
                          </span>
                        </div>
                      </div>
                    ) : bulkStudentsList.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                        {t("noActiveStudentsFound")}
                      </div>
                    ) : (
                      bulkStudentsList.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors"
                          onClick={() => toggleStudentSelection(student.id)}
                        >
                          <Checkbox
                            checked={selectedStudentIds.includes(student.id)}
                            onCheckedChange={() =>
                              toggleStudentSelection(student.id)
                            }
                          />
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {student.fullName}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {student.className} •{" "}
                              {formatCurrency(student.monthlyPayment)}/
                                {t("month")}
                              </p>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {selectedStudentIds.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-green-900 dark:text-green-100">
                          {selectedStudentIds.length} {t("studentsSelected")}
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          {t("totalIncome")}:{" "}
                          {formatCurrency(
                            selectedStudentIds.reduce((sum, id) => {
                              const student = bulkStudentsList.find(
                                (s) => s.id === id,
                              );
                              return sum + (student?.monthlyPayment || 0);
                            }, 0),
                          )}
                        </p>
                      </div>
                      <Badge
                        className={`gap-1 ${getPaymentMethodColor(
                          bulkPaymentData.paymentMethod,
                        )}`}
                      >
                        {getPaymentMethodIcon(bulkPaymentData.paymentMethod)}
                        {bulkPaymentData.paymentMethod}
                      </Badge>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsBulkPaymentOpen(false);
                      setSelectedStudentIds([]);
                      setBulkSearchTerm("");
                      setBulkStudentsList([]);
                    }}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    onClick={handleBulkPayment}
                    disabled={
                      selectedStudentIds.length === 0 || !bulkPaymentData.month
                    }
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    {t("markPaid")} ({selectedStudentIds.length})
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setStudentSearchTerm("");
                setShowStudentDropdown(false);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                onClick={() => resetForm()}
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
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("recordNewPayment")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                    {!formData.studentId && (
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

                  <div className="space-y-2">
                    <Label htmlFor="amount">{t("amount")} *</Label>
                    <Input
                      id="amount"
                      type="text"
                      value={formatNumberWithSpaces(formData.amount)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amount: removeNumberFormatting(e.target.value),
                        })
                      }
                      required
                      placeholder="10 000"
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
                    <Label htmlFor="notes">{t("notes")}</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder={t("additionalNotes")}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingPaymentId(null);
                      resetForm();
                    }}
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
                      t("recordPayment")
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {t("totalIncome")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totalIncome)}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("fromPaidFees")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {t("pendingPayments")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(totalPending)}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("unpaidFees")} {t("thisMonth")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              {t("card")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(totalByMethod.card)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              {t("cash")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(totalByMethod.cash)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {t("bank")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(totalByMethod.bank)}
            </div>
          </CardContent>
        </Card>
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
                        filterChangeInProgressRef.current = true;
                        setCurrentPage(1);
                        setSearchTerm("");
                        setIsLoading(true);
                        loadData(selectedMonth, selectedYear, "", filterStatus, filterPaymentMethod).finally(() => setIsLoading(false));
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Select
                  value={filterStatus}
                  onValueChange={(value) => {
                    // Mark filter change in progress to prevent duplicate API calls
                    filterChangeInProgressRef.current = true;
                    setFilterStatus(value);
                    // Apply filter immediately when status changes
                    setCurrentPage(1);
                    setIsLoading(true);
                    loadData(
                      selectedMonth,
                      selectedYear,
                      searchTerm,
                      value,
                      filterPaymentMethod,
                    ).finally(() => setIsLoading(false));
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
                    filterChangeInProgressRef.current = true;
                    setFilterPaymentMethod(value);
                    // Apply filter immediately when payment method changes
                    setCurrentPage(1);
                    setIsLoading(true);
                    loadData(
                      selectedMonth,
                      selectedYear,
                      searchTerm,
                      filterStatus,
                      value,
                    ).finally(() => setIsLoading(false));
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
                    <SelectItem value="card">{t("card")}</SelectItem>
                    <SelectItem value="bank">{t("bank")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filterClassId}
                  onValueChange={(value) => {
                    filterChangeInProgressRef.current = true;
                    setFilterClassId(value);
                    setCurrentPage(1);
                    setIsLoading(true);
                    loadData(
                      selectedMonth,
                      selectedYear,
                      searchTerm,
                      filterStatus,
                      filterPaymentMethod,
                      value,
                    ).finally(() => setIsLoading(false));
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
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-4 border-b">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("invoice")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("student")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("period")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("amount")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("method")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("status")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("paidDate")}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("whoAddedPayment")}
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    >
                      <td className="py-3 px-4">
                        <p className="font-mono text-sm text-slate-900 dark:text-slate-100">
                          {payment.invoiceNumber}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {getStudentName(payment.studentId)}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {getClassName(payment.studentId)}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                        {getMonthName(payment.month)} {payment.year}
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="py-3 px-4">
                        {payment.paymentMethod && (
                          <Badge
                            className={`gap-1 ${getPaymentMethodColor(
                              payment.paymentMethod,
                            )}`}
                          >
                            {getPaymentMethodIcon(payment.paymentMethod)}
                            <span>
                              {getPaymentMethodLabel(payment.paymentMethod)}
                            </span>
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={getStatusColor(
                            getEffectivePaymentStatus(payment),
                          )}
                        >
                          {getPaymentStatusLabel(
                            getEffectivePaymentStatus(payment),
                          )}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                        {payment.paidDate
                          ? new Date(payment.paidDate).toLocaleString("en-GB", {
                              timeZone: "Asia/Tashkent",
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                        <span className="text-sm">
                          {payment.createdByName || "-"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // Use studentInfoMap from consolidated endpoint
                                const studentInfo = studentInfoMap.get(payment.studentId);
                                const selectedBranchId =
                                  localStorage.getItem("selectedBranchId") || "";
                                
                                setPosPreviewData({
                                  payment,
                                  student: {
                                    id: payment.studentId,
                                    fullName: studentInfo?.fullName || getStudentName(payment.studentId),
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
                                  className: studentInfo?.className || getClassName(payment.studentId),
                                });
                              }}
                              title={t("printReceipt")}
                            >
                              <Printer className="w-4 h-4" />
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(payment)}
                              disabled={
                                !canEditPayments ||
                                processingPaymentId === payment.id
                              }
                              title={
                                canEditPayments ? t("edit") : t("noPermission")
                              }
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(payment.id)}
                              disabled={
                                !canDeletePayments ||
                                processingPaymentId === payment.id
                              }
                              title={
                                canDeletePayments
                                  ? t("delete")
                                  : t("noPermission")
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {paginatedPayments.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-500 dark:text-slate-400">
                    {t("noPaymentsFound")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {paginatedPayments.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t("showing")}{" "}
                {currentPage === 1 ? 1 : (currentPage - 1) * itemsPerPage + 1} -{" "}
                {Math.min(currentPage * itemsPerPage, totalPayments)} {t("of")}{" "}
                {totalPayments}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newPage = Math.max(1, currentPage - 1);
                      setCurrentPage(newPage);
                      const params = new URLSearchParams();
                      if (searchTerm) params.set("search", searchTerm);
                      if (filterStatus !== "all") params.set("status", filterStatus);
                      if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
                      params.set("month", selectedMonth);
                      params.set("year", selectedYear.toString());
                      params.set("page", newPage.toString());
                      params.set("limit", itemsPerPage.toString());
                      router.push(`/payments?${params.toString()}`, undefined, { shallow: true });
                    }}
                    disabled={currentPage === 1}
                    className="px-2 sm:px-3"
                  >
                    <ChevronLeft className="w-4 h-4 mr-0 sm:mr-1" />
                    <span className="hidden sm:inline">{t("previous")}</span>
                  </Button>
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const startPage = Math.max(1, currentPage - 2);
                      return startPage + i;
                    })
                      .filter((page) => page <= totalPages)
                      .map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setCurrentPage(page);
                            const params = new URLSearchParams();
                            if (searchTerm) params.set("search", searchTerm);
                            if (filterStatus !== "all") params.set("status", filterStatus);
                            if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
                            params.set("month", selectedMonth);
                            params.set("year", selectedYear.toString());
                            params.set("page", page.toString());
                            params.set("limit", itemsPerPage.toString());
                            router.push(`/payments?${params.toString()}`, undefined, { shallow: true });
                          }}
                          className="h-8 w-8 p-0"
                        >
                          {page}
                        </Button>
                      ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newPage = Math.min(totalPages, currentPage + 1);
                      setCurrentPage(newPage);
                      const params = new URLSearchParams();
                      if (searchTerm) params.set("search", searchTerm);
                      if (filterStatus !== "all") params.set("status", filterStatus);
                      if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
                      params.set("month", selectedMonth);
                      params.set("year", selectedYear.toString());
                      params.set("page", newPage.toString());
                      params.set("limit", itemsPerPage.toString());
                      router.push(`/payments?${params.toString()}`, undefined, { shallow: true });
                    }}
                    disabled={currentPage === totalPages}
                    className="px-2 sm:px-3"
                  >
                    <span className="hidden sm:inline">{t("next")}</span>
                    <ChevronRight className="w-4 h-4 ml-0 sm:ml-1" />
                  </Button>
                </div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  {t("page")} {currentPage} {t("of")} {totalPages}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* POS Terminal Receipt Preview Dialog */}
      <Dialog
        open={posPreviewData !== null}
        onOpenChange={(open) => !open && setPosPreviewData(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("printReceipt") || "Print Receipt"}</DialogTitle>
          </DialogHeader>
          {posPreviewData && (
            <div className="space-y-4">
              {/* Receipt Preview */}
              <div className="bg-white dark:bg-slate-950 border-2 border-dashed border-slate-300 dark:border-slate-700 p-4 font-mono text-sm leading-relaxed print:border-0 print:bg-white print:text-black">
                {/* Header */}
                <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-300 pb-2 mb-2">
                  <p className="font-bold text-lg print:text-base">
                    {t("receipt") || "RECEIPT"}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 print:text-black print:text-opacity-70">
                    {(() => {
                      const user = getCurrentUser();
                      if (user?.branchId) {
                        const branch = branchesDB
                          .getAll()
                          .find((b) => b.id === user.branchId);
                        return branch?.name || user.branchId;
                      }
                      return "Branch";
                    })()}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 print:text-black print:text-opacity-70">
                    {new Date().toLocaleDateString("en-GB")}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 print:text-black print:text-opacity-70">
                    {new Date().toLocaleTimeString()}
                  </p>
                </div>

                {/* Student Info */}
                <div className="border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-300 pb-2 mb-2">
                  <p className="print:text-black">
                    <span className="font-semibold">
                      {t("student") || "Student"}:
                    </span>{" "}
                    {posPreviewData.student.fullName}
                  </p>
                  <p className="print:text-black">
                    <span className="font-semibold">
                      {t("class") || "Class"}:
                    </span>{" "}
                    {posPreviewData.className}
                  </p>
                </div>

                {/* Payment Details */}
                <div className="border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-300 pb-2 mb-2">
                  <p className="print:text-black">
                    <span className="font-semibold">
                      {t("period") || "Period"}:
                    </span>{" "}
                    {getMonthName(posPreviewData.payment.month)}{" "}
                    {posPreviewData.payment.year}
                  </p>
                  <p className="print:text-black">
                    <span className="font-semibold">
                      {t("status") || "Status"}:
                    </span>{" "}
                    {getPaymentStatusLabel(posPreviewData.payment.status)}
                  </p>
                </div>

                {/* Amount */}
                <div className="border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-300 pb-2 mb-2">
                  <div className="flex justify-between print:text-black">
                    <span className="font-semibold">
                      {t("amount") || "Amount"}:
                    </span>
                    <span className="font-bold">
                      {formatCurrency(posPreviewData.payment.amount)}
                    </span>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-300 pb-2 mb-2">
                  <p className="print:text-black">
                    <span className="font-semibold">
                      {t("method") || "Method"}:
                    </span>{" "}
                    {getPaymentMethodLabel(
                      posPreviewData.payment.paymentMethod,
                    )}
                  </p>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-slate-600 dark:text-slate-400 print:text-black print:text-opacity-70 mt-4">
                  <p>{t("thankYouForPayment")}</p>
                  <p>{t("pleaseKeepReceipt")}</p>
                </div>
              </div>

              {/* Action Buttons - Hidden in print */}
              <div className="flex gap-2 print:hidden">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPosPreviewData(null)}
                >
                  {t("cancel")}
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    window.print();
                  }}
                >
                  <Printer className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={processingPaymentId === deleteConfirmDialog.paymentId}
            >
              {t("delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
