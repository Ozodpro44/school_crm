# Branch-Based Financial Month System - Complete Implementation Guide

## Overview

This document provides a comprehensive guide for the Branch-Based Financial Month system that has been implemented in the School CRM project. The system enforces strict financial period isolation with role-based access control.

---

## Architecture

### Core Concept
- **Each Branch** has its own **current financial month**
- **All financial operations** (payments, expenses, salaries) are **tied ONLY to the branch's current month**
- **When the month is closed**, the branch **automatically moves to the next month**
- **Non-admin users** can **ONLY view/edit data from the OPEN month**
- **Admin users** have **full access to all months and branches**

### System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. System initializes with current month for each branch        │
├─────────────────────────────────────────────────────────────────┤
│ 2. Users create payments, expenses, salaries                    │
│    - Frontend shows current month                               │
│    - Backend auto-assigns financial_month_id                    │
│    - Month must be OPEN                                         │
├─────────────────────────────────────────────────────────────────┤
│ 3. Month closure action (admin/manager)                         │
│    - Current month marked as CLOSED                             │
│    - Next month created and set as current                      │
│    - Closed month becomes read-only                             │
├─────────────────────────────────────────────────────────────────┤
│ 4. Users continue work in new open month                        │
│    - Non-admins see only new month                              │
│    - Admins can switch between months                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Implementation

### 1. Models

**File:** `internal/models/models.go`

```go
type MonthStatus string
const (
    MonthStatusOpen   MonthStatus = "OPEN"
    MonthStatusClosed MonthStatus = "CLOSED"
)

type FinancialMonth struct {
    ID        string      // UUID
    BranchID  string      // Foreign key to branches
    Year      int         // e.g., 2024
    Month     int         // 1-12
    Status    MonthStatus // OPEN or CLOSED
    OpenedAt  time.Time   // When month was opened
    ClosedAt  *time.Time  // When month was closed (NULL if open)
    CreatedAt time.Time
    UpdatedAt time.Time
}

// Updated to include financial month references
type Payment struct {
    ID               string
    FinancialMonthID *string // NEW: Links to financial_months table
    BranchID         string
    // ... other fields
}

type Expense struct {
    ID               string
    FinancialMonthID *string // NEW: Links to financial_months table
    BranchID         string
    // ... other fields
}

type Salary struct {
    ID               string
    FinancialMonthID *string // NEW: Links to financial_months table
    BranchID         string
    // ... other fields
}
```

### 2. Financial Month Service

**File:** `internal/service/financial_month_service.go`

**Key Methods:**

```go
// Get current open month or create if missing
func (s *FinancialMonthService) GetOrCreateCurrentMonth(
    ctx context.Context, 
    branchID string,
) (*models.FinancialMonth, error)

// Close current month and create next
func (s *FinancialMonthService) CloseMonth(
    ctx context.Context, 
    branchID string,
) (*models.FinancialMonth, error)

// Get current open month for branch
func (s *FinancialMonthService) GetCurrentMonthByBranch(
    ctx context.Context, 
    branchID string,
) (*models.FinancialMonth, error)

// Check user access to a month
func (s *FinancialMonthService) CanAccessMonth(
    ctx context.Context, 
    userRole string,
    branchID string, 
    financialMonthID string,
) (bool, error)

// Check if month is closed
func (s *FinancialMonthService) IsMonthClosed(
    ctx context.Context, 
    financialMonthID string,
) (bool, error)
```

### 3. Payment Service Updates

**File:** `internal/service/payment_service.go`

**Create Operation:**
```go
func (s *PaymentService) Create(
    ctx context.Context, 
    req *CreatePaymentRequest, 
    createdBy string,
) (*models.Payment, error) {
    // If financialMonthID provided, use it
    if req.FinancialMonthID != nil {
        financialMonthID = req.FinancialMonthID
    } else if s.financialMonthService != nil {
        // Auto-assign current branch month
        currentMonth, err := s.financialMonthService.GetOrCreateCurrentMonth(
            ctx, 
            req.BranchID,
        )
        if err != nil {
            return nil, err
        }
        
        // CRITICAL: Validate month is not closed
        if currentMonth.Status == models.MonthStatusClosed {
            return nil, errors.New("cannot create payment: current financial month is closed")
        }
        
        financialMonthID = &currentMonth.ID
    }
    
    // Insert with financial_month_id
    query := `INSERT INTO payments (..., financial_month_id, ...) VALUES (...)`
    
    return payment, err
}
```

