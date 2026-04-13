# User Not Found Error - Fix Summary

## Problem
The application was throwing "user not found" errors in two scenarios:

### Scenario 1: Frontend Runtime Error
- **Location**: `src/pages/expenses.tsx` in the `fetchAndCacheUserName` function
- **Root Cause**: When fetching user information by ID, if the user didn't exist in the backend database, the error was caught but not cached, causing the component to keep retrying indefinitely
- **Error Message**: `Error: user not found` thrown from the frontend API

### Scenario 2: Backend Authentication Error
- **Location**: Backend middleware (`internal/middleware/permission.go`)
- **Root Cause**: When a user's JWT token contained a user ID that no longer existed in the database (e.g., user was deleted), the middleware would return HTTP 403 Forbidden instead of 401 Unauthorized, preventing proper error handling on the frontend
- **Error Logs**: `[PermissionChecker] Failed to fetch user {id}: user not found` with 403 response

## Solution

### Frontend Fix (expenses.tsx)
**File**: `frontend_school_crm/src/pages/expenses.tsx`

Modified the `fetchAndCacheUserName` function to cache "Unknown" when a user cannot be found, preventing infinite retry loops:

```javascript
const fetchAndCacheUserName = async (userId: string) => {
  if (!userId || userCache[userId]) return;

  try {
    const user = await getUser(userId);
    setUserCache((prev) => ({ ...prev, [userId]: user.fullName }));
  } catch (error) {
    console.error(`Failed to fetch user ${userId}:`, error);
    // Cache empty name to avoid retrying
    setUserCache((prev) => ({ ...prev, [userId]: "Unknown" }));
  }
};
```

### Frontend API Handler Fix (api.ts)
**File**: `frontend_school_crm/src/lib/api.ts`

Updated the error handler to also catch "user not found" errors and trigger logout when status is 401:

```javascript
const isInvalidToken =
  (errorMessage.toLowerCase().includes("invalid token") ||
    errorMessage.toLowerCase().includes("unauthorized") ||
    errorMessage.toLowerCase().includes("user not found")) &&
  response.status === 401;
```

### Backend Middleware Fix (permission.go)
**File**: `backend_school_crm/internal/middleware/permission.go`

Changed the HTTP status code from 403 Forbidden to 401 Unauthorized when a user doesn't exist, and updated error messages to guide users to log in again:

**PermissionChecker changes:**
```go
// Before: HTTP 403
c.JSON(http.StatusForbidden, gin.H{"error": "user not found"})

// After: HTTP 401
c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found - please log in again"})
```

**RoleChecker changes:**
```go
// Before: HTTP 403
c.JSON(http.StatusForbidden, gin.H{"error": "user not found"})

// After: HTTP 401
c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found - please log in again"})
```

## Impact

1. **Frontend Behavior**:
   - Expenses page now gracefully displays "Unknown" for missing users instead of repeatedly throwing errors
   - API calls that receive 401 with "user not found" will automatically clear the invalid token and redirect to login page

2. **Backend Behavior**:
   - Permission and role checking now returns proper 401 status code when user doesn't exist
   - Frontend can distinguish between "user invalid" (401) and "user forbidden" (403)
   - Clear user guidance to log in again when their session becomes invalid

## Files Changed
1. `frontend_school_crm/src/pages/expenses.tsx` - Error handling in user fetching
2. `frontend_school_crm/src/lib/api.ts` - Token validation and logout logic
3. `frontend_school_crm/src/lib/subscription-api.ts` - TypeScript header type fix
4. `backend_school_crm/internal/middleware/permission.go` - HTTP status codes for missing users

## Testing
- Frontend builds successfully with no TypeScript errors
- Backend compiles successfully
- Error recovery flow: Invalid token → 401 response → Auto logout → Redirect to login
