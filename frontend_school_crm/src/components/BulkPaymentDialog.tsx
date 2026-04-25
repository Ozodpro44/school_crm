import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  UserPlus,
  CreditCard,
  Banknote,
  Building2,
  Printer,
  Search,
} from "lucide-react";
import { Payment, StudentPaymentMethod } from "@/types";
import { getCurrentUser } from "@/lib/auth";
import {
  createPayment as apiCreatePayment,
  searchStudentsWithPayments,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/exportUtils";

type BulkStudent = {
  id: string;
  fullName: string;
  phone: string;
  classId: string;
  className: string;
  monthlyPayment: number;
  paidAmount: number;
  status: "paid" | "partial" | "none";
  branchId: string;
};

export type BulkPaymentDialogProps = {
  branchId: string | null;
  existingPayments: Payment[];
  defaultYear: string;
  months: string[];
  t: (key: string) => string;
  getMonthName: (m: string) => string;
  onSuccess?: () => void;
};

const getDefaultMonth = () => {
  const month = new Date().getMonth() + 1;
  return month.toString().padStart(2, "0");
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
    default:
      return "";
  }
};

export function BulkPaymentDialog({
  branchId,
  existingPayments,
  defaultYear,
  months,
  t,
  getMonthName,
  onSuccess,
}: BulkPaymentDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkPaymentOpen, setIsBulkPaymentOpen] = useState(false);
  const [bulkSearchTerm, setBulkSearchTerm] = useState("");
  const [isBulkSearching, setIsBulkSearching] = useState(false);
  const [bulkStudentsList, setBulkStudentsList] = useState<BulkStudent[]>([]);
  const [bulkPaymentData, setBulkPaymentData] = useState({
    month: getDefaultMonth(),
    year: defaultYear,
    paymentMethod: "cash" as StudentPaymentMethod,
  });

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId],
    );
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
      const student = bulkStudentsList.find((s) => s.id === studentId);

      // If not found in bulk list, skip
      if (!student) {
        console.warn(`Student ${studentId} not found in bulk list`);
        continue;
      }

      const paidTotal = existingPayments
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

    if (onSuccess) {
      onSuccess();
    } else {
      qc.invalidateQueries({ queryKey: ["payments"] });
    }
    setIsBulkPaymentOpen(false);
    setSelectedStudentIds([]);
    setBulkSearchTerm("");
    setBulkStudentsList([]);
    setBulkPaymentData({
      month: "",
      year: defaultYear,
      paymentMethod: "cash",
    });
  };

  // Load students when bulk payment dialog opens or search term changes
  useEffect(() => {
    const loadBulkPaymentStudents = async () => {
      if (!isBulkPaymentOpen) return;

      const selectedBranchId = branchId;
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
  }, [
    isBulkPaymentOpen,
    bulkPaymentData.month,
    bulkPaymentData.year,
    bulkSearchTerm,
    branchId,
  ]);

  return (
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
              <Label htmlFor="bulkMonth">{t("month")} *</Label>
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
                onValueChange={(value: StudentPaymentMethod) =>
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
                  <SelectItem value="click">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      {t("click")}
                    </div>
                  </SelectItem>
                  <SelectItem value="cash">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4" />
                      {t("cash")}
                    </div>
                  </SelectItem>
                  <SelectItem value="terminal">
                    <div className="flex items-center gap-2">
                      <Printer className="w-4 h-4" />
                      {t("terminal")}
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
  );
}

export default BulkPaymentDialog;