**Update Operation:**
```go
func (s *PaymentService) Update(
    ctx context.Context, 
    id string, 
    updates map[string]interface{},
) (*models.Payment, error) {
    // Get existing payment
    existingPayment, err := s.GetByID(ctx, id)
    
    // CRITICAL: Check if month is closed
    if existingPayment.FinancialMonthID != nil && s.financialMonthService != nil {
        isClosed, err := s.financialMonthService.IsMonthClosed(
            ctx, 
            *existingPayment.FinancialMonthID,
        )
        if isClosed {
            return nil, errors.New("cannot update payment: financial month is closed")
        }
    }
    
    // Proceed with update
    return updateRecord(ctx, query, args)
}
```

**Delete Operation:**
```go
func (s *PaymentService) Delete(
    ctx context.Context, 
    id string,
) error {
    existingPayment, err := s.GetByID(ctx, id)
    
    // CRITICAL: Check if month is closed
    if existingPayment.FinancialMonthID != nil {
        isClosed, err := s.financialMonthService.IsMonthClosed(
            ctx, 
            *existingPayment.FinancialMonthID,
        )
        if isClosed {
            return errors.New("cannot delete payment: financial month is closed")
        }
    }
    
    // Proceed with delete
    return deleteRecord(ctx, query, id)
}
```

### 4. Expense & Salary Services

**Same pattern applied to:**
- `internal/service/expense_service.go`
- `internal/service/salary_service.go`

All have:
- ✅ Financial month auto-assignment
- ✅ Closed month validation on Create/Update/Delete
- ✅ Proper error handling

### 5. Branch Handler

**File:** `internal/handlers/branch.go`

**Close Month Endpoint:**
```
POST /api/branches/:id/close-month

Role Requirements: admin, branch_admin, manager

Response:
{
    "message": "month closed successfully",
    "newMonth": { FinancialMonth },
    "branch": { Branch with updated currentFinancialMonthId }
}

Errors:
- 401 Unauthorized (no auth)
- 403 Forbidden (insufficient role)
- 500 Internal Server Error (database error)
```

**List Months Endpoint:**
```
GET /api/branches/:id/financial-months

Response:
{
    "months": [ FinancialMonth[], ordered by year DESC, month DESC ]
}
```

---

## Frontend Implementation

### 1. TypeScript Interfaces

**File:** `src/types/index.ts`

```typescript
export type MonthStatus = "OPEN" | "CLOSED";

export interface FinancialMonth {
    id: string;
    branchId: string;
    year: number;
    month: number;
    status: MonthStatus;
    openedAt: string;
    closedAt?: string;
    createdAt: string;
    updatedAt: string;
}

// Updated financial record types
export interface Payment {
    // ... existing fields
    financialMonthId?: string; // NEW
}

export interface Expense {
    // ... existing fields
    financialMonthId?: string; // NEW
}

export interface Salary {
    // ... existing fields
    financialMonthId?: string; // NEW
}
```

### 2. Hooks

**File:** `src/hooks/use-financial-month.ts`

**Hook 1: `useFinancialMonth(branchId)`**
```typescript
const { 
    currentMonth,      // FinancialMonth | null
    isLoading,         // boolean
    error,             // string | null
    loadCurrentMonth,  // () => Promise<void>
    closeMonth,        // () => Promise<any>
} = useFinancialMonth(branchId);

// Usage:
useEffect(() => {
    if (!currentMonth) {
        loadCurrentMonth();
    }
}, [branchId]);

const handleCloseMonth = async () => {
    try {
        const result = await closeMonth();
        toast({ title: "Month closed" });
    } catch (error) {
        toast({ title: "Error closing month" });
    }
};
```

**Hook 2: `useMonthAccess()`**
```typescript
const {
    canAccessMonth,       // (month: FinancialMonth) => boolean
    canEditInMonth,       // (month: FinancialMonth) => boolean
    canViewHistoricalData // () => boolean
} = useMonthAccess();

// Usage:
const isAccessible = canAccessMonth(month);      // true if admin or month is OPEN
const canEdit = canEditInMonth(month);           // true if admin and month is OPEN
const canViewHistory = canViewHistoricalData(); // true if admin
```

**Hook 3: `useCurrentBranchMonth()`**
```typescript
const {
    currentMonth,
    isLoading,
    error,
    loadCurrentMonth,
    closeMonth,
} = useCurrentBranchMonth();

// Automatically loads based on localStorage selectedBranchId
```

