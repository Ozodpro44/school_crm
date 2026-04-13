# Frontend Dev Integration - Complete Index

## Overview

This document provides a complete reference for integrating frontend_for_dev with the backend and accessing Railway logs.

## Quick Links

| Document | Purpose |
|----------|---------|
| [FRONTEND_DEV_QUICK_START.md](./FRONTEND_DEV_QUICK_START.md) | Get started in 10 minutes |
| [FRONTEND_DEV_INTEGRATION_SETUP.md](./FRONTEND_DEV_INTEGRATION_SETUP.md) | Detailed setup instructions |
| [RAILWAY_DEPLOYMENT_GUIDE.md](./RAILWAY_DEPLOYMENT_GUIDE.md) | Deploy to production |
| [API_ENDPOINTS_SUMMARY.md](./API_ENDPOINTS_SUMMARY.md) | Backend API reference |

## Files Created

### Core Integration Files

```
frontend_for_dev/src/
├── lib/
│   └── api-client.ts              # Main API client (singleton)
│       ├── Authentication
│       ├── Students CRUD
│       ├── Payments CRUD
│       ├── Branches/Classes/Teachers CRUD
│       └── Health checks

├── services/
│   └── railway-logs.ts             # Railway logs service
│       ├── Fetch logs
│       ├── Stream logs
│       ├── Get deployment info
│       └── Mock data for dev

├── hooks/
│   └── useServerData.ts            # React hooks for data
│       ├── useServerData (generic)
│       ├── useStudents, usePayments, etc. (specific)
│       └── useMutation (POST/PUT/DELETE)

└── components/dev/
    └── ServerLogsPanel.tsx         # Logs UI component
        ├── Real-time logs display
        ├── Server health indicator
        ├── Deployment info panel
        └── Auto-refresh toggle
```

### Documentation Files

```
/
├── FRONTEND_DEV_INTEGRATION_SETUP.md      # Detailed setup
├── FRONTEND_DEV_QUICK_START.md            # Quick reference
├── RAILWAY_DEPLOYMENT_GUIDE.md            # Production deployment
├── INTEGRATION_COMPLETE_INDEX.md          # This file
└── frontend_for_dev/.env.example          # Environment template
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React/Vite)                 │
│                  frontend_for_dev                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Components         Hooks              Services         │
│  ├── Pages         ├── useStudents    ├── railway-logs │
│  ├── Forms         ├── usePayments    └── api-client   │
│  └── Logs Panel    └── useMutation                     │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                    API Client Layer                      │
│  • Token management                                      │
│  • Request/Response handling                             │
│  • Error handling & auto-logout                          │
│  • Base URL configuration                                │
└────────┬─────────────────────────────────────┬──────────┘
         │                                      │
         ▼                                      ▼
    ┌─────────────────┐            ┌──────────────────┐
    │  Backend API    │            │  Railway Logs    │
    │  (Go)           │            │  API             │
    │  :8080/api      │            │  api.railway.app │
    └─────────────────┘            └──────────────────┘
```

## Implementation Guide

### 1. Setup Phase (5 min)

```bash
# Create env file
cp frontend_for_dev/.env.example frontend_for_dev/.env.local

# Edit with your values
code frontend_for_dev/.env.local

# Install dependencies
cd frontend_for_dev
npm install
```

### 2. Development Phase

```bash
# Terminal 1: Backend
cd backend_school_crm
go run main.go

# Terminal 2: Frontend
cd frontend_for_dev
npm run dev
```

### 3. Integration Phase

Use the API client in your components:

```typescript
// Option A: Using hooks (recommended)
import { useStudents } from '@/hooks/useServerData'

function StudentsList() {
  const { data, loading, error } = useStudents(branchId)
  // ...
}

// Option B: Direct client
import { apiClient } from '@/lib/api-client'

const students = await apiClient.getStudents(branchId)
```

### 4. Logging Phase

Add logs panel to your dashboard:

```typescript
import { ServerLogsPanel } from '@/components/dev/ServerLogsPanel'

export function Dashboard() {
  return (
    <div>
      <ServerLogsPanel />
    </div>
  )
}
```

### 5. Production Phase

Deploy to Railway:

```bash
# Configure Railway (one-time)
# 1. Set VITE_RAILWAY_API_KEY
# 2. Set VITE_RAILWAY_PROJECT_ID
# 3. Update VITE_API_BASE_URL to production

# Build
npm run build

# Push to GitHub (triggers Railway auto-deploy)
git push origin main
```

## API Client Reference

### Authentication

```typescript
import { apiClient } from '@/lib/api-client'

// Login
const { token, user } = await apiClient.login(email, password)

// Token is automatically stored and sent with requests

// Check token
const token = apiClient.getToken()

// Logout
apiClient.clearToken()
```

### CRUD Operations

```typescript
// Students
const students = await apiClient.getStudents(branchId)
const student = await apiClient.getStudent(id)
const newStudent = await apiClient.createStudent(data)
await apiClient.updateStudent(id, data)
await apiClient.deleteStudent(id)

// Similar for: Payments, Branches, Classes, Teachers
```

### Health Check

```typescript
const health = await apiClient.healthCheck()
// { status: "healthy" }
```

## Hooks Reference

### Query Hooks

```typescript
// Fetch data
const { data, loading, error, refetch, isSuccess } = useStudents(branchId)

// Auto-refetch every 5 seconds
useStudents(branchId, { refetchInterval: 5000 })

// Skip initial fetch
useStudents(branchId, { skip: true })

// Callbacks
useStudents(branchId, {
  onSuccess: (data) => console.log('Loaded:', data),
  onError: (error) => console.error('Failed:', error)
})
```

