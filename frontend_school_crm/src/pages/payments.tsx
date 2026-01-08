import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAsync } from "@/hooks/use-async";
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
  paymentsDB,
  studentsDB,
  classesDB,
  branchesDB,
  usersDB,
  monthArchivesDB,
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
  listPayments as apiListPayments,
  createPayment as apiCreatePayment,
  updatePayment as apiUpdatePayment,
  deletePayment as apiDeletePayment,
  listStudents as apiListStudents,
  listClasses as apiListClasses,
  getBranch,
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

export default function PaymentsPage() {
  const router = useRouter();
  const { settings } = useSettings();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkPaymentOpen, setIsBulkPaymentOpen] = useState(false);
  const [bulkSearchTerm, setBulkSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branchData, setBranchData] = useState<Branch | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const getDefaultMonth = () => {
    const month = new Date().getMonth() + 1;
    return month.toString().padStart(2, "0");
  };

  const getDefaultYear = () => {
    return new Date().getFullYear().toString();
  };

  const [bulkPaymentData, setBulkPaymentData] = useState({
    month: getDefaultMonth(),
    year: getDefaultYear(),
    paymentMethod: "cash" as PaymentMethod,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    studentId: "",
    amount: "",
    month: getDefaultMonth(),
    year: getDefaultYear(),
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
  const [posPreviewData, setPosPreviewData] = useState<{
    payment: Payment;
    student: Student;
    className: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(
    null
  );
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    isOpen: boolean;
    paymentId: string | null;
  }>({
    isOpen: false,
    paymentId: null,
  });

  // useAsync hook will manage loading state and show toast on errors
  const { isLoading: asyncLoading, run } = useAsync();

  const language = useLanguage();
  const { toast } = useToast();
  const t = (key: string) => getTranslation(key, language);
  const canCreatePayments = hasPermission("canCreatePayments");
  const canEditPayments = hasPermission("canEditPayments");
  const canDeletePayments =
    canEditPayments && getCurrentUser()?.role !== "manager";
  const currentUser = getCurrentUser();
  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "branch_admin";

  const isMonthVisible = (month: string, year: number): boolean => {
    // The backend API handles filtering of archived months per branch
    // So we allow all months here and let the backend handle visibility
    return true;
  };

  const loadData = async (month?: string, year?: number) => {
    try {
      setIsLoading(true);
      const user = getCurrentUser();
      if (!user) {
        setPayments([]);
        setStudents([]);
        setClasses([]);
        return;
      }

      const selectedBranchId = localStorage.getItem("selectedBranchId");
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

        // Always use the current branch month for filtering
        const queryMonth = month || selectedMonth || currentMonth;
        const queryYear = year || selectedYear || currentYear;

        const [paymentsList, studentsList, classesList] = await Promise.all([
          apiListPayments({
            branchId: selectedBranchId,
            month: queryMonth,
            year: queryYear,
          }),
          apiListStudents(selectedBranchId),
          apiListClasses(selectedBranchId),
        ]);
        setPayments(paymentsList);
        setStudents(studentsList);
        setClasses(classesList);
      } else {
        // Load from local storage as fallback if no branch selected
        setStudents(studentsDB.getAll());
        setClasses(classesDB.getAll());
        setPayments(paymentsDB.getAll());
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      // Load from local storage as fallback
      setStudents(studentsDB.getAll());
      setClasses(classesDB.getAll());
      setPayments(paymentsDB.getAll());
      toast({
        title: t("error"),
        description: "Failed to load payments",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Set currentPage from URL query params
    if (router.isReady) {
      const page = router.query.page
        ? parseInt(router.query.page as string, 10)
        : 1;
      setCurrentPage(Math.max(1, page));
    }
  }, [router.isReady, router.query.page]);

  useEffect(() => {
    // load data with a small delay to keep the skeleton visible briefly
    run(async () => {
      await new Promise((r) => setTimeout(r, 300));
      await loadData();
    });
  }, [run]);

  // Reload data when branch changes
  useEffect(() => {
    const handleBranchChange = () => {
      // Reset selectedMonth to force reload from new branch
      setSelectedMonth("");
      setCurrentPage(1);
      loadData();
    };
    window.addEventListener("branchChange", handleBranchChange);
    return () => window.removeEventListener("branchChange", handleBranchChange);
  }, []);

  // Refetch data when page regains focus
  useRefetchOnFocus(loadData);

  const handleMonthChange = (month: string, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    loadData(month, year);
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
      const student = students.find((s) => s.id === formData.studentId);
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
              p.id !== editingPaymentId
          )
          .reduce((sum, p) => sum + p.amount, 0);

        // Allow if: existing other payments + new amount <= monthly payment
        if (paidTotalExcludingCurrent + newAmount > monthlyPaymentValue) {
          toast({
            title: t("error"),
            description: `Amount exceeds remaining balance. Remaining: ${formatCurrency(
              monthlyPaymentValue - paidTotalExcludingCurrent
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
            p.year === parseInt(formData.year)
        )
        .reduce((sum, p) => sum + p.amount, 0);

      // Allow if: existing payments + new amount <= monthly payment
      if (periodPaidTotal + newAmount > monthlyPaymentValue) {
        toast({
          title: t("error"),
          description: `Amount exceeds remaining balance. Remaining: ${formatCurrency(
            monthlyPaymentValue - periodPaidTotal
          )}`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
        }

        // Create via backend API
      try {
        const student = students.find((s) => s.id === formData.studentId);
        await apiCreatePayment({
          studentId: formData.studentId,
          amount: newAmount,
          month: formData.month,
          year: parseInt(formData.year),
          status: formData.status as PaymentStatus,
          paymentMethod: formData.paymentMethod,
          invoiceNumber,
          notes: formData.notes || undefined,
          paidDate: new Date().toISOString(), // Set paidDate for both "paid" and "partial"
          branchId: student?.branchId || user.branchId || "",
        });

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
      loadData();
      setIsDialogOpen(false);
      setIsSubmitting(false);
  };

  const handleMarkPaid = async (
    id: string,
    paymentMethod: PaymentMethod = "cash"
  ) => {
    // Prevent duplicate requests
    if (processingPaymentId === id) return;

    setProcessingPaymentId(id);
    try {
      await apiUpdatePayment(id, {
        status: "paid",
        paymentMethod,
        paidDate: new Date().toISOString(),
      });
      await loadData();
    } catch (error) {
      console.error("Failed to mark payment as paid:", error);

      // Check if payment still exists in state
      const paymentExists = payments.some((p) => p.id === id);
      if (!paymentExists) {
        toast({
          title: t("info"),
          description: "Payment was already removed",
          variant: "default",
        });
        await loadData();
      } else {
        toast({
          title: t("error"),
          description: "Failed to mark payment as paid",
          variant: "destructive",
        });
      }
    } finally {
      setProcessingPaymentId(null);
    }
  };

  const handleEdit = (payment: Payment) => {
    setEditingPaymentId(payment.id);
    setFormData({
      studentId: payment.studentId,
      amount: payment.amount.toString(),
      month: payment.month,
      year: payment.year.toString(),
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      notes: payment.notes || "",
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
      await loadData();
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
        await loadData();
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
      const student = students.find((s) => s.id === studentId);
      if (!student) continue;

      const paidTotal = payments
        .filter(
          (p) =>
            p.studentId === studentId &&
            p.month === bulkPaymentData.month &&
            p.year === parseInt(bulkPaymentData.year)
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
          error
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

    loadData();
    setIsBulkPaymentOpen(false);
    setSelectedStudentIds([]);
    setBulkPaymentData({
      month: "",
      year: getDefaultYear(),
      paymentMethod: "cash",
    });
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleSelectAll = () => {
    const activeStudents = students.filter((s) => s.status === "active");
    if (selectedStudentIds.length === activeStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(activeStudents.map((s) => s.id));
    }
  };

  const resetForm = () => {
    // Use branch's current financial month, fallback to current date
    const defaultMonth =
      branchData?.currentFinancialMonth?.month?.toString().padStart(2, "0") ||
      getDefaultMonth();
    const defaultYear =
      branchData?.currentFinancialMonth?.year?.toString() || getDefaultYear();

    setFormData({
      studentId: "",
      amount: "",
      month: defaultMonth,
      year: defaultYear,
      status: "partial",
      paymentMethod: "cash",
      notes: "",
    });
  };

  const recomputePaymentStatus = (
    studentId: string,
    month: string,
    year: number
  ) => {
    // This function is kept for compatibility but no longer modifies individual payment statuses
    // Each payment record maintains its own status based on what was recorded
    // Aggregated status is calculated on-the-fly for display purposes in student pages
    return;
  };

  useEffect(() => {
    // recompute payment summary when student / month / year changes
    const { studentId, month, year } = formData;
    if (!studentId || !month) {
      setPaymentSummary(null);
      return;
    }

    const student = students.find((s) => s.id === studentId);
    const monthly = student?.monthlyPayment || 0;

    // Use backend payments instead of localStorage
    const paidTotal = payments
      .filter(
        (p) =>
          p.studentId === studentId &&
          p.month === month &&
          p.year === parseInt(year)
      )
      .reduce((sum, p) => sum + p.amount, 0);

    if (paidTotal >= monthly) {
      setPaymentSummary({ paidTotal, remaining: 0, status: "paid" });
      setFormData((prev) => ({
        ...prev,
        amount: monthly.toString(),
        status: "paid",
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
  }, [formData.studentId, formData.month, formData.year, students, payments]);

  const getStudentName = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    return student?.fullName || "Unknown";
  };

  const getClassName = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return "N/A";
    const classData = classes.find((c) => c.id === student.classId);
    return classData?.name || "N/A";
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

  const filteredPayments = payments.filter((payment) => {
    const studentName = getStudentName(payment.studentId).toLowerCase();
    const matchesSearch =
      studentName.includes(searchTerm.toLowerCase()) ||
      (payment.invoiceNumber &&
        payment.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      filterStatus === "all" || payment.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPayments = filteredPayments.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Calculate effective status based on actual payment amount vs monthly payment
  const getEffectivePaymentStatus = (payment: Payment): PaymentStatus => {
    const student = students.find(s => s.id === payment.studentId);
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

  const totalIncome = payments
    .filter(
      (p) =>
        p.status === "paid" &&
        Number(p.month) === parseInt(selectedMonth) &&
        Number(p.year) === selectedYear
    )
    .reduce((sum, p) => sum + p.amount, 0);

  // Calculate pending as: monthly fees for all active students - what they've already paid
  const totalPending = (() => {
    let pending = 0;
    const selectedMonthNum = parseInt(selectedMonth);
    for (const student of students) {
      if (student.status !== "active") continue;

      // Only count students who joined before or during the selected month
      if (student.enrollmentDate) {
        const enrollDate = new Date(student.enrollmentDate);
        const enrollMonth = enrollDate.getMonth() + 1;
        const enrollYear = enrollDate.getFullYear();
        if (
          enrollYear > selectedYear ||
          (enrollYear === selectedYear && enrollMonth > selectedMonthNum)
        ) {
          continue; // Skip students who joined after the selected month
        }
      }

      const paidThisMonth = payments
        .filter(
          (p) =>
            p.studentId === student.id &&
            Number(p.month) === selectedMonthNum &&
            Number(p.year) === selectedYear
        )
        .reduce((sum, p) => sum + p.amount, 0);

      const remaining = Math.max(0, student.monthlyPayment - paidThisMonth);
      pending += remaining;
    }
    return pending;
  })();

  const totalByMethod = {
    card: payments
      .filter(
        (p) =>
          p.paymentMethod === "card" &&
          p.status === "paid" &&
          Number(p.month) === parseInt(selectedMonth) &&
          Number(p.year) === selectedYear
      )
      .reduce((sum, p) => sum + p.amount, 0),
    cash: payments
      .filter(
        (p) =>
          p.paymentMethod === "cash" &&
          p.status === "paid" &&
          Number(p.month) === parseInt(selectedMonth) &&
          Number(p.year) === selectedYear
      )
      .reduce((sum, p) => sum + p.amount, 0),
    bank: payments
      .filter(
        (p) =>
          p.paymentMethod === "bank" &&
          p.status === "paid" &&
          Number(p.month) === parseInt(selectedMonth) &&
          Number(p.year) === selectedYear
      )
      .reduce((sum, p) => sum + p.amount, 0),
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

  if (asyncLoading) {
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
                        selectedStudentIds.length ===
                          students.filter((s) => s.status === "active")
                            .length &&
                        students.filter((s) => s.status === "active").length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                    <Label className="cursor-pointer font-medium">
                      {t("selectAllActiveStudents")} (
                      {students.filter((s) => s.status === "active").length})
                    </Label>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder={t("searchStudents") || "Search students..."}
                      value={bulkSearchTerm}
                      onChange={(e) => setBulkSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                    {students.filter(
                      (s) =>
                        s.status === "active" &&
                        s.fullName
                          .toLowerCase()
                          .includes(bulkSearchTerm.toLowerCase())
                    ).length === 0 ? (
                      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                        {t("noActiveStudentsFound")}
                      </div>
                    ) : (
                      students
                        .filter(
                          (s) =>
                            s.status === "active" &&
                            s.fullName
                              .toLowerCase()
                              .includes(bulkSearchTerm.toLowerCase())
                        )
                        .map((student) => (
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
                                {getClassName(student.id)} •{" "}
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
                              const student = students.find((s) => s.id === id);
                              return sum + (student?.monthlyPayment || 0);
                            }, 0)
                          )}
                        </p>
                      </div>
                      <Badge
                        className={`gap-1 ${getPaymentMethodColor(
                          bulkPaymentData.paymentMethod
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

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                    <Label htmlFor="studentId">{t("student")} *</Label>
                    <Select
                      value={formData.studentId}
                      onValueChange={(value) => {
                        const student = students.find((s) => s.id === value);
                        const monthly = student?.monthlyPayment || 0;
                        // set student and optimistic amount
                        setFormData({
                          ...formData,
                          studentId: value,
                          amount: monthly.toString(),
                        });

                        // compute payments for selected month/year when available
                        if (value && formData.month) {
                          const allPayments = paymentsDB.getAll();
                          const paidTotal = allPayments
                            .filter(
                              (p) =>
                                p.studentId === value &&
                                p.month === formData.month &&
                                p.year === parseInt(formData.year)
                            )
                            .reduce((sum, p) => sum + p.amount, 0);

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
                              (monthly - paidTotal).toFixed(2)
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
                        } else {
                          // clear summary if month not selected
                          setPaymentSummary(null);
                        }
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectStudent")} />
                      </SelectTrigger>
                      <SelectContent>
                        {students
                          .filter((s) => s.status === "active")
                          .map((student) => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.fullName} - {getClassName(student.id)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
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
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder={t("searchPayments")}
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
                <SelectItem value="partial">{t("partial")}</SelectItem>
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
                            payment.paymentMethod
                          )}`}
                        >
                          {getPaymentMethodIcon(payment.paymentMethod)}
                          {getPaymentMethodLabel(payment.paymentMethod)}
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getStatusColor(getEffectivePaymentStatus(payment))}>
                        {getPaymentStatusLabel(getEffectivePaymentStatus(payment))}
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
                              const student = students.find(
                                (s) => s.id === payment.studentId
                              );
                              if (student) {
                                setPosPreviewData({
                                  payment,
                                  student,
                                  className: getClassName(payment.studentId),
                                });
                              }
                            }}
                            title={t("printReceipt")}
                          >
                            <Printer className="w-4 h-4" />
                          </Button>

                          {payment.status !== "paid" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600"
                              onClick={() => handleMarkPaid(payment.id)}
                              disabled={processingPaymentId === payment.id}
                            >
                              {t("markPaid")}
                            </Button>
                          )}

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

            {filteredPayments.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  {t("noPaymentsFound")}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {filteredPayments.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {t("showing")} {startIndex + 1} -{" "}
                {Math.min(startIndex + itemsPerPage, filteredPayments.length)}{" "}
                {t("of")} {filteredPayments.length}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/payments?page=${Math.max(1, currentPage - 1)}`
                    )
                  }
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  {t("previous")}
                </Button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => router.push(`/payments?page=${page}`)}
                      >
                        {page}
                      </Button>
                    )
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/payments?page=${Math.min(totalPages, currentPage + 1)}`
                    )
                  }
                  disabled={currentPage === totalPages}
                >
                  {t("next")}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
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
                      posPreviewData.payment.paymentMethod
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
