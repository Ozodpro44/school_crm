# Financial Month System - Next Steps

## Completed ✅
- [x] Database schema with `financial_months` table
- [x] Foreign key relationships for payments/salaries/expenses
- [x] Backend models (FinancialMonth, updated Payment/Salary/Expense)
- [x] FinancialMonthService (CRUD + month closing logic)
- [x] Branch handlers for closing months and listing months
- [x] Frontend types updated
- [x] Permission checks in close-month endpoint

## Todo Priority Order

### 1. Backend Service Updates (HIGH PRIORITY)

#### PaymentService.Create()
**File:** `internal/service/payment_service.go`

```go
// In Create function:
1. Get branch by ID
2. Call fmService.GetCurrentMonthByBranch(ctx, branchID)
3. Check if currentMonth.Status == "CLOSED" → return error
4. Auto-set payment.FinancialMonthID = &currentMonth.ID
5. Validate month/year match current month
```

**Error to return:**
```
"Cannot create payment: financial month is CLOSED"
```

---

#### SalaryService.Create()
**File:** `internal/service/salary_service.go`

Same pattern as PaymentService:
```go
1. Get current month via FinancialMonthService
2. Reject if CLOSED
3. Auto-set FinancialMonthID
4. Validate date alignment
```

---

#### ExpenseService.Create()
**File:** `internal/service/expense_service.go`

Same pattern:
```go
1. Get current month for branch
2. Prevent creation if CLOSED
3. Auto-set FinancialMonthID
4. Ensure expense date is in current month
```

---

#### Payment/Salary/Expense Services: Update & Delete
```go
// In Update/Delete functions:
1. Get the record
2. Get its FinancialMonth
3. Check if month is CLOSED
4. If CLOSED → return "Cannot modify records in closed month"
5. If OPEN → allow update/delete
```

**Error response:**
```json
{
  "error": "Cannot modify payment: financial month is CLOSED"
}
```

---

### 2. Middleware for Data Filtering (HIGH PRIORITY)

**File:** Create `internal/middleware/financial_month_filter.go`

```go
package middleware

import (
    "github.com/gin-gonic/gin"
    "github.com/school-crm/backend/internal/service"
)

// FinancialMonthFilter middleware
func FinancialMonthFilter(fmService *service.FinancialMonthService) gin.HandlerFunc {
    return func(c *gin.Context) {
        userRole, _ := c.Get("userRole")
        userBranchID, _ := c.Get("branchId")
        
        // For managers/accountants: only see current open month data
        if userRole == "manager" || userRole == "accountant" {
            // Filter queries to only return current month records
            // Store in context for use in services
            currentMonth, _ := fmService.GetCurrentMonthByBranch(c.Request.Context(), userBranchID.(string))
            c.Set("financialMonthFilter", currentMonth.ID)
        }
        
        c.Next()
    }
}

// In Payment/Salary/Expense services:
// Check if financialMonthFilter is set in context
// If set: only return records matching that month
```

---

### 3. Update Service GetAll Methods

**In PaymentService.GetAll():**
```go
// Add to WHERE clause:
query := `SELECT ... WHERE branch_id = $1`

// For managers, add:
if monthFilter, ok := c.Get("financialMonthFilter"); ok {
    query += ` AND financial_month_id = $2`
    args = append(args, monthFilter)
}
```

Same for SalaryService.GetAll() and ExpenseService.GetAll()

---

### 4. Handler Updates

**File:** `internal/handlers/payment.go` (and salary.go, expense.go)

In the handler functions, inject FinancialMonthService:

```go
// Update function signature:
func createPayment(paymentService *service.PaymentService, 
                  fmService *service.FinancialMonthService) gin.HandlerFunc {
    return func(c *gin.Context) {
        // Payment creation already validated in service
        // Handler just needs to call service
    }
}
```

---

### 5. Main.go Registration

**File:** `cmd/main.go`

