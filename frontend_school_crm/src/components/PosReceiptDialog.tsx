import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatCurrency } from "@/lib/exportUtils";
import type { Payment, Student } from "@/types";

export type PosReceiptData = {
  payment: Payment;
  student: Student;
  className: string;
};

type PosReceiptDialogProps = {
  data: PosReceiptData | null;
  onClose: () => void;
  branchName?: string;
  /**
   * Translation function — the dialog falls back to English defaults when a
   * key returns the same key (no translation defined).
   */
  t: (key: string) => string;
  /** Convert numeric month → human-readable month name. */
  formatMonth: (m: string | number) => string;
  /** Convert payment method → localized label. */
  formatMethod: (m: string) => string;
  /** Convert payment status → localized label. */
  formatStatus: (s: string) => string;
};

/**
 * PosReceiptDialog — print-friendly receipt preview for a single payment.
 *
 * Extracted from `pages/payments.tsx` (Phase 7.2 — split monolithic page).
 * Pure presentational: state lives in the parent; the dialog only renders
 * what it's given and calls `onClose` when dismissed or after print.
 */
export function PosReceiptDialog({
  data,
  onClose,
  branchName,
  t,
  formatMonth,
  formatMethod,
  formatStatus,
}: PosReceiptDialogProps) {
  return (
    <Dialog open={data !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("printReceipt") || "Print Receipt"}</DialogTitle>
        </DialogHeader>
        {data && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-950 border-2 border-dashed border-slate-300 dark:border-slate-700 p-4 font-mono text-sm leading-relaxed print:border-0 print:bg-white print:text-black">
              {/* Header */}
              <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-300 pb-2 mb-2">
                <p className="font-bold text-lg print:text-base">
                  {t("receipt") || "RECEIPT"}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 print:text-black print:text-opacity-70">
                  {branchName || "Branch"}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 print:text-black print:text-opacity-70">
                  {new Date().toLocaleDateString("en-GB").replace(/\//g, ".")}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 print:text-black print:text-opacity-70">
                  {new Date().toLocaleTimeString()}
                </p>
              </div>

              {/* Student */}
              <ReceiptRow label={t("student") || "Student"} value={data.student.fullName} />
              <ReceiptRow label={t("class") || "Class"} value={data.className} divider />

              {/* Payment */}
              <ReceiptRow
                label={t("period") || "Period"}
                value={`${formatMonth(data.payment.month)} ${data.payment.year}`}
              />
              <ReceiptRow
                label={t("status") || "Status"}
                value={formatStatus(data.payment.status)}
                divider
              />

              {/* Amount */}
              <div className="border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-300 pb-2 mb-2">
                <div className="flex justify-between print:text-black">
                  <span className="font-semibold">{t("amount") || "Amount"}:</span>
                  <span className="font-bold">{formatCurrency(data.payment.amount)}</span>
                </div>
              </div>

              {/* Method */}
              <ReceiptRow
                label={t("method") || "Method"}
                value={formatMethod(data.payment.paymentMethod)}
                divider
              />

              {/* Footer */}
              <div className="text-center text-xs text-slate-600 dark:text-slate-400 print:text-black print:text-opacity-70 mt-4">
                <p>{t("thankYouForPayment")}</p>
                <p>{t("pleaseKeepReceipt")}</p>
              </div>
            </div>

            {/* Action buttons (hidden in print) */}
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReceiptRow({
  label,
  value,
  divider = false,
}: {
  label: string;
  value: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      className={
        divider
          ? "border-b border-dashed border-slate-300 dark:border-slate-700 print:border-slate-300 pb-2 mb-2"
          : ""
      }
    >
      <p className="print:text-black">
        <span className="font-semibold">{label}:</span> {value}
      </p>
    </div>
  );
}
