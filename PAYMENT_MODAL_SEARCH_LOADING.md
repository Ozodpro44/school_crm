# Payment Modal Search Student - Loading State Implementation

## Overview
Added loading state UI to the create payment modal student search functionality to improve UX when searching students.

## Backend Endpoint
- **Route**: `GET /students/search/with-payments`
- **Handler**: `searchStudentsWithPayments` in `internal/handlers/student.go`
- **Response**: Student list with payment information for the selected month/year
  - Student ID, name, phone
  - Class ID and class name
  - Monthly payment amount
  - Paid amount for the period
  - Payment status (none, partial, paid)

## Frontend Implementation

### API Call
Located in `src/lib/api.ts`:
```typescript
export async function searchStudentsWithPayments(
  branchId: string,
  search?: string,
  month?: string,
  year?: string
): Promise<StudentPaymentInfo[]>
```

### Payment Modal Search Flow

1. **User Input** (Line 1402):
   - Text input field for student search
   - Typed characters trigger search with 300ms debounce

2. **useEffect Handler** (Line 873-903):
   - Watches: `studentSearchTerm`, `selectedMonth`, `selectedYear`
   - Sets `isSearchingStudents = true` before API call
   - Calls `searchStudentsWithPayments` API
   - Populates `filteredStudentsForModal` with results
   - Sets `isSearchingStudents = false` when complete

3. **Dropdown Display** (Line 1449-1531):
   - Shows loading spinner while `isSearchingStudents = true`
   - Displays student list when results load
   - Shows "No students found" message if no results
   - Shows "Type to search" hint if empty search

### Loading Spinner UI
```jsx
{isSearchingStudents ? (
  <div className="px-3 py-4 text-center">
    <div className="flex items-center justify-center gap-2">
      <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
      <span className="text-sm text-slate-600 dark:text-slate-400">
        {t("searching") || "Searching..."}
      </span>
    </div>
  </div>
) : ...
```

### State Management
- `isSearchingStudents`: Boolean flag for loading state
- `studentSearchTerm`: Current search input value
- `filteredStudentsForModal`: Array of matching students with payment info
- `selectedMonth`, `selectedYear`: Filter parameters for payment lookup

## User Experience
1. User opens payment modal
2. Types student name in search field
3. Loading spinner appears while searching
4. Student list displays with:
   - Full name
   - Class name
   - Phone number
   - Current month payment status and amount (if any)
5. User selects a student
6. Payment summary displays with remaining balance info

## Notes
- Search is debounced by 300ms to reduce API calls
- Payment info includes current month's paid amount and status
- Supports search across months/years via API parameters
- No extra API calls needed - all data comes from `/search/with-payments` endpoint
