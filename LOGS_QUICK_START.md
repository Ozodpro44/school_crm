# Railway Logging - Quick Start (5 minutes)

## ⚡ TL;DR Setup

### 1. Generate Token

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: abcd1234...xyz
```

### 2. Backend `.env`

```env
LOGS_TOKEN=abcd1234...xyz
```

### 3. Frontend `.env.local`

```env
VITE_LOGS_TOKEN=abcd1234...xyz
```

### 4. Test Backend

```bash
# From any terminal
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer abcd1234...xyz" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "api",
    "level": "info",
    "message": "Test log"
  }'

# Expected: {"status": "logged"}
```

### 5. View Dashboard

Open: `http://localhost:5173/logs`

---

## 📋 Verify Each Step

| Step | Check | Command |
|------|-------|---------|
| Token created | Copies to clipboard | See step 1 above |
| Backend has token | `.env` file updated | `grep LOGS_TOKEN backend_school_crm/.env` |
| Frontend has token | `.env.local` updated | `grep VITE_LOGS_TOKEN frontend_for_dev/.env.local` |
| Backend running | Port 8080 responds | `curl http://localhost:8080/health` |
| Frontend running | Loads at 5173 | Visit `http://localhost:5173` |
| Endpoint works | Returns 201 | See test curl above |
| Dashboard loads | Logs visible | Visit `http://localhost:5173/logs` |

---

## 🔐 Token Best Practices

✅ **DO:**
- Use a random 32-byte token
- Store in `.env` files (git-ignored)
- Rotate every 90 days
- Use HTTPS in production

❌ **DON'T:**
- Commit token to Git
- Use predictable strings
- Share in Slack/Email
- Use same token for all services

---

## 🧪 Test Cases

### ✅ Should Work

```bash
# Valid token, valid payload
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "api",
    "level": "info",
    "message": "This works"
  }'
# Response: 201 Created
```

### ❌ Should Fail

```bash
# Missing token
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{"service":"api","level":"info","message":"test"}'
# Response: 401 Unauthorized

# Wrong token
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer WRONG" \
  -H "Content-Type: application/json" \
  -d '{"service":"api","level":"info","message":"test"}'
# Response: 401 Unauthorized

# Missing message
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service":"api","level":"info"}'
# Response: 400 Bad Request
```

---

## 🚀 Deploy to Railway

1. **Set environment variable in Railway dashboard:**
   - Variables → Add `LOGS_TOKEN=your-token`

2. **Deploy backend:**
   ```bash
   git push railway main
   ```

3. **Update frontend URL:**
   - `.env.local`: `VITE_API_BASE_URL=https://your-app.railway.app/api`

4. **Test from production:**
   ```bash
   curl -X POST https://your-app.railway.app/api/logs/ingest \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"service":"api","level":"info","message":"test from prod"}'
   ```

---

## 📞 Support

| Issue | Solution |
|-------|----------|
| `401 Unauthorized` | Check token matches in `.env` and request |
| `400 Bad Request` | Ensure valid JSON with all required fields |
| `Connection refused` | Backend not running on port 8080 |
| Logs not in dashboard | Check `/api/logs` endpoint returns data |
| CORS error | Add `VITE_API_BASE_URL` to `.env.local` |

---

## 📊 What You Get

✅ **Backend Endpoint:**
- `POST /api/logs/ingest` - Send logs
- `GET /api/logs` - Retrieve logs
- `DELETE /api/logs` - Clear logs

✅ **Frontend Dashboard:**
- Real-time log viewer
- Filter by level & module
- Search logs
- Export as JSON
- View full details

✅ **Security:**
- Bearer token authentication
- Automatic token validation
- Secure HTTP headers

---

## 🎯 Next Steps

1. Implement logging in your services (see `LOGS_API_EXAMPLES.md`)
2. Set up token rotation policy
3. Configure log retention (PostgreSQL)
4. Add alerting on error logs
5. Monitor dashboard daily
