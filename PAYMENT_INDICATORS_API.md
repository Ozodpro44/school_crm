# Payment Indicators API Integration

## Overview
Updated the payments page to use a dedicated backend API endpoint for calculating payment indicators instead of calculating them on the frontend. This improves performance and ensures accurate data from the server.

## Changes Made

### Backend (Go)

#### File: `backend_school_crm/internal/handlers/payment.go`
- **Fixed endpoint**: `GET /payments/payments/:branchId/indicators`
  - Fixed typo: `brnachId` → `branchId`
  - Changed from path parameters to query parameters for month and year
  - Renamed function: `getPaymentSummaryByPeriod` → `getPaymentIndicators`
  
- **Endpoint Details**:
  ```
  GET /payments/payments/:branchId/indicators?month=01&year=2024
  ```
  - Returns: Payment summary with totals by status and method
  - Authentication: Required (`canViewPayments` permission)

### Frontend (React/TypeScript)

#### File: `frontend_school_crm/src/lib/api.ts`
- **Added function**: `getPaymentIndicators(branchId, month, year)`
  - Calls the backend indicators endpoint
  - Returns payment summary with:
    - `totalPaid`: Total paid payments
    - `totalUnpaid`: Total unpaid amount
    - `totalPartial`: Total partial payment amount
    - `byMethod`: Breakdown by payment method (card, cash, bank)

#### File: `frontend_school_crm/src/pages/payments.tsx`
- **Added state**: `indicators` to store API response
- **Updated loadData**: Fetches indicators along with payments and students
- **Simplified calculations**: Uses API data instead of local filtering
  - `totalIncome` ← `indicators.totalPaid`
  - `totalPending` ← `indicators.totalUnpaid`
  - `totalByMethod` ← `indicators.byMethod`

## Benefits

1. **Performance**: Reduces frontend computation for large datasets
2. **Accuracy**: Calculations done on the server with access to all data
3. **Consistency**: Same calculation logic for all users
4. **Scalability**: Backend can optimize queries efficiently
5. **Maintainability**: Single source of truth for calculations

## API Response Example

```json
{
  "totalPaid": 5000000,
  "totalUnpaid": 3000000,
  "totalPartial": 1500000,
  "byMethod": {
    "card": 2000000,
    "cash": 2500000,
    "bank": 500000
  }
}
```

## Data Flow

```
Payments Page
    ↓
loadData() triggers
    ↓
Promise.all([
  apiListPayments(),
  apiListStudents(),
  apiListClasses(),
  getPaymentIndicators() ← NEW
])
    ↓
Backend API Endpoint
/payments/payments/:branchId/indicators?month=01&year=2024
    ↓
Response with summary data
    ↓
Display indicators in UI cards
```

## Testing

To test the endpoint:

```bash
curl -X GET "http://localhost:8080/api/payments/payments/branch-123/indicators?month=01&year=2024" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

## Fallback

If the API call fails, indicators default to 0. The page will still function with consolidated payment display showing individual payment data.
