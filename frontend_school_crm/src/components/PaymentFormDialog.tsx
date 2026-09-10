import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormDialog } from "@/components/FormDialog";
import { Field } from "@/components/Field";
import { Payment, PaymentStatus, StudentPaymentMethod } from "@/types";
import {
  createPayment as apiCreatePayment,
  updatePayment as apiUpdatePayment,
  searchStudentsWithPayments,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/exportUtils";
import { formatNumberWithSpaces, removeNumberFormatting } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface StudentInfo {
  fullName: string;
  phone: string;
  classId: string;
  className: string;
  monthlyPayment: number;
}

interface SearchStudent {
  id: string;
  fullName: string;
  phone: string;
  classId: string;
  className: string;
  monthlyPayment: number;
  paidAmount: number;
  status: "paid" | "partial" | "none";
  branchId: string;
}

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editPayment: Payment | null;
  branchId: string | null;
  existingPayments: Payment[];
  defaultMonth: string;
  defaultYear: string;
  months: string[];
  getMonthName: (month: string) => string;
  studentInfoMap: Map<string, StudentInfo>;
  onSuccess: () => void;
  t: (key: string) => string;
}

const defaultFormData = (month: string, year: string) => ({
  studentId: "",
  amount: "",
  month,
  year,
  status: "partial" as PaymentStatus,
  paymentMethod: "cash" as StudentPaymentMethod,
  notes: "",
});

