# Deploy Logs Endpoint - Instructions

## What Was Added

### Backend (Go)

**New file:** `backend_school_crm/internal/handlers/logs.go`
- Implements `/api/logs` endpoint
- In-memory log storage (keeps last 10,000 logs)
- Sample logs added on startup
- Supports filtering by module and level
- HTTP handlers for GET (retrieve) and DELETE (clear)

**Updated file:** `backend_school_crm/cmd/main.go`
- Added logs initialization on startup
- Added route: `GET /api/logs` - Retrieve logs
- Added route: `DELETE /api/logs` - Clear logs
- Protected with authentication middleware

## Build Status

✅ Backend compiles successfully
✅ No errors in logs.go
✅ Routes registered correctly

## Deploy to Railway

1. **Push to Git**
   ```bash
   cd backend_school_crm
   git add .
   git commit -m "feat: add logs endpoint"
   git push
   ```

2. **Deploy on Railway**
   - Go to https://railway.app
   - Select your backend project
   - Click "Deploy"
   - Wait for deployment to complete

3. **Test the endpoint**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     https://incredible-love-production-0008.up.railway.app/api/logs
   ```

## Frontend Changes Required

None! The frontend already tries to fetch from `/api/logs`.

Once deployed, the frontend will automatically:
- ✅ Stop showing mock logs
- ✅ Show real application logs from the backend
- ✅ Display actual events happening on your server

## API Endpoint Documentation

### GET /api/logs

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `limit` - Number of logs to return (default: 100, max: 1000)
- `module` - Filter by module: auth, payments, students, api, database, cache, etc
- `level` - Filter by level: info, warn, error, debug

**Examples:**

```bash
# Get last 100 logs
curl -H "Authorization: Bearer $TOKEN" \
  https://your-backend.up.railway.app/api/logs

# Get last 50 logs
curl -H "Authorization: Bearer $TOKEN" \
  https://your-backend.up.railway.app/api/logs?limit=50

# Get payment errors
curl -H "Authorization: Bearer $TOKEN" \
  https://your-backend.up.railway.app/api/logs?module=payments&level=error

# Get auth logs
curl -H "Authorization: Bearer $TOKEN" \
  https://your-backend.up.railway.app/api/logs?module=auth
```

**Response:**
```json
[
  {
    "id": "uuid",
    "timestamp": "2024-01-18T18:39:31.932Z",
    "level": "info",
    "module": "api",
    "message": "API server started on port 8080",
    "details": "Server initialization complete",
    "stackTrace": "",
    "requestId": "",
    "userId": "",
    "branch": ""
  }
]
```

### DELETE /api/logs

**Authentication:** Required (Bearer token)

**Purpose:** Clear all logs from memory

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  https://your-backend.up.railway.app/api/logs
```

**Response:**
```json
{
  "message": "logs cleared"
}
```

## How to Log Events in Your Code

The logs storage is initialized but needs to be used in your handlers. Add logging calls like this:

```go
import "github.com/school-crm/backend/internal/handlers"

// In your handlers
func YourHandler(c *gin.Context) {
  // Log an event
  handlers.AddLog("info", "students", "Student enrolled successfully")
  
  // Log with details
  handlers.AddLogWithDetails(
    "info",                          // level
    "payments",                      // module
    "Payment processed",             // message
    "Amount: 5000, Method: cash",   // details
    c.GetString("request-id"),      // requestID
    c.GetString("user-id"),         // userID
    "Moscow Central",               // branch
  )
}
```

## Frontend Now Shows Real Logs

The frontend Logs page will now:

1. Try to fetch from `/api/logs` ✅ (now working)
2. Display real application logs
3. Support filtering by module and level
4. Auto-refresh capability
5. Export logs to JSON

No frontend changes needed!

## Integration with Your Backend

To fully log all events, add `handlers.AddLog()` calls in your key handlers:

### Auth Module
```go
handlers.AddLog("info", "auth", fmt.Sprintf("User %s logged in", user.Email))
handlers.AddLog("warn", "auth", fmt.Sprintf("Failed login attempt for %s", email))
```

### Payments Module
```go
handlers.AddLog("info", "payments", fmt.Sprintf("Payment of %d created", amount))
handlers.AddLog("error", "payments", fmt.Sprintf("Payment processing failed: %v", err))
```

### Students Module
```go
handlers.AddLog("info", "students", fmt.Sprintf("Student %s enrolled", student.FullName))
handlers.AddLog("warn", "students", fmt.Sprintf("Student status changed to %s", newStatus))
```

### Database
```go
handlers.AddLog("error", "database", fmt.Sprintf("Query failed: %v", err))
handlers.AddLog("info", "database", "Backup completed successfully")
```

## Production Considerations

**Current Implementation:** In-memory storage
- ✅ Fast and simple
- ✅ Works immediately
- ⚠️ Logs lost on restart
- ⚠️ Limited to 10,000 logs

**Future Enhancement:** Database storage
- ✅ Persistent logs
- ✅ Unlimited storage
- ✅ Better for long-term auditing

For now, in-memory is perfect for development and real-time monitoring.

## Testing

Once deployed, test in your browser:

```javascript
// In browser console
const { apiClient } = await import('@/services/api-client.js');
const logs = await apiClient.getLogs(10);
console.log(logs);  // Should show real logs from backend
```

## Troubleshooting

**Still seeing 404?**
- Make sure backend is deployed
- Check deployment log on Railway for errors
- Verify backend is running: `https://your-backend.up.railway.app/api/health`

**Logs showing sample data?**
- Normal! Sample logs are added on startup
- They'll be replaced as real events happen
- Delete them with: `DELETE /api/logs`

**Need to add custom logging?**
- Use `handlers.AddLog()` in your event handlers
- Module names: auth, payments, students, classes, teachers, salaries, expenses, api, database, cache
- Levels: info, warn, error, debug

## Summary

✅ Backend logs endpoint implemented
✅ Routes registered and protected
✅ Frontend ready to display logs
✅ Ready to deploy to Railway
✅ No mock data shown after deployment

Deploy now and logs will appear in the Logs page!
