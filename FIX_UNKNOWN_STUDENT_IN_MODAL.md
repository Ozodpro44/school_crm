# Fix: "Unknown" Student Name in Payment Modal

## Problem
When selecting a student from the search results in the create payment modal, the student name would show as "Unknown" because:
1. After selection, the search term is cleared
2. This clears `filteredStudentsForModal` (the array of search results)
3. `getStudentName()` couldn't find the student anymore
4. The student wasn't in `studentInfoMap` (only contains students with existing payments)
5. Result: "Unknown" name and "N/A" class displayed

## Solution
Added a `selectedStudentInfo` state to store the selected student's information when they're chosen from the search results.

### Changes Made

**1. New State Added** (lines 139-147):
```typescript
const [selectedStudentInfo, setSelectedStudentInfo] = useState<{
  id: string;
  fullName: string;
  phone: string;
  classId: string;
  className: string;
  monthlyPayment: number;
} | null>(null);
```

**2. Updated getStudentName()** (lines 858-873):
Now checks in this priority order:
1. Selected student from modal (if just selected)
2. Student map from consolidated endpoint (payments list)
3. Filtered students from search (fallback)
4. "Unknown" (if not found anywhere)

```typescript
const getStudentName = (studentId: string) => {
  // First check selected student from modal
  if (selectedStudentInfo?.id === studentId) {
    return selectedStudentInfo.fullName;
  }
  
  // Then try consolidated data
  const studentInfo = studentInfoMap.get(studentId);
  if (studentInfo?.fullName) return studentInfo.fullName;
  
  // Fall back to search results
  const student = filteredStudentsForModal.find((s) => s.id === studentId);
  if (student?.fullName) return student.fullName;
  
  return "Unknown";
};
```

**3. Updated getClassName()** (lines 876-892):
Same priority order as getStudentName()

**4. Store Selected Student Info** (lines 1493-1506):
When a student is clicked from the dropdown, store their complete info:
```typescript
setSelectedStudentInfo({
  id: student.id,
  fullName: student.fullName,
  phone: student.phone,
  classId: student.classId,
  className: student.className,
  monthlyPayment: student.monthlyPayment,
});
```

**5. Clear Selected Info When User Clears Selection** (lines 1458-1465):
When the user clicks the X button to clear selection:
```typescript
setSelectedStudentInfo(null);
```

**6. Clear Selected Info in resetForm()** (lines 784-786):
When dialog closes or form is reset:
```typescript
setSelectedStudentInfo(null);
setStudentSearchTerm("");
setPaymentSummary(null);
```

## Result
✅ When selecting a student from search results:
- Student name displays correctly (not "Unknown")
- Class name displays correctly (not "N/A")
- Info persists even after search term is cleared
- Works until user clears selection or closes modal

✅ No extra API calls needed
✅ Clean state management
✅ Build passes with no errors

## User Flow
1. User opens payment modal
2. Types to search for student
3. Search results display with loading spinner
4. User clicks a student from results
5. **Selected student info is stored** (fix)
6. Search field clears
7. Student name and class display correctly
8. User can see payment summary
9. When clearing selection or closing modal, selected info is cleared

## Files Modified
- `src/pages/payments.tsx`
  - Added `selectedStudentInfo` state (lines 139-147)
  - Updated `getStudentName()` (lines 858-873)
  - Updated `getClassName()` (lines 876-892)
  - Updated student selection click handler (lines 1493-1506)
  - Updated clear button handler (lines 1458-1465)
  - Updated `resetForm()` function (lines 784-786)
