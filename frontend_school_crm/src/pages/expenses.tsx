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
import { useNotify } from "@/hooks/use-notify";
import { useLanguage } from "@/hooks/use-language";
import { getTranslation } from "@/lib/translations";
import { formatCurrency } from "@/lib/exportUtils";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { useRefetchOnFocus } from "@/hooks/use-refetch-on-focus";
import { DataTable, Column } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { FilterBar, FilterSearch, FilterReset, filterSelectClass } from "@/components/FilterBar";
import { useBranch } from "@/context/BranchContext";

export default function ExpensesPage() {
  const router = useRouter();
  const { currentBranch, isLoading: branchLoading } = useBranch();
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
  const [formErrors, setFormErrors] = useState<{
    category?: string;
    description?: string;
    amount?: string;
  }>({});

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
  const notify = useNotify();

  const financialMonthKey = currentBranch?.currentFinancialMonth
    ? `${currentBranch.currentFinancialMonth.year}-${currentBranch.currentFinancialMonth.month}`
    : undefined;

  // The sidebar already hides this link for anyone lacking canViewExpenses
  // (see Layout.tsx), but that alone doesn't stop someone from typing the
  // URL directly — settings.tsx already guards its own page this way for
  // canViewSettings, so this mirrors that pattern for consistency.
  useEffect(() => {
    if (!hasPermission("canViewExpenses")) {
      router.push("/");
    }
  }, [router]);

  // Initialize state from URL params
  useEffect(() => {
    if (!router.isReady) return;
    // See the equivalent guard in assignments.tsx: without the branchLoading
    // check, a branch that never resolves left isLoading stuck at its
    // initial `true` forever — this effect never ran, so nothing ever
    // called setIsLoading(false).
    if (branchLoading) return;
    if (!currentBranch?.id) {
      setIsLoading(false);
      return;
    }

    if (initialLoadDoneRef.current) {
      // Branch switched or financial month changed — reset filters and reload
      setCurrentPage(1);
      setSelectedMonth("");
      setIsLoading(true);
      loadData().finally(() => setIsLoading(false));
      return;
    }

    // Initial load — read URL params first
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

    setIsLoading(true);
    loadData().finally(() => {
      setIsLoading(false);
      initialLoadDoneRef.current = true;
    });
    loadBudgets(month as string | undefined, year ? parseInt(year as string) : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, currentBranch?.id, financialMonthKey, branchLoading]);

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
      // No polling — caller (effects below) gate loadData on currentBranch.
      const branchId = currentBranch?.id;
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
      notify.error(t("error"), t("failedToLoadExpenses"));
    }
  };

  const loadBudgets = async (month?: string, year?: number) => {
    try {
      const branchId = currentBranch?.id;
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
    const branchId = currentBranch?.id;
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
      notify.success(t("saved"), t("budgetSaved"));
    } catch {
      notify.error(t("error"), t("failedToSaveBudget"));
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleDeleteBudget = async (category: string) => {
    const branchId = currentBranch?.id;
    if (!branchId) return;
    try {
      await deleteExpenseBudget(branchId, category, selectedMonth, selectedYear);
      setBudgets((prev) => prev.filter((b) => b.category !== category));
    } catch {
      notify.error(t("error"), t("failedToDeleteBudget"));
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

    // None of these were ever checked before: category/description (the
    // expense's title) could be submitted empty, and amount could be
    // blank/negative/zero — parseFloat of an empty string is NaN, sent
    // straight to the API.
    const errors: typeof formErrors = {};
    if (!formData.category) errors.category = t("fieldRequired");
    if (!formData.description.trim()) errors.description = t("fieldRequired");
    if (!formData.amount.trim() || !(parseFloat(formData.amount) > 0)) {
      errors.amount = formData.amount.trim() ? t("mustBePositive") : t("fieldRequired");
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

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
        notify.success(t("updated"), t("expenseUpdatedSuccess"));
      } else {
        await createExpense({
          title: formData.description, // Mapped from description
          category: formData.category,
          description: formData.notes, // Mapped from notes
          amount: parseFloat(formData.amount),
          paymentMethod: formData.paymentMethod,
          date: dateTimestamp,
          branchId: currentBranch?.id || "",
        });
        notify.success(t("created"), t("expenseCreatedSuccess"));
      }

      resetForm();
      await loadData();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Failed to save expense:", error);
      notify.error(t("error"), t("failedToSaveExpense"));
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
          notify.success(t("deletedItem"), t("expenseDeleted"));
        } catch (error) {
          console.error("Failed to delete expense:", error);
          notify.error(t("error"), t("expenseDeletedError"));
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
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await Promise.all(selectedIds.map((id) => deleteExpense(id)));
          clearSelection();
          await loadData();
          notify.success(t("deleted"), `${selectedIds.length} ${t("expensesDeleted")
              }`);
        } catch (error) {
          console.error("Failed to delete expenses:", error);
          notify.error(t("error"), t("failedToDeleteExpenses"));
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
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
    setFormErrors({});
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
        <span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">
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
            aria-label={t("edit")}
            onClick={(e) => { e.stopPropagation(); handleEdit(expense); }}
            disabled={!canEditExpenses}
            title={canEditExpenses ? "" : t("noPermission")}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={t("delete")}
            onClick={(e) => { e.stopPropagation(); handleDelete(expense.id); }}
            disabled={!canDeleteExpenses}
            title={canDeleteExpenses ? "" : t("noPermission")}
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
            className="bg-brand hover:bg-brand-hover"
            onClick={() => { resetForm(); setIsDialogOpen(true); }}
            disabled={!canCreateExpenses}
            title={
              !canCreateExpenses
                ? t("noPermission")
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
                  onValueChange={(value) => {
                    setFormData({ ...formData, category: value });
                    if (formErrors.category) setFormErrors((er) => ({ ...er, category: undefined }));
                  }}
                >
                  <SelectTrigger className={formErrors.category ? "border-red-500 focus:ring-red-500" : ""}>
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
                {formErrors.category && (
                  <p className="text-xs text-red-500">{formErrors.category}</p>
                )}
              </div>

              <Field
                id="amount"
                label={`${t("amount")} *`}
                type="number"
                value={formData.amount}
                error={formErrors.amount}
                placeholder="0"
                step="0.01"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFormData({ ...formData, amount: e.target.value });
                  if (formErrors.amount) setFormErrors((er) => ({ ...er, amount: undefined }));
                }}
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
                error={formErrors.description}
                placeholder={t("briefDescription")}
                className="md:col-span-2"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (formErrors.description) setFormErrors((er) => ({ ...er, description: undefined }));
                }}
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              {t("totalExpenses")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-36 mb-1" /> : (
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalExpenseAmount)}</div>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("thisMonth")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              {t("cardPayments")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-28" /> : (
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalByMethod.card)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              {t("cashPayments")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-28" /> : (
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalByMethod.cash)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {t("bankTransfers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-28" /> : (
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalByMethod.bank)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget vs Actual Widget */}
      {isAdmin && (budgets.length > 0 || selectedMonth) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-500" />
                {t("budgetVsActual")}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setIsBudgetDialogOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                {t("setBudget")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {budgets.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                {t("noBudgetsSet")}
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
                          aria-label={t("delete")}
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
                        {t("budgetNearLimit")} ({Math.round(b.usedPct)}%)
                      </p>
                    )}
                    {b.isExceeded && (
                      <p className="text-[11px] text-red-600 dark:text-red-400">
                        {t("budgetExceeded")} ({Math.round(b.usedPct)}%)
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
              {t("setBudget")}
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
              <Label>{t("budgetAmount")}</Label>
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
                {t("currentBudget")}: {formatCurrency(budgets.find((b) => b.category === budgetEditCategory)!.amount)}
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

      {/* Filter bar */}
      <FilterBar>
        <FilterSearch
          value={searchInput}
          onChange={(v) => { setSearchInput(v); if (v === "" && searchTerm !== "") handleClearSearch(); }}
          onSearch={handleSearch}
          placeholder={t("searchExpenses")}
        />
        <Select value={filterCategory} onValueChange={handleCategoryChange}>
          <SelectTrigger className={filterSelectClass("w-44")}>
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
        <Select value={filterPaymentMethod} onValueChange={handlePaymentMethodChange}>
          <SelectTrigger className={filterSelectClass("w-36")}>
            <SelectValue placeholder={t("allMethods")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allMethods")}</SelectItem>
            <SelectItem value="cash">{t("cash")}</SelectItem>
            <SelectItem value="click">Click</SelectItem>
            <SelectItem value="terminal">{t("terminal")}</SelectItem>
            <SelectItem value="card">{t("card")}</SelectItem>
            <SelectItem value="bank">{t("bankTransfer")}</SelectItem>
          </SelectContent>
        </Select>
        <FilterReset
          onClick={handleClearSearch}
          show={searchInput !== "" || filterCategory !== "all" || filterPaymentMethod !== "all"}
          label={t("reset")}
        />
      </FilterBar>

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
                    {t("deleteSelected")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={clearSelection}>
                    {t("cancel")}
                  </Button>
                </>
              ) : null
            }
            emptyIcon={TrendingDown}
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
                    <Button size="icon" variant="ghost" aria-label={t("edit")} className="h-7 w-7" onClick={() => handleEdit(expense)} disabled={!canEditExpenses}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={t("delete")} className="h-7 w-7" onClick={() => handleDelete(expense.id)} disabled={!canDeleteExpenses}>
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
              className="bg-brand hover:bg-brand-hover"
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
