# 🚀 Log Ingestion System - START HERE

**Goal**: Set up secure log ingestion from Railway services in 30 minutes.

---

## ⚡ 5-Minute Quick Start

### Step 1️⃣ Generate Token (1 min)
```bash
openssl rand -base64 32
# Copy this output: eXvK7pL9mNq8xR2wB4cD5fG6hJ1kL2oP3sT4uV5xY6zA=
```

### Step 2️⃣ Add to Railway (5 min)
1. Go to **Railway Dashboard** → Your Project → **Settings** → **Variables**
2. Click **Add Variable**
3. Name: `LOGS_TOKEN`
4. Value: `[paste your token]`
5. Click **Add**
6. Click **Redeploy** on your latest deployment

### Step 3️⃣ Test It (2 min)
```bash
TOKEN="your_token_here"

curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service":"test",
    "level":"info",
    "message":"Hello from log system!"
  }'

# Expected response: {"status":"logged"}
```

✅ **Done!** Logs are working.

---

## 📚 Full Documentation

| Time | Task | Document |
|------|------|----------|
| **30 min** | Setup & verify | `RAILWAY_LOGS_SETUP_GUIDE.md` |
| **1-2 hours** | Add to all services | `LOGS_QUICK_REFERENCE.md` (copy code examples) |
| **15 min** | Deploy dashboard | Copy `developer-logs.tsx` to frontend |
| **Ongoing** | Monitor & maintain | Use `/developer-logs` page |

---

## 🎯 What You Get

```
✅ Secure token authentication
✅ Real-time log collection from Railway
✅ Developer dashboard with filters & search
✅ Color-coded log levels
✅ Thread-safe in-memory storage
✅ Ready for database upgrade later
```

---

## 📋 3-Step Implementation

### Phase 1: Setup (Day 1)
```
✓ Generate token
✓ Add to Railway Variables
✓ Restart backend
✓ Test with curl
```

### Phase 2: Dashboard (Day 1)
```
✓ Copy developer-logs.tsx to frontend
✓ Start frontend server
✓ Navigate to /developer-logs
✓ Verify logs appear
```

### Phase 3: Services (Day 2)
```
✓ Add logger to each service
✓ Add LOGS_API and LOGS_TOKEN env vars
✓ Redeploy services
✓ Verify logs in dashboard
```

---

## 🔧 Add Logging to Your Services

### Node.js / Express (2 min)
```javascript
// In your route handler
const { sendLog } = require('./lib/logger');

app.post('/api/payments', async (req, res) => {
  try {
    const result = await processPayment(req.body);
    
    // Log success
    await sendLog('api', 'info', 'Payment processed', {
      request_id: req.id,
      user_id: req.user?.id,
    });
    
    res.json(result);
  } catch (error) {
    // Log error
    await sendLog('api', 'error', error.message, {
      request_id: req.id,
      user_id: req.user?.id,
    });
    
    res.status(500).json({ error: error.message });
  }
});
```

