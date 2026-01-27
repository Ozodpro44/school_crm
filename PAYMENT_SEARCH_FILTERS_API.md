# Payment Search & Filters API Documentation

## Overview
Two new endpoints for payment management with comprehensive search and filtering capabilities.

---

## Endpoint 1: Student Payment Status

**Route:** `GET /api/payments/status/:studentId`

**Query Parameters:**
- `branchId` (required) - Branch ID

**Response:**
```json
{
  "status": "pending",
  "amount": 170000
}
```

**Description:** Get current month payment status for a single student.

**Use Cases:**
- Create payments modal - show if student already paid
- Quick payment status check

---

## Endpoint 2: Search Students with Payment Status

**Route:** `GET /api/payments/search/students`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `branchId` | string | ✅ | Branch ID |
| `search` | string | ❌ | Search by student name or phone (case-insensitive) |
| `classId` | string | ❌ | Filter by class ID |
| `status` | string | ❌ | Filter by student status: `active`, `left`, `suspended` |
| `paymentStatus` | string | ❌ | Filter by payment status: `paid`, `partial`, `not_paid` |
| `limit` | number | ❌ | Results per page (default: 50, max: 500) |
| `offset` | number | ❌ | Pagination offset (default: 0) |

**Response:**
```json
{
  "data": [
    {
      "id": "student-123",
      "fullName": "Abdullayev Rustam",
      "classId": "class-456",
      "phone": "+998901234567",
      "monthlyPayment": 170000,
      "status": "active",
      "amountPaid": 85000,
      "paymentStatus": "partial",
      "remaining": 85000
    },
    {
      "id": "student-124",
      "fullName": "Qurbonov Ilkhom",
      "classId": "class-456",
      "phone": "+998902345678",
      "monthlyPayment": 170000,
      "status": "active",
      "amountPaid": 170000,
      "paymentStatus": "paid",
      "remaining": 0
    }
  ],
  "total": 45,
  "limit": 50,
  "offset": 0
}
```

---

## Field Descriptions

### Student Payment Status Fields
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Student ID |
| `fullName` | string | Student full name |
| `classId` | string | Class ID student is enrolled in |
| `phone` | string | Student phone number |
| `monthlyPayment` | number | Monthly tuition amount |
| `status` | string | Student status: `active`, `left`, or `suspended` |
| `amountPaid` | number | Total amount paid in current month |
| `paymentStatus` | string | Payment status: `paid`, `partial`, or `not_paid` |
| `remaining` | number | Remaining amount to pay (0 if paid) |

### Payment Status Values
- **`paid`** - Student has paid full monthly tuition
- **`partial`** - Student has paid some amount but not full
- **`not_paid`** - Student has not made any payment

### Student Status Values
- **`active`** - Currently enrolled
- **`left`** - Has left the school
- **`suspended`** - Temporarily suspended

---

## API Usage Examples

### Example 1: Check Single Student Status
```bash
curl -X GET "http://localhost:8080/api/payments/status/student-123?branchId=branch-456" \
  -H "Authorization: Bearer {token}"
```

**Response:**
```json
{
  "status": "pending",
  "amount": 170000
}
```

### Example 2: Search All Active Students in a Class
```bash
curl -X GET "http://localhost:8080/api/payments/search/students?branchId=branch-456&classId=class-789&status=active" \
  -H "Authorization: Bearer {token}"
```

### Example 3: Find All Students Who Haven't Paid
```bash
curl -X GET "http://localhost:8080/api/payments/search/students?branchId=branch-456&paymentStatus=not_paid" \
  -H "Authorization: Bearer {token}"
```

### Example 4: Search by Student Name with Pagination
```bash
curl -X GET "http://localhost:8080/api/payments/search/students?branchId=branch-456&search=Rustam&limit=25&offset=0" \
  -H "Authorization: Bearer {token}"
```

### Example 5: Complex Filter - Unpaid Active Students
```bash
curl -X GET "http://localhost:8080/api/payments/search/students?branchId=branch-456&status=active&paymentStatus=not_paid&limit=50" \
  -H "Authorization: Bearer {token}"
```

---

## Frontend Usage

### TypeScript Import
```typescript
import {
  getPaymentStatus,
  searchStudentsWithPaymentStatus,
  StudentPaymentInfo,
} from "@/lib/api";
```

### Single Student Status
```typescript
const status = await getPaymentStatus("student-123", "branch-456");
console.log(`Amount paid: ${status.amount}`);
```

### Search with Filters
```typescript
const result = await searchStudentsWithPaymentStatus({
  branchId: "branch-456",
  paymentStatus: "not_paid",
  status: "active",
  limit: 25,
  offset: 0,
});

console.log(`Found ${result.total} unpaid students`);
result.data.forEach(student => {
  console.log(`${student.fullName}: ${student.remaining} remaining`);
});
```

### Search by Name
```typescript
const result = await searchStudentsWithPaymentStatus({
  branchId: "branch-456",
  search: "Rustam",
  limit: 10,
});
```

---

## Performance Notes

1. **Search endpoint** fetches all students for a branch (max 10,000) then applies filters in-memory
2. **Pagination** is handled after filtering for optimal UX
3. **Search** supports partial name/phone matching
4. **Payment calculation** queries the current month only

## Permissions

Both endpoints require `canViewPayments` permission.

## Error Responses

```json
{
  "error": "branchId required"
}
```

```json
{
  "error": "failed to get students"
}
```

```json
{
  "error": "failed to get branch current month"
}
```

---

## Related Files
- Backend Handler: `/backend_school_crm/internal/handlers/payment.go` (lines 308-465)
- Frontend API: `/frontend_school_crm/src/lib/api.ts` (lines 674-726)
- Frontend Modal: `/frontend_school_crm/src/pages/payments.tsx` (payment creation modal)
