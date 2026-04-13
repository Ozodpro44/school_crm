# Railway Logging System - Complete Implementation Guide

## 📋 Overview

This guide implements a secure, scalable logging system that:
- Receives logs from Railway via Bearer Token authentication
- Stores logs in-memory (up to 10,000 entries with auto-rotation)
- Displays logs in a developer dashboard with filtering & search
- Supports real-time updates via polling
- Includes complete TypeScript types

## 🔧 Backend Setup

### 1. Environment Variables

Add to your `.env` file:

```bash
# Logs Token - used to authenticate log ingestion from Railway
LOGS_TOKEN="your-secure-random-token-here"

# Example: Generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For Railway deployment, set in Railway dashboard:
```
LOGS_TOKEN = your-secure-token
```

### 2. API Endpoints

#### POST /api/logs/ingest (Secure)

Receives logs from Railway. Requires `Authorization: Bearer {LOGS_TOKEN}` header.

**Request:**
```json
{
  "service": "api",
  "level": "info|warn|error|debug",
  "message": "string",
  "metadata": {
    "request_id": "string",
    "user_id": "string"
  }
}
```

**Response (201 Created):**
```json
{
  "status": "logged"
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `400 Bad Request`: Invalid JSON or missing required fields
- `500 Internal Server Error`: LOGS_TOKEN not configured

#### GET /api/logs (Public for dev)

Fetch all backend logs with optional filtering.

**Query Parameters:**
- `limit`: Max logs to return (1-1000, default: 100)
- `level`: Filter by level (info, warn, error)
- `module`: Filter by module (auth, payments, students, etc)

**Example:**
```bash
GET /api/logs?limit=50&level=error&module=auth
```

#### DELETE /api/logs (Admin only)

Clear all logs from memory.

---

## 🎨 Frontend Setup

### 1. Environment Variables

Add to `frontend_for_dev/.env.local`:

```bash
VITE_API_BASE_URL=http://localhost:8080/api
VITE_LOGS_TOKEN="your-secure-token-here"  # Same as backend LOGS_TOKEN
```

### 2. Log Service

The `LogService` automatically:
- Batches logs to reduce network overhead
- Sends logs asynchronously (every 5 seconds or when batch hits 10 logs)
- Silently fails without disrupting the app
- Flushes pending logs on unmount

**Usage Example:**
```typescript
import { getLogService } from "@/services/log-service";

const logService = getLogService();
logService?.info("User logged in", { userId: "123" });
logService?.error("Payment failed", { orderId: "456" });
logService?.warn("Cache miss on products");
```

### 3. Dashboard Features

Visit `/logs` in your developer dashboard to see:

- **Real-time Log Table**: Timestamp, Level, Module, Message
- **Filters**: By level (INFO/WARN/ERROR) and module
- **Search**: Full-text search across message and details
- **Export**: Download filtered logs as JSON
- **Details View**: Click any log to see full information
- **Color Coding**:
  - 🔵 INFO: Blue/Gray
  - 🟠 WARN: Orange
  - 🔴 ERROR: Red

---

## 🚀 Deployment on Railway

### Step 1: Configure Environment Variables

In Railway dashboard → Your Project → Variables:

```
LOGS_TOKEN = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL = postgresql://...
JWT_SECRET = xxxxxxxx
REDIS_URL = redis://...
```

### Step 2: Deploy Backend

```bash
cd backend_school_crm
git push railway main  # or your deployment method
```

Backend will be available at: `https://your-app.railway.app`

### Step 3: Deploy Frontend

```bash
cd frontend_for_dev
# Update .env.local with your Railway backend URL
VITE_API_BASE_URL=https://your-app.railway.app/api
VITE_LOGS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Deploy frontend (Vercel/Railway/Netlify)

### Step 4: Test Log Ingestion

```bash
curl -X POST https://your-app.railway.app/api/logs/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_LOGS_TOKEN" \
  -d '{
    "service": "api",
    "level": "info",
    "message": "Test log from Railway",
    "metadata": {
      "request_id": "req-123",
      "user_id": "user-456"
    }
  }'
```

Expected response:
```json
{
  "status": "logged"
}
```

---

## 📡 Sending Logs from Railway Services

### Docker Containers

Add logging to your Node.js application:

```javascript
// lib/logger.ts
async function sendToLogServer(
  level: string,
  message: string,
  metadata: Record<string, string> = {}
) {
  try {
    await fetch('https://your-app.railway.app/api/logs/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LOGS_TOKEN}`,
      },
      body: JSON.stringify({
        service: process.env.SERVICE_NAME || 'api',
        level,
        message,
        metadata: {
          ...metadata,
          hostname: os.hostname(),
          pid: process.pid.toString(),
        },
      }),
    });
  } catch (error) {
    console.error('Failed to send log:', error);
  }
}

export const logger = {
  info: (msg, meta) => sendToLogServer('info', msg, meta),
  warn: (msg, meta) => sendToLogServer('warn', msg, meta),
  error: (msg, meta) => sendToLogServer('error', msg, meta),
};
```

### Python Services

```python
import requests
import os

def log_to_server(level: str, message: str, metadata: dict = None):
    try:
        requests.post(
            f"{os.getenv('LOG_SERVER_URL')}/api/logs/ingest",
            headers={
                'Content-Type': 'application/json',
                'Authorization': f"Bearer {os.getenv('LOGS_TOKEN')}",
            },
            json={
                'service': os.getenv('SERVICE_NAME', 'worker'),
                'level': level,
                'message': message,
                'metadata': metadata or {},
            },
        )
    except Exception as e:
        print(f"Failed to send log: {e}")