export function PaymentFormDialog({
  isOpen,
  onOpenChange,
  editPayment,
  branchId,
  existingPayments,
  defaultMonth,
  defaultYear,
  months,
  getMonthName,
  studentInfoMap,
  onSuccess,
  t,
}: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState(defaultFormData(defaultMonth, defaultYear));
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [filteredStudents, setFilteredStudents] = useState<SearchStudent[]>([]);
  const [selectedStudentInfo, setSelectedStudentInfo] = useState<SearchStudent | null>(null);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState<{
    paidTotal: number;
    remaining: number;
    status: "paid" | "partial" | "none";
  } | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = editPayment !== null;

  // Initialize / reset form when dialog opens or editPayment changes
  useEffect(() => {
    if (!isOpen) return;
    if (editPayment) {
      setFormData({
        studentId: editPayment.studentId,
        amount: editPayment.amount.toString(),
        month: editPayment.month,
        year: editPayment.year.toString(),
        status: editPayment.status,
        paymentMethod: editPayment.paymentMethod,
        notes: editPayment.notes || "",
      });
    } else {
      setFormData(defaultFormData(defaultMonth, defaultYear));
    }
    setStudentSearchTerm("");
    setShowStudentDropdown(false);
    setSelectedStudentInfo(null);
    setPaymentSummary(null);
    setFormSubmitted(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editPayment]);

  // Close student dropdown when clicking outside
  useEffect(() => {
    if (!showStudentDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-student-search-container]")) {
        setShowStudentDropdown(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showStudentDropdown]);

  // Debounced student search
  useEffect(() => {
    if (!branchId || !studentSearchTerm.trim()) {
      setFilteredStudents([]);
      return;
    }
    setIsSearchingStudents(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchStudentsWithPayments(
          branchId,
          studentSearchTerm,
          formData.month,
          formData.year,
        );
        setFilteredStudents(results || []);
      } catch {
        setFilteredStudents([]);
      } finally {
        setIsSearchingStudents(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearchTerm, formData.month, formData.year, branchId]);

  // Refresh payment summary when month/year changes while a student is already selected
  useEffect(() => {
    if (!isOpen || !formData.studentId || !selectedStudentInfo || !branchId) return;
    const timer = setTimeout(async () => {
      try {
        const results = await searchStudentsWithPayments(
          branchId,
          selectedStudentInfo.fullName,
          formData.month,
          formData.year,
        );
        const studentData = results.find((s) => s.id === formData.studentId);
        if (studentData) {
          const monthly = studentData.monthlyPayment || 0;
          const paidTotal = studentData.paidAmount || 0;
          const remaining = parseFloat((monthly - paidTotal).toFixed(2));
          if (paidTotal >= monthly) {
            setPaymentSummary({ paidTotal, remaining: 0, status: "paid" });
          } else if (paidTotal > 0) {
            setPaymentSummary({ paidTotal, remaining, status: "partial" });
          } else {
            setPaymentSummary({ paidTotal: 0, remaining: monthly, status: "none" });
          }
        }
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, formData.month, formData.year, formData.studentId, selectedStudentInfo, branchId]);

  // Recompute payment summary from existing payments when student/month/year changes
  useEffect(() => {
    const { studentId, month, year } = formData;
    if (!studentId || !month) {
      setPaymentSummary(null);
      return;
    }
    let monthly = 0;
    if (selectedStudentInfo?.id === studentId) {
      monthly = selectedStudentInfo.monthlyPayment;
    } else {
      const info = studentInfoMap.get(studentId);
      monthly = info?.monthlyPayment || 0;
    }
    const editingId = editPayment?.id ?? null;
    const paidTotal = existingPayments
      .filter(
        (p) =>
          p.studentId === studentId &&
          p.month === month &&
          p.year === parseInt(year) &&
          p.id !== editingId,
      )
      .reduce((sum, p) => sum + p.amount, 0);

    if (editingId) {
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

    if (paidTotal >= monthly) {
      setPaymentSummary({ paidTotal, remaining: 0, status: "paid" });
      setFormData((prev) => ({ ...prev, amount: monthly.toString(), status: "partial" }));
    } else if (paidTotal > 0) {
      const remaining = parseFloat((monthly - paidTotal).toFixed(2));
      setPaymentSummary({ paidTotal, remaining, status: "partial" });
      setFormData((prev) => ({ ...prev, amount: remaining.toString(), status: "partial" }));
    } else {
      setPaymentSummary({ paidTotal: 0, remaining: monthly, status: "none" });
      setFormData((prev) => ({ ...prev, amount: monthly.toString(), status: "partial" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.studentId, formData.month, formData.year, selectedStudentInfo, editPayment?.id]);

  const getStudentName = (studentId: string) => {
    if (selectedStudentInfo?.id === studentId) return selectedStudentInfo.fullName;
    return studentInfoMap.get(studentId)?.fullName ?? "Unknown";
  };

  const getStudentClassName = (studentId: string) => {
    if (selectedStudentInfo?.id === studentId) return selectedStudentInfo.className;
    return studentInfoMap.get(studentId)?.className ?? "N/A";
  };

  const getMonthlyPayment = (studentId: string): number => {
    if (selectedStudentInfo?.id === studentId) return selectedStudentInfo.monthlyPayment;
    const result = filteredStudents.find((s) => s.id === studentId);
    return result?.monthlyPayment ?? studentInfoMap.get(studentId)?.monthlyPayment ?? 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    if (!formData.studentId) { setIsSubmitting(false); return; }
    setIsSubmitting(true);
    const user = getCurrentUser();
    if (!user) { setIsSubmitting(false); return; }

    const monthlyPaymentValue = getMonthlyPayment(formData.studentId);
    const newAmount = parseFloat(formData.amount);

    // Without this, a blank/non-numeric amount produced NaN, and
    // `NaN > monthlyPaymentValue` is always false — so the overpayment
    // guards below silently passed a NaN (or a negative amount, which is
    // also never > a positive balance) straight through to the API.
    if (!formData.amount || !Number.isFinite(newAmount) || newAmount <= 0) {
      setIsSubmitting(false);
      return;
    }

    if (isEditing && editPayment) {
      const paidTotalExcludingCurrent = existingPayments
        .filter(
          (p) =>
            p.studentId === formData.studentId &&
            p.month === formData.month &&
            p.year === parseInt(formData.year) &&
            p.id !== editPayment.id,
        )
        .reduce((sum, p) => sum + p.amount, 0);

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

      try {
        await apiUpdatePayment(editPayment.id, {
          amount: newAmount,
          status: formData.status as PaymentStatus,
          paymentMethod: formData.paymentMethod,
          notes: formData.notes || undefined,
          paidDate: new Date().toISOString(),
        });
        toast({
          title: t("paymentUpdated"),
          description: t("paymentUpdatedDescription"),
        });
      } catch {
        toast({ title: t("error"), description: t("failedToUpdatePayment"), variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
    } else {
      const periodPaidTotal = existingPayments
        .filter(
          (p) =>
            p.studentId === formData.studentId &&
            p.month === formData.month &&
            p.year === parseInt(formData.year),
        )
        .reduce((sum, p) => sum + p.amount, 0);

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

      const totalAfterPayment = periodPaidTotal + newAmount;
      const finalStatus: PaymentStatus = totalAfterPayment >= monthlyPaymentValue ? "paid" : "partial";
      const student = filteredStudents.find((s) => s.id === formData.studentId);

      try {
        await apiCreatePayment({
          studentId: formData.studentId,
          amount: newAmount,
          month: formData.month,
          year: parseInt(formData.year),
          status: finalStatus,
          paymentMethod: formData.paymentMethod,
          invoiceNumber: `INV-${Date.now()}`,
          notes: formData.notes || undefined,
          paidDate: new Date().toISOString(),
          branchId: student?.branchId || branchId || user.branchId || "",
        });

        if (finalStatus === "paid") {
          const relatedPartial = existingPayments.filter(
            (p) =>
              p.studentId === formData.studentId &&
              p.month === formData.month &&
              p.year === parseInt(formData.year) &&
              p.status === "partial",
          );
          for (const p of relatedPartial) {
            try { await apiUpdatePayment(p.id, { status: "paid" }); } catch { /* best-effort */ }
          }
        }

        toast({
          title: t("paymentCreated"),
          description: t("paymentCreatedDescription"),
        });
      } catch {
        toast({ title: t("error"), description: "Failed to create payment", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
    }

    qc.invalidateQueries({ queryKey: ["payments"] });
    onSuccess();
    onOpenChange(false);
    setIsSubmitting(false);
  };

  const handleStudentSelect = (student: SearchStudent) => {
    const monthly = student.monthlyPayment || 0;
    const paidTotal = student.paidAmount || 0;
    setSelectedStudentInfo(student);
    setStudentSearchTerm("");
    setShowStudentDropdown(false);

    if (paidTotal >= monthly) {
      setFormData((prev) => ({ ...prev, studentId: student.id, amount: monthly.toString(), status: "paid" }));
      setPaymentSummary({ paidTotal, remaining: 0, status: "paid" });
    } else if (paidTotal > 0) {
      const remaining = parseFloat((monthly - paidTotal).toFixed(2));
      setFormData((prev) => ({ ...prev, studentId: student.id, amount: remaining.toString(), status: "partial" }));
      setPaymentSummary({ paidTotal, remaining, status: "partial" });
    } else {
      setFormData((prev) => ({ ...prev, studentId: student.id, amount: monthly.toString(), status: "partial" }));
      setPaymentSummary({ paidTotal: 0, remaining: monthly, status: "none" });
    }
  };

  const clearStudentSelection = () => {
    setStudentSearchTerm("");
    setSelectedStudentInfo(null);
    setFormData((prev) => ({ ...prev, studentId: "", amount: "" }));
    setPaymentSummary(null);
    setShowStudentDropdown(false);
  };

  return (
    <FormDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setStudentSearchTerm("");
          setShowStudentDropdown(false);
        }
        onOpenChange(open);
      }}
      title={isEditing ? t("editPayment") : t("recordNewPayment")}
      onSubmit={handleSubmit}
      submitLabel={isEditing ? t("saveChanges") : t("recordPayment")}
      submittingLabel={t("recording")}
      isPending={isSubmitting}
      maxWidth="max-w-2xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Student search */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="studentSearch">{t("student")} *</Label>
          <div className="relative" data-student-search-container>
            <div className="relative">
              <Input
                id="studentSearch"
                type="text"
                placeholder={t("searchStudent")}
                value={studentSearchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setStudentSearchTerm(value);
                  setShowStudentDropdown(true);
                  if (value === "" && formData.studentId) {
                    setFormData((prev) => ({ ...prev, studentId: "", amount: "" }));
                    setPaymentSummary(null);
                  }
                }}
                onFocus={() => setShowStudentDropdown(true)}
                className="w-full pr-10"
                disabled={isEditing}
              />
              {formData.studentId && !studentSearchTerm && (
                <div className="absolute inset-0 flex items-center px-3 pointer-events-none bg-slate-50 dark:bg-slate-900/50 rounded-md">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {getStudentName(formData.studentId)} — {getStudentClassName(formData.studentId)}
                  </span>
                </div>
              )}
              {(studentSearchTerm || formData.studentId) && !isEditing && (
                <button
                  type="button"
                  onClick={clearStudentSelection}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  title={t("clear")}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {showStudentDropdown && !isEditing && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                {isSearchingStudents ? (
                  <div className="px-3 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {t("searching")}
                      </span>
                    </div>
                  </div>
                ) : filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-b-0 flex justify-between items-center"
                      onClick={() => handleStudentSelect(student)}
                    >
                      <div>
                        <div className="font-medium text-sm">{student.fullName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {student.className} • {student.phone}
                          {student.paidAmount > 0 && (
                            <span className="ml-2 text-xs">
                              ({t(student.status) || student.status}: {formatCurrency(student.paidAmount)})
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                ) : studentSearchTerm ? (
                  <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                    {t("noStudentsFound")}
                  </div>
                ) : (
                  <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                    {t("typeToSearch")}
                  </div>
                )}
              </div>
            )}
          </div>
          {formSubmitted && !formData.studentId && (
            <p className="text-red-500 text-sm mt-1">
              {t("studentRequired")}
            </p>
          )}
        </div>

        {/* Payment summary banner */}
        {formData.studentId && formData.month && paymentSummary && (
          <div className="md:col-span-2 p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
            {paymentSummary.status === "paid" && (
              <p className="text-sm text-green-700 dark:text-green-300">{t("alreadyPaid")}</p>
            )}
            {paymentSummary.status === "partial" && (
              <p className="text-sm text-orange-700 dark:text-orange-300">
                {t("partialPaid")}: {formatCurrency(paymentSummary.paidTotal)} •{" "}
                {t("remainingAmount")}: {formatCurrency(paymentSummary.remaining)}
              </p>
            )}
            {paymentSummary.status === "none" && (
              <p className="text-sm text-slate-600 dark:text-slate-400">{t("noPaymentsYet")}</p>
            )}
          </div>
        )}

        <Field
          id="amount"
          label={`${t("amount")} *`}
          type="text"
          value={formatNumberWithSpaces(formData.amount)}
          error={
            formSubmitted
              ? !formData.amount
                ? t("fieldRequired")
                : !(parseFloat(formData.amount) > 0)
                ? t("mustBePositive")
                : undefined
              : undefined
          }
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setFormData((prev) => ({ ...prev, amount: removeNumberFormatting(e.target.value) }))
          }
          placeholder="0"
        />

        <div className="space-y-2">
          <Label htmlFor="status">{t("paymentStatusLabel")} *</Label>
          <Select
            value={formData.status}
            onValueChange={(value: PaymentStatus) =>
              setFormData((prev) => ({ ...prev, status: value }))
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
          <Label htmlFor="paymentMethod">{t("paymentMethod")} *</Label>
          <Select
            value={formData.paymentMethod}
            onValueChange={(value: StudentPaymentMethod) =>
              setFormData((prev) => ({ ...prev, paymentMethod: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="click">{t("click")}</SelectItem>
              <SelectItem value="cash">{t("cash")}</SelectItem>
              <SelectItem value="terminal">{t("terminal")}</SelectItem>
              <SelectItem value="bank">{t("bankTransfer")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="month">{t("month")} *</Label>
          <Select
            value={formData.month}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, month: value }))}
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
            setFormData((prev) => ({ ...prev, year: e.target.value }))
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
            setFormData((prev) => ({ ...prev, notes: e.target.value }))
          }
        />
      </div>
    </FormDialog>
  );
}
