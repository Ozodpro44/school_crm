# Dashboard Total Income Zero - Root Cause & Fix

## Problem
Dashboard was showing **Total Income: UZS 0** even though the payments page displayed **Total Income: UZS 238,200,000**.

## Root Cause
**Month Format Mismatch**:
- The database stores month as **string `'01'`** (2-digit padded format)
- The API was sending month as **integer `1`** 
- SQL queries were comparing integer `1` against string `'01'`, which never matched
- This caused all dashboard income calculations to return 0

Example:
```sql
-- This query would find NO results:
SELECT SUM(amount) FROM payments 
WHERE month = 1 AND year = 2026

-- When the actual data has:
-- month = '01' (string), year = 2026
```

## Solution
Modified `backend_school_crm/internal/service/report_service.go` to convert the integer month to a 2-digit string format before querying:

```go
// Convert month to 2-digit string format (e.g., 1 -> "01")
monthStr := fmt.Sprintf("%02d", month)
```

Applied this conversion to all SQL queries in `GetDashboardData()`:
- Payment income queries
- Salary expense queries
- Expense queries (with `LPAD()` for `EXTRACT(MONTH FROM date)` comparisons)
- Debtor count queries
- Unpaid salaries count queries

## Files Modified
- `backend_school_crm/internal/service/report_service.go`
  - Line 508: Added month formatting
  - Lines 535-698: Updated all month parameter references from `month` to `monthStr`

## Testing
1. Build succeeds: `go build ./...` ✓
2. Database contains payment with month='01', year=2026
3. After fix, dashboard queries will correctly match with `month = '01'`

## Expected Result
Dashboard will now correctly display:
- **Total Income**: Sum of all paid/partial payments for the month
- **Income by Payment Method**: Breakdown by cash, card, bank
- **Expenses**: Sum of paid salaries + expenses
- **Profit**: Income minus Expenses
- **Debtors Count**: Students without paid payment for the month
