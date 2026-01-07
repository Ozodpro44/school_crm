# Reports API Integration - Frontend Implementation

## Overview
Successfully integrated the backend Reports API into the frontend reporting system. All report types now use backend API endpoints instead of local storage data.

## Changes Made

### 1. Debtors Report (`generateDebtorsReport`)
**Before:** Used local `studentsDB` and `paymentsDB` for calculations
**After:** Now calls `getDebtorsReport()` API endpoint

```typescript
await getDebtorsReport(branchId, debtorMonth, Number(debtorYear), classId)
```

**Benefits:**
- Server-side filtering by month/year
- Accurate debtor calculation from backend
- Supports class filtering
- Real-time data from database

### 2. Expenses Report (`generateExpensesReport`)
**Before:** Used `api.listExpenses()` and filtered client-side by date
**After:** Now calls `getExpensesReport()` API with server-side filtering

```typescript
await getExpensesReport(branchId, startDate, endDate)
```

**Benefits:**
- Server handles date range filtering
- Better performance with large datasets
- Consistent data handling

### 3. Financial Summary Report (`generateIncomeReport`)
**Before:** Combined local payments, salaries, and expenses manually
**After:** Uses dedicated `getFinancialSummary()` API endpoint

```typescript
await getFinancialSummary(branchId, startDate, endDate)
```

**Benefits:**
- Single API call for comprehensive financial data
- Server calculates totals and profit/loss
- Returns structured financial summary:
  - totalIncome
  - totalSalaries
  - totalExpenses
  - netProfit
  - paymentsByMethod
  - salariesByStatus

### 4. Error Handling
All report generators now include:
- Branch ID validation
- Try-catch with error toasts
- Translation support for error messages
- Proper error logging

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/reports/payments` | GET | Get payment report with filtering |
| `/api/reports/salaries` | GET | Get salary report with filtering |
| `/api/reports/debtors` | GET | Get students who owe money |
| `/api/reports/expenses` | GET | Get expenses by date range |
| `/api/reports/financial-summary` | GET | Get comprehensive financial summary |

## Query Parameters

### Payment & Salary Reports
- `branchId` (required)
- `startDate` (required, YYYY-MM-DD format)
- `endDate` (required, YYYY-MM-DD format)
- `status` (optional, all/paid/unpaid/partial)
- `classId` (optional, for payment reports)

### Debtors Report
- `branchId` (required)
- `month` (required, MM format)
- `year` (required, YYYY format)
- `classId` (optional)

### Expenses Report
- `branchId` (required)
- `startDate` (required, YYYY-MM-DD format)
- `endDate` (required, YYYY-MM-DD format)
- `category` (optional)

### Financial Summary
- `branchId` (required)
- `startDate` (required, YYYY-MM-DD format)
- `endDate` (required, YYYY-MM-DD format)

## Benefits of This Integration

1. **Server-Side Processing**
   - Faster calculations on larger datasets
   - Reduced network payload
   - Better performance

2. **Data Consistency**
   - Single source of truth (backend database)
   - No sync issues between frontend cache and backend
   - Accurate real-time data

3. **Scalability**
   - Easier to handle growth in data
   - Server can optimize queries
   - Better database indexing

4. **Maintainability**
   - Less client-side business logic
   - Easier to update report calculations
   - API-driven architecture

5. **Security**
   - Permission checks done server-side
   - Backend validation
   - Prevents data leakage

## Frontend Functions Updated

All functions in `/frontend_school_crm/src/pages/reports.tsx`:

- `generatePaymentReport()` - Already using API
- `generateSalaryReport()` - Already using API
- **`generateDebtorsReport()`** - ✅ Updated to use API
- **`generateExpensesReport()`** - ✅ Updated to use API
- **`generateIncomeReport()`** - ✅ Updated to use API

## Testing Checklist

- [ ] Test payment report with various date ranges
- [ ] Test salary report with status filtering
- [ ] Test debtors report for different months
- [ ] Test expenses report with category filtering
- [ ] Test financial summary calculations
- [ ] Verify error handling with invalid branch ID
- [ ] Test permission errors (403)
- [ ] Verify CSV exports work correctly
- [ ] Test with different user roles
- [ ] Monitor API response times

## Notes

- All API functions are already defined in `/lib/api.ts`
- Reports page respects user permissions via `canViewReports`
- Backend automatically applies branch filtering
- Error handling includes proper toast notifications
- Support for i18n translations throughout

## Related Files

- `/frontend_school_crm/src/pages/reports.tsx` - Reports page UI
- `/frontend_school_crm/src/lib/api.ts` - API client functions
- `/backend_school_crm/internal/handlers/report.go` - Backend handlers
- `/backend_school_crm/internal/service/report_service.go` - Backend business logic
