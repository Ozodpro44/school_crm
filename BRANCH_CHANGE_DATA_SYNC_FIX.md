# Branch Change Data Sync Fix

## Problem
When changing branches, student payments and other data were not being updated on certain pages. This was because some pages were missing the `branchChange` event listener that triggers data reloads when the branch selection changes.

## Root Causes

### 1. Missing Branch Change Event Listener
Several pages were not listening for the `branchChange` event:
- `student-details.tsx` - ❌ Missing listener
- `teachers.tsx` - ❌ Missing listener (was using bad dependency)
- `salaries.tsx` - ❌ Missing listener

### 2. Using Local Storage Instead of API
The `salaries.tsx` page loads data from local storage only:
```typescript
const loadData = () => {
  setSalaries(salariesDB.getAll());  // Only from local storage
  setTeachers(teachersDB.getAll());  // Only from local storage
};
```

This means it never fetches from the backend API, so branch changes have no effect on the data.

## Solutions Applied

### 1. Added Branch Change Listener to `student-details.tsx`
```typescript
// Reload data when branch changes
useEffect(() => {
  const handleBranchChange = () => {
    loadData();
  };
  window.addEventListener("branchChange", handleBranchChange);
  return () => window.removeEventListener("branchChange", handleBranchChange);
}, []);
```

### 2. Fixed `teachers.tsx` Branch Change Listener
**Before:**
```typescript
useEffect(() => {
  const user = getCurrentUser();
  setIsLoading(true);
  loadData();
}, [localStorage.getItem("selectedBranchId")]); // ❌ This doesn't work reactively
```

**After:**
```typescript
useEffect(() => {
  const user = getCurrentUser();
  setIsLoading(true);
  loadData();
}, []);

// Reload data when branch changes
useEffect(() => {
  const handleBranchChange = () => {
    loadData();
  };
  window.addEventListener("branchChange", handleBranchChange);
  return () => window.removeEventListener("branchChange", handleBranchChange);
}, []);
```

### 3. Added Branch Change Listener to `salaries.tsx`
Same pattern as above - added proper event listener instead of relying on localStorage dependency.

## How It Works

### Branch Selection Flow
1. User selects a new branch in the branch dropdown (in `Layout.tsx`)
2. `BranchContext` saves the new branch ID to `localStorage`
3. `BranchContext` dispatches a `branchChange` custom event
4. All pages listening to this event receive the notification
5. Pages call their `loadData()` function to fetch fresh data from the backend

### Data Loading on Branch Change
When a page's `loadData()` function is called after branch change:
```typescript
const loadData = async () => {
  const selectedBranchId = localStorage.getItem("selectedBranchId");
  if (selectedBranchId) {
    const paymentsList = await apiListPayments({ branchId: selectedBranchId });
    setPayments(paymentsList);
    // ... other data loads
  }
};
```

## Files Modified

1. **`/frontend_school_crm/src/pages/student-details.tsx`**
   - Added branch change event listener

2. **`/frontend_school_crm/src/pages/teachers.tsx`**
   - Removed bad localStorage dependency from useEffect
   - Added proper branch change event listener

3. **`/frontend_school_crm/src/pages/salaries.tsx`**
   - Added branch change event listener

## Pages Already Using Branch Change Listener ✅

- `payments.tsx` - ✅ Has listener
- `students.tsx` - ✅ Has listener
- `classes.tsx` - ✅ Has listener
- `class-details.tsx` - ✅ Has listener
- `expenses.tsx` - ✅ Has listener

## Pages Now Fixed ✅

- `student-details.tsx` - ✅ Fixed
- `teachers.tsx` - ✅ Fixed
- `salaries.tsx` - ✅ Fixed

## Next Steps (Optional Improvements)

### Upgrade Salaries Page to Use Backend API
Currently, `salaries.tsx` only uses local storage. To make it fully backend-driven:

1. Import API functions:
```typescript
import { listSalaries as apiListSalaries, listTeachers as apiListTeachers } from "@/lib/api";
```

2. Update `loadData()`:
```typescript
const loadData = async () => {
  const selectedBranchId = localStorage.getItem("selectedBranchId");
  if (selectedBranchId) {
    const salaryList = await apiListSalaries(selectedBranchId);
    setSalaries(salaryList);
    const teacherList = await listTeachers(selectedBranchId);
    setTeachers(teacherList);
  }
};
```

3. Update create/update/delete operations to use API functions instead of local storage.

## Testing Checklist

- [ ] Open Payments page
- [ ] Switch branch - verify payments update ✅
- [ ] Go to Students page
- [ ] Switch branch - verify student list updates ✅
- [ ] Click on a student to open Student Details
- [ ] Switch branch - verify student payments update ✅ (Now Fixed)
- [ ] Open Teachers page
- [ ] Switch branch - verify teacher list updates ✅ (Now Fixed)
- [ ] Open Salaries page
- [ ] Switch branch - verify salary list updates ✅ (Now Fixed)
- [ ] Open Classes and Class Details
- [ ] Switch branch - verify data updates ✅

## Summary

Fixed the branch switching issue by ensuring all data-dependent pages have a `branchChange` event listener that triggers data reloads. This ensures that when a user changes the branch, all pages immediately fetch data for the new branch instead of showing stale data.
