# Frontend For Dev - Real Data Setup

## Overview

The `frontend_for_dev` project has been configured to use **real data** from:
1. Your backend API (running locally or on Railway)
2. Railway logs for deployment monitoring

## Configuration

### 1. Backend API Connection

Edit `.env.local` in `frontend_for_dev/`:

```env
# Local Development (Backend running locally)
VITE_API_BASE_URL=http://localhost:8080/api

# Production (Railway)
VITE_API_BASE_URL=https://your-app.railway.app/api
```

### 2. Railway Logs Configuration (Optional)

To stream real logs from Railway deployment:

1. Get your Railway API Key:
   - Go to https://railway.app
   - Settings → Account → Tokens
   - Create new token and copy it

2. Get your Railway Project ID:
   - Go to https://railway.app
   - Select your project
   - Settings → Get ID

3. Add to `.env.local`:
```env
VITE_RAILWAY_API_KEY=your_token_here
VITE_RAILWAY_PROJECT_ID=your_project_id
```

## API Client Usage

The project uses a centralized `apiClient` for all backend requests.

### Example: Fetching Students

```typescript
import { apiClient } from '@/services/api-client';

// Fetch students for a branch
const students = await apiClient.getStudents(branchId);

// Create a student
await apiClient.createStudent({
  fullName: 'John Doe',
  classId: 'class-id',
  phone: '998901234567',
  parentPhone: '998909876543',
  monthlyPayment: 100000,
  status: 'active',
  branchId: branchId,
});
```

### Example: Authentication

```typescript
// Login
const { token, user } = await apiClient.login('email@example.com', 'password');

// Token is automatically saved to localStorage
// Subsequent requests include the token automatically

// Logout
apiClient.clearToken();
```

## API Methods Available

### Authentication
- `login(email, password)`
- `register(data)`

### Students
- `getStudents(branchId)`
- `getStudent(id)`
- `createStudent(data)`
- `updateStudent(id, data)`
- `deleteStudent(id)`

### Payments
- `getPayments(branchId, studentId, month, year)`
- `getPayment(id)`
- `getPaymentSummary(branchId)`
- `createPayment(data)`
- `updatePayment(id, data)`
- `deletePayment(id)`

### Branches
- `getBranches()`
- `getBranch(id)`
- `createBranch(data)`
- `updateBranch(id, data)`
- `deleteBranch(id)`

### Classes
- `getClasses(branchId)`
- `getClass(id)`
- `createClass(data)`
- `updateClass(id, data)`
- `deleteClass(id)`

### Teachers
- `getTeachers(branchId)`
- `getTeacher(id)`
- `createTeacher(data)`
- `updateTeacher(id, data)`
- `deleteTeacher(id)`

### Salaries
- `getSalaries(branchId)`
- `getSalary(id)`
- `createSalary(data)`
- `updateSalary(id, data)`
- `deleteSalary(id)`

### Expenses
- `getExpenses(branchId)`
- `getExpense(id)`
- `createExpense(data)`
- `deleteExpense(id)`

### Users
- `getUsers()`
- `getUser(id)`
- `updateUser(id, data)`
- `deleteUser(id)`

## Removing Mock Data

Pages that used mock data:
- `src/pages/Logs.tsx` - Now fetches from Railway logs

To update other pages to use real data:

1. Import the API client:
```typescript
import { apiClient } from '@/services/api-client';
```

2. Replace mock data with API calls:
```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchData();
}, []);

const fetchData = async () => {
  try {
    setLoading(true);
    const result = await apiClient.getEndpoint(params);
    setData(result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    setLoading(false);
  }
};
```

## Debugging

Enable API debugging in `.env.local`:
```env
VITE_DEBUG_API=true
```

This will log all API requests and responses to the browser console.

## Error Handling

The API client automatically:
- Handles authentication errors (401) by clearing token and redirecting to login
- Provides timeout protection (default 30 seconds)
- Converts errors to readable messages

## Development vs Production

### Local Development
- Backend: `http://localhost:8080/api`
- Logs: Mock data (fallback)
- Railway logging: Optional

### Production (Railway)
- Backend: `https://your-app.railway.app/api`
- Logs: Real Railway logs
- All data: Real backend data

## Next Steps

1. Update `.env.local` with your backend URL
2. Add Railway credentials (optional for logs)
3. Test API connection by checking browser console
4. Update remaining pages to use `apiClient` instead of mock data
5. Deploy to Railway

## Troubleshooting

### API Connection Failed
- Check `VITE_API_BASE_URL` matches your backend URL
- Verify backend is running
- Check browser console for network errors

### No Logs Appearing
- Verify `VITE_RAILWAY_API_KEY` and `VITE_RAILWAY_PROJECT_ID` are set
- Check Railway token has correct permissions
- Fallback mock logs will appear if credentials are invalid

### CORS Errors
- Ensure backend has CORS configured for your frontend URL
- Check backend `.env` for CORS_ALLOWED_ORIGINS

## Related Files

- `.env.local` - Environment configuration
- `src/services/api-client.ts` - API client implementation
- `src/config/api.ts` - Configuration constants
- `src/pages/Logs.tsx` - Example of real data integration
