# Profile Update Debugging Guide

## Problem
Profile changes show in the frontend but are not persisting in the database.

## Root Cause Investigation

I've added detailed logging to the backend to trace the issue. Here's what to check:

### Backend Logs to Monitor

When you try to update a profile, look for these log messages:

1. **Handler receives request:**
```
[updateUser] Updating user {user-id} with data: map[email:... full_name:...]
```

2. **Update function builds SQL:**
```
[UserService.Update] Executing query: UPDATE users SET full_name = $1, email = $2 WHERE id = $3 with args: [...]
```

3. **Database execution:**
```
[UserService.Update] Rows affected: 1
```

4. **Success message:**
```
[updateUser] Successfully updated user {user-id}
```

### Common Issues to Check

#### Issue 1: Frontend Not Sending Data
**Log you'd see:**
```
[updateUser] Updating user ... with data: map[]
```
**Solution:** Check frontend is calling `handleUpdateProfile()` correctly

#### Issue 2: Invalid Field Names
**Log you'd see:**
```
[UserService.Update] No valid fields to update for user ...
```
**Solution:** Verify field names match `allowedFields` in backend:
- `full_name` (not `fullName`)
- `email`
- `password` 
- `current_password`

#### Issue 3: Database Update Failing
**Log you'd see:**
```
[UserService.Update] Database error: ...
[updateUser] Error updating user: ...
```
**Solution:** Check database permissions and table structure

#### Issue 4: Rows Affected is 0
**Log you'd see:**
```
[UserService.Update] Rows affected: 0
```
**Solution:** User ID doesn't exist or ID is being passed incorrectly

### Step-by-Step Debugging

1. **Start the backend with logging enabled:**
   ```bash
   cd backend_school_crm
   go run ./cmd/main.go
   ```

2. **Attempt profile update from frontend**

3. **Check logs for the flow above**

4. **If "No valid fields to update":**
   - Check browser network tab to see what data is being sent
   - Verify field names match exactly

5. **If database error:**
   - Check database table exists: `SELECT * FROM users LIMIT 1`
   - Check user exists: `SELECT * FROM users WHERE id = '{user-id}'`

6. **If rows affected is 0:**
   - Verify the user ID is correct in the request URL
   - Check if user exists in database

### Frontend Checks

In browser DevTools Network tab:
1. Look for PUT request to `/api/users/{id}`
2. Check Request body shows: `{"full_name": "...", "email": "..."}`
3. Check Response is HTTP 200 with updated user data
4. Check the returned data has `updated_at` field changed

### Database Verification

After attempting an update:
```sql
SELECT id, full_name, email, updated_at FROM users WHERE id = '{user-id}';
```

The `updated_at` timestamp should reflect the update time if successful.

## Files Modified

1. **backend_school_crm/internal/handlers/user.go**
   - Added logging to handler function

2. **backend_school_crm/internal/service/user_service.go**
   - Added detailed logging to Update function
   - Added rows affected check

3. **frontend_school_crm/src/pages/admin-profile.tsx**
   - Already has console.log statements (see browser console)

## Next Steps

After checking logs:
1. Share backend logs showing the update attempt
2. Share browser console logs if any errors
3. Verify database actually has the old vs new values
4. Check user ID is being passed correctly in URL

## Recent Changes to Look For

The Update function now:
- Validates field names (only allows: full_name, email, password, current_password)
- Hashes passwords automatically if provided
- Logs the SQL query being executed
- Logs rows affected by the update
- Returns the updated user from database
