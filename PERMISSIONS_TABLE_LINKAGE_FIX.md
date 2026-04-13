# Permission Table Not Linked to Manager - Fix

## Problem
When a manager was created, no permissions record was created in the `permissions` table. This meant:
1. Managers had no permissions stored in the database
2. Permission updates would fail because there was no record to update
3. The existing `permissions` table was not being utilized at all

## Root Causes

### 1. No Permissions Created on Manager Creation
In `handlers/user.go` `createUser()` function:
- User was registered successfully
- BUT no permission record was created for the new user
- Manager could not have their permissions updated because no record existed

### 2. No Fallback in Update Handler
In `permission_service.go` `Update()` method:
- Tried to update permissions directly
- Would fail if permissions record didn't exist
- No check to create permissions if missing

## Solution Implemented

### 1. **Auto-Create Permissions on User Creation**
Modified `handlers/user.go`:
```go
// Create permissions record for the new user
permissionService := service.NewPermissionService(userService.GetDB())
_, err = permissionService.CreateForUser(c.Request.Context(), user.ID)
if err != nil {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create permissions"})
    return
}
```

This ensures:
- Every new user (manager, admin, etc.) gets a permissions record
- Default permissions (all false) are created immediately
- Record exists in database ready to be updated

### 2. **Create-If-Not-Exists on Update**
Modified `permission_service.go` `Update()` method:
```go
// First check if permissions exist
_, err := s.GetByUserID(ctx, userID)
if err != nil && err.Error() == "permissions not found" {
    // Create default permissions if they don't exist
    _, createErr := s.CreateForUser(ctx, userID)
    if createErr != nil {
        return nil, createErr
    }
}
// Now update the permissions
```

This ensures:
- If permissions are missing, they're created automatically
- No errors when updating non-existent permissions
- Backwards compatible with existing managers

## Flow After Fix

### Creating a Manager:
1. Admin creates manager via API
2. Manager user is inserted into `users` table
3. **NEW:** Permission record is created in `permissions` table with user_id linked
4. Manager is added to `branch_managers` junction table
5. Manager now has permissions that can be updated

### Updating Manager Permissions:
1. Admin updates manager permissions via UI
2. API calls `PUT /api/users/:id/permissions`
3. Handler calls `permissionService.Update()`
4. Service checks if permissions exist
5. If missing: Creates default permissions (once)
6. Updates permissions in database
7. Returns updated permissions

### Result:
✅ Permissions table is now properly linked to managers
✅ Every manager has a permissions record
✅ Permissions can be updated without errors
✅ Backwards compatible with existing data

## Database State After Fix

### Before:
```
users table:
- id: manager-uuid
- email: manager@example.com
- role: manager

permissions table:
- (NO RECORD FOR THIS MANAGER)

branch_managers table:
- manager_id: manager-uuid
- branch_id: branch-uuid
```

### After:
```
users table:
- id: manager-uuid
- email: manager@example.com
- role: manager

permissions table:
- id: perm-uuid
- user_id: manager-uuid ← NOW LINKED
- can_view_students: false
- can_edit_students: false
- (all other permissions: false)

branch_managers table:
- manager_id: manager-uuid
- branch_id: branch-uuid
```

## Files Modified

1. **`internal/handlers/user.go`**
   - Added permissions creation in `createUser()` handler
   - Ensures every new user gets a permissions record

2. **`internal/service/permission_service.go`**
   - Enhanced `Update()` method with create-if-not-exists logic
   - Automatically creates permissions if they don't exist

## Testing

### Create Manager:
```bash
POST /api/users
{
  "email": "manager@example.com",
  "password": "password123",
  "fullName": "Manager Name",
  "role": "manager",
  "branchId": "branch-uuid"
}
```

Expected: Manager user created + permissions record created automatically

### Update Permissions:
```bash
PUT /api/users/{manager-id}/permissions
{
  "can_edit_students": true,
  "can_edit_payments": true
}
```

Expected: Permissions updated successfully in database

### Verify:
```bash
GET /api/users/{manager-id}
```

Should return manager with permissions linked in database

## Backwards Compatibility
The fix is backwards compatible:
- Existing managers without permissions records will get them created on first update
- No data loss for existing managers
- All future managers will have permissions linked automatically
