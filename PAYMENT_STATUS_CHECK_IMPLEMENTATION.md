# Payment Status Check Implementation - Create Payment Modal

## Overview
When a student is selected in the create payments modal, the system now fetches their real payment status from the backend for the current month instead of using stale local data.

## Backend Changes

### New API Endpoint
**Route:** `GET /api/payments/status/:studentId`
**Query Parameter:** `branchId` (required)

**Response:**
```json
{
  "status": "pending",
  "amount": 170000
}
```

- `amount`: Total amount paid by the student in the current month (0 if not paid)
- `status`: Always "pending" in the response (status determination is done on frontend)

**Location:** `/backend_school_crm/internal/handlers/payment.go`

**Handler Function:** `getStudentPaymentStatus()`

**Permissions:** Requires `canViewPayments` permission

## Frontend Changes

### API Function
Added new API function in `/frontend_school_crm/src/lib/api.ts`:
```typescript
export async function getPaymentStatus(
  studentId: string,
  branchId: string
): Promise<{ status: string; amount: number }>
```

### Modal Logic
Modified student selection handler in `/frontend_school_crm/src/pages/payments.tsx`:

When a student is selected from the dropdown:
1. Fetches payment status from backend: `apiGetPaymentStatus(studentId, branchId)`
2. Receives the amount already paid in the current month
3. Compares with student's monthly payment amount:
   - **If paid >= monthly amount:** Status = "paid" (green indicator)
   - **If 0 < paid < monthly amount:** Status = "partial" (orange indicator, shows remaining amount)
   - **If paid = 0:** Status = "none" (shows full monthly amount to pay)

### Status Display
The payment summary box (lines 1440-1465) displays:
- ✅ **Paid:** Student has already paid full amount for current month
- ⚠️ **Partial:** Student has paid partial amount, shows remaining balance
- Default: Shows full monthly amount required

## Data Flow Diagram

```
Student Selection in Modal
        ↓
Async onClick Handler
        ↓
apiGetPaymentStatus(studentId, branchId)
        ↓
Backend: GET /api/payments/status/{studentId}?branchId={branchId}
        ↓
Database Query: Get payments for student in current month
        ↓
Calculate Total Paid Amount
        ↓
Response: { status: "pending", amount: totalPaid }
        ↓
Frontend: Compare amount with monthlyPayment
        ↓
Update Payment Summary Display
        ↓
Set Form Amount (remaining or full)
```

## API Usage Example

**Request:**
```bash
GET /api/payments/status/student-123?branchId=branch-456
Authorization: Bearer {token}
```

**Response:**
```json
{
  "status": "pending",
  "amount": 170000
}
```

## Key Improvements

1. **Real-time Data:** Fetches current payment status instead of using cached local data
2. **Prevents Duplicate Payments:** Clearly shows if student has already paid
3. **Partial Payment Tracking:** Shows remaining balance if student made partial payment
4. **Branch-aware:** Respects each branch's current financial month
5. **Graceful Fallback:** If API call fails, falls back to empty summary

## Testing

Test with Postman:
```
Method: GET
URL: http://localhost:8080/api/payments/status/student-id?branchId=branch-id
Headers: Authorization: Bearer {token}
```

## Related Files
- Backend: `/backend_school_crm/internal/handlers/payment.go` (lines 335-346)
- Frontend: `/frontend_school_crm/src/pages/payments.tsx` (lines 1354-1417)
- API: `/frontend_school_crm/src/lib/api.ts` (lines 671-682)
