# Close Month - Logout Issue Fix

## Problem
When users clicked "Close Month", they were being logged out immediately, even if they had the proper permissions.

## Root Cause
The `apiRequest()` function in `lib/api.ts` was logging out users on ANY unauthorized response:
```typescript
const isInvalidToken = errorMessage.toLowerCase().includes("invalid token") || 
                      errorMessage.toLowerCase().includes("unauthorized") ||
                      response.status === 401;
```

This logic treated both:
- **401 Unauthorized** (auth failure - should logout)
- **403 Forbidden** (permission denial - should NOT logout)

...the same way, causing logouts on permission errors.

## Solution

### 1. Fixed API Error Handling (`lib/api.ts`)
Changed the logout logic to only trigger on actual authentication failures (401):

**Before:**
```typescript
const isInvalidToken = errorMessage.toLowerCase().includes("invalid token") || 
                      errorMessage.toLowerCase().includes("unauthorized") ||
                      response.status === 401;
```

**After:**
```typescript
const isInvalidToken = (errorMessage.toLowerCase().includes("invalid token") || 
                       errorMessage.toLowerCase().includes("unauthorized")) &&
                       response.status === 401;
```

**Key change:** Only logout if status is 401 AND message indicates auth failure (using AND operator instead of OR).

### 2. Improved Error Handling in Reports Page (`pages/reports.tsx`)
Added specific error message handling for permission errors:

```typescript
catch (error) {
  let errorMessage = error instanceof Error ? error.message : "Error closing month";
  
  // Handle specific error messages
  if (errorMessage.toLowerCase().includes("insufficient permissions")) {
    errorMessage = t("insufficientPermissions") || "You don't have permission to close months";
  } else if (errorMessage.toLowerCase().includes("forbidden")) {
    errorMessage = t("accessDenied") || "You don't have permission to perform this action";
  }
  
  toast({
    title: t("error"),
    description: errorMessage,
    variant: "destructive",
  });
}
```

## HTTP Status Codes
- **401 Unauthorized** - Authentication failed (token invalid/expired) → Logout and redirect
- **403 Forbidden** - User authenticated but lacks permission → Show error toast, stay logged in

## Testing

After the fix:
✅ Users with `canFinishMonth` permission can close months
✅ Users without permission see error message but stay logged in
✅ Invalid/expired tokens still trigger logout properly
✅ No accidental logouts on permission errors

## Files Changed
1. `/home/ozod/Documents/New-Project/frontend_school_crm/src/lib/api.ts` - Fixed logout logic
2. `/home/ozod/Documents/New-Project/frontend_school_crm/src/pages/reports.tsx` - Improved error handling
