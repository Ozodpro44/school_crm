# Payments API Search Implementation

## Overview
Implemented server-side search and filtering for payments, replacing client-side filtering to improve performance and support real-time search across all payment records.

## Changes Made

### Backend (Go)

#### 1. Payment Handler (`internal/handlers/payment.go`)
- Added `search` query parameter to capture student name and invoice number searches
- Added `status` query parameter to filter by payment status (paid/partial)
- Updated handler to call new `GetByBranchIDAndPeriodPaginatedWithSearch` service method

#### 2. Payment Service (`internal/service/payment_service.go`)
- Created new method: `GetByBranchIDAndPeriodPaginatedWithSearch()`
- Supports dynamic WHERE clause building for:
  - **Search**: Case-insensitive LIKE matching on:
    - Student name (`students.full_name`)
    - Invoice number (`payments.invoice_number`)
  - **Status Filter**: Exact match on payment status (paid/partial)
- Properly handles SQL parameter binding to prevent SQL injection
- Returns paginated results with total count

### Frontend (Next.js/React)

#### 1. API Client (`src/lib/api.ts`)
- Updated `listPayments()` function signature to include:
  - `search?: string` - Search term for student name/invoice
  - `status?: string` - Filter by payment status
- Properly encodes search parameter as URL query string

#### 2. Payments Page (`src/pages/payments.tsx`)
- **Removed** client-side filtering logic from `filteredPayments` variable
- **Updated** `loadData()` to pass search and filter parameters to API:
  ```typescript
  apiListPayments({
    branchId: selectedBranchId,
    month: queryMonth,
    year: queryYear,
    page: currentPage,
    limit: itemsPerPage,
    search: searchTerm,
    status: filterStatus !== "all" ? filterStatus : undefined,
  })
  ```
- **Added** debounced effect for search/filter changes:
  - Resets to page 1 when search or filter changes
  - 300ms debounce prevents excessive API calls while typing
  - Automatically refetches data when user stops typing

## Benefits

1. **Performance**: Only fetches matching records from database
2. **Scalability**: Works with large datasets (doesn't load all records into memory)
3. **Real-time**: Search happens instantly after debounce period
4. **Consistency**: Single source of truth (backend) for filtering logic
5. **Memory Efficient**: Frontend no longer needs to store all payments in state for filtering

## API Endpoint

### GET `/api/payments`

**Query Parameters:**
- `branchId` (required): Branch ID
- `month` (optional): Month in MM format
- `year` (optional): Year in YYYY format
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 10000)
- `search` (optional): Search term (searches student name + invoice number)
- `status` (optional): Filter by status (paid/partial)

**Example:**
```
GET /api/payments?branchId=123&month=01&year=2026&search=john&status=paid&page=1&limit=10
```

## Testing

1. Login to dashboard
2. Navigate to Payments page
3. Type in search box - should see results filtered by student name or invoice
4. Change status filter - should show only matching payment statuses
5. Pagination should work correctly with filtered results

## Notes

- Search is case-insensitive
- Partial search matching supported (e.g., searching "john" finds "Johnson")
- Status filter only shows when not set to "all"
- Search and filter reset page to 1 to prevent out-of-bounds errors
