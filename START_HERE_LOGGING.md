# 🚀 Railway Logging System - START HERE

## ✅ Status: Backend Running on Port 8080

Your backend is already running and responding to requests. Now let's test the new logging system.

---

## 🎯 Step 1: Add LOGS_TOKEN to Backend

Your `.env` file is already open. Add this line:

```env
LOGS_TOKEN=your-secure-random-token-here
```

Or use a real token:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate a token and replace `your-secure-random-token-here`.

---

## 🎯 Step 2: Set Frontend Token

Create/update `frontend_for_dev/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_LOGS_TOKEN=your-secure-random-token-here
```

**Use the same token as backend!**

---

## 🧪 Step 3: Test the Endpoint

In a new terminal, test your new secure endpoint:

```bash
# Replace YOUR_TOKEN with your actual token
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "api",
    "level": "info",
    "message": "Test log from new endpoint",
    "metadata": {
      "request_id": "test-123",
      "user_id": "user-456"
    }
  }'
```

**Expected response:**
```json
{"status": "logged"}
```

### Verify Token Works
```bash
# Test with WRONG token (should get 401)
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer WRONG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service":"api","level":"info","message":"test"}'

# Should return:
# {"error":"Invalid token"}
```

---

## 📱 Step 4: View in Dashboard

Start frontend:
```bash
cd frontend_for_dev
npm run dev
```

Open: **http://localhost:5173/logs**

You should see the logs you just sent appearing in the dashboard in real-time!

---

## 🔌 Step 5: Integrate with Your Services

### Node.js Example
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

// Use it
logger.send('error', 'Payment failed', { orderId: '123' });
logger.send('info', 'User logged in', { userId: '456' });
```

### Python Example
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

### React/Frontend Example
```typescript
import { getLogService } from "@/services/log-service";

const logService = getLogService();
logService?.info("User action", { userId: "123" });
logService?.error("Error occurred", { errorCode: "E001" });
```

---

## 📊 What's Working Now

✅ **Backend endpoint**: `POST /api/logs/ingest`
- Requires: `Authorization: Bearer TOKEN`
- Accepts: JSON with service, level, message
- Returns: 201 Created or error codes

✅ **Frontend dashboard**: `/logs`
- Shows incoming logs in real-time
- Filter by level (info/warn/error)
- Search and export
- View full details

✅ **Log service**: `LogService` TypeScript class
- Auto-batching
- Non-blocking
- Metadata support

---

## 🔐 Security Features

✅ Bearer token required for all log ingestion  
✅ Invalid tokens rejected with 401  
✅ All fields validated  
✅ No sensitive data stored  

---

## 📚 Complete Documentation

For more details, read these (in order):

1. **[LOGS_QUICK_START.md](./LOGS_QUICK_START.md)** - 5-minute setup ⭐
2. **[LOGS_REFERENCE_CARD.md](./LOGS_REFERENCE_CARD.md)** - One-page cheat sheet
3. **[LOGS_API_EXAMPLES.md](./LOGS_API_EXAMPLES.md)** - Code examples
4. **[RAILWAY_LOGGING_COMPLETE.md](./RAILWAY_LOGGING_COMPLETE.md)** - Full guide
5. **[LOGS_SECURITY_ARCHITECTURE.md](./LOGS_SECURITY_ARCHITECTURE.md)** - Security details

---

## ✅ Checklist

- [ ] Added `LOGS_TOKEN` to `backend_school_crm/.env`
- [ ] Added `VITE_LOGS_TOKEN` to `frontend_for_dev/.env.local`
- [ ] Tested endpoint with curl (got 201 response)
- [ ] Started frontend with `npm run dev`
- [ ] Opened dashboard at `/logs`
- [ ] See logs appearing in dashboard
- [ ] Tested with wrong token (got 401)

---

## 🚀 Deploy to Production

When ready:

1. **Set LOGS_TOKEN in Railway dashboard** (Variables)
2. **Deploy backend**: `git push railway main`
3. **Update frontend** `.env.local` with production URL
4. **Deploy frontend** to Vercel/Railway/Netlify
5. **Test production endpoint**

---

## 📞 Troubleshooting

| Problem | Fix |
|---------|-----|
| Token mismatch | Verify same token in `.env` and backend |
| 401 Unauthorized | Check Bearer format: `Authorization: Bearer TOKEN` |
| 400 Bad Request | Ensure JSON has all required fields |
| Dashboard empty | Refresh page, check backend logs |
| CORS error | Check `VITE_API_BASE_URL` in `.env.local` |

---

## 🎉 You're All Set!

Your logging system is ready. Next steps:

1. **Test locally** with curl and dashboard
2. **Integrate** with your services (Node/Python/Go)
3. **Deploy** to Railway with production token
4. **Monitor** logs in production

---

**Questions?** See the full documentation files linked above.
