# Students Page Backend Integration

## Overview
Updated the Students page to use backend API instead of local storage (`studentsDB`). All student operations (create, read, update, delete) now communicate with the backend server.

## Changes Made

### 1. **loadData() Function**
**Before:** Loaded from local storage
```typescript
const loadData = async () => {
  if (selectedBranchId) {
    setStudents(studentsDB.getByBranch(selectedBranchId));
    const classList = await apiListClasses(selectedBranchId);
    setClasses(classList);
  } else {
    setStudents(studentsDB.getAll());
    setClasses([]);
  }
};
```

**After:** Loads from backend API with parallel requests
```typescript
const loadData = async () => {
  const selectedBranchId = localStorage.getItem("selectedBranchId");
  try {
    if (selectedBranchId) {
      const [studentsList, classList] = await Promise.all([
        apiListStudents(selectedBranchId),
        apiListClasses(selectedBranchId),
      ]);
      setStudents(studentsList);
      setClasses(classList);
    } else {
      setStudents([]);
      setClasses([]);
    }
  } catch (error) {
    console.error("Failed to load data:", error);
    toast({
      title: t("error"),
      description: "Failed to load students data",
      variant: "destructive",
    });
    setClasses([]);
  }
};
```

### 2. **handleSubmit() - Create/Update**
**Updated to use backend APIs:**
- `apiCreateStudent()` for creating new students
- `apiUpdateStudent()` for updating existing students
- Includes error handling and success toasts
- Only sends allowed fields to backend (classId is optional)

```typescript
try {
  if (editingStudent) {
    await apiUpdateStudent(editingStudent.id, {
      fullName: formData.fullName,
      classId: formData.classId || undefined,
      phone: formData.phone,
      parentPhone: formData.parentPhone,
      status: formData.status,
      monthlyPayment,
    });
  } else {
    await apiCreateStudent({
      fullName: formData.fullName,
      classId: formData.classId || undefined,
      phone: formData.phone,
      parentPhone: formData.parentPhone,
      status: formData.status,
      monthlyPayment,
      enrollmentDate: new Date().toISOString(),
      branchId: branchId || "",
    });
  }
  // ... reload data and show success toast
} catch (error) {
  // ... error handling
}
```

### 3. **confirmDelete() - Single Delete**
**Updated to use backend API:**
- Uses `apiDeleteStudent()` to delete from backend
- Includes error handling
- Reloads data after successful deletion

### 4. **confirmBulkDelete() - Batch Delete**
**Updated to use backend APIs in parallel:**
```typescript
await Promise.all(selectedIds.map((id) => apiDeleteStudent(id)));
```

### 5. **confirmMarkLeft() - Status Update**
**Updated to use backend API:**
- Uses `apiUpdateStudent()` to mark student as "left"
- Includes proper error handling
- Reloads data after successful update

### 6. **processCSVData() - Bulk Import**
**Updated to create students via backend API:**
- Loops through CSV rows and creates each student via `apiCreateStudent()`
- Catches individual row errors and adds them to warnings
- Provides detailed error feedback per row
- Only shows failed row messages in toast

```typescript
try {
  await apiCreateStudent({
    fullName,
    classId: classId || undefined,
    phone,
    parentPhone,
    monthlyPayment,
    status: "active",
    enrollmentDate: new Date().toISOString(),
    branchId: branchId || "",
  });
  importedCount++;
} catch (err) {
  warnings.push(
    `Row ${i + 1}: Failed to import "${fullName}" - ${(err as any)?.message || "Unknown error"}`
  );
}
```

## API Endpoints Used

### listStudents
- **Parameters:** `branchId: string`
- **Returns:** `Student[]`
- **Purpose:** Fetch all active and inactive students in a branch

### createStudent
- **Parameters:** `CreateStudentRequest`
- **Required:** `fullName`, `phone`, `parentPhone`, `monthlyPayment`, `status`, `branchId`
- **Optional:** `classId`, `enrollmentDate`

### updateStudent
- **Parameters:** `id: string`, `UpdateStudentRequest`
- **Allowed Updates:** `fullName`, `classId`, `phone`, `parentPhone`, `status`, `monthlyPayment`, `leftDate`

### deleteStudent
- **Parameters:** `id: string`
- **Returns:** `{ success: boolean }`

## Benefits

1. **Real-time Data Sync** - Data always in sync with backend
2. **Multi-user Support** - Changes by other users are immediately visible
3. **Data Persistence** - All changes stored in database
4. **Centralized Control** - Single source of truth
5. **Better Error Handling** - Per-operation error messages
6. **CSV Import Reliability** - Better error reporting per row

## Changes Summary

| Operation | Before | After |
|-----------|--------|-------|
| Load students | `studentsDB.getByBranch()` | `apiListStudents()` |
| Create student | `studentsDB.create()` | `apiCreateStudent()` |
| Update student | `studentsDB.update()` | `apiUpdateStudent()` |
| Delete student | `studentsDB.delete()` | `apiDeleteStudent()` |
| Bulk delete | `forEach()` local delete | `Promise.all()` API calls |
| CSV import | `studentsDB.create()` per row | `apiCreateStudent()` per row |

## Files Changed
- `/src/pages/students.tsx`

## Testing Checklist

- [ ] Load page and verify students load from backend
- [ ] Create new student and confirm appears in list
- [ ] Edit student (all fields)
- [ ] Delete single student
- [ ] Bulk select and delete multiple students
- [ ] Mark student as "left"
- [ ] Import students from CSV
- [ ] Test error handling when backend is down
- [ ] Verify branch filtering works
- [ ] Check success/error toasts appear

## Notes

- The page still uses `branchesDB.getById()` for default monthly payment (can be updated later)
- Local storage still used for branch selection (`selectedBranchId`)
- CSV import now provides per-row error messages
- All operations include comprehensive error handling
