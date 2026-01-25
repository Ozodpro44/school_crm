# Payment Reports Pagination Implementation

## Summary
Added pagination support to the payment reports page with customizable per-page limit and page navigation.

## Changes Made

### Backend (Go)

#### 1. `internal/handlers/report.go`
- Added `strconv` import for parsing pagination parameters
- Modified `getPaymentReport` handler to accept `page` and `limit` query parameters
- Default limit: 10, max limit: 1000
- Returns paginated response with metadata:
  ```json
  {
    "data": [...],
    "total": 1234,
    "page": 1,
    "limit": 10,
    "totalPages": 124
  }
  ```

#### 2. `internal/service/report_service.go`
- Updated `GetPaymentReport` signature to accept `page` and `limit` parameters
- Added total count query before fetching paginated data
- Returns `([]PaymentReportItem, int64, error)` instead of `([]PaymentReportItem, error)`
- Implements SQL `LIMIT` and `OFFSET` for pagination
- Updated call in `GetDashboardData` to use new signature with page=1, limit=10000

### Frontend (React/TypeScript)

#### 1. `lib/api.ts`
- Updated `getPaymentReport` function to accept optional `page` and `limit` parameters
- Changed return type to include pagination metadata:
  ```typescript
  {
    data: PaymentReportItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }
  ```

#### 2. `pages/reports.tsx`
- Added state variables:
  - `page`: current page (default: 1)
  - `limit`: items per page (default: 10)
  - `totalPages`: calculated from backend
  - `total`: total record count

- Modified `generatePaymentReport`:
  - Extracts data from response with `response.data`
  - Updates `total` and `totalPages` state

- Added effect hooks:
  - Reset page to 1 when filters change (month, year, class)
  - Trigger report generation when page changes

- Added pagination UI controls:
  - Per-page selector (5, 10, 20, 50, 100 items)
  - Previous/Next buttons
  - Page indicator (Page X of Y)
  - Record counter (Showing 1 to 10 of 1234)

## Features

✓ Configurable items per page (5, 10, 20, 50, 100)
✓ Previous/Next pagination buttons
✓ Page number indicator
✓ Total record counter
✓ Auto-reset to page 1 when filters change
✓ Disabled buttons at boundaries (first/last page)
✓ Backend-enforced maximum limit of 1000 items

## Usage

### Query Parameters
```
GET /api/reports/payments?branchId=xxx&month=01&year=2026&page=1&limit=10
```

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 1000)
- `classId`: Optional class filter
- `branchId`, `month`, `year`: Required

### Example Response
```json
{
  "data": [
    {
      "id": "...",
      "studentName": "John Doe",
      "amount": 500000,
      ...
    }
  ],
  "total": 1234,
  "page": 1,
  "limit": 10,
  "totalPages": 124
}
```

## Testing

1. Build backend: `cd backend_school_crm && go build ./...` ✓
2. Build frontend: `cd frontend_school_crm && npm run build` ✓
3. Test on reports page:
   - Select payment report type
   - Choose month/year/class filters
   - Change per-page limit
   - Navigate between pages
   - Verify data updates correctly

## Backward Compatibility

The API maintains backward compatibility:
- If `page` or `limit` not provided, uses defaults (1, 10)
- Other report types (salary, debtors, expenses) remain unchanged for now
- Can be extended to other report types in the future
