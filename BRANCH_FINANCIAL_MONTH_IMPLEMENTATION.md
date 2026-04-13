# Branch-Based Financial Month System Implementation Plan

## Overview
Implement a strict Branch-Based Financial Month system with role-based access control for the School CRM.

## Phase 1: Backend Database & Services
### 1.1 Database Schema
- ✓ financial_months table (already exists)
- Update branches table to link current_financial_month_id
- Add indexes for performance

### 1.2 Financial Month Service Enhancements
- ✓ GetOrCreateCurrentMonth
- ✓ CloseMonth
- Add: ValidateMonthAccess
- Add: GetMonthSummary (financial report)
- Add: CanEditRecord

### 1.3 Payment/Expense/Salary Service Updates
- Enforce financial_month_id requirement
- Add validation: prevent operations on CLOSED months
- Add filtering by current month for non-admins
- Update Create/Update/Delete methods with month validation

### 1.4 API Endpoints
- ✓ Base endpoints exist
- Add: POST /branches/{id}/close-month
- Add: GET /branches/{id}/financial-months
- Add: GET /branches/{id}/financial-months/{id}/summary
- Update: All payment/expense/salary endpoints with month filtering

## Phase 2: Frontend Types & Logic
### 2.1 TypeScript Types
- ✓ FinancialMonth interface (already defined)
- ✓ Payment, Expense, Salary (already have financialMonthId)
- Add: API request/response types

### 2.2 Frontend Hooks
- Add: useFinancialMonth hook
- Add: useMonthAccess hook (permission checking)
- Add: useCurrentBranchMonth hook

### 2.3 Frontend Components
- Add: MonthStatus indicator
- Add: ClosedMonthAlert component
- Modify: Payment, Expense, Salary forms
  - Auto-select current month (no override)
  - Show month status
  - Disable editing if closed

### 2.4 Frontend Pages
- Update: Payments page
- Update: Expenses page
- Update: Salaries page
- Update: Reports page
  - Restrict to current month for managers
  - Full access for admins
- Add: Financial month management page

## Phase 3: Middleware & Security
### 3.1 Backend Middleware
- Add: FinancialMonthAccessMiddleware
- Add: MonthClosureValidation
- Update: PermissionChecker to include month access

### 3.2 Validation Rules
- Prevent creation in CLOSED months
- Prevent editing records from CLOSED months
- Require financial_month_id in all financial operations
- Validate user can access the month

## Phase 4: Testing & Rollout
- Test month closing flow
- Test data isolation
- Test permission enforcement
- Test API endpoints

---

## Implementation Priority
1. Backend: Enhance financial month service
2. Backend: Add month validation to services
3. Backend: Add new API endpoints
4. Frontend: Add hooks and utilities
5. Frontend: Update pages
6. Frontend: Add month status components

## Database Changes Required
None - schema already in place

## Breaking Changes
- Payment/Expense/Salary creation now requires valid financial month context
- Non-admin users restricted to current month only
