# Financial Month System - Data Flow Examples

## Flow 1: Creating a Branch

```
Manager clicks "Create Branch"
         ↓
POST /branches
{
  "name": "Main Branch",
  "address": "123 Main St",
  "monthlyPayment": 5000
}
         ↓
BranchService.Create()
         ├─ Create branch record (id: branch_123)
         ├─ Call FinancialMonthService.Create()
         │  └─ Create financial_month record:
         │     {
         │       id: fm_001,
         │       branch_id: branch_123,
         │       year: 2025,
         │       month: 1,
         │       status: "OPEN",
         │       opened_at: 2025-01-01
         │     }
         └─ Update branch.current_financial_month_id = fm_001
         ↓
Response:
{
  "id": "branch_123",
  "name": "Main Branch",
  "currentFinancialMonthId": "fm_001",
  "currentFinancialMonth": {
    "id": "fm_001",
    "branch_id": "branch_123",
    "year": 2025,
    "month": 1,
    "status": "OPEN",
    "openedAt": "2025-01-01T00:00:00Z"
  }
}
```

**Database State:**
```sql
branches:
  id: branch_123
  current_financial_month_id: fm_001

financial_months:
  id: fm_001
  branch_id: branch_123
  year: 2025
  month: 1
  status: OPEN
  opened_at: 2025-01-01
```

---

## Flow 2: Creating a Payment (OPEN Month)

```
Accountant clicks "Create Payment" for January 2025
         ↓
Frontend shows form with:
  - Month: "January" (auto-populated)
  - Year: 2025 (auto-populated)
  - Status: disabled (can't change)
  - Amount: [text field]
  - Student: [dropdown]
         ↓
POST /payments
{
  "studentId": "student_456",
  "amount": 1000,
  "paymentMethod": "cash",
  "status": "unpaid",
  "branchId": "branch_123"
}
         ↓
Middleware: FinancialMonthFilter
  └─ Get user role: "accountant"
  └─ Get current month: fm_001 (OPEN)
  └─ Store in context: financialMonthFilter = fm_001
         ↓
PaymentService.Create()
         ├─ Get current financial month for branch_123
         │  └─ Query: WHERE branch_id = branch_123 AND status = "OPEN"
         │  └─ Returns: fm_001
         ├─ Check: fm_001.status == "OPEN" ✓
         ├─ Create payment:
         │  {
         │    id: pay_789,
         │    studentId: student_456,
         │    amount: 1000,
         │    branchId: branch_123,
         │    financialMonthId: fm_001,  ← AUTO-SET!
         │    status: "unpaid",
         │    createdAt: now()
         │  }
         └─ Return success
         ↓
Response (HTTP 201):
{
  "id": "pay_789",
  "studentId": "student_456",
  "amount": 1000,
  "branchId": "branch_123",
  "financialMonthId": "fm_001",
  "status": "unpaid",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

**Database State:**
```sql
payments:
  id: pay_789
  student_id: student_456
  amount: 1000
  branch_id: branch_123
  financial_month_id: fm_001  ← Linked!
  status: unpaid
```

---

## Flow 3: Trying to Create Payment in CLOSED Month

```
[Month is now CLOSED by manager]
         ↓
Accountant tries: POST /payments (same as above)
         ↓
PaymentService.Create()
         ├─ Get current financial month for branch_123
         │  └─ Query: WHERE branch_id = branch_123 AND status = "OPEN"
         │  └─ Returns: fm_002 (February, OPEN)
         ├─ User submitted payment for January (closed)
         ├─ Check: payment.month != current_month.month
         ├─ ERROR: "Cannot create payment: financial month is CLOSED"
         └─ Return error
         ↓
Response (HTTP 400):
{
  "error": "Cannot create payment: current financial month for this branch is CLOSED"
}
```

---

## Flow 4: Closing a Month

```
Manager clicks "Close Month" button
         ↓
UI shows dialog:
  "Close January 2025?"
  "Payments, salaries, and expenses will be locked."
  "You cannot edit or create records for this month."
  [Confirm] [Cancel]
         ↓
Manager clicks [Confirm]
         ↓
POST /branches/branch_123/close-month
         ↓
Handler checks:
  - userRole = "manager" ✓
  - branchId = "branch_123" ✓
         ↓
FinancialMonthService.CloseMonth()
         ├─ BEGIN TRANSACTION
         │
         ├─ Get current open month
         │  └─ Query: branch_id = branch_123 AND status = "OPEN"
         │  └─ Returns: fm_001 (January)
         │
         ├─ Close January
         │  └─ UPDATE financial_months
         │     SET status = "CLOSED", closed_at = now()
         │     WHERE id = fm_001
         │
         ├─ Calculate next month
         │  └─ month = 1 + 1 = 2 (February)
         │  └─ year = 2025
         │
         ├─ Create February
         │  └─ INSERT INTO financial_months
         │     (id: fm_002, branch_id: branch_123, year: 2025, month: 2, status: "OPEN", opened_at: now())
         │
         ├─ Update branch
         │  └─ UPDATE branches
         │     SET current_financial_month_id = fm_002
         │     WHERE id = branch_123
         │
         └─ COMMIT
         ↓
BranchService.GetByID()
  └─ Reload branch with new month
         ↓
