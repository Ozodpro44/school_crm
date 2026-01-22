# Setup Subscriptions Database

## Error
```
failed to fetch subscription plans: pq: relation "subscription_plans" does not exist
```

This means the database tables for subscriptions haven't been created yet.

## Solution - Run Migration

### Step 1: Navigate to Backend
```bash
cd backend_school_crm
```

### Step 2: Run Migration
```bash
make migrate-up
```

**What this does:**
- Creates `subscription_plans` table
- Creates `subscriptions` table
- Creates `subscription_usage` table
- Creates `subscription_payments` table
- Adds subscription columns to `permissions` table
- Creates all necessary indexes

### Step 3: Grant Permissions
```bash
psql -d school_crm -U school_user -f grant_subscription_permissions.sql
```

**What this does:**
- Grants `can_view_subscriptions = true` to all users
- Grants `can_manage_subscriptions = true` to admin users only

### Step 4: Verify Tables Created
```bash
psql -d school_crm -U school_user

# Inside psql:
\d subscription_plans
\d subscriptions
\d subscription_usage
\d subscription_payments

# Should see table definitions
```

### Step 5: Verify Permissions
```sql
SELECT * FROM subscription_plans;
SELECT * FROM subscriptions;
SELECT can_view_subscriptions, can_manage_subscriptions FROM permissions LIMIT 5;
```

## Complete Setup Steps

### If you have Docker (Recommended)

```bash
# 1. Start database
cd backend_school_crm
docker-compose up -d postgres

# Wait a few seconds for PostgreSQL to start

# 2. Run migrations
make migrate-up

# 3. Grant permissions
psql -d school_crm -U school_user -f grant_subscription_permissions.sql

# 4. Start backend
make run
```

### If you're using local PostgreSQL

```bash
# 1. Make sure PostgreSQL is running
sudo service postgresql start  # Linux
# or
brew services start postgresql  # macOS

# 2. Navigate to backend
cd backend_school_crm

# 3. Run migrations
make migrate-up

# 4. Grant permissions
psql -d school_crm -U school_user -f grant_subscription_permissions.sql

# 5. Start backend
make run
```

## Verify It's Working

### Test 1: Check Tables Exist
```bash
psql -d school_crm -U school_user -c "SELECT count(*) FROM subscription_plans;"
```

Should return: `count: 0` (no plans yet, which is correct)

### Test 2: Check Backend API
```bash
curl http://localhost:8080/api/subscriptions/plans
```

Should return: `[]` (empty array, no plans created yet)

### Test 3: Check Frontend
Visit: `http://localhost:3000/subscriptions`

Should show:
- ✓ "Subscription Plans" heading
- ✓ "Choose the perfect plan for your school" subtitle
- ✓ "No plans available" message (or empty grid)

If you see these instead of "relation does not exist" error → Tables created successfully! ✓

## Insert Sample Plans (Optional)

To see plans in the UI, insert some sample data:

```bash
psql -d school_crm -U school_user

# Inside psql:
INSERT INTO subscription_plans (
  id, name, description, price, billing_period, 
  max_branches, max_students, max_classes, 
  features, status
) VALUES
(
  gen_random_uuid(),
  'Starter',
  'Perfect for small schools',
  49.99,
  'monthly',
  1,
  100,
  5,
  '{"sso": false, "api": false, "support": "email"}'::jsonb,
  'active'
),
(
  gen_random_uuid(),
  'Professional',
  'For growing schools',
  99.99,
  'monthly',
  5,
  500,
  20,
  '{"sso": true, "api": true, "support": "priority"}'::jsonb,
  'active'
),
(
  gen_random_uuid(),
  'Enterprise',
  'For large organizations',
  299.99,
  'monthly',
  NULL,
  NULL,
  NULL,
  '{"sso": true, "api": true, "support": "24/7", "custom": true}'::jsonb,
  'active'
);
```

Then refresh the frontend page and you should see 3 plans displayed!

## Troubleshooting

### "make: command not found"
Install Make:
```bash
# Ubuntu/Debian
sudo apt-get install make

# macOS
brew install make

# Or use direct commands instead
postgresql_url="postgres://school_user:school_password@localhost:5432/school_crm?sslmode=disable"
migrate -path migrations -database $postgresql_url up
```

### "psql: command not found"
Install PostgreSQL client:
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql
```

### "cannot find migrations directory"
Make sure you're in the backend directory:
```bash
cd /path/to/backend_school_crm
pwd  # Should end with /backend_school_crm
ls migrations/  # Should list .sql files
```

### "permission denied" errors
Check your database credentials in `.env`:
```bash
cat .env | grep DATABASE_URL
```

Should show something like:
```
DATABASE_URL=postgres://school_user:school_password@localhost:5432/school_crm?sslmode=disable
```

### Still seeing "relation does not exist"?
1. Check migrations ran: `make migrate-status`
2. List all tables: `psql -d school_crm -U school_user -c "\dt"`
3. Look for `subscription_plans`, `subscriptions`, etc.
4. If not there, check migration errors: `make migrate-up` (run again, it will show errors)

## Summary

**3 Simple Steps:**
```bash
cd backend_school_crm
make migrate-up
psql -d school_crm -U school_user -f grant_subscription_permissions.sql
```

Then refresh browser at `http://localhost:3000/subscriptions`

Error should be gone and plans will display (once you add sample data).

## Success Indicators

✓ No "relation does not exist" error
✓ No "authorization header required" error
✓ Plans page loads
✓ Can see subscription plans (if sample data inserted)
✓ Can subscribe (if logged in)
