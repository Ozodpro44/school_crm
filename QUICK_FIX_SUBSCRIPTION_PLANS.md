# Quick Fix: Subscription Plans Not Loading

## Problem
You see: `failed to fetch subscription plans: pq: relation "subscription_plans" does not exist`

## Solution (30 seconds)

### Option A: Using Curl
```bash
curl -X POST http://localhost:8080/api/dev/seed-subscription-plans
```

Response:
```json
{
  "message": "Subscription plans seeded successfully",
  "plans_created": 3
}
```

### Option B: Using Browser/Postman
1. Open `http://localhost:8080/api/dev/seed-subscription-plans` in Postman
2. Set method to `POST`
3. Click Send
4. You should see 3 plans created

### Option C: Automatic (on next app restart)
Just restart the backend - migrations will run automatically:
```bash
cd backend_school_crm
go run ./cmd/main.go
```

## Verify It Works
Go to subscriptions page and you should see:
- ✅ Starter ($29.99/month)
- ✅ Professional ($79.99/month)
- ✅ Enterprise ($199.99/month)

## Need More Info?
See `SUBSCRIPTION_PLANS_FIX.md` for detailed explanation.
