# Developer Dashboard Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd frontend_for_dev
npm install
```

### 2. Configure Environment
```bash
# .env.local is already configured
# Verify API URL points to your backend
cat .env.local
```

### 3. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## First Time Setup

### Step 1: Ensure Backend is Running
```bash
# In backend_school_crm directory
make dev
# or
docker-compose up
```

Verify backend health:
```bash
curl http://localhost:8080/health
# Should return: {"status":"healthy"}
```

### Step 2: Start Developer Dashboard
```bash
npm run dev
```

### Step 3: Get JWT Token
There are two ways to authenticate:

**Option A: Quick Login**
1. Go to "Security Tools" tab
2. Enter demo credentials:
   - Email: `admin@example.com`
   - Password: `password` (or your test user password)
3. Click "Login"

**Option B: Paste Token**
1. Get JWT token from backend (e.g., via Postman or login)
2. Go to "Security Tools" tab
3. Paste token in "Import Token" section
4. Click "Save Token"

### Step 4: Test Tools
- **API Tester**: Send test requests to your API
- **Settings Manager**: View/edit branch settings
- **Health Check**: Verify backend status
- **User Management**: Create test users

## Available Tools

| Tool | Purpose | Auth Required |
|------|---------|---------------|
| API Tester | Test API endpoints | No |
| Security Tools | Manage JWT tokens | No |
| System Health | Check backend status | No |
| API Documentation | View API reference | No |
| Database Explorer | View schema | No |
| Settings Manager | Edit settings | Yes |
| User Management | Manage users | Yes |
| Test Data Generator | Create test data | Yes |

## Common Tasks

### Testing an API Endpoint
1. Go to "API Tester"
2. Select method (GET/POST/PUT/DELETE)
3. Enter endpoint: `/api/students`
4. Add headers if needed
5. Add request body for POST/PUT
6. Click "Send Request"
7. View response and timing

### Viewing API Logs
1. Go to "API Tester"
2. Scroll to "Recent API Logs" section
3. Click on any log to view details
4. Use "Clear" button to reset logs

### Managing JWT Tokens
1. Go to "Security Tools"
2. Current token section shows active token
3. Copy token to clipboard
4. View token expiry time
5. See decoded claims (email, role, etc.)

### Creating Test Users
1. Go to "User Management"
2. Authenticate first
3. Click "New User"
4. Fill in email, password, name
5. Click "Create User"
6. User appears in list immediately

### Updating Settings
1. Go to "Settings Manager"
2. Authenticate first
3. Edit fields:
   - Branch Name
   - Monthly Payment
   - Currency
4. Click "Save Settings"
5. Dates auto-update

## Troubleshooting

### Port 3000 Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- -p 3001
```

### Backend Not Responding
```bash
# Check if backend is running
curl http://localhost:8080/health

# If not running, start it
cd ../backend_school_crm
make dev
```

### Authentication Failing
- Verify user email/password in backend database
- Check JWT_SECRET matches between backend and frontend
- Try logging in with different user credentials

### API Requests Blocked (CORS)
- Ensure backend CORS middleware is enabled
- Check backend is running on correct port
- Verify NEXT_PUBLIC_API_URL in .env.local

### Response Time Very Slow
- Check backend logs for errors
- Verify database connection
- Look for N+1 queries in backend
- Check network latency

## Development Tips

### Hot Reload
- Changes to components auto-reload
- .env.local changes require restart

### Browser DevTools
- Check Network tab for API calls
- Use Console for debugging
- React DevTools extension helpful

### API Logs
- All API calls logged automatically
- View in "API Tester" tool
- Helps debug issues without backend logs

### Local Testing
```bash
# Test with curl
curl http://localhost:3000/
curl http://localhost:8080/health

# Watch backend logs
tail -f backend_school_crm/logs/server.log
```

## Next Steps

1. Explore each tool and familiarize yourself
2. Test API endpoints relevant to your work
3. Create test users for your feature
4. Generate test data if needed
5. Monitor system health during testing

## Build for Production

```bash
npm run build
npm start
```

This creates an optimized production build.

## Documentation

- Full README: `README.md`
- API Reference: `../API_ENDPOINTS_SUMMARY.md`
- Backend Setup: `../BACKEND_SETUP.md`

## Help & Support

- Check tool documentation in each page
- Review API endpoint specs in "API Documentation" tool
- Check backend logs for errors
- Verify .env.local configuration
