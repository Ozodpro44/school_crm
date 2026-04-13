# Payments Page Backend Integration

## Overview
Updated the Payments page to use backend API instead of local storage (`paymentsDB`). All payment operations now communicate with the backend server.

## Changes Made

### 1. **Import Backend APIs**
Added imports for payment, student, and class API functions:
```typescript
import {
  listPayments as apiListPayments,
  createPayment as apiCreatePayment,
  updatePayment as apiUpdatePayment,
  deletePayment as apiDeletePayment,
  listStudents as apiListStudents,
  listClasses as apiListClasses,
} from "@/lib/api";
```

### 2. **loadData() Function**
**Before:** Loaded data from local storage
```typescript
const loadData = () => {
  setPayments(paymentsDB.getAll());
  setStudents(studentsDB.getAll());
  setClasses(classesDB.getAll());
};
```

**After:** Loads data from backend API with branch filtering
```typescript
const loadData = async () => {
  const selectedBranchId = localStorage.getItem("selectedBranchId");
  try {
    if (selectedBranchId) {
      const [paymentsList, studentsList, classesList] = await Promise.all([
        apiListPayments({ branchId: selectedBranchId }),
        apiListStudents(selectedBranchId),
        apiListClasses(selectedBranchId),
      ]);
      setPayments(paymentsList);
      setStudents(studentsList);
      setClasses(classesList);
    } else {
      setPayments([]);
      setStudents([]);
      setClasses([]);
    }
  } catch (error) {
    console.error("Failed to load data:", error);
    toast({
      title: t("error"),
      description: "Failed to load payments data",
      variant: "destructive",
    });
  }
};
```

### 3. **handleSubmit() Function**
**Updated for:**
- Create new payments: Uses `apiCreatePayment()`
- Update existing payments: Uses `apiUpdatePayment()`
- Error handling with try-catch
- Reloads data after successful operations

**Key Changes:**
- Used `payments` state array instead of `paymentsDB.getAll()`
- API only allows updating: `amount`, `status`, `paymentMethod`, `notes`, `paidDate`
- Cannot change `studentId`, `month`, or `year` after creation

### 4. **handleDelete() Function**
**Before:** Used `paymentsDB.delete()`
**After:** Uses `apiDeletePayment()` with error handling

### 5. **handleBulkPayment() Function**
**Updated for:**
- Converts forEach loop to for-of loop (proper async handling)
- Creates payments via `apiCreatePayment()` for each student
- Uses `payments` state instead of `paymentsDB.getAll()`
- Includes comprehensive error handling

## API Endpoint Usage

### listPayments
- **Parameters:** `{ branchId?: string; studentId?: string; month?: string; year?: number; }`
- **Purpose:** Fetch payments with optional filters

### createPayment
- **Parameters:** `CreatePaymentRequest`
- **Required Fields:** `studentId`, `amount`, `month`, `year`, `status`, `paymentMethod`, `branchId`
- **Optional Fields:** `invoiceNumber`, `notes`, `paidDate`

### updatePayment
- **Parameters:** `UpdatePaymentRequest`
- **Allowed Updates:** `status`, `paymentMethod`, `amount`, `notes`, `paidDate`
- **Note:** Cannot change `studentId`, `month`, or `year`

### deletePayment
- **Parameters:** Payment ID
- **Returns:** `{ success: boolean }`

## Benefits

1. **Real-time Data:** Data is always synced with the backend
2. **Multi-user Support:** Payments created by other users are immediately visible
3. **Data Persistence:** All changes are persisted to the database
4. **Centralized Control:** Single source of truth on the server
5. **Audit Trail:** Backend can maintain complete audit logs

## Testing Checklist

- [ ] Load payments page and verify data loads from backend
- [ ] Create new payment and confirm it appears in list
- [ ] Edit payment (amount, status, payment method, notes only)
- [ ] Delete payment and confirm removal
- [ ] Bulk create payments for multiple students
- [ ] Verify branch filtering works correctly
- [ ] Test error handling when backend is unavailable
- [ ] Verify payment status calculations still work

## Notes

- The `monthArchivesDB` local database is still used for month archival checks
- Local storage is still used for branch selection (`selectedBranchId`)
- The page uses the `useAsync` hook for loading state management
- All API calls include proper error handling and user feedback
