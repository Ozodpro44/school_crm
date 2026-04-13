# Complete Manager Permissions Flow - Technical Overview

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CREATING A MANAGER                            │
└─────────────────────────────────────────────────────────────────┘

Admin sends: POST /api/users
{
  "email": "manager@example.com",
  "password": "secret",
  "fullName": "John Manager",
  "role": "manager",
  "branchId": "branch-123"
}
        ↓
[createUser handler]
        ↓
userService.Register() → INSERT users table
        ↓
[NEW] permissionService.CreateForUser() → INSERT permissions table
     ├─ id: generated-uuid
     ├─ user_id: manager-id (LINKED!)
     └─ all permissions: false (default)
        ↓
userService.AddBranchManager() → INSERT branch_managers table
        ↓
Response: 201 Created ✓


┌─────────────────────────────────────────────────────────────────┐
│              UPDATING MANAGER PERMISSIONS                        │
└─────────────────────────────────────────────────────────────────┘

Admin sends: PUT /api/users/manager-id/permissions
{
  "can_edit_students": true,
  "can_edit_payments": true,
  "can_edit_salaries": true
}
        ↓
[updateUserPermissions handler]
        ↓
permissionService.Update(manager-id, updates)
        ↓
[NEW] Check: Do permissions exist for this manager?
├─ YES → Skip to update
└─ NO  → CreateForUser() first
        ↓
UPDATE permissions SET can_edit_students=true, ... WHERE user_id=manager-id
        ↓
SELECT permissions WHERE user_id=manager-id
        ↓
Response: 200 OK with updated permissions ✓


┌─────────────────────────────────────────────────────────────────┐
│              DATABASE SCHEMA RELATIONSHIPS                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│ users        │
├──────────────┤
│ id (PK)      │
│ email        │
│ role         │
│ full_name    │
│ password     │
└──────────────┘
       │
       │ user_id (FK)
       │
       ├──────────────────┐
       │                  │
       ↓                  ↓
┌──────────────┐   ┌─────────────────────┐
│ permissions  │   │ branch_managers     │
├──────────────┤   ├─────────────────────┤
│ id (PK)      │   │ id (PK)             │
│ user_id (FK) │   │ branch_id (FK)      │
│ can_view_*   │   │ manager_id (FK)     │
│ can_edit_*   │   │ created_at          │
│ can_delete_* │   └─────────────────────┘
└──────────────┘            │
                            ↓
                    ┌──────────────┐
                    │ branches     │
                    ├──────────────┤
                    │ id (PK)      │
                    │ name         │
                    │ address      │
                    │ phone        │
                    └──────────────┘
```

## Key Components

### 1. Permission Service
**File:** `internal/service/permission_service.go`

Methods:
- `GetByUserID(userID)` - Fetch permissions from DB
- `CreateForUser(userID)` - Create default permissions
- `Update(userID, updates)` - Update with auto-create
- `GetAll()` - Fetch all permissions

### 2. User Service
**File:** `internal/service/user_service.go`

Methods:
- `Register()` - Create user (calls permission creation)
- `AddBranchManager()` - Link manager to branch
- `GetDB()` - Expose database connection

### 3. User Handler
**File:** `internal/handlers/user.go`

Routes:
- `POST /api/users` - Create manager (+ permissions)
- `PUT /api/users/:id/permissions` - Update permissions

### 4. Frontend API
**File:** `src/lib/api.ts`

Functions:
- `updateUserPermissions(userId, permissions)` - Update via API

### 5. Manager Page
**File:** `src/pages/managers.tsx`

- Displays manager list
- Edit dialog with permission checkboxes
- Calls API to save permissions

## Permission Creation Timeline

### Scenario 1: New Manager Created
```
Time  Event                                    Database State
───────────────────────────────────────────────────────────────
T0    Admin creates manager                    users: empty
T1    → userService.Register()                 users: + manager
T2    → permissionService.CreateForUser()      permissions: + record
T3    → userService.AddBranchManager()         branch_managers: + link
T4    → Response: 201 Created                  manager ready!
```

### Scenario 2: Update Permissions (Record Exists)
```
Time  Event                                    Database State
───────────────────────────────────────────────────────────────
T0    Admin clicks Save in permission UI       permissions: unchanged
T1    → updateUserPermissions API              permissions: unchanged
T2    → permissionService.Update()             permissions: unchanged
T3    → Check: Does record exist?              permissions: YES
T4    → UPDATE permissions SET ...             permissions: updated
T5    → Response: 200 OK                       manager.permissions updated!
```

### Scenario 3: Legacy Manager (No Permissions Record)
```
Time  Event                                    Database State
───────────────────────────────────────────────────────────────
T0    Admin updates permissions for legacy      permissions: none
T1    → updateUserPermissions API              permissions: none
T2    → permissionService.Update()             permissions: none
T3    → Check: Does record exist?              permissions: NO!
T4    → CREATE default permissions            permissions: + new record
T5    → UPDATE permissions SET ...             permissions: updated
T6    → Response: 200 OK                       legacy manager fixed!
```

## API Endpoints Summary

### Create Manager
```
POST /api/users
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "email": "manager@example.com",
  "password": "password123",
  "fullName": "Manager Name",
  "role": "manager",
  "branchId": "branch-uuid"
}

Response: 201 Created
{
  "id": "manager-uuid",
  "email": "manager@example.com",
  "fullName": "Manager Name",
  "role": "manager",
  "createdAt": "2025-12-14T10:00:00Z"
}
```

### Update Permissions
```
PUT /api/users/{manager-id}/permissions
Authorization: Bearer {token}
Content-Type: application/json

Request:
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

Response: 200 OK
{
  "id": "permission-uuid",
  "user_id": "manager-uuid",
  "can_view_students": true,
  "can_edit_students": true,
  ... (all permissions)
}
```

## Error Handling

### Scenario: Missing Permissions (AUTO-FIXED)
```
Request: PUT /api/users/manager-id/permissions
Database: No permissions record

Handler:
1. permissionService.Update() called
2. Checks GetByUserID() → "permissions not found"
3. Auto-creates: CreateForUser() → SUCCESS
4. Proceeds to UPDATE → SUCCESS
5. Response: 200 OK (user doesn't see the auto-create)
```

### Scenario: Permission Creation Fails
```
Request: POST /api/users (create manager)
Database: Connection error

Handler:
1. userService.Register() → SUCCESS (user created)
2. permissionService.CreateForUser() → ERROR
3. Rolls back? NO - handler already returned error
4. Response: 500 error

Result: Manager created but no permissions (legacy state)
Fix: Next permission update will auto-create
```

## Security Notes

- Only **admin** can create managers
- Only **admin** can update permissions
- Each manager's permissions are isolated (user_id FK)
- Permissions are database-backed (not hardcoded)

## Testing Queries

```sql
-- See all manager permissions
SELECT u.id, u.full_name, p.* 
FROM users u 
LEFT JOIN permissions p ON u.id = p.user_id 
WHERE u.role = 'manager';

-- See manager with branch info
SELECT u.id, u.full_name, b.name as branch
FROM users u 
LEFT JOIN branch_managers bm ON u.id = bm.manager_id
LEFT JOIN branches b ON bm.branch_id = b.id
WHERE u.role = 'manager';

-- Check for orphaned managers (no permissions)
SELECT u.id, u.full_name 
FROM users u 
LEFT JOIN permissions p ON u.id = p.user_id 
WHERE u.role = 'manager' AND p.id IS NULL;
```

## Build Status
✅ Backend: `go build ./...` - Success
✅ Frontend: `npm run build` - Success
