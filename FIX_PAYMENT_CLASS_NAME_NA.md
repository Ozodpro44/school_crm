# Fix: Class Name Showing as "N/A" in Payment List

## Problem
Class names were displaying as "N/A" in the payment list, even though students were properly assigned to classes.

## Root Cause
The `getClassName()` function was only looking in `filteredStudentsForModal`, which is only populated when you search for students in the modal. For regular payment list display, the data wasn't available.

## Solution

### Backend Changes

**1. Updated StudentInfo Model** (`internal/models/models.go`):
Added `ClassID` and `ClassName` fields to include class information:
```go
type StudentInfo struct {
    ID             string
    FullName       string
    Phone          string
    ClassID        string      // NEW
    ClassName      string      // NEW
    MonthlyPayment float64
}
```

**2. Modified getPaymentsConsolidatedData Handler** (`internal/handlers/payment.go`):
- Build a `classNameMap` before building student list
- For each student in payment results, look up and include their class name
- Pass `ClassID` and `ClassName` in StudentInfo response
- Avoid duplicate class fetching

Flow:
```
1. Get all students for branch
2. Build classIDMap from payment results
3. For each classID, fetch class data and build classNameMap
4. For each student in results, look up className from classNameMap
5. Include ClassID and ClassName in StudentInfo response
```

### Frontend Changes

**1. Updated studentInfoMap Type** (`src/pages/payments.tsx`):
```typescript
studentInfoMap: Map<string, {
  fullName: string;
  phone: string;
  classId: string;        // NEW
  className: string;      // NEW
  monthlyPayment: number;
}>
```

**2. Updated loadData Function**:
Populate the new fields from API response:
```typescript
const studentMap = new Map(...);
studentsList.forEach((student: any) => {
  studentMap.set(student.id, {
    fullName: student.fullName,
    phone: student.phone,
    classId: student.classId,      // NEW
    className: student.className,   // NEW
    monthlyPayment: student.monthlyPayment,
  });
});
```

**3. Updated getClassName Function**:
Now checks multiple sources:
1. First checks `studentInfoMap` (from consolidated endpoint)
2. Falls back to `filteredStudentsForModal` (from search)
3. Returns "N/A" if not found

```typescript
const getClassName = (studentId: string) => {
  // Try consolidated data first
  const studentInfo = studentInfoMap.get(studentId);
  if (studentInfo?.className) return studentInfo.className;
  
  // Fall back to search results
  const student = filteredStudentsForModal.find((s) => s.id === studentId);
  if (student?.className) return student.className;
  
  // Not found
  return "N/A";
};
```

## Result
- Class names now display correctly in payment list
- Data comes directly from consolidated endpoint (single API call)
- No "N/A" values unless class is actually unassigned
- Efficient: no extra API calls needed
- Works in both list view and modal view

## Data Flow
```
Backend:
  getPaymentsConsolidatedData
  ├── Get payments
  ├── Get all students (to map student -> class)
  ├── Get class data for each class
  └── Return StudentInfo[] with className included

Frontend:
  loadData()
  ├── Fetch consolidated data
  ├── Build studentInfoMap from students array
  └── Use studentInfoMap in getClassName()
```