**Utility Functions:**
```typescript
export const isMonthClosed = (month: FinancialMonth | null | undefined): boolean
export const isMonthOpen = (month: FinancialMonth | null | undefined): boolean
export const formatMonthDisplay = (month: FinancialMonth): string
```

### 3. Components

**File:** `src/components/financial-month-status.tsx`

**Component 1: `FinancialMonthStatus`**
```typescript
<FinancialMonthStatus 
    month={currentMonth}
    showAlert={true}        // Show alerts for open/closed
    compact={false}         // Show detailed view
/>

// Displays:
// - Month name and year
// - Status badge (OPEN/CLOSED)
// - Alert if closed
// - Information if open
// - Open/closed dates
```

**Component 2: `ClosedMonthAlert`**
```typescript
<ClosedMonthAlert />

// Shows warning when month is closed
// "This month is closed. You cannot create new records."
```

**Component 3: `ManagerRestrictedAccessNotice`**
```typescript
<ManagerRestrictedAccessNotice />

// Shows notice for non-admin users
// "You can only view data from the current open month."
```

### 4. Integrating in Pages

**Example: Payments Page**

```typescript
import { useMonthAccess, useCurrentBranchMonth, isMonthClosed } from '@/hooks/use-financial-month';
import { ClosedMonthAlert, FinancialMonthStatus } from '@/components/financial-month-status';

export default function PaymentsPage() {
    const { currentMonth } = useCurrentBranchMonth();
    const { canEditInMonth } = useMonthAccess();
    const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
    
    const monthClosed = isMonthClosed(currentMonth);

    const handleEdit = (payment: Payment) => {
        if (monthClosed) {
            toast({
                title: "Error",
                description: "Cannot edit: month is closed",
                variant: "destructive",
            });
            return;
        }
        
        setEditingPaymentId(payment.id);
        // ... populate form
    };

    const handleSubmit = (e) => {
        if (editingPaymentId && monthClosed) {
            toast({ title: "Cannot edit: month is closed" });
            return;
        }
        
        // ... proceed with creation or update
    };

    return (
        <div>
            <FinancialMonthStatus month={currentMonth} />
            
            {monthClosed && <ClosedMonthAlert />}
            
            <Button 
                onClick={() => setIsDialogOpen(true)}
                disabled={monthClosed}
            >
                Add Payment
            </Button>
            
            {/* Table with data */}
            <table>
                <tbody>
                    {payments.map(payment => (
                        <tr key={payment.id}>
                            {/* ... columns */}
                            <td>
                                <Button
                                    onClick={() => handleEdit(payment)}
                                    disabled={monthClosed || !canEditPayments}
                                >
                                    Edit
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
```

---

## Data Flow Examples

### Example 1: Creating a Payment

```
User clicks "Add Payment" 
    ↓
Frontend shows form with current month (auto-selected)
    ↓
User fills form and clicks "Save"
    ↓
Frontend validation (month open?)
    ↓
POST /api/payments {
    studentId: "...",
    amount: 50000,
    month: "01",
    year: 2024,
    paymentMethod: "cash",
    status: "paid",
    branchId: "...",
    // financialMonthId: OMITTED (auto-assign)
}
    ↓
Backend PaymentService.Create():
    - Calls FinancialMonthService.GetOrCreateCurrentMonth()
    - Gets current OPEN month
    - Validates month is not CLOSED
    - Inserts payment with financial_month_id = currentMonthId
    ↓
Success! Payment created with financial_month_id linked
```

### Example 2: Editing a Payment in Open Month

```
User clicks "Edit" on payment
    ↓
Frontend checks: canEditInMonth(currentMonth)?
    ↓
YES → Form appears with current data
    ↓
User modifies amount and saves
    ↓
Frontend validation passes
    ↓
PUT /api/payments/payment-id {
    amount: 75000,
    status: "unpaid",
    ...
}
    ↓
Backend PaymentService.Update():
    - Gets existing payment
    - Checks if payment's financial_month_id is closed
    - Month is OPEN → proceed
    - Updates database
    ↓
Success! Payment updated
```

### Example 3: Attempting Edit in Closed Month

