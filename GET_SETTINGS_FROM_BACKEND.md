# Get Settings Page Data from Backend - Step by Step

## Architecture Overview

```
Frontend (Next.js)
    ↓
useSettings() hook
    ↓
API Client (lib/api.ts)
    ↓
Backend (Go)
    ↓
PostgreSQL Database
```

## Step 1: Start the Backend

### Prerequisites
- Go 1.19+ installed
- PostgreSQL running with database created
- `.env` file configured with DATABASE_URL and JWT_SECRET

### Start Backend
```bash
cd backend_school_crm
go run ./cmd/main.go
```

**Expected output:**
```
Starting server on :8080
```

**Verify it's running:**
```bash
curl http://localhost:8080/health
# Should return: {"status":"healthy"}
```

## Step 2: Create a User and Get Token

```bash
# Register a new user
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123",
    "fullName": "Admin User",
    "role": "admin"
  }'

# Login to get token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }'
```

**Save the token from response:**
```json
{
  "token": "eyJhbGc...",
  "user": { ... }
}
```

## Step 3: Test Settings API Endpoint

### Get Settings
```bash
export TOKEN="YOUR_TOKEN_HERE"

curl -X GET http://localhost:8080/api/settings \
  -H "Authorization: Bearer $TOKEN"
```

**Expected response:**
```json
{
  "id": "some-uuid",
  "defaultMonthlyPayment": 500000,
  "defaultTeacherSalary": 3000000,
  "currency": "UZS",
  "language": "uz-cyrl",
  "schoolName": "School CRM",
  "currentMonth": "01",
  "currentYear": 2025,
  "updatedAt": "2025-01-01T12:00:00Z"
}
```

**If you get an error:**
- Check backend logs for SQL errors
- Verify database migrations ran: `SELECT * FROM settings;`
- Check JWT token is valid

### Update Settings
```bash
curl -X PUT http://localhost:8080/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schoolName": "My School Name",
    "currency": "USD",
    "language": "en"
  }'
```

**Expected response:** Updated settings object

## Step 4: Start the Frontend

```bash
cd frontend_school_crm
npm run dev
```

**Expected:**
```
Local:        http://localhost:3000
```

## Step 5: Test in Browser

### 1. Login
- Go to http://localhost:3000
- Click Login
- Enter credentials: `admin@example.com` / `password123`
- Click Login

### 2. Navigate to Settings
- Click menu → Settings
- Page should load and display settings from backend

### 3. Verify Data
Check that you see:
- ✅ School name (from backend)
- ✅ Currency dropdown (from backend)
- ✅ Language dropdown (from backend)
- ✅ Default monthly payment (from backend)
- ✅ Default teacher salary (from backend)

### 4. Check Network Activity
Open DevTools (F12):
1. Go to Network tab
2. Filter by "settings"
3. You should see:
   - `GET /api/settings` - When page loads
   - `PUT /api/settings` - When you save changes

### 5. Test Update
1. Change school name
2. Click "Save"
3. Should show success toast
4. Refresh page
5. Settings should persist (from backend)

## Troubleshooting

### Settings page shows error "Failed to load settings"

**Check 1: Backend Running?**
```bash
curl http://localhost:8080/health
```

**Check 2: API URL Correct?**
Frontend should connect to `http://localhost:8080/api`

Check `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

**Check 3: Database Issue?**
Check backend logs for SQL errors

**Check 4: Authentication Token?**
Check DevTools Console for auth errors

### Settings page shows default values

This is expected if:
- Backend created default settings (first time)
- Backend API is unavailable (frontend fallback)

To verify backend data:
```bash
# Check database directly
psql -d your_database -c "SELECT * FROM settings;"
```

## Complete Test Sequence

1. ✅ Start backend: `go run ./cmd/main.go`
2. ✅ Verify health: `curl http://localhost:8080/health`
3. ✅ Register user via API
4. ✅ Login and get token
5. ✅ Test GET /api/settings
6. ✅ Test PUT /api/settings
7. ✅ Start frontend: `npm run dev`
8. ✅ Login to frontend
9. ✅ Visit Settings page
10. ✅ Verify data loaded from backend
11. ✅ Update a setting
12. ✅ Verify change persisted (refresh page)

## API Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/settings` | Required | Fetch current settings |
| PUT | `/api/settings` | Required | Update settings |

## Frontend Files Using Settings

- `src/pages/settings.tsx` - Settings management page
- `src/hooks/use-settings.ts` - React hook for fetching
- `src/pages/payments.tsx` - Uses current month/year
- `src/pages/students.tsx` - Uses default payment
- `src/pages/salaries.tsx` - Uses current year
- `src/context/LanguageContext.tsx` - Syncs language

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| CORS error | Backend CORS not enabled | Check middleware in main.go |
| 401 Unauthorized | Invalid token | Re-login and get new token |
| 404 Not Found | Route not registered | Check handlers registration in main.go |
| Empty response | Database empty | Backend auto-creates on first call |
| Network timeout | Backend not running | Start backend on port 8080 |

## Next Steps

1. Run both backend and frontend
2. Test complete flow from login → settings page
3. Verify database contains settings: `SELECT * FROM settings;`
4. All changes should be persisted to backend only, not localStorage
