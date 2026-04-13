# Consolidated Dashboard API Implementation

## Overview
Implemented a single consolidated API endpoint that returns all dashboard data at once, replacing 6+ separate API calls with a single efficient call.

## Backend Changes

### 1. New Type: `DashboardData` 
**File**: `backend_school_crm/internal/service/report_service.go`

```go
type DashboardData struct {
	Students            int                `json:"totalStudents"`
	ActiveStudents      int                `json:"activeStudents"`
	Teachers            int                `json:"totalTeachers"`
	TotalIncome         float64            `json:"totalIncome"`
	TotalExpenses       float64            `json:"totalExpenses"`
	Profit              float64            `json:"profit"`
	DebtorsCount        int                `json:"debtorsCount"`
	UnpaidSalariesCount int                `json:"unpaidSalariesCount"`
	CashIncome          float64            `json:"cashIncome"`
	CashExpenses        float64            `json:"cashExpenses"`
	CashProfit          float64            `json:"cashProfit"`
	CardIncome          float64            `json:"cardIncome"`
	CardExpenses        float64            `json:"cardExpenses"`
	CardProfit          float64            `json:"cardProfit"`
	BankIncome          float64            `json:"bankIncome"`
	BankExpenses        float64            `json:"bankExpenses"`
	BankProfit          float64            `json:"bankProfit"`
	Payments            []PaymentReportItem `json:"payments"`
	Salaries            []SalaryReportItem  `json:"salaries"`
	Expenses            []ExpenseReportItem `json:"expenses"`
}
```

### 2. New Method: `GetDashboardData()`
**File**: `backend_school_crm/internal/service/report_service.go`

The method aggregates data from multiple sources efficiently:
- Counts: Total students, active students, total teachers
- Financial data: 
  - Income by payment method (cash, card, bank) - from payments
  - Expenses by payment method (cash, card, bank) - from salaries + expenses
  - Each tracked by their actual payment_method field
- Calculated profit per payment method (income - expenses for each method)
- Debtor and unpaid salary counts
- Full lists of payments, salaries, and expenses for the month

Key optimization: 
- Uses single queries with GROUP BY and conditional aggregation
- Tracks expenses by their actual payment method (not proportionally allocated)
- Each payment type shows real income vs. real expenses paid in that method

### 3. New Handler: `getDashboardData()`
**File**: `backend_school_crm/internal/handlers/report.go`

New endpoint: `GET /api/reports/dashboard?branchId={id}&month={1-12}&year={2024}`

**Parameters**:
- `branchId` (required): Branch ID
- `month` (required): Month number (1-12)
- `year` (required): Year (e.g., 2024)

**Response**: Returns `DashboardData` object with all dashboard information

### 4. Route Registration
Updated in `report.go` RegisterReportRoutes:
```go
reports.GET("/dashboard", getDashboardData(reportService))
```

## Frontend Changes

### 1. New API Function
**File**: `frontend_school_crm/src/lib/api.ts`

```typescript
export async function getDashboardData(
  branchId: string,
  month: number,
  year: number
): Promise<any>
```

### 2. Updated Dashboard Component
**File**: `frontend_school_crm/src/pages/index.tsx`

**Before**: 
- 6 separate API calls:
  1. `getBranch()` - Get current financial month
  2. `listStudents()` - Get all students
  3. `listTeachers()` - Get all teachers
  4. `listPayments()` - Get payments
  5. `listSalaries()` - Get salaries
  6. `listExpenses()` - Get expenses
  
- Frontend filtering and calculations for:
  - Active students
  - Debtors
  - Unpaid salaries
  - Payment method breakdown
  - Expense allocation

**After**:
- 2 API calls:
  1. `getBranch()` - Get current financial month (still needed for month/year)
  2. `getDashboardData()` - Get all dashboard data (NEW)

All calculations now happen on the backend where data is aggregated more efficiently.

## Performance Benefits

