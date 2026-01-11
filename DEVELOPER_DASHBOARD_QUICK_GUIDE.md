# Developer Dashboard - Quick Guide

## 🚀 Get Started in 5 Minutes

### 1. Start Backend (Terminal 1)
```bash
cd backend_school_crm
make dev
```

### 2. Start Frontend (Terminal 2)
```bash
cd frontend_for_dev
npm run dev
```

### 3. Open Dashboard
```
http://localhost:3000
```

### 4. Login
1. Click "Security Tools"
2. Enter email and password
3. Click "Login"

### 5. Explore Tools
- **Database Explorer** - See database schema
- **API Documentation** - View all endpoints
- **API Tester** - Test any endpoint
- **Test Data Generator** - Create dummy data
- **System Health** - Check backend status

---

## 📊 The 8 Tools

| Tool | Purpose | Live Data |
|------|---------|-----------|
| API Tester | Test endpoints | ✅ Yes |
| Security Tools | Manage tokens | ✅ Yes |
| System Health | Monitor backend | ✅ Yes |
| API Documentation | View endpoints | ✅ Yes |
| Database Explorer | View schema | ✅ Yes |
| Settings Manager | Edit settings | ✅ Yes |
| User Management | Manage users | ✅ Yes |
| Test Data Generator | Generate data | ✅ Yes |

---

## 🔗 Backend Endpoints

All protected (JWT auth required):

```
GET  /api/dev/schema              - Database schema
GET  /api/dev/migrations          - Migration history
GET  /api/dev/api-docs            - API documentation
POST /api/dev/generate-test-data  - Generate test data (admin only)
```

---

## 🧪 Quick Test

### Test Backend Health
```bash
curl http://localhost:8080/health
```

### Fetch Schema
```bash
curl -X GET http://localhost:8080/api/dev/schema \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Generate Test Data
```bash
curl -X POST http://localhost:8080/api/dev/generate-test-data \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📝 What Each Tool Does (Live!)

### Database Explorer
- Shows real database tables
- Displays columns and types
- Shows migration history
- Click "Reload" to refresh

### API Documentation
- Lists all API endpoints
- Shows request/response info
- Indicates public vs protected
- Auto-generated from backend

### Test Data Generator
- Creates dummy students (12)
- Creates dummy teachers (8)
- Creates dummy classes (5)
- Creates dummy payments (35+)
- Admin authorization required

### API Tester
- Test any HTTP endpoint
- View request/response
- Check response time
- See status codes

### System Health
- Check if backend is running
- Test each endpoint
- Monitor availability
- Auto-refreshes every 30s

---

## 🔐 Authentication

### Login in Dashboard
1. Go to Security Tools
2. Enter credentials:
   - Email: admin@example.com
   - Password: (your password)
3. Click Login
4. Token auto-saves

### Copy Token
In Security Tools:
1. View current token
2. Click "Copy" button
3. Use in API requests

---

## 📚 File Structure

```
Frontend:
  frontend_for_dev/
  ├── app/tools/
  │   ├── api-tester/
  │   ├── security/
  │   ├── health/
  │   ├── api-docs/
  │   ├── db-explorer/
  │   ├── settings-manager/
  │   ├── user-management/
  │   └── test-data/
  └── (other files)

Backend:
  backend_school_crm/
  ├── cmd/main.go (routes)
  └── internal/handlers/
      └── developer.go (endpoints)
```

---

## 💻 Development Workflow

### 1. Start Servers
```bash
# Terminal 1
cd backend_school_crm && make dev

# Terminal 2
cd frontend_for_dev && npm run dev
```

### 2. Open Dashboard
```
http://localhost:3000
```

### 3. Authenticate
```
Security Tools → Login
```

### 4. Use Tools
- Test API endpoints
- View database schema
- Generate test data
- Monitor system health

### 5. Check Results
- API responses in API Tester
- Real schema in Database Explorer
- Generated records in database

---

## 🎯 Common Tasks

### View Database Schema
1. Open Database Explorer
2. Click "Reload"
3. See all tables with columns

### Test an Endpoint
1. Open API Tester
2. Select method (GET, POST, etc)
3. Enter path (/api/students)
4. Add headers/body if needed
5. Click "Send Request"

### Generate Test Data
1. Open Test Data Generator
2. Click "Generate Test Data"
3. See results with record counts
4. Check database for records

### Check System Status
1. Open System Health
2. See green (healthy) or red (down)
3. Check individual endpoints
4. Auto-refreshes every 30s

### Login/Get Token
1. Open Security Tools
2. Enter email and password
3. Click "Login"
4. See token and expiry time

---

## 📋 Endpoint Reference

### Database Schema
**URL**: `GET /api/dev/schema`

**Response**: 
```json
{
  "tables": [...],
  "count": 12
}
```

### Migrations
**URL**: `GET /api/dev/migrations`

**Response**:
```json
{
  "migrations": [...],
  "count": 13
}
```

### API Documentation
**URL**: `GET /api/dev/api-docs`

**Response**:
```json
{
  "endpoints": [...],
  "count": 20
}
```

### Test Data
**URL**: `POST /api/dev/generate-test-data`

**Response**:
```json
{
  "students": 12,
  "teachers": 8,
  "classes": 5,
  "payments": 35,
  "status": "completed"
}
```

---

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check if port 8080 is in use
lsof -i :8080

# Kill if needed
kill -9 <PID>

# Restart
make dev
```

### Frontend Won't Start
```bash
# Clear dependencies
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Start
npm run dev
```

### Can't Login
- Verify credentials are correct
- Check backend is running
- Check email in database

### Endpoints Return 401
- Make sure you're logged in
- Check token hasn't expired
- Token appears in Security Tools

---

## 📞 Quick Help

**Need to restart?**
- Ctrl+C in both terminals
- Run make dev and npm run dev again

**Need to clear data?**
- Database Explorer shows schema
- Test Data Generator creates records
- Delete from database manager if needed

**Need real-time updates?**
- Database Explorer has "Reload" button
- System Health auto-refreshes
- API Tester logs all requests

**Need to test API?**
- Use API Tester tool
- Or use curl with JWT token
- All endpoints documented in API Docs tool

---

## ✅ Checklist

- [ ] Backend running on port 8080
- [ ] Frontend running on port 3000
- [ ] Can access http://localhost:3000
- [ ] Can login with credentials
- [ ] API Tester works
- [ ] Database Explorer shows tables
- [ ] API Documentation loads
- [ ] Test Data Generator creates records

---

## 📊 Architecture

```
Browser (http://localhost:3000)
    ↓
Next.js Frontend
    ↓
Axios HTTP Client
    ↓
Backend API (http://localhost:8080)
    ↓
PostgreSQL Database
```

---

## 🎉 You're Ready!

All tools are live and connected to real backend data.

Start developing and testing! 🚀
