# Payment System Documentation

## Overview

The WonderKids payment system supports flexible, multi-method student payment tracking with partial payment aggregation. Students can pay in installments using different payment methods (cash, card, bank transfer), and the system automatically aggregates these to track fully-paid status.

---

## Database Schema

### Payment Model

```typescript
interface Payment {
  id: string; // Unique identifier (payment-{timestamp}-{random})
  studentId: string; // Reference to the student
  amount: number; // Payment amount for this transaction
  month: string; // Payment period (e.g., "January", "February")
  year: number; // Payment year (e.g., 2025)
  paymentMethod: PaymentMethod; // How payment was made: "cash" | "card" | "bank"
  status: PaymentStatus; // "paid" | "unpaid" | "partial"
  invoiceNumber: string; // Unique invoice identifier (INV-{timestamp})
  notes?: string; // Optional notes about the payment
  paidDate?: string; // ISO timestamp when marked as paid
  branchId: string; // Which branch recorded this payment
  createdAt: string; // ISO timestamp of record creation
}
```

### Key Constraints

- **No duplicate full payments**: Once a student's total payments for a month equal or exceed their `monthlyPayment`, no additional payments can be recorded for that period.
- **Partial payments allowed**: Multiple payment records can exist for the same month/year (e.g., $50 cash + $30 card + $20 bank = $100 total).
- **Status aggregation**: All payments for a period are marked with the same status based on aggregated totals:
  - `paid`: Total amount ≥ required monthly payment
  - `partial`: 0 < Total amount < required monthly payment
  - `unpaid`: Total amount = 0

---

## Database Layer

### paymentsDB API

```typescript
export const paymentsDB = {
  // Core CRUD operations
  getAll(): Payment[];
  getByStudentId(studentId: string): Payment[];
  getByBranch(branchId: string): Payment[];
  create(payment: Omit<Payment, "id" | "createdAt">): Payment;
  update(id: string, updates: Partial<Payment>): Payment | null;
  delete(id: string): boolean;
};
```

### paymentHelpers API

Helper functions for payment validation and calculation:

```typescript
export const paymentHelpers = {
  /**
   * Get all payments for a student in a specific month/year
   * @param studentId - Student ID
   * @param month - Month name (e.g., "January")
   * @param year - Year (e.g., 2025)
   * @returns Array of Payment records for the period
   */
  getPaymentsByPeriod(studentId: string, month: string, year: number): Payment[];

  /**
   * Calculate total amount paid by a student for a specific month/year
   * @returns Total amount across all payment methods for the period
   */
  calculateTotalPaid(studentId: string, month: string, year: number): number;

  /**
   * Calculate remaining balance for a student in a specific month/year
   * @param monthlyPaymentRequired - The required monthly payment amount
   * @returns Amount still needed to reach the required payment (0 if already paid)
   */
  calculateRemainingBalance(
    studentId: string,
    month: string,
    year: number,
    monthlyPaymentRequired: number
  ): number;

  /**
   * Check if a student has fully paid for a specific month/year
   * @param monthlyPaymentRequired - The required monthly payment amount
   * @returns true if total paid >= required amount
   */
  isFullyPaid(
    studentId: string,
    month: string,
    year: number,
    monthlyPaymentRequired: number
  ): boolean;

  /**
   * Get payment breakdown by method for a specific student/period
   * @returns Object with amounts paid via cash, card, and bank
   */
  getPaymentBreakdownByMethod(
    studentId: string,
    month: string,
    year: number
  ): { cash: number; card: number; bank: number };
};
```

---

## Backend Logic & Validation Rules

### Rule 1: No Duplicate Full Payments

**When recording a new payment:**

1. Calculate the total amount already paid for the student/month/year
2. If `totalAlreadyPaid >= monthlyPaymentRequired`:
   - **REJECT** the new payment
   - Show error: "This student is already fully paid for the selected period"
3. Otherwise, allow the payment to be created

**Implementation location**: `src/pages/payments.tsx` → `handleSubmit()`

```typescript
const monthlyPaymentValue = student?.monthlyPayment || 0;
const periodPaidTotal = paymentsDB
  .getAll()
  .filter(
    (p) =>
      p.studentId === formData.studentId &&
      p.month === formData.month &&
      p.year === parseInt(formData.year)
  )
  .reduce((sum, p) => sum + p.amount, 0);

if (!editingPaymentId && periodPaidTotal >= monthlyPaymentValue) {
  toast({
    title: "This student is already fully paid for the selected period",
  });
  return; // Block payment creation
}
```

