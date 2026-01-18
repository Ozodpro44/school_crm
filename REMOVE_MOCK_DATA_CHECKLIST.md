# Remove Mock Data - Migration Checklist

## Overview
This checklist helps you migrate each page from mock data to real API data.

## Completed ✅

- [x] **Logs Page** - `src/pages/Logs.tsx`
  - Fetches from Railway logs service
  - Falls back to mock logs if unavailable
  - Has loading and error states

## To Do - Pages with Mock Data

### Branches Page
- [ ] File: `src/pages/Branches.tsx`
- [ ] Steps:
  1. Import apiClient: `import { apiClient } from '@/services/api-client';`
  2. Replace mock data fetch with: `const branches = await apiClient.getBranches();`
  3. Add loading state
  4. Add error handling
  5. Test with real data

### Users Page
- [ ] File: `src/pages/Users.tsx`
- [ ] Steps:
  1. Import apiClient
  2. Replace mock data with: `const users = await apiClient.getUsers();`
  3. Add loading state
  4. Add error handling

### Dashboard Page
- [ ] File: `src/pages/Dashboard.tsx`
- [ ] Steps:
  1. Import apiClient
  2. Fetch branch data: `const branch = await apiClient.getBranch(branchId);`
  3. Fetch summary data as needed
  4. Add loading states
  5. Add error handling

### Analytics Page
- [ ] File: `src/pages/Analytics.tsx`
- [ ] Steps:
  1. Import apiClient
  2. Fetch payment summary: `const summary = await apiClient.getPaymentSummary(branchId);`
  3. Fetch expenses/salaries as needed
  4. Calculate metrics from real data
  5. Add loading states

### Settings Page
- [ ] File: `src/pages/Settings.tsx`
- [ ] Steps:
  1. Import apiClient
  2. Fetch current user: `const user = await apiClient.getUser(userId);`
  3. Update user on save: `await apiClient.updateUser(userId, data);`
  4. Add loading states
  5. Add success/error messages

### Subscriptions Page
- [ ] File: `src/pages/Subscriptions.tsx`
- [ ] Steps:
  1. Check if this uses real backend endpoints
  2. If yes, implement API calls
  3. If no (payment system feature), keep mock or implement payment logic

### Notifications Page
- [ ] File: `src/pages/Notifications.tsx`
- [ ] Steps:
  1. Determine if notifications come from API
  2. If yes, create notifications service
  3. Add real-time notification handling if needed
  4. Test notification updates

### Incidents Page
- [ ] File: `src/pages/Incidents.tsx`
- [ ] Steps:
  1. Check if incidents are tracked in backend
  2. Create/update incidents via API
  3. Fetch incident history from API
  4. Add real-time updates if needed

## Template for Migration

Use this template for each page:

```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '@/services/api-client';
import { toast } from 'sonner';

export default function YourPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Fetch function
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.getYourData();  // Replace with actual method
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Handle create
  const handleCreate = async (newItem) => {
    try {
      const result = await apiClient.createYourData(newItem);
      setData([...data, result]);
      toast.success('Created successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create';
      toast.error(message);
    }
  };

  // Handle update
  const handleUpdate = async (id, updates) => {
    try {
      const result = await apiClient.updateYourData(id, updates);
      setData(data.map(item => item.id === id ? result : item));
      toast.success('Updated successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update';
      toast.error(message);
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    try {
      await apiClient.deleteYourData(id);
      setData(data.filter(item => item.id !== id));
      toast.success('Deleted successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete';
      toast.error(message);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    // Your JSX here
  );
}
```

## Common Patterns

### Fetch with Branch Context
```typescript
const branchId = localStorage.getItem('current_branch_id');
const data = await apiClient.getStudents(branchId);
```

### Fetch with User Context
```typescript
const userId = localStorage.getItem('user_id');
const user = await apiClient.getUser(userId);
```

### Refresh Data
```typescript
const handleRefresh = () => {
  fetchData();
};
```

### Pagination (when API supports it)
```typescript
const [page, setPage] = useState(1);
const [limit, setLimit] = useState(10);

useEffect(() => {
  fetchData();
}, [page, limit]);

const fetchData = async () => {
  const result = await apiClient.getStudents(branchId);
  // Implement pagination on frontend for now
  const paginated = result.slice((page - 1) * limit, page * limit);
  setData(paginated);
};
```

## Testing Your Changes

1. **Test with real backend running locally**
   ```bash
   cd backend_school_crm
   go run main.go
   ```

2. **Start frontend dev server**
   ```bash
   cd frontend_for_dev
   npm run dev
   ```

3. **Check browser console for errors**
   - Open DevTools (F12)
   - Go to Console tab
   - Look for API errors

4. **Test CRUD operations**
   - Create a new item
   - Edit an existing item
   - Delete an item
   - Verify changes appear immediately

## Rollback Plan

If you encounter issues:

1. **Keep mock data as fallback**
   ```typescript
   try {
     const result = await apiClient.getData();
     setData(result);
   } catch (error) {
     setData(mockData);  // Fallback
     toast.error('Using offline data');
   }
   ```

2. **Use feature flag**
   ```typescript
   const useMockData = import.meta.env.VITE_USE_MOCK_DATA === 'true';
   const data = useMockData ? mockData : await apiClient.getData();
   ```

## Git Workflow

For each page migration:

```bash
# Create feature branch
git checkout -b migrate/remove-mock-data-{page-name}

# Make changes
# Update page to use API

# Test
npm run dev

# Commit
git add .
git commit -m "feat: remove mock data from {page-name}"

# Push
git push origin migrate/remove-mock-data-{page-name}

# Create PR for review
```

## Progress Tracking

| Page | Status | Assigned To | PR | Notes |
|------|--------|-------------|-----|-------|
| Logs | ✅ Done | - | - | Uses Railway logs |
| Branches | ⬜ Todo | - | - | |
| Users | ⬜ Todo | - | - | |
| Dashboard | ⬜ Todo | - | - | |
| Analytics | ⬜ Todo | - | - | |
| Settings | ⬜ Todo | - | - | |
| Subscriptions | ⬜ Todo | - | - | |
| Notifications | ⬜ Todo | - | - | |
| Incidents | ⬜ Todo | - | - | |

## Questions?

See:
- `FRONTEND_FOR_DEV_SETUP.md` - Complete setup guide
- `QUICK_START_FRONTEND_REAL_DATA.md` - Quick reference
- `src/services/api-client.ts` - All available API methods