```go
// Add:
financialMonthService := service.NewFinancialMonthService(database)

// Update route registration:
handlers.RegisterBranchRoutes(v1, branchService, financialMonthService)

// For payments:
handlers.RegisterPaymentRoutes(v1, paymentService, financialMonthService)
// Same for salary and expense routes
```

---

## Frontend Implementation

### 1. Create FinancialMonthService Hook
**File:** `src/services/financialMonthService.ts`

```typescript
export const closeFinancialMonth = async (branchId: string) => {
  const response = await api.post(`/branches/${branchId}/close-month`);
  return response.data;
};

export const getFinancialMonths = async (branchId: string) => {
  const response = await api.get(`/branches/${branchId}/financial-months`);
  return response.data.months;
};
```

---

### 2. Create CloseMonthButton Component
**File:** `src/components/CloseMonthButton.tsx`

```typescript
interface CloseMonthButtonProps {
  branchId: string;
  currentMonth: FinancialMonth;
  onSuccess: () => void;
}

export default function CloseMonthButton({
  branchId,
  currentMonth,
  onSuccess,
}: CloseMonthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClose = async () => {
    setLoading(true);
    try {
      await closeFinancialMonth(branchId);
      onSuccess();
      // Show success toast
    } catch (error) {
      // Show error toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setShowConfirm(true)}>
        Close Month ({getMonthName(currentMonth.month)} {currentMonth.year})
      </button>
      
      {showConfirm && (
        <ConfirmDialog
          title="Close Financial Month?"
          message={`Close ${getMonthName(currentMonth.month)} ${currentMonth.year}? 
                     You won't be able to edit payments, salaries, or expenses for this month.`}
          onConfirm={handleClose}
          onCancel={() => setShowConfirm(false)}
          loading={loading}
        />
      )}
    </>
  );
}
```

---

### 3. Update Payment/Salary/Expense Forms
**Pattern for all forms:**

```typescript
// In form component:
const [branch, setBranch] = useState<Branch>();

useEffect(() => {
  if (branch?.currentFinancialMonth) {
    const { month, year } = branch.currentFinancialMonth;
    setFormData(prev => ({
      ...prev,
      month: getMonthName(month),
      year: year,
    }));
  }
}, [branch?.currentFinancialMonth]);

// In JSX:
<select 
  name="month" 
  value={formData.month}
  disabled={branch?.currentFinancialMonth?.status === 'CLOSED'}
>
  <option>{getMonthName(branch?.currentFinancialMonth?.month)}</option>
</select>

{branch?.currentFinancialMonth?.status === 'CLOSED' && (
  <ErrorAlert message="This month is closed. You cannot create new records." />
)}
```

---

### 4. Add Month Status Display Component
**File:** `src/components/MonthStatusBadge.tsx`

```typescript
export default function MonthStatusBadge({ status }: { status: MonthStatus }) {
  return (
    <span className={`badge badge-${status === 'OPEN' ? 'success' : 'secondary'}`}>
      {status}
    </span>
  );
}
```

**Usage:**
```typescript
<MonthStatusBadge status={branch.currentFinancialMonth?.status} />
```

---

## Testing Checklist

- [ ] Create branch → automatically creates current month
- [ ] Close month → creates next month automatically
- [ ] Create payment with open month → success
- [ ] Create payment with closed month → error
- [ ] Manager views payments → sees current month only
- [ ] Admin views payments → sees all months
- [ ] Edit payment in closed month → error
- [ ] Close December → creates January next year
- [ ] Financial month fields are in forms

---

## Database Migration Check

After code changes, verify:
```sql
-- Check financial months created
SELECT * FROM financial_months;

-- Check branches have current_financial_month_id set
SELECT id, name, current_financial_month_id FROM branches;

-- Check payments have financial_month_id
SELECT id, financial_month_id FROM payments LIMIT 5;
```

---

## Rollout Order
1. ✅ Database & models
2. ✅ Backend services & endpoints
3. → Backend payment/salary/expense updates
4. → Backend middleware
5. → Frontend types & components
6. → UI integration
7. → Testing & QA
