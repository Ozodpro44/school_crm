# Logs Page - Real Data Setup

## Current Status

The Logs page now displays **mock logs by default** and has a 3-tier fallback system to show real logs.

## How It Works

The frontend tries to fetch logs in this order:

### 1. Backend API (Recommended) ⭐
```
GET /api/logs
GET /api/logs?module=payments
GET /api/logs?level=error
```

**Status:** Not yet implemented in backend
**Expected:** Real application logs from your Go backend
**Requires:** Backend to add `/api/logs` endpoint

### 2. Railway API (Fallback)
Fetches logs from Railway deployment using GraphQL API.

**Status:** Configured but requires credentials
**Expected:** Deployment logs from Railway
**Requires:** 
- `VITE_RAILWAY_API_KEY` - Railway API token
- `VITE_RAILWAY_PROJECT_ID` - Railway project ID

### 3. Mock Logs (Last Resort)
Hardcoded sample logs for development/testing.

**Status:** Active now
**Shows:** Sample payment, auth, student logs

## What You're Seeing

Since the backend endpoint isn't implemented yet, the frontend is using **mock logs**, which show:
- Sample student enrollment logs
- Payment processing logs
- Authentication events
- Database queries
- API requests

These are realistic examples but not real data.

## To Show Real Logs

Choose one option:

### Option A: Implement Backend Logs Endpoint (Best)

See `BACKEND_LOGS_ENDPOINT.md` for complete implementation guide.

Quick steps:
1. Add logs table to database (or use in-memory)
2. Create `GET /api/logs` endpoint in your Go backend
3. Deploy backend
4. Frontend will automatically fetch real logs

Example response:
```json
[
  {
    "id": "uuid",
    "timestamp": "2024-01-18T18:39:31.932Z",
    "level": "INFO",
    "module": "backend",
    "message": "API server started on port 8080"
  }
]
```

### Option B: Configure Railway Credentials

If you prefer to use Railway's logs API:

1. Get credentials:
   - API Key: https://railway.app → Account Settings → Tokens
   - Project ID: https://railway.app → Project Settings

2. Update `.env.local`:
   ```env
   VITE_RAILWAY_API_KEY=your_token_here
   VITE_RAILWAY_PROJECT_ID=your_project_id_here
   ```

3. Refresh page

**Note:** Railway API has CORS restrictions, so backend API is recommended.

## Frontend Code Changes

The frontend now has smart fallback logic:

```typescript
// Try backend first
const backendLogs = await apiClient.getLogs(100);
if (backendLogs.length > 0) {
  // Use real backend logs
  setLogData(convertedLogs);
  return;
}

// Try Railway next
if (railwayApiKey && railwayProjectId) {
  const railwayLogs = await railwayLogsService.getLogs(100);
  // Use Railway logs
  setLogData(convertedLogs);
  return;
}

// Fall back to mock logs
setLogData(mockLogs);
```

## API Client Methods

New methods added to `apiClient`:

```typescript
// Get all logs
apiClient.getLogs(limit?: number)

// Get logs by module
apiClient.getLogsByModule('payments', limit?: number)

// Get logs by level
apiClient.getLogsByLevel('error', limit?: number)
```

## Testing

### Check what's being fetched
1. Open DevTools (F12)
2. Go to Console tab
3. Check network tab for API calls
4. Look for: `/api/logs`, Railway API calls, or mock logs

### Manual test
```javascript
// In browser console
const { apiClient } = await import('/src/services/api-client.js');
const logs = await apiClient.getLogs(10);
console.log(logs);
```

## Next Steps

1. **Immediate:** Keep using mock logs (working fine)
2. **Short term:** Implement backend `/api/logs` endpoint (see guide)
3. **Deploy:** Once backend implemented, real logs will appear automatically
4. **Optional:** Add Railway credentials for backup

## Files Modified

- `frontend_for_dev/src/pages/Logs.tsx` - Smart fallback logic
- `frontend_for_dev/src/services/api-client.ts` - Added getLogs methods

## Files Created

- `BACKEND_LOGS_ENDPOINT.md` - Complete backend implementation guide

## Build Status

✅ Builds successfully
✅ No TypeScript errors
✅ No runtime errors
✅ Works with mock logs now
✅ Ready for backend implementation

## Timeline

- **Now:** Mock logs working
- **After backend implementation:** Real logs automatically appear
- **No frontend changes needed** once backend is ready

See `BACKEND_LOGS_ENDPOINT.md` for detailed implementation instructions.
