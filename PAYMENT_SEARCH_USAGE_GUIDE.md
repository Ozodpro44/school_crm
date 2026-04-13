# Payment Search & Filters - Usage Guide

## Feature Overview

The payment system now includes two powerful search and filter capabilities:

1. **Modal Integration** - Real-time payment status in create payment modal
2. **Search API** - Comprehensive student search with multiple filters

---

## Feature 1: Payment Modal Status Check

### Location
**Page:** Payments → Create New Payment Modal
**Trigger:** Click "Add Payment" button → Select Student

### How It Works

1. Click **"Add Payment"** button
2. Start typing student name in search box
3. Select a student from dropdown
4. ⚡ **Automatic Status Check** - Backend fetches real-time payment status
5. Status indicator appears below search:

### Status Display

**✅ PAID** (Green)
```
Student has already paid full amount for current month
```

**⚠️ PARTIAL** (Orange)
```
Student has paid partial amount
Shows: "Paid: 85,000 | Remaining: 85,000"
Amount field auto-fills with remaining balance
```

**DEFAULT** (No indicator)
```
Student has not paid yet
Shows full monthly amount to pay
```

---

## Feature 2: Student Search with Filters

### Access Points

**Option 1: Direct API Usage**
```typescript
import { searchStudentsWithPaymentStatus } from '@/lib/api';

const students = await searchStudentsWithPaymentStatus({
  branchId: 'branch-id',
  paymentStatus: 'not_paid'
});
```

**Option 2: Reports Page** (if implemented)
- Filter students by payment status
- See all unpaid students
- Export filtered results

### Filter Types

#### 1. Search by Name
```
Search: "Rustam"
Matches: Abdullayev Rustam, Rustamov Ali, etc.
Case-insensitive, partial matches
```

#### 2. Search by Phone
```
Search: "998901234567"
Matches: Exact or partial phone number
```

#### 3. Filter by Class
```
Class: "Class 5-A"
Shows: Only students in that class
```

#### 4. Filter by Student Status
```
Options:
  - active (default)
  - left (students who left)
  - suspended (temporarily stopped)
```

#### 5. Filter by Payment Status
```
Options:
  - paid (full payment done)
  - partial (some payment done)
  - not_paid (no payment yet)
```

### Combining Filters

**Example 1: Find Unpaid Active Students**
```typescript
searchStudentsWithPaymentStatus({
  branchId: 'branch-1',
  paymentStatus: 'not_paid',
  status: 'active'
})
```
Result: 23 active students who haven't paid

**Example 2: Find Unpaid Students in Specific Class**
```typescript
searchStudentsWithPaymentStatus({
  branchId: 'branch-1',
  classId: 'class-5a',
  paymentStatus: 'not_paid'
})
```
Result: 5 students in class 5-A with no payment

**Example 3: Search Student by Name, Check Payment**
```typescript
searchStudentsWithPaymentStatus({
  branchId: 'branch-1',
  search: 'Rustam'
})
```
Result: All students named Rustam with payment info

---

## Common Use Cases

### Use Case 1: Before Creating a Payment

**Current Flow:**
1. Click "Add Payment"
2. Start typing student name
3. Select student from dropdown
4. **System checks payment status from backend**
5. If paid: Shows "Already Paid" warning
6. If partial: Shows remaining amount and pre-fills form
7. If not paid: Shows full amount to collect

**Benefit:** Prevents duplicate or incorrect payments

---

### Use Case 2: Payment Collection Report

**Find all students who haven't paid yet:**

```javascript
const unpaidStudents = await searchStudentsWithPaymentStatus({
  branchId: 'branch-1',
  paymentStatus: 'not_paid',
  limit: 100
});

// Print report
console.log(`Total unpaid students: ${unpaidStudents.total}`);
unpaidStudents.data.forEach(student => {
  console.log(`${student.fullName} - Owes: ${student.remaining}`);
});
```

---

### Use Case 3: Class-wise Payment Status

**Check payment status for a specific class:**

```javascript
const classPayments = await searchStudentsWithPaymentStatus({
  branchId: 'branch-1',
  classId: 'class-5a'
});

const paidCount = classPayments.data.filter(s => s.paymentStatus === 'paid').length;
const partialCount = classPayments.data.filter(s => s.paymentStatus === 'partial').length;
const unpaidCount = classPayments.data.filter(s => s.paymentStatus === 'not_paid').length;

console.log(`Class 5-A Payment Summary:`);
console.log(`Paid: ${paidCount}`);
console.log(`Partial: ${partialCount}`);
console.log(`Not Paid: ${unpaidCount}`);
```

---

### Use Case 4: Partial Payments Follow-up

**Find students with partial payments:**

```javascript
const partialPayments = await searchStudentsWithPaymentStatus({
  branchId: 'branch-1',
  paymentStatus: 'partial'
});

// Send reminders to collect remaining
partialPayments.data.forEach(student => {
  console.log(`${student.fullName}: Paid ${student.amountPaid}, Remaining: ${student.remaining}`);
});
```

---

### Use Case 5: Multi-filter Search

**Find unpaid students in Class 5-A named "Rustam":**

