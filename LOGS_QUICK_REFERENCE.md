# Log Ingestion - Quick Reference Card

## 🚀 Generate Token

```bash
openssl rand -base64 32
# Output: eXvK7pL9mNq8xR2wB4cD5fG6hJ1kL2oP3sT4uV5xY6zA=
```

## 📋 Configuration Checklist

```bash
# 1. Railway Dashboard → Variables
LOGS_TOKEN=eXvK7pL9mNq8xR2wB4cD5fG6hJ1kL2oP3sT4uV5xY6zA=

# 2. Local .env
echo "LOGS_TOKEN=eXvK7pL9mNq8xR2wB4cD5fG6hJ1kL2oP3sT4uV5xY6zA=" >> backend_school_crm/.env

# 3. Restart backend
cd backend_school_crm && go run cmd/main.go
```

## 🔑 API Endpoints

### Ingest Logs (POST)
```
POST /api/logs/ingest
Authorization: Bearer <LOGS_TOKEN>
Content-Type: application/json

{
  "service": "api | worker | cron | health-check",
  "level": "debug | info | warn | error",
  "message": "string",
  "timestamp": "ISO8601 (optional)",
  "metadata": {
    "request_id": "string",
    "user_id": "string"
  }
}
```

**Response**: `201 Created`
```json
{"status":"logged"}
```

### Retrieve Logs (GET)
```
GET /api/logs?limit=100&level=info&module=auth

Query Parameters:
  - limit: 1-1000 (default: 100)
  - level: debug, info, warn, error (default: all)
  - module: filter by module (optional)
```

**Response**: `200 OK` (array of logs)
```json
[
  {
    "id": "uuid",
    "timestamp": "2024-01-19T10:30:00Z",
    "level": "info",
    "service": "api",
    "module": "auth",
    "message": "Login successful",
    "requestId": "req_123",
    "userId": "user_456"
  }
]
```

### Clear Logs (DELETE)
```
DELETE /api/logs
```

**Response**: `200 OK`
```json
{"message":"logs cleared"}
```

## 💻 Usage Examples

### Node.js / Express

```javascript
// lib/logger.js
const LOGS_API = process.env.LOGS_API || 'http://localhost:8080';
const LOGS_TOKEN = process.env.LOGS_TOKEN;

async function sendLog(service, level, message, metadata = {}) {
  try {
    await fetch(`${LOGS_API}/api/logs/ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOGS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: service || 'api',
        level: level || 'info',
        message,
        timestamp: new Date().toISOString(),
        metadata,
      }),
    });
  } catch (error) {
    console.error('Log error:', error);
  }
}

module.exports = { sendLog };
```

**Usage**:
```javascript
const { sendLog } = require('./lib/logger');

// In your route handler
await sendLog('api', 'info', 'User logged in', {
  request_id: req.id,
  user_id: req.user.id,
});
```

### Python / FastAPI

```python
# app/logger.py
import httpx
import os
from datetime import datetime

class LogClient:
    def __init__(self):
        self.api = os.getenv("LOGS_API", "http://localhost:8080")
        self.token = os.getenv("LOGS_TOKEN")
        self.service = os.getenv("SERVICE_NAME", "api")
    
    async def log(self, level, message, metadata=None):
        if not self.token:
            return
        
        async with httpx.AsyncClient(timeout=5) as client:
            try:
                await client.post(
                    f"{self.api}/api/logs/ingest",
                    json={
                        "service": self.service,
                        "level": level,
                        "message": message,
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "metadata": metadata or {},
                    },
                    headers={"Authorization": f"Bearer {self.token}"},
                )
            except Exception as e:
                print(f"Log error: {e}")

logger = LogClient()
```

**Usage**:
```python
await logger.log("info", "Payment processed", {
    "request_id": request.id,
    "user_id": request.user_id,
})
```

### Go / Goroutine

```go
// lib/logger.go
package lib

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

func SendLog(level, message string, metadata map[string]string) {
	go func() {
		api := os.Getenv("LOGS_API")
		token := os.Getenv("LOGS_TOKEN")
		service := os.Getenv("SERVICE_NAME")
		
		if api == "" {
			api = "http://localhost:8080"
		}
		if service == "" {
			service = "api"
		}

		payload, _ := json.Marshal(map[string]interface{}{
			"service":   service,
			"level":     level,
			"message":   message,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"metadata":  metadata,
		})

		req, _ := http.NewRequest("POST", api+"/api/logs/ingest", bytes.NewBuffer(payload))
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{Timeout: 5 * time.Second}
		client.Do(req)
	}()
}
```

**Usage**:
```go
SendLog("info", "Payment processed", map[string]string{
	"request_id": "req_123",
	"user_id":    "user_456",
})
```

## 🧪 Test with curl

### Test Token Validation

```bash
TOKEN="eXvK7pL9mNq8xR2wB4cD5fG6hJ1kL2oP3sT4uV5xY6zA="

