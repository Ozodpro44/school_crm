# Frontend Subscriptions Fix - Remove Auth from Plans

## Issue
Frontend was sending authorization header to the public `/subscriptions/plans` endpoint, causing "authorization header required" error.

## Root Cause
The `makeRequest()` helper function was being used for all requests, including public ones. It always checked for a token in localStorage and sent it if found.

## Solution

### Changed in `src/lib/subscription-api.ts`

**Split request handlers into two functions:**

1. **`makePublicRequest()`** - For public endpoints (no auth)
   ```tsx
   // No authorization header
   // Used for: subscription plans
   ```

2. **`makeRequest()`** - For protected endpoints (with auth)
   ```tsx
   // Includes authorization header from localStorage
   // Used for: current subscription, create, cancel, usage, payments
   ```

### Updated Functions

**Public (no auth needed):**
- `getSubscriptionPlans()` → `makePublicRequest`
- `getSubscriptionPlan(id)` → `makePublicRequest`

**Protected (auth required):**
- `getCurrentSubscription()` → `makeRequest`
- `createSubscription()` → `makeRequest`
- `cancelSubscription()` → `makeRequest`
- `getSubscriptionUsage()` → `makeRequest`
- `getSubscriptionPayments()` → `makeRequest`

## How It Works Now

### Request Flow

```
User visits /subscriptions
    ↓
getSubscriptionPlans() called
    ↓
makePublicRequest() [NO auth header]
    ↓
GET /api/subscriptions/plans (200 OK)
    ↓
Display plans
```

### When User Subscribes

```
User clicks "Choose Plan"
    ↓
createSubscription(planId) called
    ↓
makeRequest() [WITH auth header from localStorage]
    ↓
POST /api/subscriptions (with JWT token)
    ↓
201 Created → Subscription started
```

## Test It

### Test 1: View Plans (No Login)
1. Clear browser localStorage: Press F12 → Application → LocalStorage → Delete all
2. Refresh page
3. Visit `http://localhost:3000/subscriptions`
4. Should see plans displayed ✓
5. Open DevTools → Network tab
6. Look for `subscriptions/plans` request
7. Should NOT have `Authorization` header ✓

### Test 2: Subscribe (With Login)
1. Log in to the app
2. Go to `/subscriptions`
3. Click "Choose Plan"
4. DevTools → Network → Find subscription POST request
5. Should have `Authorization: Bearer <token>` header ✓
6. Response should be 201 Created ✓

### Test 3: View Current Subscription
1. While logged in
2. Go to `/subscription-details`
3. DevTools → Network → Find `/subscriptions/current` request
4. Should have Authorization header ✓
5. Should show subscription details ✓

## Files Changed

**Frontend:**
- ✓ `src/lib/subscription-api.ts` - Split into public/protected requests

**No changes needed:**
- Backend (already fixed)
- Frontend pages
- Components

## Verification

After changes, restart frontend:
```bash
cd frontend_school_crm
npm run dev
```

Test in browser:
1. No login → Plans load ✓
2. Login → Can subscribe ✓
3. DevTools shows correct headers ✓

## HTTP Headers

### Public Request (Plans)
```http
GET /api/subscriptions/plans HTTP/1.1
Content-Type: application/json
```

### Protected Request (Create Subscription)
```http
POST /api/subscriptions HTTP/1.1
Content-Type: application/json
Authorization: Bearer eyJhbGci...
```

## Status

✓ **FIXED** - Plans endpoint no longer requires auth
✓ **SECURE** - Protected endpoints still require auth and permission checks
✓ **WORKING** - Both public and authenticated flows work correctly

## Summary

| Endpoint | Before | After | Status |
|----------|--------|-------|--------|
| `GET /plans` | ❌ Auth required | ✓ Public | FIXED |
| `GET /current` | ✓ Auth required | ✓ Auth required | OK |
| `POST /subscribe` | ✓ Auth required | ✓ Auth required | OK |
| `POST /cancel` | ✓ Auth required | ✓ Auth required | OK |

Now anyone can browse subscription plans without logging in!
