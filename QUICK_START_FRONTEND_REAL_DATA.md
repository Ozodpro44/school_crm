# Quick Start - Frontend Real Data

## 30-Second Setup

### 1. Update Backend URL
```bash
# Edit frontend_for_dev/.env.local
VITE_API_BASE_URL=http://localhost:8080/api  # or your Railway URL
```

### 2. Start Dev Server
```bash
cd frontend_for_dev
npm run dev
```

### 3. Done!
All pages automatically use real backend data via `apiClient`

## Using API in Your Code

### Fetch Data
```typescript
import { apiClient } from '@/services/api-client';

const students = await apiClient.getStudents(branchId);
const payments = await apiClient.getPayments(branchId);
const branches = await apiClient.getBranches();
```

### Create Data
```typescript
await apiClient.createStudent({
  fullName: 'Ahmed Ali',
  classId: 'class-uuid',
  phone: '998901234567',
  parentPhone: '998909876543',
  monthlyPayment: 100000,
  status: 'active',
  branchId: branchId,
});
```

### Update Data
```typescript
await apiClient.updateStudent(studentId, {
  monthlyPayment: 120000,
  status: 'active',
});
```

### Delete Data
```typescript
await apiClient.deleteStudent(studentId);
```

## Login

```typescript
const { token, user } = await apiClient.login('email@example.com', 'password');
// Token is auto-saved to localStorage
```

## Logout

```typescript
apiClient.clearToken();
// Token is removed, next request will fail with 401
```

## Error Handling

```typescript
try {
  const result = await apiClient.getStudents(branchId);
  setData(result);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  toast.error(message);  // Show user-friendly error
}
```

## Loading States

```typescript
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  try {
    setLoading(true);
    const result = await apiClient.getStudents(branchId);
    setData(result);
  } finally {
    setLoading(false);  // Always runs
  }
};
```

## Check API Connection

```typescript
// In browser console
await apiClient.healthCheck()
// Should return: {data: {status: "healthy"}, error: null, message: ""}
```

## All Available Methods

### Students
- getStudents(branchId)
- getStudent(id)
- createStudent(data)
- updateStudent(id, data)
- deleteStudent(id)

### Payments
- getPayments(branchId?, studentId?, month?, year?)
- getPayment(id)
- getPaymentSummary(branchId)
- createPayment(data)
- updatePayment(id, data)
- deletePayment(id)

### Branches
- getBranches()
- getBranch(id)
- createBranch(data)
- updateBranch(id, data)
- deleteBranch(id)

### Classes
- getClasses(branchId)
- getClass(id)
- createClass(data)
- updateClass(id, data)
- deleteClass(id)

### Teachers
- getTeachers(branchId)
- getTeacher(id)
- createTeacher(data)
- updateTeacher(id, data)
- deleteTeacher(id)

### Salaries
- getSalaries(branchId)
- getSalary(id)
- createSalary(data)
- updateSalary(id, data)
- deleteSalary(id)

### Expenses
- getExpenses(branchId)
- getExpense(id)
- createExpense(data)
- deleteExpense(id)

### Users
- getUsers()
- getUser(id)
- updateUser(id, data)
- deleteUser(id)

### Auth
- login(email, password)
- register(data)

## Fallback Behavior

If backend is unavailable:
- Logs page falls back to mock data
- Other pages show error messages
- User is redirected to login on 401 error

## Environment Variables

```env
# Required
VITE_API_BASE_URL=http://localhost:8080/api

# Optional
VITE_API_TIMEOUT=30000  # Request timeout in ms
VITE_RAILWAY_API_KEY=   # For Railway logs
VITE_RAILWAY_PROJECT_ID=# For Railway logs

# Dev only
VITE_DEV_MODE=true
VITE_DEBUG_API=false
```

## Tips

✅ Always await API calls
✅ Wrap in try/catch or .catch()
✅ Use loading states for UX
✅ Check browser console for network errors
✅ Token is auto-managed (login/logout)
✅ 30-second timeout on all requests

## Troubleshooting

**API Connection Error?**
- Check VITE_API_BASE_URL in .env.local
- Verify backend is running: `http://localhost:8080/api/health`

**401 Unauthorized?**
- Login again: `await apiClient.login(email, password)`
- Check token expiration in backend

**CORS Error?**
- Configure backend CORS for your frontend URL
- Check backend .env CORS_ALLOWED_ORIGINS

See `FRONTEND_FOR_DEV_SETUP.md` for detailed docs.