```javascript
const specificStudents = await searchStudentsWithPaymentStatus({
  branchId: 'branch-1',
  classId: 'class-5a',
  paymentStatus: 'not_paid',
  search: 'Rustam'
});

// Process results
if (specificStudents.total === 0) {
  console.log('No unpaid students matching criteria');
} else {
  specificStudents.data.forEach(student => {
    console.log(`${student.fullName} (Class ${student.classId}): ${student.remaining} remaining`);
  });
}
```

---

## Filter Response Examples

### All Students (First 10)
```json
{
  "data": [
    {
      "id": "s1",
      "fullName": "Abdullayev Rustam",
      "classId": "c1",
      "phone": "+998901234567",
      "monthlyPayment": 170000,
      "status": "active",
      "amountPaid": 0,
      "paymentStatus": "not_paid",
      "remaining": 170000
    },
    {
      "id": "s2",
      "fullName": "Qurbonov Ilkhom",
      "classId": "c1",
      "phone": "+998902345678",
      "monthlyPayment": 170000,
      "status": "active",
      "amountPaid": 170000,
      "paymentStatus": "paid",
      "remaining": 0
    }
  ],
  "total": 45,
  "limit": 10,
  "offset": 0
}
```

### Not Paid Filter
- Only students with `paymentStatus: "not_paid"`
- `amountPaid: 0`
- `remaining: monthlyPayment`

### Partial Filter
- Only students with `paymentStatus: "partial"`
- `0 < amountPaid < monthlyPayment`
- `remaining > 0`

### Paid Filter
- Only students with `paymentStatus: "paid"`
- `amountPaid >= monthlyPayment`
- `remaining: 0`

---

## Pagination Examples

### Get First Page (25 per page)
```javascript
const page1 = await searchStudentsWithPaymentStatus({
  branchId: 'branch-1',
  paymentStatus: 'not_paid',
  limit: 25,
  offset: 0
});
```

### Get Second Page
```javascript
const page2 = await searchStudentsWithPaymentStatus({
  branchId: 'branch-1',
  paymentStatus: 'not_paid',
  limit: 25,
  offset: 25
});
```

### Get All Results (if < 500)
```javascript
const allStudents = await searchStudentsWithPaymentStatus({
  branchId: 'branch-1',
  limit: 500
});
```

---

## Error Handling

### Handle Missing Branch
```typescript
try {
  const students = await searchStudentsWithPaymentStatus({
    branchId: ''  // Missing!
  });
} catch (error) {
  console.error('Error: branchId is required');
}
```

### Handle Empty Results
```typescript
const results = await searchStudentsWithPaymentStatus({
  branchId: 'branch-1',
  paymentStatus: 'not_paid'
});

if (results.total === 0) {
  console.log('All students have paid or made partial payments');
} else {
  // Process results
}
```

### Handle API Errors
```typescript
try {
  const results = await searchStudentsWithPaymentStatus({
    branchId: 'branch-1'
  });
} catch (error) {
  console.error('Failed to fetch students:', error);
  // Show user-friendly message
  toast.error('Could not load student list');
}
```

---

## Performance Tips

1. **Use Specific Filters**
   - `?paymentStatus=not_paid` instead of fetching all
   - Reduces data transfer

2. **Combine Filters**
   - `?classId=X&paymentStatus=not_paid` filters early
   - Better than two API calls

3. **Pagination for Large Results**
   - Use `limit=50` for 50 per page
   - Implement "Load More" pattern

4. **Cache Results** (frontend)
   - Store results temporarily
   - Refresh on user action

---

## Integration Points

### Payment Modal
- File: `src/pages/payments.tsx` (lines 1354-1413)
- Calls: `apiGetPaymentStatus()` on student select

### Reports Page (Future)
- Search for students by criteria
- Show payment statistics
- Export functionality

### Dashboard (Future)
- Quick stats: "X students haven't paid"
- Payment collection trends
- Class-wise summaries

---

## Keyboard Shortcuts (Modal)

| Action | Key |
|--------|-----|
| Search student | Just type |
| Select from dropdown | Enter or Click |
| Clear selection | ESC or X button |

---

## Mobile Considerations

- Search dropdown is touch-friendly
- Filter parameters work on mobile API calls
- Results paginated for mobile performance

---

## Troubleshooting

### "No students found" with filters
- Check if branchId is correct
- Verify filters match your data
- Try removing filters one by one

### Wrong payment status showing
- Backend may need data refresh
- Check payment creation timestamps
- Verify payments are in current month

### Slow search response
- Reduce result set with filters
- Use pagination with smaller pages
- Check server logs for errors

---

## Best Practices

1. ✅ Always include branchId
2. ✅ Use appropriate filters
3. ✅ Handle errors gracefully
4. ✅ Cache when appropriate
5. ✅ Paginate large result sets
6. ✅ Show loading indicators
7. ✅ Validate input before sending
8. ✅ Provide clear status feedback

---

## Summary

The new payment search and filter system provides:

- ✅ **Real-time payment status** in create modal
- ✅ **Multi-criteria search** by name or phone
- ✅ **Flexible filtering** by class, status, payment
- ✅ **Pagination support** for large datasets
- ✅ **Error handling** with graceful fallbacks
- ✅ **Performance optimization** with smart queries

Use these features to improve payment collection efficiency and prevent duplicate payments.
