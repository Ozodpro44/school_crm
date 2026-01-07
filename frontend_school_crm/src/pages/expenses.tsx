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
} from "lucide-react";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import {
  createExpense,
  listExpenses,
  deleteExpense,
  updateExpense,
  getUser,
  getBranch,
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

export default function ExpensesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [userCache, setUserCache] = useState<{ [key: string]: string }>({});
  const [branchData, setBranchData] = useState<Branch | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "branch_admin";
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
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
    setIsLoading(true);
    const timer = setTimeout(() => {
      loadData();
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Refetch when branch changes
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

  const t = (key: string) => getTranslation(key, language);

  const loadData = async (month?: string, year?: number) => {
    try {
      const branchId = localStorage.getItem("selectedBranchId") || "";
      let data: Expense[] = [];
      
      // Load branch data to get current month
      if (branchId) {
        const branch = await getBranch(branchId);
        setBranchData(branch);
        
        // Use financial month data if available, otherwise fall back to current date
        const currentMonth = branch.currentFinancialMonth?.month?.toString().padStart(2, '0') || new Date().getMonth().toString().padStart(2, '0');
        const currentYear = branch.currentFinancialMonth?.year || new Date().getFullYear();
        
        // Set selected month to branch's current month if not already set and not provided
        const targetMonth = month || selectedMonth || currentMonth;
        const targetYear = year || selectedYear || currentYear;
        
        if (!selectedMonth) {
          setSelectedMonth(currentMonth);
          setSelectedYear(currentYear);
        }
        
        // Always use the current branch month for filtering
        const queryMonth = targetMonth;
        const queryYear = targetYear;
        
        data = await listExpenses(branchId, queryMonth, queryYear);
        setExpenses(data);
      }

      // Fetch user names for all unique creators
      const creatorIds = [
        ...new Set(data.map((e) => e.createdBy).filter(Boolean)),
      ];
      for (const userId of creatorIds) {
        await fetchAndCacheUserName(userId);
      }
    } catch (error) {
      console.error("Failed to load expenses:", error);
      toast({
        title: "Error",
        description: "Failed to load expenses",
        variant: "destructive",
      });
    }
  };

  const handleMonthChange = (month: string, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    loadData(month, year);
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
        formData.date + "T00:00:00Z"
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
        title: "Error",
        description: "Failed to save expense",
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
      onConfirm: async () => {
        try {
          await deleteExpense(id);
          await loadData();
          toast({
            title: t("deletedItem"),
            description: t("expenseDeleted"),
            variant: "success",
          });
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        } catch (error) {
          console.error("Failed to delete expense:", error);
          toast({
            title: "Error",
            description: "Failed to delete expense",
            variant: "destructive",
          });
        }
      },
      onCancel: () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
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
            description: `${selectedIds.length} ${
              t("expensesDeleted") || "expenses deleted"
            }`,
            variant: "success",
          });
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        } catch (error) {
          console.error("Failed to delete expenses:", error);
          toast({
            title: "Error",
            description: "Failed to delete expenses",
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

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch =
      expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      filterCategory === "all" || expense.category === filterCategory;

    const matchesPaymentMethod =
      filterPaymentMethod === "all" ||
      expense.paymentMethod === filterPaymentMethod;

    return matchesSearch && matchesCategory && matchesPaymentMethod;
  });

  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedExpenses = filteredExpenses.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalByMethod = {
    card: expenses
      .filter((e) => e.paymentMethod === "card")
      .reduce((sum, e) => sum + e.amount, 0),
    cash: expenses
      .filter((e) => e.paymentMethod === "cash")
      .reduce((sum, e) => sum + e.amount, 0),
    bank: expenses
      .filter((e) => e.paymentMethod === "bank")
      .reduce((sum, e) => sum + e.amount, 0),
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
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={() => {
                  confirmDialog.onConfirm();
                }}
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
              >
                {t("delete")}
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
              currentBranchMonth={branchData.currentFinancialMonth?.month?.toString().padStart(2, '0')}
              currentBranchYear={branchData.currentFinancialMonth?.year}
            />
          </div>
        )}

        <div className="flex-1 flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
              onClick={() => resetForm()}
              disabled={!canCreateExpenses}
              title={!canCreateExpenses ? t("noPermission") || "No permission to create expenses" : ""}
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
                    placeholder="10000"
                    step="0.01"
                  />
                </div>

                <div className="space-y-2">
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
                      setFormData({ ...formData, description: e.target.value })
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
                   ) : (
                     editingExpense ? t("update") : t("addExpense")
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
              {formatCurrency(totalExpenses)}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t("allTime")}
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
        className={`border-l-4 transition-all ${
          getSelectedCount() > 0
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
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder={t("searchExpenses")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t("allCategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCategories")}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {t(category)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterPaymentMethod}
              onValueChange={setFilterPaymentMethod}
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
                        areAllSelected(filteredExpenses) ||
                        areSomeSelected(filteredExpenses)
                      }
                      onCheckedChange={() => toggleSelectAll(filteredExpenses)}
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
                    className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
                      isSelected(expense.id)
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
                      <Badge variant="outline">{t(expense.category)}</Badge>
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
                          expense.paymentMethod
                        )}`}
                      >
                        {getPaymentMethodIcon(expense.paymentMethod)}
                        {t(
                          expense.paymentMethod === "bank"
                            ? "bankTransfer"
                            : expense.paymentMethod
                        )}
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

            {filteredExpenses.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  {t("noExpensesFound")}
                </p>
              </div>
            )}

            {/* Pagination */}
            {filteredExpenses.length > 0 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {t("showing")} {startIndex + 1} -{" "}
                  {Math.min(startIndex + itemsPerPage, filteredExpenses.length)}{" "}
                  {t("of")} {filteredExpenses.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/expenses?page=${Math.max(1, currentPage - 1)}`
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
                          onClick={() => router.push(`/expenses?page=${page}`)}
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
                        `/expenses?page=${Math.min(
                          totalPages,
                          currentPage + 1
                        )}`
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
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={() => {
                confirmDialog.onConfirm();
              }}
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
