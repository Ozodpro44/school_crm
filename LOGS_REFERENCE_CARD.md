# Railway Logging - Reference Card

## 🔑 Quick Token Generation

```bash
# Generate 32-byte token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copy output and use as LOGS_TOKEN everywhere
```

---

## 🎯 One-Minute Setup

### 1. Backend `.env`
```env
LOGS_TOKEN=abc123def456...
```

### 2. Frontend `.env.local`
```env
VITE_LOGS_TOKEN=abc123def456...
```

### 3. Test
```bash
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer abc123def456..." \
  -H "Content-Type: application/json" \
  -d '{
    "service": "api",
    "level": "info",
    "message": "Test"
  }'
```

### 4. View
- Dashboard: http://localhost:5173/logs

---

## 🔌 Integration (Copy-Paste Ready)

### Node.js
```javascript
const logger = {
  send: async (level, message, meta = {}) => {
    await fetch('http://localhost:8080/api/logs/ingest', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service: 'api',
        level,
        message,
        metadata: meta
      })
    });
  }
};

logger.send('error', 'Payment failed', { orderId: '123' });
```

### Python
```python
import requests

def log(level, message, **meta):
    requests.post(
        'http://localhost:8080/api/logs/ingest',
        headers={'Authorization': 'Bearer YOUR_TOKEN'},
        json={'service': 'api', 'level': level, 'message': message, 'metadata': meta}
    )

log('error', 'Payment failed', orderId='123')
```

### Go
```go
func Log(level, message string) {
  payload := map[string]interface{}{
    "service": "api",
    "level": level,
    "message": message,
  }
  body, _ := json.Marshal(payload)
  req, _ := http.NewRequest("POST", "http://localhost:8080/api/logs/ingest", bytes.NewBuffer(body))
  req.Header.Set("Authorization", "Bearer YOUR_TOKEN")
  req.Header.Set("Content-Type", "application/json")
  http.DefaultClient.Do(req)
}
```

---

## 🔐 Security Essentials

```
✓ Token: 32-byte random string
✓ Header: Authorization: Bearer <token>
✓ Storage: .env files (git-ignored)
✓ Transport: HTTPS in production
✓ Rotation: Every 90 days or if exposed
```

---

## 📊 Endpoint Reference

```bash
# Send log (requires token)
POST /api/logs/ingest
Authorization: Bearer TOKEN
Content-Type: application/json
{
  "service": "api",
  "level": "info|warn|error|debug",
  "message": "string",
  "metadata": { "key": "value" }
}

# Get logs (no auth)
GET /api/logs?limit=100&level=error&module=auth

# Clear logs (no auth)
DELETE /api/logs
```

---

## 🧪 Test Cases

| Test | Command | Expected |
|------|---------|----------|
| Valid | `curl -H "Authorization: Bearer TOKEN" ...` | 201 |
| Invalid token | `curl -H "Authorization: Bearer WRONG" ...` | 401 |
| Missing header | `curl ...` | 401 |
| Missing message | JSON without `message` field | 400 |
| Missing Bearer | `Authorization: TOKEN` | 401 |

---

## 🐳 Docker Setup

```yaml
services:
  api:
    environment:
      LOGS_TOKEN: ${LOGS_TOKEN}
      LOG_SERVER_URL: http://api:8080
```

```bash
export LOGS_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
docker-compose up
```

---

## 📱 Frontend Usage

```typescript
import { getLogService } from "@/services/log-service";

const logService = getLogService();
logService?.info("User logged in", { userId: "123" });
logService?.error("Payment failed", { orderId: "456" });
```

---

## 🚀 Deploy to Railway

1. **Set variable in Railway dashboard:**
   ```
   LOGS_TOKEN = your-token
   ```

2. **Deploy backend:**
   ```bash
   git push railway main
   ```

3. **Test from production:**
   ```bash
   curl -X POST https://your-app.railway.app/api/logs/ingest \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"service":"api","level":"info","message":"test"}'
   ```

---

## 🔄 Token Rotation

```
1. Generate new token
2. Deploy backend with new token
3. Deploy services with new token
4. Remove old token
5. Verify no 401 errors
```

---

## 📈 What You Get

| Component | URL | Type |
|-----------|-----|------|
| API | `POST /api/logs/ingest` | Secure endpoint |
| Logs | `GET /api/logs` | Public API |
| Dashboard | `/logs` | React page |
| Service | `log-service.ts` | TypeScript |

---

## ⚠️ Common Mistakes

```
❌ commit token to Git
❌ expose token in error messages
❌ use same token for all services
❌ send token in URL query parameter
❌ forget HTTPS in production

✅ use environment variables
✅ rotate token every 90 days
✅ send in Authorization header
✅ monitor authentication failures
✅ use HTTPS everywhere
```

---

## 📞 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| 401 Unauthorized | Check token matches in `.env` |
| 400 Bad Request | Ensure all required fields in JSON |
| Connection refused | Backend not running on 8080 |
| CORS error | Check `VITE_API_BASE_URL` in `.env.local` |
| Logs not showing | Refresh dashboard, check network tab |

---

## 📝 Checklist

- [ ] Token generated
- [ ] Backend `.env` updated
- [ ] Frontend `.env.local` updated
- [ ] Curl test successful
- [ ] Dashboard shows logs
- [ ] Services integrated
- [ ] Production deployed
- [ ] Monitoring set up

---

## 🎓 Documentation Links

- Full setup: `RAILWAY_LOGGING_COMPLETE.md`
- Security: `LOGS_SECURITY_ARCHITECTURE.md`
- Examples: `LOGS_API_EXAMPLES.md`
- Quick start: `LOGS_QUICK_START.md`

---

## 🔍 Verify Each Step

```bash
# 1. Check backend is running
curl http://localhost:8080/health

# 2. Check frontend is running
curl http://localhost:5173

# 3. Send test log
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service":"api","level":"info","message":"test"}'

# 4. Get logs
curl http://localhost:8080/api/logs?limit=5

# 5. Open dashboard
open http://localhost:5173/logs
```

---

**Save this file for quick reference!**

Print → Keep at desk → Reference when implementing logging
