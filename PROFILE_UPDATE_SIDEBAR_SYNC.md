# Profile Update - Sidebar Sync Fix

## Problem
When editing admin profile (name and email), the changes were reflected in the frontend state but not updating in:
1. localStorage
2. The sidebar display

## Root Cause
The Layout component (which contains the sidebar) reads user data only once on mount. When the profile was updated on the admin-profile page, the Layout component had no way to know about the changes, so the sidebar continued to display the old user data.

## Solution
Implemented a custom event system to notify the Layout component when the user profile is updated.

### Changes Made

#### 1. Frontend: `/frontend_school_crm/src/pages/admin-profile.tsx`

Added a custom event dispatch after successful profile update:

```typescript
// After updating user in state and localStorage
window.dispatchEvent(
  new CustomEvent("userProfileUpdated", { detail: updatedUser })
);
```

**File Section:**
- Line ~195: Dispatch event after successful API response
- Includes updated user data in event detail

#### 2. Frontend: `/frontend_school_crm/src/components/Layout.tsx`

Added event listener to detect profile updates and update the sidebar:

```typescript
useEffect(() => {
  const handleUserProfileUpdate = (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail) {
      setUser(customEvent.detail);
    }
  };

  window.addEventListener("userProfileUpdated", handleUserProfileUpdate);
  return () => {
    window.removeEventListener("userProfileUpdated", handleUserProfileUpdate);
  };
}, []);
```

**File Section:**
- Lines 77-91: New useEffect hook to listen for profile updates
- Properly cleans up event listener on component unmount

## How It Works

1. **User edits profile** on `/admin-profile` page
2. **API request** is sent to update user in database
3. **Response is received** with updated user data
4. **State is updated** in admin-profile component: `setUser(updatedUser)`
5. **localStorage is updated**: `localStorage.setItem("school_auth_user", JSON.stringify(updatedUser))`
6. **Custom event is dispatched**: `window.dispatchEvent(new CustomEvent("userProfileUpdated", ...))`
7. **Layout component receives event** and updates its user state: `setUser(customEvent.detail)`
8. **Sidebar re-renders** with new user name/email

## Data Flow

```
Admin Profile Page
       ↓
API Update Request
       ↓
Parse Response
       ↓
Update State (admin-profile.tsx)
       ↓
Update localStorage ("school_auth_user")
       ↓
Dispatch Custom Event ("userProfileUpdated")
       ↓
Layout Component Listener
       ↓
Update Layout State
       ↓
Sidebar Re-renders with New Data
```

## What Updates

- Admin name (fullName) in sidebar
- Admin email in profile
- localStorage reflects the changes
- All other components reading from getCurrentUser() will see updated data

## Testing Checklist

- [x] Edit admin name in profile modal
- [x] Edit admin email in profile modal
- [x] Verify sidebar updates with new name
- [x] Refresh page and verify data persists (localStorage)
- [x] Check browser console for no errors
- [x] Verify old data is not shown after refresh

## Technical Details

### Event System
- Uses native DOM `CustomEvent` API
- No external dependencies required
- Works across all modern browsers
- Properly cleans up listeners to prevent memory leaks

### Why This Approach
1. **Decoupled** - Components don't need direct references
2. **Simple** - No complex state management needed
3. **Performant** - Minimal re-renders
4. **Clean** - Follows React best practices

## Related Files
- `src/pages/admin-profile.tsx` - Dispatches event
- `src/components/Layout.tsx` - Listens for event
- `src/lib/auth.ts` - `getCurrentUser()` utility (unchanged)
- `src/lib/auth-api.ts` - `AUTH_USER_KEY` = "school_auth_user" (unchanged)

## Future Enhancements
1. Could create a custom hook `useUserProfileUpdates()` for reusability
2. Could add toast notification on successful update
3. Could add analytics tracking for profile changes
