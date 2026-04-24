import { useEffect, useState, useRef, useCallback } from "react";
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
  Loader2,
  Target,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import {
  createExpense,
  deleteExpense,
  updateExpense,
  getUser,
  getBranch,
  getExpensesConsolidatedData,
  getExpenseBudgets,
  upsertExpenseBudget,
  deleteExpenseBudget,
  ExpenseSummary,
  type BudgetWithActual,
} from "@/lib/api";
import { Branch } from "@/types";
import MonthYearSelector from "@/components/MonthYearSelector";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { useRefetchOnFocus } from "@/hooks/use-refetch-on-focus";
import { DataTable, Column } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";

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
  const [indicators, setIndicators] = useState<ExpenseSummary | null>(null);
  const [userCache, setUserCache] = useState<{ [key: string]: string }>({});
  const [branchData, setBranchData] = useState<Branch | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [budgets, setBudgets] = useState<BudgetWithActual[]>([]);
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [budgetEditCategory, setBudgetEditCategory] = useState("");
  const [budgetEditAmount, setBudgetEditAmount] = useState("");
  const [isSavingBudget, setIsSavingBudget] = useState(false);
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
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
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
    loadBudgets(month as string | undefined, year ? parseInt(year as string) : undefined);
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
      const filters: Record<string, string> = {
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

  const loadBudgets = async (month?: string, year?: number) => {
    try {
      const branchId = localStorage.getItem("selectedBranchId");
      if (!branchId) return;
      const m = month || selectedMonth;
      const y = year || selectedYear;
      if (!m || !y) return;
      const data = await getExpenseBudgets(branchId, m, y);
      setBudgets(data);
    } catch {
      setBudgets([]);
    }
  };

  const handleSaveBudget = async () => {
    const branchId = localStorage.getItem("selectedBranchId");
    if (!branchId || !budgetEditCategory || !budgetEditAmount) return;
    setIsSavingBudget(true);
    try {
      await upsertExpenseBudget({
        branchId,
        category: budgetEditCategory,
        month: selectedMonth,
        year: selectedYear,
        amount: parseFloat(budgetEditAmount),
      });
      await loadBudgets();
      setBudgetEditCategory("");
      setBudgetEditAmount("");
      toast({ title: t("saved") || "Saved", description: t("budgetSaved") || "Budget saved", variant: "success" });
    } catch {
      toast({ title: t("error"), description: t("failedToSaveBudget") || "Failed to save budget", variant: "destructive" });
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleDeleteBudget = async (category: string) => {
    const branchId = localStorage.getItem("selectedBranchId");
    if (!branchId) return;
    try {
      await deleteExpenseBudget(branchId, category, selectedMonth, selectedYear);
      setBudgets((prev) => prev.filter((b) => b.category !== category));
    } catch {
      toast({ title: t("error"), description: t("failedToDeleteBudget") || "Failed to delete budget", variant: "destructive" });
    }
  };

  const handleMonthChange = (month: string, year: number) => {
    filterChangeInProgressRef.current = currentPage !== 1;
    setSelectedMonth(month);
    setSelectedYear(year);
    setCurrentPage(1);
    setIsLoading(true);
    loadData(month, year, searchTerm, filterCategory, filterPaymentMethod, 1).finally(() => setIsLoading(false));
    loadBudgets(month, year);
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
    if (userCache[userId]) return userCache[userId];
    return "-";
  };

  const fetchAndCacheUserName = async (userId: string) => {
    if (!userId || userCache[userId]) return;

    try {
      const user = await getUser(userId);
      setUserCache((prev) => ({ ...prev, [userId]: user.fullName }));
    } catch (error) {
      console.error(`Failed to fetch user ${userId}:`, error);
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
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
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
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const resetForm = () => {
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

  // ── Column definitions ────────────────────────────────────────────────────────
  const columns: Column<Expense>[] = [
    {
      key: "date",
      header: t("date"),
      render: (expense) => (
        <span className="text-slate-900 dark:text-slate-100">
          {new Date(expense.date).toLocaleDateString("en-GB").replace(/\//g, ".")}
        </span>
      ),
    },
    {
      key: "category",
      header: t("category"),
      render: (expense) => (
        <Badge variant="outline">
          {t(getCategoryTranslationKey(expense.category))}
        </Badge>
      ),
    },
    {
      key: "description",
      header: t("description"),
      render: (expense) => (
        <span className="text-slate-900 dark:text-slate-100">{expense.title}</span>
      ),
    },
    {
      key: "amount",
      header: t("amount"),
      render: (expense) => (
        <span className="font-semibold text-red-600 dark:text-red-400">
          {formatCurrency(expense.amount)}
        </span>
      ),
    },
    {
      key: "paymentMethod",
      header: t("paymentMethod"),
      hideOnMobile: true,
      render: (expense) => (
        <Badge className={`gap-1 ${getPaymentMethodColor(expense.paymentMethod)}`}>
          {getPaymentMethodIcon(expense.paymentMethod)}
          <span>
            {t(expense.paymentMethod === "bank" ? "bankTransfer" : expense.paymentMethod)}
          </span>
        </Badge>
      ),
    },
    {
      key: "createdBy",
      header: t("whoAddedExpenses"),
      hideOnMobile: true,
      render: (expense) => (
        <span className="text-sm text-slate-900 dark:text-slate-100">
          {expense.createdBy ? getUserName(expense.createdBy) : "-"}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("actions"),
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (expense) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); handleEdit(expense); }}
            disabled={!canEditExpenses}
            title={canEditExpenses ? "" : "No permission"}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); handleDelete(expense.id); }}
            disabled={!canDeleteExpenses}
            title={canDeleteExpenses ? "" : "No permission"}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1">
          <PageHeader title={t("expenses")} subtitle={t("trackManageExpenses")} />
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
          <Button
            className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
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

          <FormDialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
            title={editingExpense ? t("editExpense") : t("addNewExpense")}
            onSubmit={handleSubmit}
            submitLabel={editingExpense ? t("update") : t("addExpense")}
            submittingLabel={editingExpense ? t("updating") : t("creating")}
            isPending={isSubmitting}
            maxWidth="max-w-2xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="category">{t("category")} *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
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

              <Field
                id="amount"
                label={`${t("amount")} *`}
                type="number"
                value={formData.amount}
                placeholder="0"
                step="0.01"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
              />

              <div className="space-y-1.5">
                <Label htmlFor="paymentMethod">{t("paymentMethod")} *</Label>
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
                id="date"
                label={`${t("date")} *`}
                type="date"
                value={formData.date}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />

              <Field
                id="description"
                label={`${t("description")} *`}
                value={formData.description}
                placeholder={t("briefDescription")}
                className="md:col-span-2"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />

              <Field
                id="notes"
                label={t("notes")}
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

      {/* Budget vs Actual Widget */}
      {isAdmin && (budgets.length > 0 || selectedMonth) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-500" />
                {t("budgetVsActual") || "Budget vs Actual"}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setIsBudgetDialogOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                {t("setBudget") || "Set Budget"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {budgets.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                {t("noBudgetsSet") || "No budgets set for this period. Click \"Set Budget\" to add one."}
              </p>
            ) : (
              <div className="space-y-3">
                {budgets.map((b) => (
                  <div key={b.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {b.isExceeded ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        ) : b.isNearLimit ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {t(b.category.toLowerCase()) || b.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold ${b.isExceeded ? "text-red-600 dark:text-red-400" : b.isNearLimit ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"}`}>
                          {formatCurrency(b.actual)} / {formatCurrency(b.amount)}
                        </span>
                        <button
                          onClick={() => handleDeleteBudget(b.category)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${b.isExceeded ? "bg-red-500" : b.isNearLimit ? "bg-amber-400" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(b.usedPct, 100)}%` }}
                      />
                    </div>
                    {b.isNearLimit && !b.isExceeded && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        {t("budgetNearLimit") || "Approaching budget limit"} ({Math.round(b.usedPct)}%)
                      </p>
                    )}
                    {b.isExceeded && (
                      <p className="text-[11px] text-red-600 dark:text-red-400">
                        {t("budgetExceeded") || "Budget exceeded"} ({Math.round(b.usedPct)}%)
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Budget Editor Dialog */}
      <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              {t("setBudget") || "Set Monthly Budget"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("category")}</Label>
              <Select value={budgetEditCategory} onValueChange={setBudgetEditCategory}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {t(cat.toLowerCase()) || cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("budgetAmount") || "Budget Amount"}</Label>
              <Input
                type="number"
                min="0"
                step="1000"
                placeholder="0"
                value={budgetEditAmount}
                onChange={(e) => setBudgetEditAmount(e.target.value)}
              />
            </div>
            {budgetEditCategory && budgets.find((b) => b.category === budgetEditCategory) && (
              <p className="text-xs text-slate-500">
                {t("currentBudget") || "Current budget"}: {formatCurrency(budgets.find((b) => b.category === budgetEditCategory)!.amount)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBudgetDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSaveBudget}
              disabled={!budgetEditCategory || !budgetEditAmount || isSavingBudget}
            >
              {isSavingBudget && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search and Filters */}
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
                if (value === "" && searchTerm !== "") {
                  handleClearSearch();
                }
              }}
              onKeyDown={(e) => {
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
              <SelectItem value="cash">{t("cash")}</SelectItem>
              <SelectItem value="click">Click</SelectItem>
              <SelectItem value="terminal">{t("terminal") || "Terminal"}</SelectItem>
              <SelectItem value="card">{t("card")}</SelectItem>
              <SelectItem value="bank">{t("bankTransfer")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paginatedExpenses}
            loading={isLoading}
            skeletonRows={8}
            selectable
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={() => toggleSelectAll(paginatedExpenses)}
            areAllSelected={areAllSelected(paginatedExpenses)}
            areSomeSelected={areSomeSelected(paginatedExpenses)}
            bulkActions={
              canDeleteExpenses ? (
                <>
                  <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    {t("deleteSelected") || "Delete Selected"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearSelection}>
                    {t("cancel")}
                  </Button>
                </>
              ) : null
            }
            emptyTitle={t("noExpensesFound")}
            pagination={{
              page: currentPage,
              limit: itemsPerPage,
              total: totalExpenses,
            }}
            onPageChange={handlePageChange}
            onLimitChange={(limit) => {
              filterChangeInProgressRef.current = true;
              setItemsPerPage(limit);
              setCurrentPage(1);
            }}
            limitOptions={[10, 20, 50, 100]}
            renderCard={(expense, isSelected, onToggle) => (
              <div
                key={expense.id}
                className={`border rounded-lg p-4 transition-all ${
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={onToggle}
                      className="mt-0.5 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {expense.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(expense.date).toLocaleDateString("en-GB").replace(/\//g, ".")}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-red-600 dark:text-red-400 flex-shrink-0">
                    {formatCurrency(expense.amount)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {t(getCategoryTranslationKey(expense.category))}
                    </Badge>
                    <Badge className={`gap-1 text-xs ${getPaymentMethodColor(expense.paymentMethod)}`}>
                      {getPaymentMethodIcon(expense.paymentMethod)}
                      <span>{t(expense.paymentMethod === "bank" ? "bankTransfer" : expense.paymentMethod)}</span>
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(expense)} disabled={!canEditExpenses}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(expense.id)} disabled={!canDeleteExpenses}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
                {expense.createdBy && (
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    {t("whoAddedExpenses")}: {getUserName(expense.createdBy)}
                  </p>
                )}
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Custom Confirmation Dialog */}
      <Dialog
        open={confirmDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
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
