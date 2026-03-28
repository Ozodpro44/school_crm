import { useEffect, useState, useRef, useCallback } from "react";
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
import { usersDB } from "@/lib/storage";
import { Expense, PaymentMethod } from "@/types";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CreditCard,
  Banknote,
  Building2,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import {
  createExpense,
  deleteExpense,
  updateExpense,
  getUser,
  getBranch,
  getExpensesConsolidatedData,
  ExpenseSummary,
} from "@/lib/api";
import { Branch } from "@/types";
import MonthYearSelector from "@/components/MonthYearSelector";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { formatNumberWithSpaces, removeNumberFormatting } from "@/lib/utils";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { useRefetchOnFocus } from "@/hooks/use-refetch-on-focus";

export default function ExpensesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [indicators, setIndicators] = useState<ExpenseSummary | null>(null);
  const [userCache, setUserCache] = useState<{ [key: string]: string }>({});
  const [branchData, setBranchData] = useState<Branch | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const initialLoadDoneRef = useRef(false);
  const currentLoadIdRef = useRef(0);
  const filterChangeInProgressRef = useRef(false);
  const currentUser = getCurrentUser();
  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "branch_admin";
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => { },
    onCancel: () => { },
    isLoading: false,
  });
  const language = useLanguage();
  const { toast } = useToast();
  const canCreateExpenses = hasPermission("canCreateExpenses");
  const canEditExpenses = hasPermission("canEditExpenses");
  const canDeleteExpenses = hasPermission("canDeleteExpenses");
  const {
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isSelected,
    getSelectedCount,
    getSelectedIds,
    areAllSelected,
    areSomeSelected,
  } = useMultiSelect<Expense>();

  const [formData, setFormData] = useState({
    category: "",
    description: "",
    amount: "",
    paymentMethod: "cash" as PaymentMethod,
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const categories = [
    "Utilities",
    "Supplies",
    "Maintenance",
    "Transportation",
    "Equipment",
    "Marketing",
    "Insurance",
    "Rent",
    "Other",
  ];

  const getCategoryTranslationKey = (category: string): string => {
    const keyMap: Record<string, string> = {
      Utilities: "utilities",
      Supplies: "supplies",
      Maintenance: "maintenance",
      Transportation: "transportation",
      Equipment: "equipment",
      Marketing: "marketing",
      Insurance: "insurance",
      Rent: "rent",
      Other: "other",
    };
    return keyMap[category] || category.toLowerCase();
  };

  const t = (key: string) => getTranslation(key, language);

  // Initialize state from URL params
  useEffect(() => {
    if (!router.isReady) return;

    const { page, limit, search, category, paymentMethod, month, year } = router.query;
    if (page) setCurrentPage(parseInt(page as string) || 1);
    if (limit) setItemsPerPage(parseInt(limit as string) || 10);
    if (search) {
      setSearchTerm(search as string);
      setSearchInput(search as string);
    }
    if (category) setFilterCategory(category as string);
    if (paymentMethod) setFilterPaymentMethod(paymentMethod as string);
    if (month) setSelectedMonth(month as string);
    if (year) setSelectedYear(parseInt(year as string) || new Date().getFullYear());

    // Load initial data
    setIsLoading(true);
    loadData().finally(() => {
      setIsLoading(false);
      initialLoadDoneRef.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // Refetch when branch changes
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

  // Reload data when page or items per page changes
  useEffect(() => {
    if (!initialLoadDoneRef.current) return;

    // Skip if a filter change is in progress
    if (filterChangeInProgressRef.current) {
      filterChangeInProgressRef.current = false;
      return;
    }

    setIsLoading(true);
    loadData().finally(() => setIsLoading(false));

    // Update URL
    updateURL();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage]);

  // Refetch on focus
  const refetchData = useCallback(() => {
    setIsLoading(true);
    loadData().finally(() => setIsLoading(false));
  }, [searchTerm, filterCategory, filterPaymentMethod, selectedMonth, selectedYear, currentPage, itemsPerPage]);
  useRefetchOnFocus(refetchData);

  const updateURL = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (filterCategory !== "all") params.set("category", filterCategory);
    if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
    if (selectedMonth) params.set("month", selectedMonth);
    if (selectedYear) params.set("year", selectedYear.toString());
    params.set("page", currentPage.toString());
    params.set("limit", itemsPerPage.toString());
    router.push(`/expenses?${params.toString()}`, undefined, { shallow: true });
  };

  const handlePageChange = (page: number) => {
    filterChangeInProgressRef.current = false;
    setCurrentPage(page);
    setIsLoading(true);
    loadData(
      selectedMonth,
      selectedYear,
      searchTerm,
      filterCategory,
      filterPaymentMethod,
      page,
    ).finally(() => setIsLoading(false));
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (filterCategory !== "all") params.set("category", filterCategory);
    if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
    if (selectedMonth) params.set("month", selectedMonth);
    if (selectedYear) params.set("year", selectedYear.toString());
    params.set("page", page.toString());
    params.set("limit", itemsPerPage.toString());
    router.push(`/expenses?${params.toString()}`, undefined, { shallow: true });
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
    monthOverride?: string,
    yearOverride?: number,
    searchOverride?: string,
    categoryOverride?: string,
    paymentMethodOverride?: string,
    pageOverride?: number,
  ) => {
    try {
      const loadId = ++currentLoadIdRef.current;
      const branchId = await waitForSelectedBranchId();
      if (!branchId) {
        return;
      }

      // Load branch data to get current month
      const branch = await getBranch(branchId);
      setBranchData(branch);

      // Use financial month data if available
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

      // Use override values first, then state, then URL params
      const queryMonth = monthOverride || selectedMonth || currentMonth;
      const queryYear = yearOverride || selectedYear || currentYear;
      const querySearch = searchOverride !== undefined ? searchOverride : searchTerm;
      const queryCategory = categoryOverride !== undefined ? categoryOverride : filterCategory;
      const queryPaymentMethod = paymentMethodOverride !== undefined ? paymentMethodOverride : filterPaymentMethod;
      const queryPage = pageOverride !== undefined ? pageOverride : currentPage;

      // Build filters
      const filters: any = {
        month: queryMonth,
        year: queryYear.toString(),
      };
      if (querySearch) filters.search = querySearch;
      if (queryCategory !== "all") filters.category = queryCategory;
      if (queryPaymentMethod !== "all") filters.paymentMethod = queryPaymentMethod;

      // Call consolidated API
      const result = await getExpensesConsolidatedData(branchId, queryPage, itemsPerPage, filters);
      if (loadId !== currentLoadIdRef.current) {
        return;
      }

      setExpenses(result.items || []);
      setTotalExpenses(result.total || 0);
      setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      setIndicators(result.indicators);

      // Fetch user names for all unique creators
      const creatorIds = [...new Set((result.items || []).map((e) => e.createdBy).filter(Boolean))];
      for (const userId of creatorIds) {
        await fetchAndCacheUserName(userId);
      }
    } catch (error) {
      console.error("Failed to load expenses:", error);
      toast({
        title: t("error"),
        description: t("failedToLoadExpenses"),
        variant: "destructive",
      });
    }
  };

  const handleMonthChange = (month: string, year: number) => {
    filterChangeInProgressRef.current = currentPage !== 1;
    setSelectedMonth(month);
    setSelectedYear(year);
    setCurrentPage(1);
    setIsLoading(true);
    loadData(month, year, searchTerm, filterCategory, filterPaymentMethod, 1).finally(() => setIsLoading(false));
    // Update URL
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (filterCategory !== "all") params.set("category", filterCategory);
    if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
    params.set("month", month);
    params.set("year", year.toString());
    params.set("page", "1");
    params.set("limit", itemsPerPage.toString());
    router.push(`/expenses?${params.toString()}`, undefined, { shallow: true });
  };

  const handleSearch = () => {
    filterChangeInProgressRef.current = currentPage !== 1;
    setCurrentPage(1);
    setSearchTerm(searchInput);
    setIsLoading(true);
    loadData(selectedMonth, selectedYear, searchInput, filterCategory, filterPaymentMethod, 1).finally(() => setIsLoading(false));
    // Update URL
    const params = new URLSearchParams();
    if (searchInput) params.set("search", searchInput);
    if (filterCategory !== "all") params.set("category", filterCategory);
    if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
    if (selectedMonth) params.set("month", selectedMonth);
    if (selectedYear) params.set("year", selectedYear.toString());
    params.set("page", "1");
    params.set("limit", itemsPerPage.toString());
    router.push(`/expenses?${params.toString()}`, undefined, { shallow: true });
  };

  const handleClearSearch = () => {
    filterChangeInProgressRef.current = currentPage !== 1;
    setSearchInput("");
    setCurrentPage(1);
    setSearchTerm("");
    setIsLoading(true);
    loadData(selectedMonth, selectedYear, "", filterCategory, filterPaymentMethod, 1).finally(() => setIsLoading(false));
    // Update URL
    const params = new URLSearchParams();
    if (filterCategory !== "all") params.set("category", filterCategory);
    if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
    if (selectedMonth) params.set("month", selectedMonth);
    if (selectedYear) params.set("year", selectedYear.toString());
    params.set("page", "1");
    params.set("limit", itemsPerPage.toString());
    router.push(`/expenses?${params.toString()}`, undefined, { shallow: true });
  };

  const handleCategoryChange = (value: string) => {
    filterChangeInProgressRef.current = currentPage !== 1;
    setFilterCategory(value);
    setCurrentPage(1);
    setIsLoading(true);
    loadData(selectedMonth, selectedYear, searchTerm, value, filterPaymentMethod, 1).finally(() => setIsLoading(false));
    // Update URL
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (value !== "all") params.set("category", value);
    if (filterPaymentMethod !== "all") params.set("paymentMethod", filterPaymentMethod);
    if (selectedMonth) params.set("month", selectedMonth);
    if (selectedYear) params.set("year", selectedYear.toString());
    params.set("page", "1");
    params.set("limit", itemsPerPage.toString());
    router.push(`/expenses?${params.toString()}`, undefined, { shallow: true });
  };

  const handlePaymentMethodChange = (value: string) => {
    filterChangeInProgressRef.current = currentPage !== 1;
    setFilterPaymentMethod(value);
    setCurrentPage(1);
    setIsLoading(true);
    loadData(selectedMonth, selectedYear, searchTerm, filterCategory, value, 1).finally(() => setIsLoading(false));
    // Update URL
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (filterCategory !== "all") params.set("category", filterCategory);
    if (value !== "all") params.set("paymentMethod", value);
    if (selectedMonth) params.set("month", selectedMonth);
    if (selectedYear) params.set("year", selectedYear.toString());
    params.set("page", "1");
    params.set("limit", itemsPerPage.toString());
    router.push(`/expenses?${params.toString()}`, undefined, { shallow: true });
  };

  const getUserName = (userId: string) => {
    if (!userId) return "-";

    // Check cache first
    if (userCache[userId]) {
      return userCache[userId];
    }

    // Try local storage fallback
    const localUser = usersDB.getAll().find((u) => u.id === userId);
    if (localUser?.fullName) {
      return localUser.fullName;
    }

    // Return loading state and fetch from API
    return "-";
  };

  const fetchAndCacheUserName = async (userId: string) => {
    if (!userId || userCache[userId]) return;

    try {
      const user = await getUser(userId);
      setUserCache((prev) => ({ ...prev, [userId]: user.fullName }));
    } catch (error) {
      console.error(`Failed to fetch user ${userId}:`, error);
      // Cache empty name to avoid retrying
      setUserCache((prev) => ({ ...prev, [userId]: "Unknown" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const user = getCurrentUser();
    if (!user) {
      setIsSubmitting(false);
      return;
    }

    try {
      // Convert date string (YYYY-MM-DD) to ISO timestamp (YYYY-MM-DDTHH:mm:ssZ)
      const dateTimestamp = new Date(
        formData.date + "T00:00:00Z",
      ).toISOString();

      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          title: formData.description, // Mapped from description
          category: formData.category,
          description: formData.notes, // Mapped from notes
          amount: parseFloat(formData.amount),
          paymentMethod: formData.paymentMethod,
          date: dateTimestamp,
          branchId: editingExpense.branchId,
        });
        toast({
          title: "Updated",
          description: "Expense updated successfully",
          variant: "success",
        });
      } else {
        await createExpense({
          title: formData.description, // Mapped from description
          category: formData.category,
          description: formData.notes, // Mapped from notes
          amount: parseFloat(formData.amount),
          paymentMethod: formData.paymentMethod,
          date: dateTimestamp,
          branchId: localStorage.getItem("selectedBranchId") || "",
        });
        toast({
          title: t("created"),
          description: t("expenseCreatedSuccess"),
          variant: "success",
        });
      }

      resetForm();
      await loadData();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Failed to save expense:", error);
      toast({
        title: t("error"),
        description: t("failedToSaveExpense"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    // Extract YYYY-MM-DD from ISO timestamp
    const dateOnly = new Date(expense.date).toISOString().split("T")[0];
    setFormData({
      category: expense.category,
      description: expense.title, // Mapped to title
      amount: expense.amount.toString(),
      paymentMethod: expense.paymentMethod,
      date: dateOnly,
      notes: expense.description || "", // Mapped to description
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t("deleteExpense"),
      message: t("confirmDeleteExpenseMessage"),
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isLoading: true }));
        try {
          await deleteExpense(id);
          await loadData();
          toast({
            title: t("deletedItem"),
            description: t("expenseDeleted"),
            variant: "success",
          });
        } catch (error) {
          console.error("Failed to delete expense:", error);
          toast({
            title: t("error"),
            description: t("expenseDeletedError"),
            variant: "destructive",
          });
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleBulkDelete = () => {
    const selectedIds = getSelectedIds();
    if (selectedIds.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: t("deleteMultipleExpenses"),
      message: t("confirmDeleteMultipleExpensesMessage"),
      onConfirm: async () => {
        try {
          await Promise.all(selectedIds.map((id) => deleteExpense(id)));
          clearSelection();
          await loadData();
          toast({
            title: t("deleted"),
            description: `${selectedIds.length} ${t("expensesDeleted") || "expenses deleted"
              }`,
            variant: "success",
          });
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        } catch (error) {
          console.error("Failed to delete expenses:", error);
          toast({
            title: t("error"),
            description: t("failedToDeleteExpenses"),
            variant: "destructive",
          });
        }
      },
      onCancel: () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      },
    });
  };

  const resetForm = () => {
    // Set date to today
    const today = new Date().toISOString().split("T")[0];
    setFormData({
      category: "",
      description: "",
      amount: "",
      paymentMethod: "cash",
      date: today,
      notes: "",
    });
    setEditingExpense(null);
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case "card":
        return <CreditCard className="w-4 h-4" />;
      case "cash":
        return <Banknote className="w-4 h-4" />;
      case "bank":
        return <Building2 className="w-4 h-4" />;
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

  // Server-side filtering and pagination - no client-side filtering needed
  const paginatedExpenses = expenses;

  // Use API indicators if available, otherwise calculate from current page data
  const totalExpenseAmount = indicators?.totalAmount || expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalByMethod = {
    card: indicators?.byMethod?.card || 0,
    cash: indicators?.byMethod?.cash || 0,
    bank: indicators?.byMethod?.bank || 0,
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

        {/* Action Button Skeleton */}
        <Skeleton className="h-10 w-32" />

        {/* Search and Filters Skeleton */}
        <div className="flex gap-4 flex-col sm:flex-row">
          <Skeleton className="h-10 w-full sm:flex-1" />
          <Skeleton className="h-10 w-40" />
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

        {/* Custom Confirmation Dialog */}
        <Dialog
          open={confirmDialog.isOpen}
          onOpenChange={(open) => {
            if (!open) setConfirmDialog({ ...confirmDialog, isOpen: false });
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmDialog.title}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-600 dark:text-slate-400">
                {confirmDialog.message}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  confirmDialog.onCancel();
                }}
                disabled={confirmDialog.isLoading}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={() => {
                  confirmDialog.onConfirm();
                }}
                disabled={confirmDialog.isLoading}
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
              >
                {confirmDialog.isLoading && (
                  <svg
                    className="w-4 h-4 mr-2 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                )}
                {confirmDialog.isLoading
                  ? t("loading") || "Loading..."
                  : t("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {t("expenses")}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t("trackManageExpenses")}
          </p>
        </div>

        {isAdmin && branchData && selectedMonth && (
          <div className="flex-1 flex justify-center">
            <MonthYearSelector
              month={selectedMonth}
              year={selectedYear}
              onChange={handleMonthChange}
              currentBranchMonth={branchData.currentFinancialMonth?.month
                ?.toString()
                .padStart(2, "0")}
              currentBranchYear={branchData.currentFinancialMonth?.year}
            />
          </div>
        )}

        <div className="flex-1 flex justify-end">
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
                onClick={() => resetForm()}
                disabled={!canCreateExpenses}
                title={
                  !canCreateExpenses
                    ? t("noPermission") || "No permission to create expenses"
                    : ""
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("addExpense")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingExpense ? t("editExpense") : t("addNewExpense")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">{t("category")} *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectCategory")} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {t(category.toLowerCase()) !==
                              String(category.toLowerCase())
                              ? t(category.toLowerCase())
                              : category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">{t("amount")} *</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      required
                      placeholder="0"
                      step="0.01"
                    />
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
                    <Label htmlFor="date">{t("date")} *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">{t("description")} *</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder={t("briefDescription")}
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
                        {editingExpense ? t("updating") : t("creating")}
                      </>
                    ) : editingExpense ? (
                      t("update")
                    ) : (
                      t("addExpense")
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              {t("totalExpenses")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(totalExpenseAmount)}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("thisMonth")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              {t("cardPayments")}
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
              {t("cashPayments")}
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
              {t("bankTransfers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(totalByMethod.bank)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card
        className={`border-l-4 transition-all ${getSelectedCount() > 0
            ? "border-l-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-l-slate-300 dark:border-l-slate-600 bg-slate-50 dark:bg-slate-900/50 opacity-50"
          }`}
      >
        <CardContent className="py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {getSelectedCount()} {t("itemsSelected") || "items selected"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={getSelectedCount() === 0}
            >
              {t("deleteSelected") || "Delete Selected"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clearSelection}
              disabled={getSelectedCount() === 0}
            >
              {t("cancel")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder={t("searchExpenses")}
                  value={searchInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchInput(value);
                    // Auto-clear search when input is empty
                    if (value === "" && searchTerm !== "") {
                      handleClearSearch();
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  className="pl-10"
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
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={filterCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("allCategories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allCategories")}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {t(getCategoryTranslationKey(category))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterPaymentMethod}
                onValueChange={handlePaymentMethodChange}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("allMethods")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allMethods")}</SelectItem>
                  <SelectItem value="card">{t("card")}</SelectItem>
                  <SelectItem value="cash">{t("cash")}</SelectItem>
                  <SelectItem value="bank">{t("bankTransfer")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={itemsPerPage.toString()} onValueChange={(val) => {
                const limit = parseInt(val);
                filterChangeInProgressRef.current = true;
                setItemsPerPage(limit);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[140px]">
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
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left py-3 px-4">
                    <Checkbox
                      checked={
                        areAllSelected(paginatedExpenses) ||
                        areSomeSelected(paginatedExpenses)
                      }
                      onCheckedChange={() => toggleSelectAll(paginatedExpenses)}
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("date")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("category")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("description")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("amount")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("paymentMethod")}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("whoAddedExpenses")}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {t("actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedExpenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 ${isSelected(expense.id)
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : ""
                      }`}
                  >
                    <td className="py-3 px-4">
                      <Checkbox
                        checked={isSelected(expense.id)}
                        onCheckedChange={() => toggleSelect(expense.id)}
                      />
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">
                        {t(getCategoryTranslationKey(expense.category))}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                      {expense.title}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(expense.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        className={`gap-1 ${getPaymentMethodColor(
                          expense.paymentMethod,
                        )}`}
                      >
                        {getPaymentMethodIcon(expense.paymentMethod)}
                        <span>
                          {t(
                            expense.paymentMethod === "bank"
                              ? "bankTransfer"
                              : expense.paymentMethod,
                          )}
                        </span>
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100">
                      <span className="text-sm">
                        {expense.createdBy
                          ? getUserName(expense.createdBy)
                          : "-"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(expense)}
                          disabled={!canEditExpenses}
                          title={canEditExpenses ? "" : "No permission"}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(expense.id)}
                          disabled={!canDeleteExpenses}
                          title={canDeleteExpenses ? "" : "No permission"}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {paginatedExpenses.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  {t("noExpensesFound")}
                </p>
              </div>
            )}

            {/* Pagination */}
            {totalExpenses > 0 && (
              <div className="flex flex-col gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {t("showing")} {(currentPage - 1) * itemsPerPage + 1} –{" "}
                    {Math.min(currentPage * itemsPerPage, totalExpenses)}{" "}
                    {t("of")} {totalExpenses}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newPage = Math.max(1, currentPage - 1);
                      handlePageChange(newPage);
                    }}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {t("previous")}
                  </Button>
                  <div className="flex items-center gap-2">
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
                            handlePageChange(page);
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
                      handlePageChange(newPage);
                    }}
                    disabled={currentPage === totalPages || totalPages === 0}
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

      {/* Custom Confirmation Dialog */}
      <Dialog
        open={confirmDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 dark:text-slate-400">
              {confirmDialog.message}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                confirmDialog.onCancel();
              }}
              disabled={confirmDialog.isLoading}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={() => {
                confirmDialog.onConfirm();
              }}
              disabled={confirmDialog.isLoading}
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
            >
              {confirmDialog.isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("deleting")}
                </>
              ) : (
                t("delete")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
