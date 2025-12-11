# Settings Backend Setup - Complete Guide

## What Was Done

### Backend Implementation
✅ Created `internal/service/settings_service.go` - Settings service with:
- `Get()` - Fetches settings, creates defaults if none exist
- `Update()` - Updates settings in database
- Auto-creates default settings on first load

✅ Created `internal/handlers/settings.go` - REST endpoints:
- `GET /api/settings` - Fetch current settings
- `PUT /api/settings` - Update settings

✅ Registered routes in `cmd/main.go`

### Frontend Implementation
✅ Created `src/hooks/use-settings.ts` - React hook for fetching settings with:
- Automatic backend synchronization
- Fallback to default values if API fails
- Error handling

✅ Updated components to use backend settings:
- `src/pages/settings.tsx` - Settings management page
- `src/pages/payments.tsx` - Uses current year/month from settings
- `src/pages/students.tsx` - Uses default payment amount from settings
- `src/pages/salaries.tsx` - Uses current year from settings
- `src/context/LanguageContext.tsx` - Syncs language preference with backend
- `src/hooks/use-system-date.ts` - Gets system date from settings

✅ Updated translations for error/success messages

## How to Use

### 1. Start Backend
```bash
cd backend_school_crm
go run ./cmd/main.go
```
Server starts on `http://localhost:8080`

### 2. Start Frontend
```bash
cd frontend_school_crm
npm run dev
```
Frontend starts on `http://localhost:3000`

### 3. Test Settings API
```bash
# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Get settings (use token from login response)
curl -X GET http://localhost:8080/api/settings \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update settings
curl -X PUT http://localhost:8080/api/settings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "schoolName": "My School",
    "currency": "UZS",
    "language": "uz-cyrl"
  }'
```

## Database Schema
Settings table stores:
- `id` - UUID primary key
- `default_monthly_payment` - Default payment amount for students
- `default_teacher_salary` - Default salary for teachers
- `currency` - Currency code (UZS, USD, EUR)
- `language` - Language code (uz-cyrl, uz-latn, en)
- `school_name` - Name of the school
- `school_logo` - URL to school logo
- `current_month` - Current month (01-12)
- `current_year` - Current year
- `updated_at` - Timestamp of last update

## Default Values (Auto-Created on First Load)
```
defaultMonthlyPayment: 500000
defaultTeacherSalary: 3000000
currency: UZS
language: uz-cyrl
schoolName: School CRM
currentMonth: 01
currentYear: 2025
```

## Features
✅ Settings synchronized across all pages
✅ Language preference persists on backend
✅ Automatic default creation on first access
✅ Graceful fallback if backend unavailable
✅ Real-time UI updates on settings change
✅ Permission-based access control

## Troubleshooting

### Settings show error
1. Ensure backend is running on port 8080
2. Check database migrations ran successfully
3. Check `NEXT_PUBLIC_API_URL` environment variable
4. Check browser console for API errors

### Changes not saving
1. Check backend logs for SQL errors
2. Verify JWT token is valid
3. Check user has `canEditSettings` permission

### Language not syncing
1. Backend API must be running
2. Check user authentication token
3. Check browser console for fetch errors
