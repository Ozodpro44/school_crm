# Settings Backend - Quick Start Guide

## 5-Minute Setup

### 1. Start Backend (Terminal 1)
```bash
cd backend_school_crm
go run ./cmd/main.go
# Expected: "Starting server on :8080"
```

### 2. Start Frontend (Terminal 2)
```bash
cd frontend_school_crm
npm run dev
# Expected: "Local: http://localhost:3000"
```

### 3. Test in Browser
1. Go to http://localhost:3000
2. Login: admin@example.com / password123
3. Click Settings in menu
4. See settings data from backend ✅

## How Settings Flow

```
Browser Page Load
    ↓
useSettings() hook runs
    ↓
Calls getSettings() API
    ↓
Backend query: SELECT FROM settings
    ↓
Backend auto-creates if missing
    ↓
Returns JSON to frontend
    ↓
Display in UI
```

## What Changed

### Backend (Go)
- ✅ New: `internal/service/settings_service.go` - Handles settings logic
- ✅ New: `internal/handlers/settings.go` - REST endpoints
- ✅ Updated: `cmd/main.go` - Registered settings routes

### Frontend (React/Next.js)
- ✅ New: `src/hooks/use-settings.ts` - React hook for settings
- ✅ Updated: `src/pages/settings.tsx` - Uses backend API
- ✅ Updated: 5 other pages - Use useSettings() hook
- ✅ Removed: localStorage initialization of settings

### Database
- ✅ Settings table created automatically
- ✅ Default settings created on first access
- ✅ Updates persisted to database

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/settings` | GET | Yes | Get current settings |
| `/api/settings` | PUT | Yes | Update settings |

## Using Settings in Components

### Simple Usage
```tsx
import { useSettings } from "@/hooks/use-settings";

export default function MyComponent() {
  const { settings, loading, error } = useSettings();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading settings</div>;

  return <div>{settings.schoolName}</div>;
}
```

### Available Fields
```typescript
settings.defaultMonthlyPayment  // 500000
settings.defaultTeacherSalary   // 3000000
settings.currency              // "UZS"
settings.language              // "uz-cyrl"
settings.schoolName            // "School CRM"
settings.currentMonth          // "01"
settings.currentYear           // 2025
```

## Test API Manually

```bash
# 1. Get token
TOKEN=$(curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}' | jq -r '.token')

# 2. Get settings
curl http://localhost:8080/api/settings \
  -H "Authorization: Bearer $TOKEN"

# 3. Update settings
curl -X PUT http://localhost:8080/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"schoolName":"My School"}'
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Backend error | Run `go run ./cmd/main.go` from backend_school_crm directory |
| Frontend error | Run `npm run dev` from frontend_school_crm directory |
| Settings not loading | Check backend logs for errors |
| 401 error | Re-login or check JWT token |
| Database error | Check PostgreSQL is running |

## Key Files

- Backend service: `backend_school_crm/internal/service/settings_service.go`
- Backend handler: `backend_school_crm/internal/handlers/settings.go`
- Frontend hook: `frontend_school_crm/src/hooks/use-settings.ts`
- Settings page: `frontend_school_crm/src/pages/settings.tsx`

## Verification Checklist

- [ ] Backend running on :8080
- [ ] Frontend running on :3000
- [ ] Can login
- [ ] Settings page loads
- [ ] Settings display from backend
- [ ] Can update settings
- [ ] Changes persist after refresh
- [ ] No errors in browser console

## What's NOT Using LocalStorage

- ❌ Settings data
- ❌ Language preference
- ❌ Current month/year
- ❌ School name
- ❌ Currencies

**Everything comes from backend database now!**

## Common Commands

```bash
# Backend health check
curl http://localhost:8080/health

# Backend logs
go run ./cmd/main.go (will show logs)

# Frontend logs
npm run dev (will show logs)

# Database check
psql -d school_crm -c "SELECT * FROM settings;"

# Get fresh token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

## Next Steps

1. ✅ Verify both servers running
2. ✅ Test settings page
3. ✅ Verify API calls in DevTools
4. ✅ Check database contains settings
5. ✅ Update a setting and refresh
6. ✅ All working? Ready for production!

---

**Need more help?** See:
- `GET_SETTINGS_FROM_BACKEND.md` - Detailed testing guide
- `SETTINGS_BACKEND_SETUP.md` - Full architecture
- `SETTINGS_IMPLEMENTATION_CHECKLIST.md` - Complete checklist