1. **Reduced Network Requests**: From 6+ calls to 2 calls (33% reduction)
2. **Backend Optimization**: 
   - Single database queries with aggregation instead of loading full datasets
   - Allocation calculations done once server-side
   - Payment method filtering done with GROUP BY
3. **Reduced Frontend Processing**: No client-side filtering, aggregation, or calculations
4. **Faster Load Time**: Single consolidated response instead of waiting for multiple sequential requests

## Data Flow

```
Frontend Dashboard
    ↓
[1] getBranch() → Get current month/year
    ↓
[2] getDashboardData() → Backend processes all data
    ↓
Backend:
  - Query student counts (total & active)
  - Query teacher counts
  - Query payments by month/year & payment method
  - Query salaries by month/year
  - Query expenses by month/year
  - Count debtors (students without paid payment)
  - Count unpaid salaries
  - Calculate allocated expenses per method
  - Return consolidated DashboardData
    ↓
Frontend receives complete data object
    ↓
[3] generateChartData() → Process payments/salaries/expenses for charts
    ↓
[4] setStats() → Update state with all dashboard values
    ↓
Render dashboard with all metrics
```

## API Response Example

```json
{
  "totalStudents": 150,
  "activeStudents": 142,
  "totalTeachers": 25,
  "totalIncome": 15000000,
  "totalExpenses": 8500000,
  "profit": 6500000,
  "debtorsCount": 8,
  "unpaidSalariesCount": 3,
  "cashIncome": 5000000,
  "cashExpenses": 2833333.33,
  "cashProfit": 2166666.67,
  "cardIncome": 7000000,
  "cardExpenses": 3966666.67,
  "cardProfit": 3033333.33,
  "bankIncome": 3000000,
  "bankExpenses": 1700000,
  "bankProfit": 1300000,
  "payments": [...],
  "salaries": [...],
  "expenses": [...]
}
```

## Testing

### Backend Test
```bash
curl -H "Authorization: Bearer {token}" \
  "http://localhost:8080/api/reports/dashboard?branchId={branchId}&month=1&year=2024"
```

### Frontend
The dashboard automatically uses the new endpoint. No changes needed to dashboard.tsx beyond what was already made.

## Backward Compatibility

All existing report endpoints remain unchanged:
- `/api/reports/payments`
- `/api/reports/salaries`
- `/api/reports/debtors`
- `/api/reports/expenses`
- `/api/reports/financial-summary`

The new endpoint is an addition that doesn't break existing functionality.

## How Payment Method Tracking Works

### Income by Payment Method
Tracked from the `payments` table where `status = 'paid'` or `status = 'partial'`:
- **Cash Income**: Sum of payments with `payment_method = 'cash'`
- **Card Income**: Sum of payments with `payment_method = 'card'`
- **Bank Income**: Sum of payments with `payment_method = 'bank'`

### Expenses by Payment Method
Tracked from both salaries and expenses tables:
- **Cash Expenses**: Salaries with `payment_method = 'cash'` + Expenses with `payment_method = 'cash'`
- **Card Expenses**: Salaries with `payment_method = 'card'` + Expenses with `payment_method = 'card'`
- **Bank Expenses**: Salaries with `payment_method = 'bank'` + Expenses with `payment_method = 'bank'`

### Example Scenario
If you have:
- 0 cash payments (income)
- 1 cash expense of 10,000 UZS

The result will be:
- **Cash Payments**: Income: 0, Expenses: 10,000, Profit: -10,000
- **Total**: The 10,000 expense shows in total expenses and reduces net profit

This correctly reflects that you spent 10,000 in cash even though you didn't receive cash payments.

## Future Optimizations

1. **Add caching**: Cache dashboard data for 5-10 minutes to reduce database load
2. **Pagination**: For payments, salaries, expenses - currently returns all records
3. **Date range**: Could expand to accept custom date ranges instead of just month/year
4. **Drill-down**: Add endpoints to get details for specific payment methods or expense categories