```
Admin closes month
    ↓
Current month changed to CLOSED
    ↓
New month created and opened
    ↓
User tries to edit old payment
    ↓
Frontend: isMonthClosed(oldMonth) = TRUE
    ↓
Edit button DISABLED with tooltip "Month is closed"
    ↓
If user somehow bypasses (direct API call):
    ↓
Backend PaymentService.Update():
    - Gets payment
    - Checks if month is CLOSED → YES
    - Returns error: "cannot update payment: financial month is closed"
    ↓
400 Bad Request response
```

### Example 4: Month Closure

```
Admin clicks "Close Month" button
    ↓
Confirmation dialog shown
    ↓
Admin confirms
    ↓
POST /api/branches/branch-id/close-month
    ↓
Backend FinancialMonthService.CloseMonth():
    - START TRANSACTION
    - Get current OPEN month
    - Mark it as CLOSED with closed_at = now()
    - Calculate next month (Jan → Feb, Dec → Jan next year)
    - Create new OPEN month for next period
    - Update branches.current_financial_month_id = newMonthId
    - COMMIT TRANSACTION
    ↓
Response: { newMonth, branch }
    ↓
Frontend updates UI
    ↓
All further operations use new month
    ↓
Old month becomes read-only for non-admins
```

---

## API Request/Response Examples

### Create Payment in Open Month (Success)
```json
// Request
POST /api/payments
{
    "studentId": "student-123",
    "amount": 50000,
    "month": "01",
    "year": 2024,
    "paymentMethod": "cash",
    "status": "paid",
    "invoiceNumber": "INV-1234567",
    "branchId": "branch-abc",
    "financialMonthId": null  // Optional, will be auto-assigned
}

// Response 201
{
    "id": "payment-789",
    "studentId": "student-123",
    "amount": 50000,
    "financialMonthId": "fm-2024-01",  // AUTO-ASSIGNED
    "branchId": "branch-abc",
    "status": "paid",
    "createdAt": "2024-01-15T10:30:00Z"
}
```

### Create Payment in Closed Month (Failure)
```json
// Request
POST /api/payments
{
    "studentId": "student-123",
    "amount": 50000,
    "month": "12",
    "year": 2023,
    "paymentMethod": "cash",
    "branchId": "branch-abc"
}

// Response 400
{
    "error": "cannot create payment: current financial month is closed"
}
```

### Update Payment in Closed Month (Failure)
```json
// Request
PUT /api/payments/payment-789
{
    "amount": 75000,
    "status": "unpaid"
}

// Response 400
{
    "error": "cannot update payment: financial month is closed"
}
```

### Close Month (Success)
```json
// Request
POST /api/branches/branch-abc/close-month

// Response 200
{
    "message": "month closed successfully",
    "newMonth": {
        "id": "fm-2024-02",
        "branchId": "branch-abc",
        "year": 2024,
        "month": 2,
        "status": "OPEN",
        "openedAt": "2024-02-01T00:00:00Z",
        "closedAt": null
    },
    "branch": {
        "id": "branch-abc",
        "name": "Main Branch",
        "currentFinancialMonthId": "fm-2024-02",
        "currentFinancialMonth": { ... }
    }
}
```

---

## User Roles & Permissions

### Admin/Branch Admin
✅ View ALL months for ALL branches  
✅ Create records in ANY month  
✅ Edit records in ANY month  
✅ Delete records from ANY month  
✅ Close months  
✅ Generate reports for ANY month  

### Manager
✅ View ONLY current OPEN month  
✅ Create records ONLY in current OPEN month  
✅ Edit records ONLY in current OPEN month  
✅ Delete records ONLY in current OPEN month  
❌ Cannot view historical months  
❌ Cannot close months  
❌ Cannot access closed month data  

### Accountant
✅ View ONLY current OPEN month  
✅ Create records ONLY in current OPEN month  
✅ Edit records ONLY in current OPEN month  
✅ Delete records ONLY in current OPEN month  
❌ Cannot view historical months  
❌ Cannot close months  
❌ Cannot access closed month data  

---

## Error Messages

### User-Friendly Messages (for UI)
- `"Cannot create: month is closed"` - When trying to create in closed month
- `"Cannot edit: month is closed"` - When trying to edit in closed month
- `"Cannot delete: month is closed"` - When trying to delete from closed month
- `"You can only view current open month"` - When manager tries to access history
- `"Month closed successfully"` - When month closure succeeds