# ✅ Valid token
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service":"test","level":"info","message":"Valid"}'
# Response: {"status":"logged"}

# ❌ Invalid token
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer invalid" \
  -H "Content-Type: application/json" \
  -d '{"service":"test","level":"info","message":"Invalid"}'
# Response: {"error":"Invalid token"}

# ❌ Missing header
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{"service":"test","level":"info","message":"No header"}'
# Response: {"error":"Missing Authorization header"}
```

### Bulk Test Logs

```bash
TOKEN="eXvK7pL9mNq8xR2wB4cD5fG6hJ1kL2oP3sT4uV5xY6zA="
API="http://localhost:8080"

# Send different log levels
for level in debug info warn error; do
  curl -s -X POST "$API/api/logs/ingest" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"service\":\"test\",
      \"level\":\"$level\",
      \"message\":\"Test $level message\",
      \"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"metadata\":{\"request_id\":\"test_$RANDOM\"}
    }"
done

# Send from different services
for service in api worker scheduler cron; do
  curl -s -X POST "$API/api/logs/ingest" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"service\":\"$service\",
      \"level\":\"info\",
      \"message\":\"Message from $service\",
      \"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }"
done
```

### Retrieve and Filter

```bash
API="http://localhost:8080"

# Get last 100 logs
curl "$API/api/logs"

# Get errors only
curl "$API/api/logs?level=error"

# Get warnings (last 50)
curl "$API/api/logs?level=warn&limit=50"

# Filter by module
curl "$API/api/logs?module=auth"

# Combine filters
curl "$API/api/logs?level=error&module=payments&limit=30"

# Format output (requires jq)
curl -s "$API/api/logs?limit=5" | jq '.[] | {timestamp, level, message}'
```

## 🔄 Token Rotation

```bash
# Step 1: Generate new token
NEW_TOKEN=$(openssl rand -base64 32)
echo "New token: $NEW_TOKEN"

# Step 2: Update Railway variable
railway variable set LOGS_TOKEN=$NEW_TOKEN

# Step 3: Redeploy
railway deploy

# Step 4: Test new token
curl -X POST "https://api.railway.app/api/logs/ingest" \
  -H "Authorization: Bearer $NEW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service":"test","level":"info","message":"New token test"}'
```

## 📊 Frontend Dashboard

### Access
- Local: `http://localhost:3000/developer-logs`
- Production: `https://your-app.com/developer-logs`

### Features
- ✅ Real-time log streaming (5s refresh)
- ✅ Color-coded levels (info: blue, warn: orange, error: red)
- ✅ Filter by level, service, text search
- ✅ Sort by time, level, service, message
- ✅ Copy metadata to clipboard
- ✅ Statistics card (total, errors, warnings)
- ✅ Auto-refresh toggle
- ✅ Clear all logs

## 🚨 Error Responses

| Status | Error | Cause |
|--------|-------|-------|
| **401** | Missing Authorization header | No Authorization header sent |
| **401** | Invalid Authorization format | Format not "Bearer <token>" |
| **401** | Invalid token | Token doesn't match LOGS_TOKEN |
| **400** | Invalid JSON | JSON parsing failed |
| **400** | Message is required | Missing "message" field |
| **500** | LOGS_TOKEN not configured | Backend missing env var |

## 💡 Best Practices

### DO ✅
- Send logs asynchronously (don't block request)
- Include request_id and user_id in metadata
- Use appropriate log levels (not everything is info)
- Set SERVICE_NAME in environment
- Test token before production deployment
- Rotate token every 3-6 months

### DON'T ❌
- Commit token to git
- Share token in Slack/messages
- Log sensitive data (passwords, API keys)
- Send logs synchronously (blocks request)
- Use same token for all environments
- Ignore log ingestion errors

## 🔍 Troubleshooting

| Problem | Solution |
|---------|----------|
| **Logs not appearing** | Verify token matches with `echo $LOGS_TOKEN` |
| **401 Unauthorized** | Check Bearer format: `Authorization: Bearer <token>` |
| **Connection timeout** | Verify backend is running: `curl http://localhost:8080/health` |
| **High latency** | Backend may be slow; increase timeout to 10s |
| **Memory usage high** | Reduce max logs or implement database storage |

## 📚 Full Documentation

- **System Design**: See `LOGS_ARCHITECTURE.md`
- **Setup Guide**: See `RAILWAY_LOGS_SETUP_GUIDE.md`
- **Implementation**: See `LOGS_INGESTION_SYSTEM.md`

---

**Last Updated**: 2024-01-19 | **Version**: 1.0 | **Status**: Production Ready
