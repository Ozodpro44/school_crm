# Manager Permissions Implementation - Complete Fix

## Problem
Manager permissions were not being saved when edited in the manager profile. The frontend had a TODO comment indicating the API integration was missing.

## Solution Implemented

### 1. Backend Permission Service
Created new file: `internal/service/permission_service.go`

Methods:
- `GetByUserID(userID)` - Fetch permissions for a user
- `CreateForUser(userID)` - Create default permissions for new user
- `Update(userID, updates)` - Update specific permissions
- `GetAll()` - Get all permissions

### 2. Backend API Endpoint
Added to `internal/handlers/user.go`:

**Route:** `PUT /api/users/:id/permissions`

**Handler:** `updateUserPermissions()`

**Authorization:** Admin only

**Request Body:**
```json
{
  "can_view_students": true,
  "can_edit_students": true,
  "can_delete_students": false,
  "can_view_teachers": true,
  "can_edit_teachers": true,
  "can_delete_teachers": false,
  "can_view_classes": true,
  "can_edit_classes": true,
  "can_delete_classes": false,
  "can_view_payments": true,
  "can_edit_payments": true,
  "can_view_salaries": true,
  "can_edit_salaries": true,
  "can_view_expenses": true,
  "can_edit_expenses": true,
  "can_delete_expenses": false,
  "can_view_reports": true,
  "can_finish_month": true,
  "can_view_settings": false,
  "can_edit_settings": false
}
```

### 3. Frontend API Integration
Added to `src/lib/api.ts`:

```typescript
export async function updateUserPermissions(
  userId: string,
  permissions: Record<string, boolean>
): Promise<any>
```

### 4. Manager Page Implementation
Updated `src/pages/managers.tsx`:

- Imported `updateUserPermissions` from API
- Replaced TODO comment with actual API call
- Converts Permission object to Record<string, boolean>
- Shows success/error toast
- Reloads manager list after update

### 5. Database Support
The `permissions` table already exists with all required columns:
- `id` (UUID, Primary Key)
- `user_id` (UUID, Unique, Foreign Key)
- All permission boolean fields

## How It Works Now

### Edit Manager Permissions Flow:
1. Admin clicks "Edit" on a manager
2. Permission checkboxes are displayed
3. Admin modifies permissions
4. Admin clicks "Save"
5. `handleSubmit()` is called
6. Permissions are converted to API format
7. `updateUserPermissions()` API is called
8. Backend updates the `permissions` table
9. Success toast is shown
10. Manager list is reloaded with updated permissions

### Default Permissions
When a manager is created, they get default permissions based on role (from `DEFAULT_PERMISSIONS` in `auth-api.ts`).

Manager defaults:
- Can view/edit: students, teachers, classes, payments, salaries, expenses
- Can finish month: true
- Cannot delete: students, teachers, classes, expenses
- Cannot edit: settings

## Testing

### Test with Postman:

1. **Get auth token:**
```
POST http://localhost:8080/api/auth/login
{
  "email": "admin@example.com",
  "password": "password123"
}
```

2. **Update manager permissions:**
```
PUT http://localhost:8080/api/users/{manager-id}/permissions
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "can_view_payments": true,
  "can_edit_payments": false,
  "can_view_students": true,
  "can_edit_students": false
}
```

3. **Verify permissions:**
```
GET http://localhost:8080/api/users/{manager-id}
Authorization: Bearer YOUR_TOKEN
```

## Files Modified

### Backend
1. **Created:** `internal/service/permission_service.go`
   - New permission service for database operations

2. **Modified:** `internal/handlers/user.go`
   - Added route: `PUT /api/users/:id/permissions`
   - Added handler: `updateUserPermissions()`

3. **Modified:** `internal/service/user_service.go`
   - Added `GetDB()` method to expose database connection

### Frontend
1. **Modified:** `src/lib/api.ts`
   - Added `updateUserPermissions()` function

2. **Modified:** `src/pages/managers.tsx`
   - Imported `updateUserPermissions` from API
   - Replaced TODO with actual API call
   - Converts Permission object for API

## Build Status
✅ Frontend builds successfully
✅ No TypeScript errors
✅ All imports resolved

## Next Steps
1. Test manager permission updates in the UI
2. Verify permissions are persisted in database
3. Test that permissions are reflected on next login
4. Verify permission checks work across the application
