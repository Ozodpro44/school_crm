# 🚀 START HERE - Complete Setup Guide

## ✅ Your School CRM is Ready!

You now have a **complete, production-ready School CRM system** with:

- ✅ Next.js Frontend (React with TypeScript)
- ✅ Golang Backend (Gin + PostgreSQL)
- ✅ Complete API Integration (40+ endpoints)
- ✅ JWT Authentication
- ✅ Full Documentation

---

## 📝 Quick Navigation

| What | Where |
|------|-------|
| **Full Setup Guide** | `FRONTEND_BACKEND_CONNECTION.md` |
| **Backend Documentation** | `backend_school_crm/README.md` |
| **API Reference** | `backend_school_crm/API.md` |
| **Integration Details** | `frontend_school_crm/INTEGRATION_GUIDE.md` |
| **Project Overview** | `PROJECT_SUMMARY.txt` |

---

## ⚡ 5-Minute Quick Start

### Terminal 1: Start Backend

```bash
cd backend_school_crm
go run cmd/main.go
```

Expected output:
```
Starting server on :8080
```

### Terminal 2: Start Frontend

```bash
cd frontend_school_crm
npm run dev
```

Expected output:
```
ready - started server on 0.0.0.0:3000
```

### Step 3: Open Browser

Navigate to: `http://localhost:3000`

### Step 4: Register/Login

Create a test account or use:
- **Email**: admin@example.com
- **Password**: password123

---

## 📁 Project Structure

```
New-Project/
│
├── START_HERE.md                        ← You are here
├── FRONTEND_BACKEND_CONNECTION.md       ← Integration guide
├── PROJECT_SUMMARY.txt                  ← Project overview
├── INDEX.md                             ← File index
│
├── frontend_school_crm/                 ← Next.js App
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts          ← API client (NEW)
│   │   │   ├── auth-api.ts     ← Backend auth (NEW)
│   │   │   └── ... (other libs)
│   │   ├── pages/              ← Page components
│   │   └── components/         ← Reusable components
│   ├── .env.local              ← Config (create this)
│   └── .env.example
│
└── backend_school_crm/                  ← Go App
    ├── cmd/main.go             ← Entry point
    ├── internal/
    │   ├── handlers/           ← HTTP routes
    │   ├── service/            ← Business logic
    │   ├── models/             ← Data types
    │   └── ... (other packages)
    ├── go.mod
    ├── docker-compose.yml      ← PostgreSQL setup
    ├── .env                    ← Config (edit this)
    └── .env.example
```

---

## 🔧 Prerequisites

- Go 1.21+ (for backend)
- Node.js 18+ (for frontend)
- PostgreSQL 12+ (or Docker)
- Terminal/Command line

---

## ✨ What's Included

### Backend (Golang)
- 42+ REST API endpoints
- JWT authentication
- 8 business logic services
- 13 database tables
- Docker support
- Complete error handling

### Frontend (Next.js)
- Modern UI with Tailwind CSS
- Payment management
- Student tracking
- Class management
- Teacher administration
- Salary management
- Expense tracking
- Multi-language support
- Dark mode

### Documentation
- API reference
- Integration guide
- Setup instructions
- Code examples
- Troubleshooting guide

---

## 🎯 Key Features

### User Management
- 7 user roles (Admin, Branch Admin, Manager, Accountant, Teacher, Student, Parent)
- Secure JWT authentication
- Role-based permissions

### Student Management
- Enrollment tracking
- Status management
- Class assignments
- Contact information

### Payment System
- Payment recording
- Status tracking (paid, unpaid, partial)
- Multiple payment methods
- Invoice generation
- Payment summaries

### Financial Management
- Salary tracking
- Expense management
- Income recording
- Financial reports

### Class & Staff
- Class creation
- Teacher assignments
- Subject management
- Branch management

---

## 🚀 Getting Started

### Step 1: Setup Environment

```bash
# Frontend
cd frontend_school_crm
cp .env.example .env.local
# Default config is fine, or edit API_URL if needed

# Backend
cd ../backend_school_crm
cp .env.example .env
# Update DATABASE_URL and JWT_SECRET if needed
```

### Step 2: Start Services

```bash
# Terminal 1: Backend
cd backend_school_crm
go run cmd/main.go

# Terminal 2: Frontend
cd frontend_school_crm
npm install
npm run dev

# Terminal 3 (optional): Docker PostgreSQL
cd backend_school_crm
docker-compose up -d
```

### Step 3: Test Connection

```bash
# Test backend health
curl http://localhost:8080/health

# Should respond with:
# {"status":"healthy"}
```

### Step 4: Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080/api
- **PostgreSQL**: localhost:5432 (if using Docker)

---

## 📚 Documentation

### Essential Reading

1. **FRONTEND_BACKEND_CONNECTION.md**
   - How frontend and backend communicate
   - API client usage
   - Quick examples

2. **backend_school_crm/README.md**
   - Backend setup
   - Environment variables
   - Building & deploying

3. **backend_school_crm/API.md**
   - Complete API reference
   - Request/response examples
   - Error codes

4. **frontend_school_crm/INTEGRATION_GUIDE.md**
   - How to update pages
   - Code migration examples
   - Best practices

### Quick Reference

- **API Endpoints**: `backend_school_crm/API_ENDPOINTS.txt`
- **API Examples**: `backend_school_crm/EXAMPLES.sh`
- **Project Overview**: `PROJECT_SUMMARY.txt`
- **File Index**: `INDEX.md`

---

## 🔑 API Key Concepts

### Authentication

All requests need a JWT token:

```
Authorization: Bearer <token>
```

The API client handles this automatically.

### Data Format

All requests use JSON:

```json
{
  "studentId": "uuid",
  "amount": 100000,
  "month": "01",
  "year": 2024,
  "paymentMethod": "cash",
  "status": "paid"
}
```

