# Complete Setup Guide - Subscriptions Feature

## Quick Start (3 Steps)

### 1. Start Database
```bash
cd backend_school_crm
docker-compose up -d postgres
```

### 2. Start Backend (Migrations Run Automatically)
```bash
make run
# or
go run cmd/main.go
```

Watch for this log:
```
[Database.RunMigrations] Using migration path: file:/...migrations
[Database.RunMigrations] No new migrations to run
Successfully connected to Redis
[GIN-debug] Running in "debug" mode...
```

Backend is ready when you see: `Starting server on :8080`

### 3. Start Frontend (In New Terminal)
```bash
cd frontend_school_crm
npm run dev
```

Visit: `http://localhost:3000/subscriptions`

**Done!** All tables are created automatically. ✓

---

## What Happens Behind the Scenes

### On Backend Startup

1. **Database Connection**
   - Connects to PostgreSQL at `DATABASE_URL`
   - Checks connection with ping

2. **Auto Migration**
   - Finds migrations directory: `backend_school_crm/migrations/`
   - Runs `000001_init_all_tables.up.sql`
   - Creates all tables:
     - Core tables (users, branches, classes, etc.)
     - Subscription tables (subscription_plans, subscriptions, etc.)
   - Creates indexes for performance
   - Creates constraints and relationships

3. **Permission Setup**
   - Ensures all users have permission records
   - Admins get full subscription management
   - Others get view-only

4. **App Ready**
   - Routes registered
   - Services initialized
   - Server listening on :8080

### On Frontend Load

1. **Subscriptions Page** (`/subscriptions`)
   - Frontend requests: `GET /api/subscriptions/plans` (public, no auth)
   - Backend queries: `SELECT * FROM subscription_plans`
   - Plans displayed to user

2. **Subscribe** (if logged in)
   - User clicks "Choose Plan"
   - Frontend sends: `POST /api/subscriptions` (with JWT token)
   - Backend checks: `can_manage_subscriptions` permission
   - Creates subscription record
   - Shows "Subscription created!"

3. **Manage Subscription** (`/subscription-details`)
   - User visits page
   - Frontend requests: `GET /api/subscriptions/current` (needs auth)
   - Backend checks: `can_view_subscriptions` permission
   - Shows: status, usage, payment history
   - Options to pause/resume/cancel

---

## Verification

### Backend Ready?
```bash
# Check if tables exist
psql -d school_crm -U school_user -c "SELECT COUNT(*) FROM subscription_plans;"
# Should return: 0 ✓

# Or check via API
curl http://localhost:8080/api/subscriptions/plans
# Should return: [] ✓
```

### Frontend Ready?
```bash
# Check if page loads
curl http://localhost:3000/subscriptions 2>&1 | grep -i "subscription"
# Should show HTML with "Subscription Plans" ✓
```

### Can You Subscribe?
1. Visit `http://localhost:3000/subscriptions`
2. See "authorization header required" → Log in first
3. Log in → See plans displayed
4. Click "Choose Plan" → Creates subscription

---

## Database Tables Created

### Core Tables
- `users` - User accounts
- `branches` - School branches
- `classes` - Classes per branch
- `students` - Students in classes
- `teachers` - Teachers in branch
- `payments` - Student payments
- `salaries` - Teacher salaries
- `expenses` - Branch expenses
- `incomes` - Branch incomes
- `permissions` - User permissions
- `financial_months` - Monthly financial periods

### Subscription Tables ✨
- `subscription_plans` - Available plans (Starter, Pro, Enterprise)
- `subscriptions` - User subscriptions (who's subscribed to what)
- `subscription_usage` - Usage tracking (branches used, students enrolled, etc.)
- `subscription_payments` - Billing history (invoices, payment status)

---

## Example Workflows

### Workflow 1: First-Time Setup
```
1. docker-compose up -d postgres
   → PostgreSQL starts
   
2. make run
   → [Database.RunMigrations] Running...
   → All tables created
   → Migrations applied
   → App starts
   
3. npm run dev (in frontend)
   → Frontend starts
   
4. Visit /subscriptions
   → Page loads!
   → Shows "No plans yet" (empty)
```

### Workflow 2: View Plans (No Login)
```
1. Visit /subscriptions (NOT logged in)
2. Frontend: GET /api/subscriptions/plans (no auth needed)
3. Backend: SELECT * FROM subscription_plans
4. Response: [] (empty, or plans if you added them)
5. Display: Shows available plans
```

### Workflow 3: Subscribe (With Login)
```
1. Log in at /login
2. Visit /subscriptions
3. Click "Choose Plan"
4. Frontend: POST /api/subscriptions (with JWT token)
5. Backend checks: user logged in + can_manage_subscriptions
6. Creates row in subscriptions table
7. Response: 201 Created
8. Navigate to /subscription-details
9. Shows new subscription
```

---

## Environment Variables

### Required
```bash
# In backend_school_crm/.env:
DATABASE_URL=postgres://school_user:school_password@localhost:5432/school_crm?sslmode=disable
JWT_SECRET=your-secret-key
```

### Frontend
```bash
# In frontend_school_crm/.env.local:
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

---

## Troubleshooting

### Error: "relation does not exist"
```
Solution: This should NOT happen anymore!
- Backend auto-runs migrations on startup
- Check: make run output for migration logs
- If error persists: Restart backend
```

### Error: "Dirty database version 1"
```
Solution: Backend auto-fixes this
- Shows: [Database.RunMigrations] Detected dirty migration state
- Auto-fixes: Forces version and continues
- Result: App starts normally
```

### Error: "authorization header required" (on /subscriptions)
```
Solution: Fixed! Plans endpoint is public now
- No auth header sent for plans endpoint
- Check: Frontend shows plans without login
- To subscribe: You need to log in
```

### Frontend won't connect to backend
```
Check:
1. Backend running? curl http://localhost:8080/health
2. NEXT_PUBLIC_API_URL set? echo $NEXT_PUBLIC_API_URL
3. Frontend port: http://localhost:3000 (not 3001)
```

---

## What's Automated Now

✅ Database table creation (on app startup)
✅ Permission setup (for existing users)
✅ Index creation (for performance)
✅ Foreign key constraints (for data integrity)
✅ Dirty migration state recovery (if needed)

## What's Manual (Still)

- Adding sample plans (SQL insert or admin panel)
- Configuring specific permissions (if needed)
- Setting up Stripe integration (future feature)
- Email notifications (future feature)

---

## Summary

| Step | Before | After |
|------|--------|-------|
| Database created | Manual SQL | ✓ Auto on startup |
| Tables created | Manual migrations | ✓ Auto on startup |
| Permissions set | Manual SQL | ✓ Auto on startup |
| Backend start | `make run` | ✓ `make run` (same) |
| Frontend start | `npm run dev` | ✓ `npm run dev` (same) |

**Everything just works now!** 🎉

---

## Next Steps

1. **Add Sample Plans** (optional):
   ```bash
   psql -d school_crm -U school_user < add_sample_plans.sql
   ```

2. **Test Subscription Flow**:
   - Visit /subscriptions
   - Log in
   - Subscribe to plan
   - View /subscription-details

3. **Customize**:
   - Edit plan names and prices
   - Add more features to plans
   - Adjust permissions for roles

That's it! Everything is set up and ready to use.