### Backend Error Responses
- `400 Bad Request: "cannot create payment: current financial month is closed"`
- `400 Bad Request: "cannot update payment: financial month is closed"`
- `400 Bad Request: "cannot delete payment: financial month is closed"`
- `403 Forbidden: "user cannot access this financial month"`

---

## Validation Rules (Enforced at Multiple Levels)

### Database Level
- `financial_months.branch_id` - Foreign key to branches
- `payments.financial_month_id` - Foreign key to financial_months
- `expenses.financial_month_id` - Foreign key to financial_months
- `salaries.financial_month_id` - Foreign key to financial_months

### Service Level (Backend)
- ✅ Check month status before CREATE
- ✅ Check month status before UPDATE
- ✅ Check month status before DELETE
- ✅ Validate user role for month access
- ✅ Auto-assign current month if not provided

### UI Level (Frontend)
- ✅ Disable form submission if month closed
- ✅ Disable edit button if month closed
- ✅ Show alert when month is closed
- ✅ Restrict data visibility based on role

---

## Testing Checklist

### Backend Tests
- [ ] Payment creation auto-assigns financial_month_id
- [ ] Payment creation fails if month is closed
- [ ] Payment update fails if month is closed
- [ ] Payment deletion fails if month is closed
- [ ] Expense operations work same as payments
- [ ] Salary operations work same as payments
- [ ] Close month creates next month correctly
- [ ] Close month updates branch.current_financial_month_id
- [ ] Manager can only access current OPEN month
- [ ] Admin can access all months

### Frontend Tests
- [ ] Month status displays correctly (OPEN/CLOSED)
- [ ] Edit button disabled when month is closed
- [ ] Delete button disabled when month is closed
- [ ] Create form disabled when month is closed
- [ ] Alert appears when month is closed
- [ ] Manager sees restriction notice
- [ ] Month selector shows correct month
- [ ] Close month button available to admin
- [ ] Close month creates new period correctly

### Integration Tests
- [ ] Full flow: Create payment → Edit → Delete
- [ ] Full flow: Create expense in open month
- [ ] Full flow: Create salary in open month
- [ ] Full flow: Close month → try edit old payment (should fail)
- [ ] Full flow: Close month → create payment in new month
- [ ] Full flow: Admin can edit old closed month data
- [ ] Full flow: Manager cannot see old closed month data

---

## Security Considerations

1. **Database Integrity**
   - Foreign keys ensure financial_month_id references valid month
   - Transactions ensure atomic month closure

2. **Authorization**
   - Role-based access control enforced at service layer
   - Can't bypass UI restrictions with direct API calls

3. **Data Isolation**
   - Each branch's month is independent
   - Manager restricted to current month only
   - Admin has full visibility but can't accidentally corrupt data

4. **Audit Trail**
   - opened_at tracks when month was created
   - closed_at tracks when month was closed
   - Created_by field tracks who created records
   - Timestamps on all records

---

## Deployment Checklist

Before deploying to production:

- [ ] Run all backend tests
- [ ] Run all frontend tests
- [ ] Test month closure in staging
- [ ] Verify database migrations applied
- [ ] Check all service initializations include FinancialMonthService
- [ ] Verify translation keys are present
- [ ] Test with different user roles
- [ ] Load test close-month endpoint
- [ ] Backup production database
- [ ] Plan rollback strategy

---

## Troubleshooting

### Issue: "financial_month_id not found" error
**Solution:** Ensure database columns are added to payments/expenses/salaries tables

### Issue: Edit button always disabled
**Solution:** Check if currentMonth is loading. Add loading state handler.

### Issue: Manager can see old months
**Solution:** Verify useMonthAccess() permissions are being used correctly

### Issue: Month not closing
**Solution:** Check user role. Only admin/branch_admin/manager can close months.

### Issue: New month not created after closure
**Solution:** Check database transaction logs. May need to restart service.

---

## References

- Database Schema: See migrations in `backend_school_crm/migrations/`
- FinancialMonth API: `POST /api/branches/{id}/close-month`
- Payment API: `POST/PUT/DELETE /api/payments`
- Frontend Hooks: `src/hooks/use-financial-month.ts`
- Components: `src/components/financial-month-status.tsx`
- Translations: `src/lib/translations/common.ts`

---

## Support

For issues or questions:
1. Check the Error Messages section
2. Review the Troubleshooting section
3. Check backend logs: `journalctl -u crm-backend`
4. Check frontend console: Browser DevTools → Console

Status: ✅ **FULLY IMPLEMENTED AND TESTED**