### Error Handling

API returns HTTP status codes:

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Resource not found
- `500 Server Error` - Server error

---

## 💻 Development Workflow

### Frontend Development

```bash
cd frontend_school_crm

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Format code
npm run format

# Lint code
npm run lint
```

### Backend Development

```bash
cd backend_school_crm

# Download dependencies
go mod download

# Run application
go run cmd/main.go

# Build executable
make build

# Run tests
make test

# Format code
make fmt
```

---

## 🐛 Troubleshooting

### Backend Won't Start

```bash
# Check port 8080 is free
netstat -an | grep 8080

# Verify Go is installed
go version

# Check PostgreSQL is running
psql -U postgres

# View error logs
go run cmd/main.go 2>&1 | head -20
```

### Frontend Can't Connect to Backend

```bash
# Check backend is running
curl http://localhost:8080/health

# Check API URL in .env.local
cat frontend_school_crm/.env.local

# Clear browser cache and try again
# Check browser DevTools > Network tab for CORS errors
```

### Login Fails

```bash
# Create a test user first
source backend_school_crm/EXAMPLES.sh
register_user "test@example.com" "password123" "Test User" "manager"

# Then try logging in with that email/password
```

### Database Connection Error

```bash
# Start PostgreSQL with Docker
cd backend_school_crm
docker-compose up -d

# Or use psql directly
psql -U postgres -c "CREATE DATABASE school_crm;"

# Check connection
psql -U postgres -d school_crm -c "SELECT 1;"
```

---

## 📊 Important Files

### Frontend

| File | Purpose |
|------|---------|
| `src/lib/api.ts` | API client |
| `src/lib/auth-api.ts` | Authentication |
| `src/pages/` | Page components |
| `src/components/` | UI components |
| `.env.local` | Configuration |

### Backend

| File | Purpose |
|------|---------|
| `cmd/main.go` | Entry point |
| `internal/handlers/` | HTTP routes |
| `internal/service/` | Business logic |
| `internal/models/` | Data types |
| `.env` | Configuration |

---

## ✅ Checklist

- [ ] Backend running on port 8080
- [ ] Frontend running on port 3000
- [ ] Health check passes: `curl http://localhost:8080/health`
- [ ] Can navigate to http://localhost:3000
- [ ] Can register/login
- [ ] Can create/view data
- [ ] Can use payment system
- [ ] API calls work correctly

---

## 🎓 Learning Resources

### API Client Usage

See `frontend_school_crm/src/lib/api.ts` for all available functions.

Example:

```typescript
import { listStudents, createPayment } from "@/lib/api";

// Load students
const students = await listStudents(branchId);

// Create payment
const payment = await createPayment({
  studentId: "...",
  amount: 100000,
  month: "01",
  year: 2024,
  paymentMethod: "cash",
  status: "paid",
  invoiceNumber: "INV-123",
  branchId: branchId,
});
```

### Authentication

```typescript
import { login, logout, getCurrentUser, isAuthenticated } from "@/lib/auth-api";

// Login
const user = await login(email, password);

// Check if logged in
if (isAuthenticated()) {
  const user = getCurrentUser();
  console.log("Welcome", user.fullName);
}

// Logout
logout();
```

---

## 🚢 Deployment

### Local (Development)
- Run both frontend and backend on localhost
- Use Docker Compose for PostgreSQL
- Perfect for development

### Docker (Staging/Production)
```bash
# Build backend image
docker build -t school-crm:latest .

# Run with PostgreSQL
docker-compose up
```

### Cloud (AWS/GCP/Azure)
- Deploy backend to App Engine or EC2
- Deploy frontend to Vercel or S3 + CloudFront
- Use managed database (RDS, Cloud SQL, etc.)

See `backend_school_crm/README.md` for deployment details.

---

## 📞 Support

### Documentation
- See `FRONTEND_BACKEND_CONNECTION.md` for API usage
- See `backend_school_crm/API.md` for endpoint details
- See `frontend_school_crm/INTEGRATION_GUIDE.md` for code examples

### Common Issues
- Backend not starting → Check port 8080 is free
- Can't login → Create user with EXAMPLES.sh
- API errors → Check browser DevTools Network tab
- Database error → Start docker-compose

### Getting Help
1. Check documentation files
2. Review error messages carefully
3. Check browser console and DevTools
4. Check backend logs: `go run cmd/main.go`

---

## 🎉 You're All Set!

Your School CRM system is ready to use. 

**Next steps:**

1. Start the backend: `cd backend_school_crm && go run cmd/main.go`
2. Start the frontend: `cd frontend_school_crm && npm run dev`
3. Open http://localhost:3000 in your browser
4. Create test data and explore the system

Enjoy! 🚀

---

## 📋 File Locations

```
/home/ozod/Documents/New-Project/

├── START_HERE.md                        ← You are here
├── FRONTEND_BACKEND_CONNECTION.md       ← Read next
├── BACKEND_SETUP.md
├── IMPLEMENTATION_COMPLETE.md
├── PROJECT_SUMMARY.txt
├── INDEX.md

├── frontend_school_crm/
│   ├── src/lib/api.ts          ← NEW
│   ├── src/lib/auth-api.ts     ← NEW
│   ├── .env.example            ← NEW
│   ├── INTEGRATION_GUIDE.md    ← NEW
│   └── ... (rest of frontend)

└── backend_school_crm/
    ├── cmd/main.go
    ├── internal/
    ├── go.mod
    ├── docker-compose.yml
    ├── .env.example
    ├── README.md
    ├── API.md
    ├── QUICK_START.md
    └── ... (rest of backend)
```

---

**Status: ✅ READY TO USE**

Start the services and begin building! 🚀
