# Backend Settings API Guide

## Problem
Settings are not being fetched from the backend API.

## Checklist

### 1. Verify Backend is Running
```bash
# In backend_school_crm directory
go run ./cmd/main.go
```
The server should start on `http://localhost:8080`

### 2. Verify Migrations Ran
Check if the `settings` table exists in your database:
```sql
SELECT * FROM settings;
```

### 3. Test the Settings Endpoint
```bash
# Get token first
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Use the token in the response and make this request:
curl -X GET http://localhost:8080/api/settings \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Check Frontend Environment
Ensure `NEXT_PUBLIC_API_URL` is set in `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

### 5. Check Browser Console
Open browser DevTools Console tab and look for:
- Network errors when calling `/api/settings`
- Error messages in the console

## Backend Settings Service Files
- Service: `internal/service/settings_service.go`
- Handler: `internal/handlers/settings.go`
- Routes registered in: `cmd/main.go`

## Expected Behavior
1. When settings page loads, it calls `GET /api/settings`
2. Backend queries the `settings` table
3. If no settings exist, backend creates default settings
4. Settings are displayed on the page
5. When you update settings, it calls `PUT /api/settings`
6. Backend updates the database

## Troubleshooting
If settings still show errors:
1. Check that backend is running (port 8080)
2. Check database connectivity in backend logs
3. Check CORS is enabled (middleware in cmd/main.go)
4. Check JWT token is valid
