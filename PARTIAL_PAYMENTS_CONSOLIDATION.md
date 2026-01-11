# Partial Payments Consolidation Feature

## Overview
Implemented consolidation of partial payments on the payments page. When a student has multiple partial payments for the same period (month/year), they are now displayed as a single consolidated line item showing the total amount paid.

## Changes Made

### Backend (Go)

#### File: `backend_school_crm/internal/service/payment_service.go`
- **Added Method**: `ConsolidatePayments(payments []models.Payment) []models.Payment`
  - Groups payments by studentId + month + year
  - For groups with multiple partial payments: consolidates them into one payment entry
  - Sums all partial payment amounts into a single total
  - Keeps single payments as-is
  - Mixed status payments (partial + paid) are kept separate
  - Consolidated payments are marked with `invoiceNumber: "CONSOLIDATED"`

#### File: `backend_school_crm/internal/handlers/payment.go`
- **Updated Handler**: `listPayments` function
  - Added query parameter: `consolidate=true`
  - When consolidate flag is set, applies the consolidation logic to returned payments
  - Works for both branch-level and student-level payment queries

### Frontend (React/TypeScript)

#### File: `frontend_school_crm/src/lib/api.ts`
- **Updated Function**: `listPayments`
  - Added optional parameter: `consolidate?: boolean`
  - Passes consolidation flag to backend API endpoint when set to true

#### File: `frontend_school_crm/src/pages/payments.tsx`
- **Updated**: Payment data loading
  - Modified `loadData` function to always request consolidated payments
  - Changed API call: `apiListPayments({ consolidate: true })`

## How It Works

### Example Scenario
**Before:**
```
Student: John Doe | Period: January 2024 | Amount: 5,000 | Status: Partial
Student: John Doe | Period: January 2024 | Amount: 3,000 | Status: Partial
Student: John Doe | Period: January 2024 | Amount: 2,000 | Status: Partial
```

**After:**
```
Student: John Doe | Period: January 2024 | Amount: 10,000 | Status: Partial | Invoice: CONSOLIDATED
```

## API Endpoint

### Request
```
GET /api/payments?branchId=branch-123&month=01&year=2024&consolidate=true
```

### Response
Consolidated payment objects with totaled amounts from multiple partial payments.

## Behavior

- **Single Payments**: Displayed as-is, no consolidation
- **Multiple Partial Payments**: Consolidated into one entry with total amount
- **Mixed Statuses**: Partial + Paid payments are NOT consolidated (kept separate)
- **All Paid Payments**: Already treated individually, not affected
- **Display**: Shows "CONSOLIDATED" in the invoice number field to indicate merged entries

## Database Impact
No database changes needed. Consolidation happens at the application level during data retrieval.

## Benefits

1. **Cleaner UI**: Reduces visual clutter on payments table
2. **Better Accuracy**: Shows true total paid per student per period at a glance
3. **Backward Compatible**: Consolidation can be toggled via query parameter
4. **Flexible**: Works for both admin viewing all months and managers viewing current month

## Testing Recommendations

1. Create a student with multiple partial payments for the same period
2. Verify payments are consolidated on the payments page
3. Verify consolidated payment shows total of all partial amounts
4. Verify invoice shows "CONSOLIDATED" identifier
5. Test with mixed payment statuses to ensure they remain separate
6. Verify editing individual consolidated payments still works correctly
