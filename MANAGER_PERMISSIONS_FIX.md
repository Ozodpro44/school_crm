# Manager Permissions Not Saving - Root Cause & Fix

## Problem
Manager permissions in the manager profile are not being saved to the backend. When you edit a manager's permissions and click save, nothing happens.

## Root Cause
The managers page has a **TODO comment** on line 169:
```javascript
// TODO: Implement updateUserPermissions API call
```

When updating a manager, the permissions are displayed in the UI, but there's no API call to save them to the database. The code only shows a success toast without actually saving.

## Solution

### 1. Create Backend Permission Service (if doesn't exist)
Check if permission service exists:
```bash
ls -la backend_school_crm/internal/service/permission*.go
```

If not, create one with methods to:
- Get permissions by user ID
- Update permissions for a user

### 2. Add API Endpoint in Backend
Add endpoint to update user permissions:
```go
PUT /api/users/:id/permissions
```

### 3. Implement Frontend API Call
Add function to `lib/api.ts`:
```typescript
export async function updateUserPermissions(
  userId: string,
  permissions: Permission
): Promise<Permission> {
  return apiRequest<Permission>(`/users/${userId}/permissions`, {
    method: "PUT",
    body: JSON.stringify(permissions),
  });
}
```

### 4. Update Managers Page
Replace the TODO section in `pages/managers.tsx` with actual API call:

```typescript
if (editingManager) {
  try {
    // Update permissions via backend
    await updateUserPermissions(editingManager.id, permissions);
    toast({ 
      title: t("permissionsUpdatedSuccess") || "Permissions updated successfully", 
      variant: "success" 
    });
    await loadData();
  } catch (error) {
    console.error("Failed to update permissions:", error);
    toast({ 
      title: "Error", 
      description: "Failed to update permissions", 
      variant: "destructive" 
    });
  }
}
```

## Database Schema
The `permissions` table already exists with structure:
```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  can_view_students BOOLEAN DEFAULT FALSE,
  can_edit_students BOOLEAN DEFAULT FALSE,
  can_delete_students BOOLEAN DEFAULT FALSE,
  can_view_teachers BOOLEAN DEFAULT FALSE,
  can_edit_teachers BOOLEAN DEFAULT FALSE,
  can_delete_teachers BOOLEAN DEFAULT FALSE,
  can_view_classes BOOLEAN DEFAULT FALSE,
  can_edit_classes BOOLEAN DEFAULT FALSE,
  can_delete_classes BOOLEAN DEFAULT FALSE,
  can_view_payments BOOLEAN DEFAULT FALSE,
  can_edit_payments BOOLEAN DEFAULT FALSE,
  can_view_salaries BOOLEAN DEFAULT FALSE,
  can_edit_salaries BOOLEAN DEFAULT FALSE,
  can_view_expenses BOOLEAN DEFAULT FALSE,
  can_edit_expenses BOOLEAN DEFAULT FALSE,
  can_delete_expenses BOOLEAN DEFAULT FALSE,
  can_view_reports BOOLEAN DEFAULT FALSE,
  can_finish_month BOOLEAN DEFAULT FALSE,
  can_view_settings BOOLEAN DEFAULT FALSE,
  can_edit_settings BOOLEAN DEFAULT FALSE
);
```

## Current Flow (Broken)
1. User edits manager permissions in UI
2. User clicks Save
3. `handleSubmit()` is called
4. If editing: Shows success toast but does NOT save to backend
5. `loadData()` is called (but backend has no saved permissions)
6. Next refresh: Manager has default permissions again (not saved ones)

## Fixed Flow
1. User edits manager permissions in UI
2. User clicks Save
3. `handleSubmit()` is called
4. If editing: Calls `updateUserPermissions()` API
5. Backend updates `permissions` table
6. `loadData()` is called
7. Fetches updated permissions from backend
8. Next refresh: Manager has saved permissions

## Why Permissions Currently Show
- Frontend uses `DEFAULT_PERMISSIONS` for each role
- When editing a manager, it loads `manager.permissions || getDefaultPermissions()`
- Since permissions are never saved, it always falls back to default

## Files to Modify
1. **Backend:** 
   - `internal/service/permission_service.go` (create if needed)
   - `internal/handlers/user.go` (add permission update endpoint)

2. **Frontend:**
   - `src/lib/api.ts` (add updateUserPermissions function)
   - `src/pages/managers.tsx` (replace TODO with actual API call)