### Rule 2: Aggregate Status Reconciliation

**After any payment create/update/delete:**

1. Query all payments for the student/month/year
2. Calculate total amount paid across all methods
3. Compare to the student's required monthly payment:
   - If `total >= required` → mark all period payments as `paid`
   - If `0 < total < required` → mark all period payments as `partial`
   - If `total = 0` → mark all period payments as `unpaid`

**Implementation location**: `src/pages/payments.tsx` → `recomputePaymentStatus()`

```typescript
const recomputePaymentStatus = (
  studentId: string,
  month: string,
  year: number
) => {
  const student = students.find((s) => s.id === studentId);
  const monthly = student?.monthlyPayment || 0;
  const periodPayments = paymentsDB
    .getAll()
    .filter(
      (p) => p.studentId === studentId && p.month === month && p.year === year
    );
  const paidTotal = periodPayments.reduce((sum, p) => sum + p.amount, 0);

  if (paidTotal >= monthly && periodPayments.length > 0) {
    periodPayments.forEach((p) => {
      paymentsDB.update(p.id, {
        status: "paid",
        paidDate: new Date().toISOString(),
      });
    });
  } else if (paidTotal > 0) {
    periodPayments.forEach((p) => {
      paymentsDB.update(p.id, { status: "partial", paidDate: undefined });
    });
  } else {
    periodPayments.forEach((p) => {
      paymentsDB.update(p.id, { status: "unpaid", paidDate: undefined });
    });
  }
};
```

### Rule 3: Multi-Method Partial Payments

**Supported scenario:**

A student can split their monthly payment across multiple methods:

- Example: $500 total required
  - Payment 1: $200 cash on Dec 1 → **partial** status
  - Payment 2: $150 card on Dec 5 → still **partial** status (total $350)
  - Payment 3: $150 bank on Dec 15 → status changes to **paid** (total $500)

All payments in the period are marked with the same status based on the aggregated total.

---

## API Usage Examples

### Example 1: Record a Partial Cash Payment

```typescript
import { paymentsDB, paymentHelpers } from "@/lib/storage";

const payment = paymentsDB.create({
  studentId: "student-abc123",
  amount: 200,
  month: "December",
  year: 2025,
  paymentMethod: "cash",
  status: "partial",
  invoiceNumber: `INV-${Date.now()}`,
  branchId: "branch-1",
});

// Check remaining balance
const remaining = paymentHelpers.calculateRemainingBalance(
  "student-abc123",
  "December",
  2025,
  500 // required monthly payment
);
console.log(`Remaining balance: ${remaining}`); // Output: Remaining balance: 300
```

### Example 2: Validate Before Recording Payment

```typescript
const studentId = "student-abc123";
const month = "December";
const year = 2025;
const monthlyPayment = 500;

if (paymentHelpers.isFullyPaid(studentId, month, year, monthlyPayment)) {
  console.log("Student already fully paid for this period");
  return; // Don't allow new payment
}

// Safe to record payment
const remaining = paymentHelpers.calculateRemainingBalance(
  studentId,
  month,
  year,
  monthlyPayment
);
console.log(`Can record up to: ${remaining}`);
```

### Example 3: View Payment Breakdown by Method

```typescript
const breakdown = paymentHelpers.getPaymentBreakdownByMethod(
  "student-abc123",
  "December",
  2025
);

console.log(`Cash: $${breakdown.cash}`); // Cash: $200
console.log(`Card: $${breakdown.card}`); // Card: $150
console.log(`Bank: $${breakdown.bank}`); // Bank: $150
console.log(`Total: $${breakdown.cash + breakdown.card + breakdown.bank}`); // Total: $500
```

### Example 4: Bulk Payments with Duplicate Check

```typescript
const studentIds = ["student-1", "student-2", "student-3"];
const month = "December";
const year = 2025;
const monthlyPayment = 500;
const method = "cash";

const skipped: string[] = [];

studentIds.forEach((studentId) => {
  if (paymentHelpers.isFullyPaid(studentId, month, year, monthlyPayment)) {
    skipped.push(studentId); // Skip already-paid students
    return;
  }

  paymentsDB.create({
    studentId,
    amount: monthlyPayment,
    month,
    year,
    paymentMethod: method,
    status: "paid",
    invoiceNumber: `INV-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`,
    paidDate: new Date().toISOString(),
    branchId: "branch-1",
  });
});

if (skipped.length > 0) {
  console.log(`Skipped ${skipped.length} already-paid students`);
}
```

---

