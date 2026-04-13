# Loading States Implementation for Buttons

This document summarizes all the loading states (Loader2 spinners) added to buttons across the application.

## Changes Made

### Frontend School CRM (`frontend_school_crm/src/pages/`)

#### 1. **branches.tsx**
- Added `isDeleteLoading` and `deletingBranchId` states
- Delete button shows spinner when deleting specific branch
- Updated `handleDelete` with loading state management

#### 2. **teachers.tsx**
- Added `isDeleteLoading` and `deletingTeacherId` states
- Delete button shows spinner when deleting specific teacher
- Updated `handleDelete` with loading state management

#### 3. **managers.tsx**
- Added `isDeleteLoading`, `deletingManagerId`, and `isBulkDeleteLoading` states
- Individual delete button shows spinner for specific manager
- Bulk delete button shows spinner during bulk operation
- Updated `handleDelete` and `handleBulkDelete` with loading state management

#### 4. **classes.tsx**
- Confirm dialog button updated to use `Loader2` instead of showing only text
- Loading state shows "Deleting..." with spinner during class deletion

#### 5. **expenses.tsx**
- Added `Loader2` to imports
- Confirm dialog button shows spinner during expense deletion
- Both cancel and confirm buttons disabled during loading

#### 6. **salaries.tsx**
- Added `isDeleteLoading` state
- Delete confirmation button shows spinner during salary deletion
- Updated `confirmDelete` to be async with loading state

#### 7. **payments.tsx**
- Added `Loader2` to imports
- Delete confirmation dialog shows spinner during payment deletion
- Cancel button disabled during loading

#### 8. **students.tsx**
- Added `Loader2` to imports
- Delete Confirmation Dialog: Shows spinner with "Deleting..." text
- Bulk Delete Confirmation Dialog: Shows spinner with "Deleting..." text
- Mark Left Confirmation Dialog: Shows spinner with "Updating..." text

#### 9. **admin-profile.tsx**
- Added `Loader2` to imports
- Edit Profile Modal: Save button shows spinner with "Saving..."
- Change Password Modal: Update button shows spinner with "Updating..."

#### 10. **settings.tsx**
- Added `Loader2` to imports
- Switch Month Confirmation Dialog: Button shows spinner with "Переключение..."

#### 11. **developer-logs.tsx**
- Added `isClearingLogs` state
- Clear Logs button shows spinner with "Clearing..." during log deletion

#### 12. **class-details.tsx**
- Replaced inline SVG spinner with `Loader2` icon
- Confirm dialog button shows spinner with "Loading..." during async operations

#### 13. **student-details.tsx**
- Added `isDeleteLoading` and `isMarkLeftLoading` states
- Delete Confirmation Dialog: Shows spinner with "Deleting..." text
- Mark Left Confirmation Dialog: Shows spinner with "Updating..." text
- Updated `confirmDelete` and `confirmMarkLeft` to be async with error handling

### Frontend for Dev (`frontend_for_dev/src/pages/`)

#### 1. **SubscriptionPlans.tsx**
- Changed `Loader` to `Loader2` for consistency
- Added `isSaving` and `isDeleting` states
- Plan Modal: Save button shows spinner with "Saving..."
- Delete Plan Dialog: Button shows spinner with "Deleting..."
- Subscription Modal: Save button shows spinner with "Saving..."
- Delete Subscription Dialog: Button shows spinner with "Deleting..."
- Page loading indicator updated to use `Loader2`

## Pattern Used

All loading implementations follow this pattern:

```tsx
// State
const [isLoading, setIsLoading] = useState(false);

// Handler
const handleAction = async () => {
  setIsLoading(true);
  try {
    await asyncOperation();
    // Success handling
  } catch (error) {
    // Error handling
  } finally {
    setIsLoading(false);
  }
};

// Button
<Button
  onClick={handleAction}
  disabled={isLoading}
>
  {isLoading ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Loading...
    </>
  ) : (
    "Action"
  )}
</Button>
```

## Notes

- All buttons are disabled during their respective loading states
- Cancel buttons are also disabled during loading to prevent user confusion
- Loader2 icon from lucide-react is used consistently across all components
- The `animate-spin` class provides the spinning animation