# Usage
log_to_server('info', 'User created', {'user_id': '123'})
log_to_server('error', 'Payment failed', {'order_id': '456'})
```

---

## 🔐 Security Considerations

### 1. Token Rotation

**To rotate the LOGS_TOKEN:**

1. Generate new token:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Update in Railway dashboard and restart services

3. Update clients to use new token

4. Old logs remain intact (stored in memory)

### 2. Bearer Token Security

- Token is sent in `Authorization: Bearer` header (not in URL)
- Use HTTPS in production (Railway uses HTTPS by default)
- Token should be at least 32 bytes (256 bits)
- Never commit token to Git (use `.env` files)

### 3. Rate Limiting (Optional Enhancement)

Add rate limiting to prevent log flooding:

```go
// In main.go, add:
import "github.com/gin-contrib/ratelimit"

router.Use(ratelimit.RateLimiter(
  ratelimit.RateLimitHandler{
    NoKeyHandler: ratelimit.DefaultNoKeyHandler,
    KeyGetter: ratelimit.HeaderKeyGetter("Authorization"),
    Limit: 1000, // 1000 requests per second per token
  },
))
```

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Railway Services (API, Workers, Schedulers)             │
│ - Node.js                                               │
│ - Python                                                │
│ - Go                                                    │
│ All send logs via HTTP POST                             │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ POST /api/logs/ingest
                     │ Authorization: Bearer LOGS_TOKEN
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Backend (Go + Gin)                                      │
│ - Validates Bearer token                               │
│ - Stores logs in memory (rotate last 10,000)           │
│ - Exposes /api/logs for retrieval                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ GET /api/logs
                     │ (with JWT auth if needed)
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Frontend (React + TailwindCSS)                          │
│ - Developer Dashboard at /logs                          │
│ - Real-time polling every 5 seconds                     │
│ - Filters: Level, Module, Search                        │
│ - Export logs as JSON                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing

### Unit Test for Backend Endpoint

```go
// internal/handlers/logs_test.go
package handlers

import (
  "testing"
  "github.com/stretchr/testify/assert"
)

func TestIngestLogsHandler_ValidToken(t *testing.T) {
  // Test valid token acceptance
  handler := IngestLogsHandler("test-token-123")
  
  // Should return 201 Created
  assert.NotNil(t, handler)
}

func TestIngestLogsHandler_InvalidToken(t *testing.T) {
  // Test invalid token rejection
  handler := IngestLogsHandler("test-token-123")
  
  // Should return 401 Unauthorized
  assert.NotNil(t, handler)
}
```

### Manual Testing with cURL

```bash
# Valid request
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token-123" \
  -d '{
    "service": "api",
    "level": "info",
    "message": "Test message"
  }'

# Invalid token (should get 401)
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wrong-token" \
  -d '{
    "service": "api",
    "level": "info",
    "message": "Test message"
  }'

# Missing header (should get 401)
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "service": "api",
    "level": "info",
    "message": "Test message"
  }'
```

---

## 📈 Scaling Considerations

### Current Implementation (In-Memory)
- ✅ Fast (no database latency)
- ✅ Simple deployment
- ❌ Logs lost on restart
- ❌ Limited to single server
- ❌ No persistence

### To Scale to PostgreSQL

```go
// migrations/003_create_logs_table.sql
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service VARCHAR(50) NOT NULL,
  level VARCHAR(10) NOT NULL,
  module VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  request_id VARCHAR(50),
  user_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_service ON logs(service);
```

Then update IngestLogsHandler to insert into database instead of memory.

### To Scale with Redis

Use Redis as a message queue:

```go
import "github.com/redis/go-redis/v9"

// Queue log for processing
redisClient.LPush(ctx, "logs:queue", logPayload)

// Separate worker processes queue
// This allows decoupling log ingestion from storage
```

---

## 🔍 Troubleshooting

### Logs not appearing in dashboard

1. **Check LOGS_TOKEN is set**
   ```bash
   echo $LOGS_TOKEN
   ```

2. **Verify Bearer token format**
   ```
   Authorization: Bearer your-token-here
   ```

3. **Check backend is running**
   ```bash
   curl http://localhost:8080/health
   ```

4. **Check network in browser console**
   - Open DevTools → Network tab
   - Look for POST to `/api/logs/ingest`
   - Verify status 201 Created

### CORS errors in frontend

Frontend logs use direct fetch (not API client), so CORS should work.
If issues persist, ensure backend CORS middleware includes:

```go
router.Use(middleware.CORSMiddleware())
```

### Token validation failing

1. Ensure token has no whitespace:
   ```bash
   echo -n "your-token" | wc -c
   ```

2. Compare with environment variable:
   ```bash
   echo "$LOGS_TOKEN" | wc -c
   ```

3. Verify format in request header:
   ```
   Authorization: Bearer xxxxx
   ```

---

## 📝 API Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/logs/ingest` | POST | Bearer Token | Ingest logs from Railway |
| `/api/logs` | GET | None | Fetch stored logs |
| `/api/logs` | DELETE | None | Clear all logs |
| `/api/logs/railway` | GET | None | Fetch Railway deployment logs |

---

## 🎯 Next Steps

1. ✅ Set `LOGS_TOKEN` in Railway environment
2. ✅ Deploy backend changes
3. ✅ Update frontend `.env.local` with token
4. ✅ Deploy frontend
5. ✅ Test log ingestion from Railway services
6. ✅ Monitor logs in developer dashboard
7. Consider scaling to PostgreSQL for persistence
8. Add alerting based on log levels