### Mutation Hooks

```typescript
const { mutate, data, loading, error, reset } = useCreateStudent({
  onSuccess: (student) => {
    console.log('Created:', student)
    // Refetch list, etc.
  }
})

// Call mutation
await mutate({
  fullName: 'Ahmed Ali',
  classId: 'class-123',
  // ...
})

// Reset state
reset()
```

## Railway Configuration

### Get API Token

1. Go to https://railway.app/account/tokens
2. Create new token
3. Copy and set `VITE_RAILWAY_API_KEY`

### Get Project ID

1. Go to https://railway.app/project/[project-id]
2. Copy the project ID from URL or settings
3. Set `VITE_RAILWAY_PROJECT_ID`

### View Logs

```typescript
import { railwayLogsService } from '@/services/railway-logs'

// Fetch logs
const logs = await railwayLogsService.getLogs(50)

// Get deployment info
const deployment = await railwayLogsService.getDeployment()

// Test connection
const connected = await railwayLogsService.testConnection()
```

## Environment Variables

### Local Development

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_API_TIMEOUT=30000
VITE_RAILWAY_API_KEY=      # Optional for local
VITE_RAILWAY_PROJECT_ID=   # Optional for local
```

### Production (Railway)

```env
VITE_API_BASE_URL=https://your-backend.up.railway.app/api
VITE_API_TIMEOUT=30000
VITE_RAILWAY_API_KEY=your_token
VITE_RAILWAY_PROJECT_ID=your_project_id
```

## Common Tasks

### Create a New Page with Data

```typescript
import { useStudents } from '@/hooks/useServerData'
import { ServerLogsPanel } from '@/components/dev/ServerLogsPanel'

export default function StudentsPage() {
  const { data: students, loading, error } = useStudents(branchId)

  return (
    <div>
      <h1>Students</h1>
      
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      
      <ul>
        {students?.map(s => (
          <li key={s.id}>{s.fullName}</li>
        ))}
      </ul>

      <ServerLogsPanel />
    </div>
  )
}
```

### Handle API Errors

```typescript
import { useStudents } from '@/hooks/useServerData'

function MyComponent() {
  const { data, error, refetch } = useStudents(branchId, {
    onError: (error) => {
      if (error.message.includes('401')) {
        // Auto-logout handled by api-client
        console.log('Please login again')
      } else if (error.message.includes('500')) {
        console.error('Server error')
      }
    }
  })

  return (
    <div>
      {error && (
        <div className="error">
          {error.message}
          <button onClick={refetch}>Retry</button>
        </div>
      )}
    </div>
  )
}
```

### Create a Student

```typescript
import { useCreateStudent } from '@/hooks/useServerData'

function CreateStudentForm() {
  const { mutate, loading, error } = useCreateStudent({
    onSuccess: (student) => {
      console.log('Student created:', student)
      // Refresh list, navigate, etc.
    }
  })

  async function handleSubmit(e) {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    await mutate({
      fullName: formData.get('fullName'),
      classId: formData.get('classId'),
      phone: formData.get('phone'),
      // ... other fields
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="fullName" required />
      <input name="classId" required />
      {/* More fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create'}
      </button>
      {error && <p className="error">{error.message}</p>}
    </form>
  )
}
```

## Troubleshooting

### Backend Not Responding

```bash
# Check if backend is running
curl http://localhost:8080/api/health

# Check logs
cd backend_school_crm
go run main.go 2>&1 | tail -20
```

### CORS Errors

```typescript
// Error: Access to XMLHttpRequest... CORS policy

// Solution: Check backend CORS configuration
// In backend: internal/middleware/cors.go
// Should include frontend URL in CORS_ORIGINS

// Temporary local fix:
VITE_API_BASE_URL=http://localhost:8080/api
```

### Authentication Failed

```typescript
// Clear token
localStorage.removeItem('token')
apiClient.clearToken()

// Login again
await apiClient.login(email, password)

// Check token is stored
console.log(localStorage.getItem('token'))
```

### Railway Logs Not Showing

```typescript
// Check credentials
console.log(import.meta.env.VITE_RAILWAY_API_KEY)
console.log(import.meta.env.VITE_RAILWAY_PROJECT_ID)

// Test connection
import { railwayLogsService } from '@/services/railway-logs'
const connected = await railwayLogsService.testConnection()
console.log('Connected:', connected)
```

## Next Steps

1. ✅ Read FRONTEND_DEV_QUICK_START.md (10 min)
2. ✅ Set up environment variables
3. ✅ Start backend and frontend
4. ✅ Test API connection in console
5. ✅ Create first component with useStudents
6. ✅ Add ServerLogsPanel to dashboard
7. ✅ Configure Railway (production)
8. ✅ Deploy to Railway

## Support Resources

- Backend API: `/backend_school_crm/API_ENDPOINTS.txt`
- API Examples: `/API_USAGE_EXAMPLES.md`
- Backend Setup: `/BACKEND_SETUP.md`
- Integration Examples: `/BACKEND_INTEGRATION_SUMMARY.md`

## Summary

You now have:

✅ **API Client** - Complete TypeScript client for backend
✅ **Hooks** - React hooks for easy data fetching
✅ **Logs Service** - Real-time Railway logs access
✅ **UI Component** - Ready-to-use logs panel
✅ **Documentation** - Complete setup guides
✅ **Examples** - Working code patterns

Everything is ready for:
- Local development
- Production deployment
- Real-time monitoring
- Error tracking
