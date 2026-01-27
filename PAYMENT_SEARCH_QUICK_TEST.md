# Payment Search & Filters - Quick Test Guide

## Testing with Postman

### 1. Get Payment Status for Single Student
```
Method: GET
URL: http://localhost:8080/api/payments/status/STUDENT_ID?branchId=BRANCH_ID
Headers: 
  Authorization: Bearer TOKEN
```

**Expected Response:**
```json
{
  "status": "pending",
  "amount": 170000
}
```

---

### 2. Search All Students with Payment Status
```
Method: GET
URL: http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID
Headers: 
  Authorization: Bearer TOKEN
```

**Expected Response:**
```json
{
  "data": [
    {
      "id": "student-1",
      "fullName": "Student Name",
      "classId": "class-1",
      "phone": "+998...",
      "monthlyPayment": 170000,
      "status": "active",
      "amountPaid": 0,
      "paymentStatus": "not_paid",
      "remaining": 170000
    }
  ],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

---

### 3. Filter by Payment Status (Not Paid)
```
Method: GET
URL: http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&paymentStatus=not_paid
Headers: 
  Authorization: Bearer TOKEN
```

---

### 4. Filter by Payment Status (Paid)
```
Method: GET
URL: http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&paymentStatus=paid
Headers: 
  Authorization: Bearer TOKEN
```

---

### 5. Filter by Payment Status (Partial)
```
Method: GET
URL: http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&paymentStatus=partial
Headers: 
  Authorization: Bearer TOKEN
```

---

### 6. Filter by Class
```
Method: GET
URL: http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&classId=CLASS_ID
Headers: 
  Authorization: Bearer TOKEN
```

---

### 7. Filter by Student Status (Active)
```
Method: GET
URL: http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&status=active
Headers: 
  Authorization: Bearer TOKEN
```

---

### 8. Search by Name
```
Method: GET
URL: http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&search=Rustam
Headers: 
  Authorization: Bearer TOKEN
```

---

### 9. Search by Phone
```
Method: GET
URL: http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&search=998901234567
Headers: 
  Authorization: Bearer TOKEN
```

---

### 10. Complex Query - Unpaid Active Students in Class
```
Method: GET
URL: http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&classId=CLASS_ID&status=active&paymentStatus=not_paid
Headers: 
  Authorization: Bearer TOKEN
```

---

### 11. Pagination - First Page (25 per page)
```
Method: GET
URL: http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&limit=25&offset=0
Headers: 
  Authorization: Bearer TOKEN
```

---

### 12. Pagination - Second Page
```
Method: GET
URL: http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&limit=25&offset=25
Headers: 
  Authorization: Bearer TOKEN
```

---

## Testing with cURL

### Get Single Student Status
```bash
curl -X GET "http://localhost:8080/api/payments/status/STUDENT_ID?branchId=BRANCH_ID" \
  -H "Authorization: Bearer TOKEN"
```

### Search All Students
```bash
curl -X GET "http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID" \
  -H "Authorization: Bearer TOKEN"
```

### Search Not Paid Students
```bash
curl -X GET "http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&paymentStatus=not_paid" \
  -H "Authorization: Bearer TOKEN"
```

### Search by Name
```bash
curl -X GET "http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&search=Rustam" \
  -H "Authorization: Bearer TOKEN"
```

---

## Testing in Frontend

### In JavaScript Console
```javascript
// Check payment status
const status = await fetch(
  '/api/payments/status/student-id?branchId=branch-id',
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.json());
console.log(status);

// Search students
const result = await fetch(
  '/api/payments/search/students?branchId=branch-id&paymentStatus=not_paid',
  { headers: { 'Authorization': `Bearer ${token}` } }
).then(r => r.json());
console.log(result.data);
```

### Using API Functions
```typescript
import { getPaymentStatus, searchStudentsWithPaymentStatus } from '@/lib/api';

// Get single student status
const status = await getPaymentStatus('student-id', 'branch-id');

// Search with filters
const result = await searchStudentsWithPaymentStatus({
  branchId: 'branch-id',
  paymentStatus: 'not_paid',
  status: 'active'
});
```

---

## Common Test Cases

| Purpose | Filter | Expected |
|---------|--------|----------|
| All unpaid | `paymentStatus=not_paid` | Students with 0 payment |
| All partial payments | `paymentStatus=partial` | Students with 0 < amount < monthly |
| All full payments | `paymentStatus=paid` | Students with amount >= monthly |
| Active students | `status=active` | Only active students |
| Left students | `status=left` | Only students who left |
| Specific class | `classId=CLASS_ID` | Students in that class |
| By name | `search=Rustam` | Case-insensitive name match |
| By phone | `search=998901234567` | Phone number search |

---

## Error Testing

### Missing branchId
```
Method: GET
URL: http://localhost:8080/api/payments/search/students
```
**Expected:** 400 - branchId required

### Invalid paymentStatus
```
Method: GET
URL: http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&paymentStatus=invalid
```
**Expected:** 200 - Empty data array (filter returns no results)

### Invalid classId
```
Method: GET
URL: http://localhost:8080/api/payments/search/students?branchId=BRANCH_ID&classId=invalid-id
```
**Expected:** 200 - Empty data array

---

## Performance Tips

1. Use specific filters to reduce result set
2. Use pagination with limit=50 for large datasets
3. Combine filters for better performance: `?status=active&paymentStatus=not_paid`
4. Search by exact phone if possible (faster than name)
