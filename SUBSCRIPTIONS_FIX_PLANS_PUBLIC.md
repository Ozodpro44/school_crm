# Subscriptions Fix - Plans Endpoint Public

## Issue
The `/api/subscriptions/plans` endpoint was requiring authentication when it should be public.

## Error Message
```
authorization header required
```

This appeared when trying to load the subscriptions page without being logged in.

## Solution

### Changes Made

**1. Backend - cmd/main.go**
- Added public route for subscription plans BEFORE the protected group
- This allows unauthenticated users to view available plans

```go
// Public subscription plans
router.GET("/api/subscriptions/plans", handlers.GetSubscriptionPlans(subscriptionService))
```

**2. Backend - internal/handlers/subscription.go**
- Split registration into two functions:
  - `RegisterSubscriptionRoutes()` - for public routes (plans)
  - `RegisterSubscriptionProtectedRoutes()` - for protected routes (current, create, cancel, usage, payments)

### Route Permissions

| Endpoint | Auth Required | Handler |
|----------|:----:|---------|
| `GET /api/subscriptions/plans` | ❌ | Public |
| `GET /api/subscriptions/current` | ✅ | Protected (requires `can_view_subscriptions`) |
| `POST /api/subscriptions` | ✅ | Protected (requires `can_manage_subscriptions`) |
| `POST /api/subscriptions/:id/cancel` | ✅ | Protected (requires `can_manage_subscriptions`) |
| `GET /api/subscriptions/:id/usage` | ✅ | Protected |
| `GET /api/subscriptions/:id/payments` | ✅ | Protected |

## What This Means

### Before
All subscription endpoints required authentication, including the public plans list.
- ❌ Users had to log in before seeing available plans

### After
- ✅ Anyone can view available subscription plans (public)
- ✅ Only logged-in users can manage their subscriptions
- ✅ Permission checks still enforced for sensitive operations

## How It Works Now

### Flow 1: Unauthenticated User (Just Browsing)
1. User visits `/subscriptions` page
2. Frontend calls `GET /api/subscriptions/plans` (NO auth needed)
3. Shows list of plans
4. User sees "Log in to subscribe"

### Flow 2: Authenticated User (Browsing & Subscribing)
1. User logs in
2. Visits `/subscriptions` page
3. Frontend calls `GET /api/subscriptions/plans` (works without token)
4. Frontend calls `POST /api/subscriptions` (WITH token)
5. User can subscribe to plan

### Flow 3: Authenticated User (Manage Subscription)
1. User visits `/subscription-details` (requires login)
2. Frontend calls `GET /api/subscriptions/current` (WITH token + `can_view_subscriptions`)
3. Shows subscription status, usage, payments
4. User can pause/cancel if they have `can_manage_subscriptions`

## Testing

### Test Public Endpoint (No Auth)
```bash
# Should work without authorization header
curl http://localhost:8080/api/subscriptions/plans

# Response: 200 OK with plan list
```

### Test Protected Endpoint (Requires Auth)
```bash
# Without token - should fail
curl http://localhost:8080/api/subscriptions/current
# Response: 401 Unauthorized

# With token - should work
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/subscriptions/current
# Response: 200 OK with subscription data
```

## Frontend Changes

No frontend changes needed! The subscription-api.ts already handles this:

```tsx
// This works without token
const plans = await getSubscriptionPlans();

// This requires token (sent automatically from localStorage)
const subscription = await getCurrentSubscription();
```

## Verification

### Backend Routes
After `make run`, check the console output:

```
[GIN-debug] GET    /api/subscriptions/plans  --> main.main.GetSubscriptionPlans.func12 (5 handlers)
[GIN-debug] GET    /api/subscriptions/current --> ... (6 handlers)
```

**5 handlers** = public route (no auth middleware)
**6 handlers** = protected route (with auth middleware)

### Frontend Test
1. Open browser DevTools → Network tab
2. Visit `http://localhost:3000/subscriptions`
3. Look for `GET /api/subscriptions/plans` request
4. It should NOT have an `Authorization` header
5. Response should be 200 OK with plans

## Deployment

No special deployment steps needed. Just:

1. Pull the latest code
2. Rebuild backend: `go run cmd/main.go`
3. The endpoint is now public

The fix is backward compatible - existing authenticated calls still work.

## Security Notes

✅ **Public Plans Endpoint**
- Shows only plan names, descriptions, and prices
- No sensitive user or payment data exposed
- Safe for public access

✅ **Protected User Endpoints**
- All user-specific endpoints still require authentication
- Permission checks enforced for management operations
- Admins have full control, users have limited control

## Summary

**Before:** All subscription endpoints required auth
**After:** Plans are public, user subscriptions are protected

This allows visitors to browse plans without logging in, which is typical SaaS UX.