## UI/UX Flow

### Payments Page - Record Single Payment

1. User opens "Record Payment" dialog
2. Selects a student and month/year
3. System queries `paymentHelpers.getPaymentsByPeriod()` to check existing payments
4. **If fully paid**: Display alert "Student already fully paid for this period" and block submission
5. **If partial or unpaid**:
   - Show remaining balance: `calculateRemainingBalance()`
   - Display payment breakdown: `getPaymentBreakdownByMethod()`
   - Allow user to enter amount (auto-filled with remaining or full amount)
   - User selects payment method
   - On submit: create payment and call `recomputePaymentStatus()` to update all period payments' status

### Payments Page - Bulk Payments

1. User selects multiple students and month/year
2. System filters out students where `isFullyPaid() === true`
3. Show toast: "Some students were already fully paid and were skipped"
4. Record payments for remaining students
5. Call `recomputePaymentStatus()` for each affected period

### Payments Page - Edit Payment

1. User clicks "Edit" on a payment
2. Form pre-fills with existing payment data
3. **If editing to a different period**: Validate that target period isn't already fully paid (excluding current payment)
4. On save: update payment and call `recomputePaymentStatus()` for the new period

### Payments Page - Delete Payment

1. User clicks "Delete"
2. Confirm dialog shown
3. On confirm: delete the payment and call `recomputePaymentStatus()` to recalculate period status

---

## Error Handling

### Messages (Translated in `src/lib/translations/common.ts`)

| Scenario          | Message Key                 | English                                                      | Uzbek (Lat)                                            | Uzbek (Cyrl)                                     |
| ----------------- | --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------ |
| Fully paid period | `alreadyFullyPaidForPeriod` | "This student is already fully paid for the selected period" | "Ushbu oy uchun to'liq to'langan"                      | "Ушбу ой учун тўлиқ тўланган"                    |
| Bulk skip         | `bulkSkippedFullyPaid`      | "Some students were already fully paid and were skipped"     | "Bir necha o'quvchilar allaqachon to'liq to'langan..." | "Бир неча ўқувчилар аллақачон тўлиқ тўланган..." |
| Payment deleted   | `paymentDeleted`            | "Payment deleted"                                            | "To'lov o'chirildi"                                    | "Тўлов ўчирилди"                                 |

---

## Testing Scenarios

### Test 1: Multi-Method Aggregation

- Record cash payment: $200 for December → status: partial
- Record card payment: $150 for December → all Dec payments: partial
- Record bank payment: $150 for December → all Dec payments: paid ✓
- Attempt to record another payment → BLOCKED ✓

### Test 2: Duplicate Prevention

- Record full payment ($500 cash) for December → status: paid
- Attempt to record $100 card for December → BLOCKED ✓

### Test 3: Bulk with Skip

- Select 5 students for bulk December payment
- 2 students already fully paid for December
- Record payments for 3 students
- Toast shows: "Some students were already fully paid and were skipped" ✓

### Test 4: Edit Period Validation

- Student has $500 paid for December (status: paid)
- Edit a January $100 card payment and change month to December
- Verify: BLOCKED because December is already fully paid ✓

### Test 5: Delete Triggers Recompute

- Record: $200 cash for December (status: partial)
- Record: $150 card for December (status: partial)
- Delete the cash payment
- Verify: card payment now shows status: unpaid (total = $150 < $500) ✓

---

## Implementation Status

✅ **Completed:**

- Payment model and database schema
- paymentsDB CRUD operations with delete method
- paymentHelpers with validation functions
- handleSubmit validation (blocks fully-paid periods)
- recomputePaymentStatus aggregation logic
- handleBulkPayment with skip logic
- handleEdit with period validation
- handleDelete with status recompute
- Translations for error messages
- UI integration on Payments page

✅ **Key Features:**

- Partial multi-method payments
- Automatic status aggregation
- Duplicate full-payment prevention
- Bulk payment with intelligent skipping
- Edit/delete with validation

---

## Files Modified

- `src/lib/storage.ts` — Added paymentHelpers with validation functions and paymentsDB.delete()
- `src/pages/payments.tsx` — Added edit/delete UI, validation logic, recomputePaymentStatus()
- `src/lib/translations/common.ts` — Added error message translations

---

## Future Enhancements

- Add payment reversal (refunds) with automatic status downgrade
- Payment reminders for partially-paid students
- Automated payment consolidation (merge partial payments into single record)
- Payment reports filtered by status, method, date range
- Student payment history timeline view
- Payment search/filter by invoice number, method, date
