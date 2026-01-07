# Close Month Backend Integration

## Summary
Fixed the "Close Month" / "Finish Month" functionality to use the backend API instead of local storage.

## Changes Made

### 1. Frontend Hook - `use-financial-month.ts`
**Updated:**
- Changed from raw `fetch()` calls to `apiRequest()` wrapper
- `loadCurrentMonth()` now uses authenticated API requests
- `closeMonth()` now uses authenticated API requests
- Ensures JWT token is included in all requests

**Before:**
```typescript
const response = await fetch(`/api/branches/${branchId}/close-month`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});
```

**After:**
```typescript
const data = await apiRequest<any>(`/branches/${branchId}/close-month`, {
  method: 'POST',
});
```

### 2. Frontend Component - `CloseMonthButton.tsx`
**Updated:**
- Added permission-based check using `canFinishMonth` permission
- Imports `getCurrentUser` from `apiRequest`
- Validates user has proper permission before showing button

**Key Change:**
```typescript
const user = getCurrentUser();
const canClose = user?.permissions?.canFinishMonth ?? (userRole === "admin" || userRole === "branch_admin" || userRole === "manager");
```

### 3. Backend Handler - `branch.go`
**Updated:**
- Added middleware import
- Added `userService` parameter to `RegisterBranchRoutes()`
- Added permission middleware check to close-month endpoint
- Removed redundant hardcoded role checking

**Before:**
```go
branches.POST("/:id/close-month", closeMonth(financialMonthService, branchService))
```

**After:**
```go
branches.POST("/:id/close-month", middleware.PermissionChecker(userService, "canFinishMonth"), closeMonth(financialMonthService, branchService))
```

**Handler simplified:**
- Removed manual role checking
- Permission validation handled by middleware

### 4. Backend Route Registration - `main.go`
**Updated:**
- Passed `userService` to `RegisterBranchRoutes()`

```go
handlers.RegisterBranchRoutes(protected, branchService, financialMonthService, userService)
```

### 5. Reports Page - `reports.tsx`
**Updated:**
- Removed import of `finishMonth` from local storage
- Added imports:
  - `closeFinancialMonth` from financial-month-api
  - `apiRequest` from api module
- Replaced `handleFinishMonth()` to call backend API instead of local storage
- Now:
  - Gets branch ID from localStorage (for route parameter)
  - Calls backend API `closeFinancialMonth(branchId)`
  - Reloads page after successful close to reflect changes

**Before:**
```typescript
const result = finishMonth(currentUser.id); // Local storage operation
```

**After:**
```typescript
const response = await closeFinancialMonth(branchId); // Backend API call
// Page reloads to reflect changes
```

## API Flow

1. **User clicks "Finish Month" button** → Reports page
2. **Button triggers dialog confirmation** → User must confirm
3. **Confirmation sends request** → `POST /api/branches/{branchId}/close-month`
4. **Backend handles request:**
   - Auth middleware validates JWT token
   - Permission middleware checks `canFinishMonth` permission
   - Financial Month Service closes current month and opens next month
   - Database transaction ensures consistency
5. **Response returns:**
   - New opened month
   - Updated branch information
6. **Frontend shows success message** and reloads page

## Benefits

✅ **Security**: Uses proper authentication and permission validation
✅ **Consistency**: Single source of truth (backend database)
✅ **Reliability**: Database transactions ensure data integrity
✅ **Scalability**: Works across multiple users/branches
✅ **Audit Trail**: All changes logged in backend
✅ **No Data Loss**: Old data properly archived in database

## Testing Checklist

- [ ] User with `canFinishMonth` permission can see button
- [ ] User without permission cannot see button
- [ ] Clicking button opens confirmation dialog
- [ ] Confirming closes current month and opens next month
- [ ] Page reloads after success
- [ ] Backend properly creates new month record
- [ ] Branch's `current_financial_month_id` is updated
- [ ] Error messages display if something fails
