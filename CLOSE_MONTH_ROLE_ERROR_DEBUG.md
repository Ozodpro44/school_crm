# Close Month - "User Role Not Found" Error Debug

## Symptom
When attempting to close a month, user gets error: `"role not found"` or similar

## Root Causes Identified

### 1. Branch Access Middleware (Not Used)
- File: `backend_school_crm/internal/middleware/branch_access.go:20`
- Returns: `{"error": "role not found"}`
- Status: Not currently applied to routes, but code exists

### 2. Permission Checker (Currently Used)
- File: `backend_school_crm/internal/middleware/permission.go`
- May fail if:
  - User not found in database
  - User ID not in JWT context
  - User fetch returns nil or error

## Improvements Made

### Enhanced Error Logging in Permission Checker
Added detailed logging to help identify where the failure occurs:

```go
if err != nil {
    log.Printf("[PermissionChecker] Failed to fetch user %s: %v", userID, err)
    c.JSON(http.StatusForbidden, gin.H{"error": "user not found"})
    c.Abort()
    return
}

if user == nil {
    log.Printf("[PermissionChecker] User %s is nil", userID)
    c.JSON(http.StatusForbidden, gin.H{"error": "user not found"})
    c.Abort()
    return
}
```

## Debugging Steps

1. **Check Backend Logs** - Look for `[PermissionChecker]` entries to see where it fails:
   - "Failed to get user ID" → JWT token issue
   - "Failed to fetch user" → User not in database
   - "User is nil" → Database returned nil user

2. **Verify User in Database**:
   ```sql
   SELECT id, email, role, full_name FROM users WHERE email = 'your-email@example.com';
   ```

3. **Check JWT Token** - Ensure token is being sent with `Authorization: Bearer <token>` header

4. **Verify User Service** - Ensure `UserService.GetByID()` works correctly

## Files Modified
- `backend_school_crm/internal/middleware/permission.go` - Added logging and nil checks

## Next Steps if Error Persists
1. Check backend logs for detailed error messages
2. Verify user record exists in database
3. Ensure authentication middleware is setting user_id in context correctly
4. Test with a different user account
