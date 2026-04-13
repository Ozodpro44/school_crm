# Payment Status Logic Fix

## Problem
Previously, payment status displayed what was stored in the database without considering the actual payment amount relative to the monthly payment requirement. This could show incorrect status combinations:
- A payment marked "partial" that actually covers the full monthly amount would show as "partial"
- A payment marked "paid" that only covers a portion would show as "paid"

## Solution
Implemented intelligent payment status calculation based on actual paid amount vs monthly payment:

### Logic
```
IF payment.amount >= student.monthlyPayment
  → Display status as "paid" (fully covers monthly amount)
ELSE
  → Display status as "partial" (does not fully cover monthly amount)
```

### Files Modified

#### 1. **frontend_school_crm/src/pages/payments.tsx**
- Added `getEffectivePaymentStatus()` function to calculate status based on payment amount
- Updated payment table display to use effective status instead of stored status
- Effective status determines the badge color and label shown to users

#### 2. **frontend_school_crm/src/pages/student-details.tsx**
- Added `getEffectivePaymentStatus()` function for consistent logic
- Updated individual payment display in student details
- Updated totals calculation (totalPaid/totalPending) to use effective status

## Behavior

### Payment Display
When viewing a payment record:
- If `payment.amount >= student.monthlyPayment` → shows "paid" badge (green)
- If `payment.amount < student.monthlyPayment` → shows "partial" badge (orange)

### Example Scenarios
1. Student monthly payment: 500,000 UZS
   - Payment of 500,000 marked "partial" → displays as "paid"
   - Payment of 400,000 marked "paid" → displays as "partial"
   - Payment of 250,000 marked "paid" → displays as "partial"

2. Multiple payments per month
   - 250,000 (partial) + 250,000 (paid) = 500,000 total → both show "paid"
   - 300,000 (paid) alone → shows "partial"

## Impact
- Users see accurate payment status based on actual amounts
- Prevents confusion from misaligned status selections
- Totals in student details now correctly reflect effective status
- Payment filtering and reporting use accurate status