[See logger code](LOGS_QUICK_REFERENCE.md#nodejs--express)

### Python / FastAPI (2 min)
```python
await logger.log('info', 'Payment processed', {
    'request_id': request.id,
    'user_id': request.user_id,
})
```

[See logger code](LOGS_QUICK_REFERENCE.md#python--fastapi)

### Go (2 min)
```go
SendLog("info", "Payment processed", map[string]string{
    "user_id": "user_123",
    "request_id": "req_456",
})
```

[See logger code](LOGS_QUICK_REFERENCE.md#go--goroutine)

---

## 🌐 View Logs

### In Browser
```
http://localhost:3000/developer-logs
```

### Via API
```bash
# Get all logs
curl http://localhost:8080/api/logs

# Get errors only
curl "http://localhost:8080/api/logs?level=error"

# Filter by service
curl "http://localhost:8080/api/logs?service=api"
```

---

## ❌ Troubleshooting (2 min)

### Logs Not Appearing?

1. **Verify token is set**:
   ```bash
   echo $LOGS_TOKEN
   ```

2. **Check header format**:
   ```bash
   # Correct:   Authorization: Bearer <token>
   # Wrong:     Authorization: <token>
   # Wrong:     Bearer <token>
   ```

3. **Backend running?**:
   ```bash
   curl http://localhost:8080/health
   # Should return: {"status":"healthy"}
   ```

4. **See full troubleshooting**: [LOGS_QUICK_REFERENCE.md](LOGS_QUICK_REFERENCE.md#troubleshooting)

---

## 🔐 Security

✅ **Token Best Practices**:
- Store in environment variables (not code)
- Rotate every 3-6 months
- Different token per environment
- Never commit to git

---

## 📞 Need Help?

| Question | Answer |
|----------|--------|
| "How do I set this up?" | → `RAILWAY_LOGS_SETUP_GUIDE.md` |
| "What commands do I use?" | → `LOGS_QUICK_REFERENCE.md` |
| "How does it work?" | → `LOGS_ARCHITECTURE.md` |
| "What's the checklist?" | → `LOGS_IMPLEMENTATION_CHECKLIST.md` |
| "I need a full summary" | → `LOGS_SYSTEM_SUMMARY.md` |

---

## ✨ Key Features

| Feature | Benefit |
|---------|---------|
| **Bearer Token Auth** | Secure log ingestion |
| **Real-time Dashboard** | See logs as they happen |
| **Color-Coded Levels** | Quick error spotting |
| **Search & Filter** | Find what you need fast |
| **Multi-Service** | Works with all your services |
| **Auto-Refresh** | No manual refreshing |
| **Copy to Clipboard** | Easy sharing of logs |

---

## ⏱️ Timeline

- **5 min**: Generate token & add to Railway
- **5 min**: Test with curl
- **15 min**: Deploy frontend dashboard
- **30 min**: Add logging to one service
- **60 min**: Add logging to all services
- **TOTAL: ~2 hours** to full implementation

---

## 🎓 Next Steps

1. ✅ Read this page (you're here!)
2. 📖 Open `RAILWAY_LOGS_SETUP_GUIDE.md`
3. 🔑 Generate your token
4. 🚀 Add to Railway Variables
5. 🧪 Test with curl command above
6. 📊 Deploy frontend dashboard
7. 🔗 Add logging to services
8. ✨ View real-time logs!

---

## 💡 Pro Tips

```bash
# Save token to use multiple times
TOKEN=$(openssl rand -base64 32)
echo "Save this token: $TOKEN"

# Test multiple times
for i in {1..5}; do
  curl -X POST http://localhost:8080/api/logs/ingest \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"service\":\"test\",\"level\":\"info\",\"message\":\"Test $i\"}"
done

# View in dashboard
# http://localhost:3000/developer-logs
```

---

## 📦 What's Included

```
✅ Backend log handler (already integrated)
✅ Frontend dashboard component
✅ Documentation (7 guides)
✅ Code examples (Node.js, Python, Go)
✅ Setup instructions (Railway)
✅ Troubleshooting guide
✅ Implementation checklist
```

---

## 🏁 Success Checklist

- [ ] Token generated
- [ ] Token added to Railway Variables
- [ ] Backend tested with curl
- [ ] Frontend dashboard deployed
- [ ] Can see logs in browser
- [ ] Service code updated with logging
- [ ] All services redeployed
- [ ] Production logs appearing
- [ ] Team can access dashboard

---

## 🚀 Ready?

**Start with**: `RAILWAY_LOGS_SETUP_GUIDE.md` → Step-by-step instructions

---

**Current Status**: Everything is ready. Just follow the guide!

**Estimated Setup Time**: 2 hours (start to finish)

**Complexity**: Low (copy-paste mostly)

**Support**: All documentation is in this folder

Let's go! 🎉
