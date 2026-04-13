# Quick Integration Reference Card

## Setup (Copy & Paste)

```bash
# 1. Setup environment
cp frontend_for_dev/.env.example frontend_for_dev/.env.local

# 2. Install dependencies
cd frontend_for_dev && npm install

# 3. Terminal 1: Start backend
cd backend_school_crm && go run main.go

# 4. Terminal 2: Start frontend
cd frontend_for_dev && npm run dev
```

## Common Code Snippets

### Fetch Students List
```typescript
import { useStudents } from '@/hooks/useServerData'

const { data: students, loading } = useStudents(branchId)
```

### Create Student
```typescript
import { useCreateStudent } from '@/hooks/useServerData'

const { mutate } = useCreateStudent({
  onSuccess: () => console.log('Created!')
})

await mutate({ fullName, classId, phone, branchId })
```

### Fetch Payments
```typescript
import { usePayments } from '@/hooks/useServerData'

const { data: payments } = usePayments(branchId)
```

### Direct API Call
```typescript
import { apiClient } from '@/lib/api-client'

await apiClient.login(email, password)
const students = await apiClient.getStudents(branchId)
```

### Show Logs Panel
```typescript
import { ServerLogsPanel } from '@/components/dev/ServerLogsPanel'

<ServerLogsPanel />
```

## Environment Variables

```env
# Required
VITE_API_BASE_URL=http://localhost:8080/api

# Optional (Production)
VITE_RAILWAY_API_KEY=your_key
VITE_RAILWAY_PROJECT_ID=your_id
```

## API Endpoints

```
GET /students?branchId={id}          - List students
POST /students                        - Create student
PUT /students/{id}                    - Update student
DELETE /students/{id}                 - Delete student

GET /payments?branchId={id}           - List payments
POST /payments                        - Create payment
PUT /payments/{id}                    - Update payment

Similar for: /classes, /teachers, /branches
```

## Hook Signatures

```typescript
// Query
useStudents(branchId, options?)
useStudent(id, options?)
usePayments(branchId, options?)
usePaymentSummary(branchId, options?)
useBranches(options?)
useClasses(branchId, options?)
useTeachers(branchId, options?)

// Mutation
useCreateStudent(options?)
useUpdateStudent(options?)
useDeleteStudent(options?)
useCreatePayment(options?)
useUpdatePayment(options?)
useDeletePayment(options?)

// Returns: { data, loading, error, refetch }
// Mutation returns: { mutate, data, loading, error }
```

## Test Connection

```javascript
// Browser console
import { apiClient } from './src/lib/api-client'

// Health check
await apiClient.healthCheck()

// Login
await apiClient.login('test@example.com', 'password')

// Get token
apiClient.getToken()
```

## Debug Tips

```typescript
// Check API URL
console.log(import.meta.env.VITE_API_BASE_URL)

// Check token
console.log(localStorage.getItem('token'))

// Clear token
localStorage.removeItem('token')

// Check logs
const logs = await railwayLogsService.getLogs(50)
console.log(logs)
```

## File Locations

```
frontend_for_dev/
├── src/lib/api-client.ts          ← API client
├── src/services/railway-logs.ts   ← Logs service
├── src/hooks/useServerData.ts     ← Data hooks
├── src/components/dev/
│   └── ServerLogsPanel.tsx        ← Logs UI
└── .env.local                      ← Configuration
```

## Production Deployment

```bash
# Build
npm run build

# Test build
npm run preview

# Deploy to Railway (auto from GitHub)
git push origin main
```

## Railway Setup

1. Get API token: https://railway.app/account/tokens
2. Get Project ID: https://railway.app/project/[id]
3. Update `.env.local`:
   ```env
   VITE_RAILWAY_API_KEY=your_token
   VITE_RAILWAY_PROJECT_ID=your_project_id
   ```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend not responding | `curl http://localhost:8080/api/health` |
| CORS error | Check backend CORS_ORIGINS includes frontend URL |
| 401 Unauthorized | Token expired, login again |
| API not found | Check `VITE_API_BASE_URL` is correct |
| Railway logs empty | Check API key and Project ID |

## Full Documentation

- FRONTEND_DEV_QUICK_START.md
- FRONTEND_DEV_INTEGRATION_SETUP.md
- RAILWAY_DEPLOYMENT_GUIDE.md
- INTEGRATION_COMPLETE_INDEX.md
- backend_school_crm/API_ENDPOINTS.txt