Response (HTTP 200):
{
  "message": "Month closed successfully",
  "newMonth": {
    "id": "fm_002",
    "branchId": "branch_123",
    "year": 2025,
    "month": 2,
    "status": "OPEN",
    "openedAt": "2025-01-31T23:59:59Z"
  },
  "branch": {
    "id": "branch_123",
    "name": "Main Branch",
    "currentFinancialMonthId": "fm_002",
    "currentFinancialMonth": {
      "id": "fm_002",
      "year": 2025,
      "month": 2,
      "status": "OPEN"
    }
  }
}
```

**Database State After Close:**
```sql
financial_months:
  id: fm_001, branch_id: branch_123, year: 2025, month: 1, status: CLOSED, closed_at: 2025-01-31
  id: fm_002, branch_id: branch_123, year: 2025, month: 2, status: OPEN, opened_at: 2025-01-31

branches:
  id: branch_123, current_financial_month_id: fm_002

payments:
  [all January payments still linked to fm_001]
  [new payments now link to fm_002]
```

---

## Flow 5: Manager Viewing Payments (Current Month Only)

```
Manager calls: GET /payments?branch=branch_123
         ↓
Middleware: FinancialMonthFilter
  ├─ Get user role: "manager"
  ├─ Get branch: branch_123
  ├─ Get current month: fm_002 (February, OPEN)
  └─ Store in context: financialMonthFilter = fm_002
         ↓
PaymentService.GetAll()
  ├─ Build query:
  │  SELECT * FROM payments
  │  WHERE branch_id = $1 AND financial_month_id = $2
  │  [branch_123, fm_002]
  │
  ├─ Returns only payments from February
  │  └─ [pay_001, pay_002, ...] (all from fm_002)
  │
  └─ Does NOT return January payments
         ↓
Response:
[
  {
    "id": "pay_001",
    "studentId": "...",
    "amount": 1000,
    "financialMonthId": "fm_002",  ← All are from current month
    "month": "February"
  },
  {
    "id": "pay_002",
    "studentId": "...",
    "amount": 1500,
    "financialMonthId": "fm_002",
    "month": "February"
  }
]
```

---

## Flow 6: Admin Viewing Payments (All Months)

```
Admin calls: GET /payments?branch=branch_123&month=1&year=2025
         ↓
Middleware: FinancialMonthFilter
  ├─ Get user role: "admin"
  ├─ Admin can see all months - no filter applied
         ↓
PaymentService.GetAll()
  ├─ Build query:
  │  SELECT * FROM payments
  │  WHERE branch_id = $1 AND financial_month_id = $2
  │  [branch_123, fm_001]
  │
  ├─ Returns payments from specified month
  │  (could be from January, February, or any month)
  │
  └─ Returns payments only from fm_001 (January)
         ↓
Response:
[
  {
    "id": "pay_789",
    "studentId": "student_456",
    "amount": 1000,
    "financialMonthId": "fm_001",  ← January data
    "month": "January"
  },
  // ... other January payments
]
```

---

## Flow 7: Trying to Edit Payment in CLOSED Month

```
Admin tries to edit pay_789 (from January - CLOSED)
         ↓
PUT /payments/pay_789
{
  "amount": 2000
}
         ↓
PaymentService.Update()
  ├─ Get payment: pay_789
  │  └─ financialMonthId: fm_001
  │
  ├─ Get financial month: fm_001
  │  └─ status: "CLOSED"
  │
  ├─ Check: fm_001.status == "CLOSED"
  │  └─ TRUE!
  │
  ├─ ERROR: "Cannot modify payment: financial month is CLOSED"
  └─ Return error
         ↓
Response (HTTP 400):
{
  "error": "Cannot modify payment: financial month (January 2025) is CLOSED"
}
```

---

## Flow 8: Year Boundary - December to January

```
Manager closes December 2025
         ↓
FinancialMonthService.CloseMonth()
  ├─ Get current month: fm_dec (year: 2025, month: 12, status: OPEN)
  ├─ Close December: UPDATE fm_dec SET status = CLOSED
  ├─ Calculate next month:
  │  ├─ month = 12 + 1 = 13
  │  ├─ 13 > 12? YES
  │  ├─ month = 13 - 12 = 1
  │  └─ year = 2025 + 1 = 2026
  ├─ Create January 2026:
  │  INSERT INTO financial_months
  │  (id: fm_jan26, branch_id, year: 2026, month: 1, status: "OPEN")
  └─ Update branch.current_financial_month_id = fm_jan26
         ↓
Database State:
financial_months:
  id: fm_dec, year: 2025, month: 12, status: CLOSED, closed_at: 2025-12-31
  id: fm_jan26, year: 2026, month: 1, status: OPEN, opened_at: 2025-12-31
         ↓
Next Payment:
  POST /payments (for new invoice)
  └─ Auto-linked to fm_jan26 (January 2026)
```

---

## Summary: Data Isolation by Role

| Operation | Manager | Accountant | Admin |
|-----------|---------|-----------|-------|
| See January (CLOSED) | ❌ Hidden | ❌ Hidden | ✅ View, Filter |
| Create payment in January | ❌ Error | ❌ Error | ❌ Error (FK constraint) |
| Create payment in current month | ✅ February | ✅ February | ✅ Current month |
| View all months | ❌ Current only | ❌ Current only | ✅ All |
| Close a month | ✅ Yes | ❌ No | ✅ Yes |
| Edit January payment | ❌ Error | ❌ Error | ❌ Error (CLOSED) |
| Generate report for January | ❌ No | ❌ No | ✅ Yes |
| Generate report for February | ✅ Yes (current) | ✅ Yes (current) | ✅ Yes |

---

## Key Takeaways

1. **Every record knows which month it belongs to** via `financial_month_id`
2. **Closed months are immutable** - no creation, update, or deletion possible
3. **Role-based filtering happens automatically** in middleware for managers
4. **Transactions ensure consistency** - month close is atomic (all or nothing)
5. **No data loss** - closed months preserved forever for auditing
6. **Auto-advancement** - closing a month automatically creates the next one
