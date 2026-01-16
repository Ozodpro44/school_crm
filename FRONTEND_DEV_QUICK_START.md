# Frontend Dev - Quick Start Integration

## Step 1: Configure Environment

Edit `frontend_for_dev/.env.local`:

```env
# Backend API Configuration
VITE_API_BASE_URL=http://localhost:8080/api
VITE_API_TIMEOUT=30000

# Railway Configuration (optional - for production logs)
VITE_RAILWAY_API_KEY=your_railway_api_key_here
VITE_RAILWAY_PROJECT_ID=your_railway_project_id_here
```

## Step 2: Install Dependencies

```bash
cd frontend_for_dev
npm install
```

## Step 3: Start Backend

Make sure the backend is running:

```bash
cd backend_school_crm
go run main.go
# or with make
make run
```

The backend should be accessible at: `http://localhost:8080/api`

## Step 4: Start Frontend Dev

```bash
cd frontend_for_dev
npm run dev
```

Frontend will run on: `http://localhost:5173` (or next available port)

## Step 5: Test API Connection

Open browser console and run:

```javascript
// Import the API client
import { apiClient } from './src/lib/api-client'

// Test health check
await apiClient.healthCheck()
// Expected: { status: "healthy" }

// Test login (use your test credentials)
await apiClient.login('admin@example.com', 'password123')
// Expected: { token: "...", user: {...} }
```

## Step 6: Access Logs & Monitoring

### Local Development Logs
1. Open Browser DevTools (F12)
2. Go to Console tab
3. Check network requests in Network tab
4. Use the ServerLogsPanel component in your dashboard

### Production Logs (Railway)

1. Get your Railway credentials:
   - Go to https://railway.app/dashboard
   - Select your project
   - Go to Settings → API Tokens
   - Create new token
   - Copy the token

2. Get your Project ID:
   - In Railway dashboard, copy Project ID from URL or settings

3. Update `.env.local`:
   ```env
   VITE_RAILWAY_API_KEY=your_new_token
   VITE_RAILWAY_PROJECT_ID=your_project_id
   ```

4. Restart frontend dev server

5. View logs in ServerLogsPanel component

## Step 7: Create Your First API Call

Example component using the API client:

```typescript
import { useStudents } from '@/hooks/useServerData'
import { apiClient } from '@/lib/api-client'

export function StudentsList() {
  const branchId = 'your-branch-id'
  const { data: students, loading, error } = useStudents(branchId)

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <ul>
      {students?.map(student => (
        <li key={student.id}>{student.fullName}</li>
      ))}
    </ul>
  )
}
```

## Step 8: Available Hooks

Pre-built hooks for common operations:

```typescript
// Queries
useStudents(branchId)
useStudent(studentId)
usePayments(branchId)
usePaymentSummary(branchId)
useBranches()
useClasses(branchId)
useTeachers(branchId)

// Mutations
useCreateStudent()
useUpdateStudent()
useDeleteStudent()
useCreatePayment()
useUpdatePayment()
useDeletePayment()
```

## Step 9: Direct API Client Usage

For custom API calls:

```typescript
import { apiClient } from '@/lib/api-client'

// Login
const { token, user } = await apiClient.login(email, password)

// Get students
const students = await apiClient.getStudents(branchId)

// Create student
const student = await apiClient.createStudent({
  fullName: 'Ahmed Ali',
  classId: 'class-123',
  phone: '998901234567',
  parentPhone: '998909876543',
  monthlyPayment: 100000,
  status: 'active',
  branchId: 'branch-123'
})

// Update student
await apiClient.updateStudent(studentId, { status: 'left' })

// Delete student
await apiClient.deleteStudent(studentId)
```

## Step 10: Troubleshooting

### Backend not responding
```bash
# Check if backend is running
curl http://localhost:8080/api/health

# If not, restart backend
cd backend_school_crm
go run main.go
```

### CORS errors
- Backend CORS must allow frontend URL
- Check backend `.env` for CORS_ORIGINS setting
- Should include: `http://localhost:5173`

### Authentication errors
```javascript
// Clear stored token
localStorage.removeItem('token')

// Login again
await apiClient.login(email, password)
```

### Railway logs not showing
- Verify API key and Project ID are correct
- Check Railway project settings
- Try in production deployment first

## File Structure

```
frontend_for_dev/
├── src/
│   ├── lib/
│   │   └── api-client.ts          # API client singleton
│   ├── services/
│   │   └── railway-logs.ts         # Railway logs service
│   ├── hooks/
│   │   └── useServerData.ts        # Custom data hooks
│   ├── components/
│   │   └── dev/
│   │       └── ServerLogsPanel.tsx # Logs display component
│   └── ...
├── .env.local                       # Environment config
└── package.json
```

## Backend URL Reference

| Environment | URL |
|---|---|
| Local Development | `http://localhost:8080/api` |
| Production (Railway) | Set via `VITE_API_BASE_URL` |

## Next Steps

1. ✅ Configure environment
2. ✅ Start backend
3. ✅ Start frontend
4. ✅ Test API connection
5. ✅ Build your pages using hooks
6. ✅ Deploy to Railway

## Support

Check these files for more details:
- `/FRONTEND_DEV_INTEGRATION_SETUP.md` - Detailed setup guide
- `/backend_school_crm/API_ENDPOINTS.txt` - Backend API reference
- `/API_USAGE_EXAMPLES.md` - API usage examples
