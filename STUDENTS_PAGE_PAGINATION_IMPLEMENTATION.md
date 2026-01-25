# Students Page Pagination Implementation

## Summary
Added backend and frontend pagination support to the students listing with customizable per-page limit and page navigation.

## Changes Made

### Backend (Go)

#### 1. `internal/handlers/student.go`
- Added `strconv` import for parsing pagination parameters
- Modified `listStudents` handler to accept `page` and `limit` query parameters
- Default limit: 10, max limit: 1000
- Returns paginated response with metadata:
  ```json
  {
    "data": [...],
    "total": 264,
    "page": 1,
    "limit": 10,
    "totalPages": 27
  }
  ```

#### 2. `internal/service/student_service.go`
- Updated `GetByBranchID` signature to accept `page` and `limit` parameters
- Added total count query before fetching paginated data
- Returns `([]models.Student, int64, error)` instead of `([]models.Student, error)`
- Implements SQL `LIMIT` and `OFFSET` for pagination

### Frontend (React/TypeScript)

#### 1. `lib/api.ts`
- Updated `listStudents` function to accept optional `page` and `limit` parameters
- Changed return type to include pagination metadata:
  ```typescript
  {
    data: Student[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }
  ```

#### 2. `pages/students.tsx`
- Added state variables:
  - `page`: current page (default: 1)
  - `limit`: items per page (default: 10)
  - `totalPages`: calculated from backend
  - `total`: total record count

- Updated `loadData()`:
  - Calls `apiListStudents(selectedBranchId, page, limit)`
  - Extracts data from response with `response.data`
  - Updates `total` and `totalPages` state

- Added effect hooks:
  - Reset page to 1 when filters change (status, class, payment status, limit)
  - Trigger data fetch when page changes
  - Reset page when branch is switched

- Replaced pagination UI:
  - Per-page selector (5, 10, 20, 50, 100 items)
  - Previous/Next buttons
  - Page number indicator
  - Record counter

- Added client-side filtering:
  - Still supports search, status, class, and payment status filters
  - Filters applied after backend pagination

#### 3. Updated other pages that call `listStudents`:
- `pages/class-details.tsx`: Fetch all with limit=10000
- `pages/classes.tsx`: Fetch all with limit=10000
- `pages/payments.tsx`: Handle both array and paginated responses

## Features

✓ Configurable items per page (5, 10, 20, 50, 100)
✓ Previous/Next pagination buttons
✓ Page number indicator (Page X of Y)
✓ Total record counter
✓ Auto-reset to page 1 when filters change
✓ Disabled buttons at boundaries (first/last page)
✓ Backend-enforced maximum limit of 1000 items
✓ Client-side filtering combined with backend pagination
✓ Works with multiple filter options (search, status, class, payment status)

## Usage

### Query Parameters
```
GET /api/students?branchId=xxx&page=1&limit=10
```

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 1000)
- `branchId`: Required branch ID

### Example Response
```json
{
  "data": [
    {
      "id": "...",
      "fullName": "John Doe",
      "monthlyPayment": 500000,
      "status": "active",
      ...
    }
  ],
  "total": 264,
  "page": 1,
  "limit": 10,
  "totalPages": 27
}
```

## Testing

✓ Backend build successful: `cd backend_school_crm && go build ./...`
✓ Frontend build successful: `cd frontend_school_crm && npm run build`
✓ Students page:
  - Change per-page limit
  - Navigate between pages
  - Verify data updates correctly
  - Test with filters (search, status, class, payment status)
  - Verify filters reset page to 1

## Benefits

- Better performance with large student lists
- Improved user experience with load times
- Consistent pagination pattern across app
- Scalable to handle growing databases
