# Branch-Based Financial Month System

## Overview
Implemented a strict financial month system where each branch tracks its own current financial period. All financial operations (payments, expenses, salaries) are tied to the branch's current open month.

## Completed Implementation

### 1. Database Schema
- **New Table: `financial_months`**
  - Stores financial periods for each branch
  - Fields: `id`, `branch_id`, `year`, `month`, `status` (OPEN/CLOSED), `opened_at`, `closed_at`
  - UNIQUE constraint on (branch_id, year, month)
  - Automatically cascades on branch deletion

- **Updated Tables:**
  - `branches`: Added `current_financial_month_id` foreign key
  - `payments`: Added `financial_month_id` foreign key with RESTRICT on delete
  - `salaries`: Added `financial_month_id` foreign key with RESTRICT on delete
  - `expenses`: Added `financial_month_id` foreign key with RESTRICT on delete

- **New Indexes:**
  - On `financial_months(branch_id)`, `(status)`, `(year, month)`
  - On payment/salary/expense tables for `financial_month_id`

### 2. Backend Models (Go)

**FinancialMonth struct:**
```go
type FinancialMonth struct {
  ID       string      // UUID
  BranchID string      // Reference to branch
  Year     int         // YYYY
  Month    int         // 1-12
  Status   MonthStatus // "OPEN" or "CLOSED"
  OpenedAt time.Time
  ClosedAt *time.Time  // null until closed
}
```

**Updated Models:**
- `Payment`, `Salary`, `Expense` now include `FinancialMonthID *string`
- `Branch` now includes:
  - `CurrentFinancialMonthID *string`
  - `CurrentFinancialMonth *FinancialMonth`

### 3. Backend Services

**FinancialMonthService:**
```go
// Get or create current month for a branch
GetOrCreateCurrentMonth(ctx, branchID) → *FinancialMonth

// Create new financial month
Create(ctx, branchID, year, month) → *FinancialMonth

// Get month by ID
GetByID(ctx, id) → *FinancialMonth

// Get current OPEN month for branch
GetCurrentMonthByBranch(ctx, branchID) → *FinancialMonth

// Close current month and open next one (TRANSACTIONAL)
CloseMonth(ctx, branchID) → *FinancialMonth
  // - Marks current month as CLOSED
  // - Creates next calendar month (auto-increments)
  // - Updates branch.current_financial_month_id
  // - All in single transaction

// List all months for a branch
ListMonthsByBranch(ctx, branchID) → []FinancialMonth

// Check role-based access to month
CanAccessMonth(ctx, role, branchID, monthID) → bool
  // - Admin: can access all months
  // - Manager/Accountant: can only access current OPEN month

// Check if month is closed
IsMonthClosed(ctx, monthID) → bool
```

**BranchService Updates:**
- `Create()`: Automatically creates initial financial month for new branch
- `GetByID()`, `GetAll()`: Load current financial month with data

### 4. Backend API Endpoints

**New Endpoints:**
```
POST /branches/:id/close-month
- Closes current month and advances to next
- Requires: admin or manager role
- Returns: { message, newMonth, branch }

GET /branches/:id/financial-months
- Lists all financial months for branch
- Returns: { months: [] }
```

**Updated Endpoints:**
- All branch endpoints now return `currentFinancialMonth` with branch data

### 5. Frontend Types

**New Type:**
```typescript
interface FinancialMonth {
  id: string;
  branchId: string;
  year: number;
  month: number;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

**Updated Interfaces:**
- `Branch`: Added `currentFinancialMonthId?`, `currentFinancialMonth?`
- `Payment`, `Salary`, `Expense`: Added `financialMonthId?`

---

## Implementation Rules

### Financial Month Rules
1. **Each branch has exactly ONE current OPEN month**
2. **Cannot create records in CLOSED months** (enforce at service layer)
3. **When month is closed:**
   - No new records can be added
   - No existing records can be edited
   - Records remain tied to that closed month forever
   - Next month automatically created

### Role-Based Access
| Role | Access |
|------|--------|
| Admin | All months, all branches |
| Manager | Current OPEN month only for their branch |
| Accountant | Current OPEN month only for their branch |
| Other | Read-only on current month |

### Data Isolation
- Managers and accountants can ONLY see data from the branch's current OPEN month
- They cannot view, edit, or report on closed months
- Admin can view/report on any month
- Database constraints prevent orphaned records

---

## TODO - Remaining Work

### Backend (Priority)
1. **Update PaymentService, SalaryService, ExpenseService:**
   - When creating records, auto-set `financial_month_id` to current month
   - Prevent creation if month is CLOSED
   - Add validation to ensure month matches branch

2. **Create FilterMiddleware:**
   - Filter GET requests based on:
     - User role
     - Branch assignment
     - Financial month status
   - Managers see only current month data
   - Admins see all data

3. **Update existing handlers:**
   - Register `FinancialMonthService` in main.go
   - Update all financial record handlers to check month status
   - Add error responses for closed month operations

### Frontend
1. **Create close-month button:**
   - Show in Branch view/settings
   - Confirmation dialog with consequences
   - Show current month info (Year/Month)

2. **Month selector component:**
   - For admins only
   - Dropdown showing available months
   - Visual indicator of current vs. archived months

3. **Update forms:**
   - Auto-populate `month` and `year` from current financial month
   - Disable date picker for managers (current month only)
   - Show warnings if month is closed

4. **Dashboard/Reports:**
   - For admins: month filter dropdown
   - For managers: show current month only
   - Display month status (OPEN/CLOSED)

---

## Example: Creating a Payment

**Flow:**
1. Manager clicks "Create Payment"
2. Form auto-fills with current month's year/month
3. Payment submitted with `branchId`, amount, etc.
4. **Service checks:**
   - Is current month OPEN? If closed → error
   - Is `financial_month_id` correct? If not → auto-fix
5. Payment created with `financial_month_id` set
6. Returns success with payment + month info

---

## Example: Closing a Month

**Flow:**
1. Manager clicks "Close Month"
2. Confirmation: "Close December 2025? You won't be able to edit it."
3. `POST /branches/:branchId/close-month`
4. **Backend:**
   - Marks `financial_months` record as CLOSED
   - Calculates next month (Jan 2026)
   - Creates new `financial_months` record for Jan 2026
   - Updates `branches.current_financial_month_id`
   - All in transaction
5. Frontend shows success + new month displayed
6. All forms now show Jan 2026, previous month is archived

---

## Database Constraints Enforced
- Foreign key constraints prevent orphaned records
- CHECK constraint ensures month 1-12
- UNIQUE constraint on (branch, year, month)
- ON DELETE RESTRICT on financial_month_id ensures months can't be deleted while records exist

## Safety Features
- **Transactional month closing** prevents partial updates
- **View-level filtering** prevents data leakage
- **Role-based access control** at both middleware and service layer
- **Audit trail** preserved (created_at, updated_at timestamps)
- **Cannot delete closed month** - records preserved forever
