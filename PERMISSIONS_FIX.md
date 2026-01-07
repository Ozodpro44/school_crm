# Fix Missing Permissions for Existing Users

## Problem
Existing manager/admin accounts created before the permission system was implemented don't have permission records in the database. They get "insufficient permissions" errors.

## Solution

### Option 1: Run SQL Script (Recommended)
Run this SQL script against your database to create default permissions for all existing users:

```bash
psql -U school_user -d school_crm -h localhost < fix_missing_permissions.sql
```

This will create permissions for all users based on their role:
- **Admins**: Full access to everything
- **Branch Admins**: Full access except settings
- **Managers**: View/edit most (not delete students/teachers/classes), no settings
- **Accountants**: View most, edit payments/salaries/expenses only

### Option 2: Auto-Creation on First Access
The backend now has a fallback that automatically creates default permissions when a user makes their first protected API call. Simply try accessing the dashboard and it will auto-create permissions.

### Option 3: Manual Update via UI
Go to **Managers** page and:
1. Find the manager whose permissions need updating
2. Click Edit
3. Toggle the permissions they need
4. Save

## Permission Defaults by Role

| Permission | Admin | Branch Admin | Manager | Accountant |
|-----------|-------|-------------|---------|-----------|
| View Students | ✓ | ✓ | ✓ | ✓ |
| Edit Students | ✓ | ✓ | ✓ | ✗ |
| Delete Students | ✓ | ✓ | ✗ | ✗ |
| View Teachers | ✓ | ✓ | ✓ | ✓ |
| Edit Teachers | ✓ | ✓ | ✓ | ✗ |
| Delete Teachers | ✓ | ✓ | ✗ | ✗ |
| View Classes | ✓ | ✓ | ✓ | ✓ |
| Edit Classes | ✓ | ✓ | ✓ | ✗ |
| Delete Classes | ✓ | ✓ | ✗ | ✗ |
| View Payments | ✓ | ✓ | ✓ | ✓ |
| Edit Payments | ✓ | ✓ | ✓ | ✓ |
| View Salaries | ✓ | ✓ | ✓ | ✓ |
| Edit Salaries | ✓ | ✓ | ✓ | ✓ |
| View Expenses | ✓ | ✓ | ✓ | ✓ |
| Edit Expenses | ✓ | ✓ | ✓ | ✓ |
| Delete Expenses | ✓ | ✓ | ✗ | ✗ |
| View Reports | ✓ | ✓ | ✓ | ✓ |
| Finish Month | ✓ | ✓ | ✓ | ✗ |
| View Settings | ✓ | ✗ | ✗ | ✗ |
| Edit Settings | ✓ | ✗ | ✗ | ✗ |

## Debugging

Check the backend logs to see permission checks:
```
[PermissionChecker] User {id} (role: {role}) checking permission: {permission}
[PermissionChecker] Created permissions for user {id}
[PermissionChecker] User {id} allowed access - has permission {permission}
```

If you see "insufficient permissions" after running the SQL, it means the permission value for that specific action is `false`. Update it via the Managers UI.
