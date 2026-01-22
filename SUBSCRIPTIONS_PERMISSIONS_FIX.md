# Subscriptions Permissions Fix

## Problem
Frontend getting "insufficient permissions" error when accessing subscription endpoints.

## Root Cause
- Permission checks added to subscription handlers
- Subscription permission columns not in existing database
- Existing users don't have subscription permissions set

## Solution Overview

### 1. Database Changes
Added subscription permission columns to `permissions` table:
```sql
can_view_subscriptions BOOLEAN DEFAULT true   -- View plans and subscription status
can_manage_subscriptions BOOLEAN DEFAULT false -- Create/cancel subscriptions
```

### 2. Backend Changes
Updated Permission model in `internal/models/models.go`:
```go
type Permission struct {
    ...
    CanViewSubscriptions  bool   `json:"canViewSubscriptions" db:"can_view_subscriptions"`
    CanManageSubscriptions bool  `json:"canManageSubscriptions" db:"can_manage_subscriptions"`
}
```

Updated handlers to check permissions:
- `GetUserSubscription()` - requires `can_view_subscriptions`
- `CreateSubscription()` - requires `can_manage_subscriptions`
- `CancelSubscription()` - requires `can_manage_subscriptions`

### 3. Frontend - No Changes Needed
Frontend subscription API calls work automatically with added permissions.

## Implementation Steps

### Step 1: Run Migration
Apply the consolidated migration that includes subscription tables and permissions columns:

```bash
cd backend_school_crm
make migrate-up
```

This will:
- Create subscription tables
- Add `can_view_subscriptions` and `can_manage_subscriptions` columns to permissions table

### Step 2: Grant Permissions to Existing Users
Run the script to grant subscription permissions:

```bash
cd backend_school_crm

# Using psql directly
psql -d school_crm -U school_user -f grant_subscription_permissions.sql

# Or through Docker if using Docker Compose
docker-compose exec postgres psql -U school_user -d school_crm -f grant_subscription_permissions.sql
```

This script:
- Grants both view AND manage permissions to all admins
- Grants view-only permission to all other users
- Creates permission records for any new users

### Step 3: Verify Permissions
Check that permissions were granted:

```sql
SELECT u.email, u.role, p.can_view_subscriptions, p.can_manage_subscriptions
FROM users u
LEFT JOIN permissions p ON u.id = p.user_id
ORDER BY u.role;
```

### Step 4: Test Frontend
Clear browser cache and test:
1. Load `/subscriptions` page
2. View subscription plans
3. Subscribe to a plan
4. View subscription details
5. Cancel subscription (if you have manage permission)

## Permission Levels

### View Only (Default for non-admins)
- `can_view_subscriptions = true`
- `can_manage_subscriptions = false`

**Can do:**
- View subscription plans
- View current subscription status
- View payment history
- View usage metrics

**Cannot do:**
- Create new subscription
- Cancel/pause subscription

### Manage (Admins)
- `can_view_subscriptions = true`
- `can_manage_subscriptions = true`

**Can do:**
- Everything in View Only
- Create new subscription
- Cancel/pause subscription

## Role-Based Defaults

| Role | View | Manage |
|------|------|--------|
| admin | ✓ | ✓ |
| branch_admin | ✓ | ✗ |
| manager | ✓ | ✗ |
| accountant | ✓ | ✗ |
| teacher | ✓ | ✗ |
| student | ✓ | ✗ |
| parent | ✓ | ✗ |

## Custom Permission Grant

To grant manage permissions to specific users:

```sql
UPDATE permissions 
SET can_manage_subscriptions = true 
WHERE user_id = (SELECT id FROM users WHERE email = 'user@example.com');
```

To revoke manage permissions:

```sql
UPDATE permissions 
SET can_manage_subscriptions = false 
WHERE user_id = (SELECT id FROM users WHERE email = 'user@example.com');
```

## Verify After Migration

### Check database columns exist
```sql
\d permissions
```

Should show:
```
can_view_subscriptions       | boolean   | default true
can_manage_subscriptions     | boolean   | default false
```

### Check user permissions
```sql
SELECT u.email, u.role, p.can_view_subscriptions, p.can_manage_subscriptions
FROM users u
LEFT JOIN permissions p ON u.id = p.user_id
LIMIT 10;
```

### Test API permission check
Make authenticated request:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/subscriptions/current
```

Should return:
- ✓ 200 OK with subscription data if user has `can_view_subscriptions`
- ✗ 403 Forbidden if user doesn't have permission

## Common Issues & Solutions

### Still Getting 403 Error After Migration

**Check 1: Verify migration ran**
```sql
SELECT * FROM information_schema.columns 
WHERE table_name='permissions' 
AND column_name LIKE '%subscription%';
```

**Check 2: Verify permissions were granted**
```sql
SELECT can_view_subscriptions, can_manage_subscriptions 
FROM permissions 
WHERE user_id = 'YOUR_USER_ID';
```

**Check 3: Restart backend after migration**
```bash
make run
# or
docker-compose restart api
```

### New Users Not Getting Permissions

The grant script creates permission records for users without them. To manually add:

```sql
INSERT INTO permissions (user_id, can_view_subscriptions, can_manage_subscriptions)
VALUES ('USER_ID', true, false)
ON CONFLICT (user_id) DO NOTHING;
```

### Permission Changes Not Taking Effect

1. Clear browser cache
2. Log out and log back in
3. Request new JWT token (token cached permissions)

## Files Changed

### Database
- `migrations/000001_init_all_tables.up.sql` - Added subscription columns to permissions
- `migrations/000001_init_all_tables.down.sql` - Updated drop statements
- `grant_subscription_permissions.sql` - New grant script

### Backend
- `internal/models/models.go` - Updated Permission struct
- `internal/handlers/subscription.go` - Added permission checks

### Frontend
- No changes needed (uses JWT token with embedded permissions)

## Next Steps

1. Run migration: `make migrate-up`
2. Grant permissions: `psql -f grant_subscription_permissions.sql`
3. Restart backend: `make run`
4. Test frontend: `http://localhost:3000/subscriptions`

## Support

If you continue seeing permission errors:
1. Check backend logs: `docker-compose logs api`
2. Verify token is being sent: Browser DevTools → Network → Headers → Authorization
3. Check user has permissions: Run SQL verification queries above
