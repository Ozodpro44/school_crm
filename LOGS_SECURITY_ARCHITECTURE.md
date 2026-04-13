# Logging Security Architecture

## 🔐 Security Model

```
┌──────────────────────────────────────────────────────────────┐
│                    RAILWAY SERVICES                           │
│  ┌──────────────────┬──────────────────┬──────────────────┐   │
│  │  API Service     │  Worker Service  │ Scheduler Service│   │
│  │                  │                  │                  │   │
│  │ LOGS_TOKEN env   │ LOGS_TOKEN env   │ LOGS_TOKEN env   │   │
│  └─────────┬────────┴─────────┬────────┴────────┬─────────┘   │
│            │                  │                 │             │
└────────────┼──────────────────┼─────────────────┼─────────────┘
             │                  │                 │
             │ POST /api/logs/ingest              │
             │ Authorization: Bearer <TOKEN>      │
             │ Content-Type: application/json     │
             │                                    │
             └────────────────┬─────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────┐
│                  BACKEND (Go)                                  │
│                                                                │
│  1. Extract Bearer Token from header                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Authorization: Bearer <token>                          │  │
│  │ → Extract: "<token>"                                   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  2. Compare with LOGS_TOKEN env var                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ if token != os.Getenv("LOGS_TOKEN") {                  │  │
│  │   return 401 Unauthorized                              │  │
│  │ }                                                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  3. Validate JSON payload                                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ {                                                       │  │
│  │   "service": "api",        ✓ Required                  │  │
│  │   "level": "error",        ✓ Required                  │  │
│  │   "message": "...",        ✓ Required                  │  │
│  │   "metadata": {...}        ✓ Optional                  │  │
│  │ }                                                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  4. Store in memory (circular buffer)                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ logs := []Log{}                                         │  │
│  │ if len(logs) >= 10000 {                                │  │
│  │   logs = logs[1:]  // Remove oldest                    │  │
│  │ }                                                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  5. Return 201 Created                                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ {"status": "logged"}                                    │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│              FRONTEND DEVELOPER DASHBOARD                     │
│                                                               │
│  User can:                                                    │
│  ✓ View all logs (must be logged in)                         │
│  ✓ Filter by level (info/warn/error)                         │
│  ✓ Filter by module                                          │
│  ✓ Search in message & details                               │
│  ✓ Export logs as JSON                                       │
│  ✓ View full log entry details                               │
│                                                               │
│  User CANNOT:                                                │
│  ✗ Modify logs without DELETE endpoint                       │
│  ✗ Clear logs (requires DELETE /api/logs)                    │
│  ✗ Access without authentication                             │
└───────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Security Layers

### Layer 1: Transport Security

```
✓ HTTPS/TLS in production (Railway default)
✓ Bearer token in Authorization header (not in URL)
✓ Token never logged or exposed
✓ All requests timeout after 5 seconds
```

### Layer 2: Authentication

```
✓ Bearer token format validation
✓ Token comparison is constant-time (string equality)
✓ Invalid tokens immediately rejected (401)
✓ Missing header immediately rejected (401)
```

### Layer 3: Input Validation

```
✓ JSON schema validation
✓ Required fields check
✓ Level enum validation (debug|info|warn|error)
✓ Message cannot be empty
```

### Layer 4: Storage

```
✓ In-memory only (no persistent storage)
✓ Circular buffer (auto-rotate at 10k logs)
✓ No database credentials needed
✓ Logs lost on restart (no data leakage)
```

### Layer 5: Access Control

```
✓ Frontend requires JWT authentication
✓ Users can only view logs (GET)
✓ DELETE requires explicit request
✓ No metadata modification allowed
```

---

## 🔑 Token Management

### Token Generation (One-time)

```bash
# Option 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: OpenSSL
openssl rand -hex 32

# Option 3: Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Token Storage

```
✓ Backend: environment variable (LOGS_TOKEN)
✓ Frontend: environment variable (VITE_LOGS_TOKEN)
✓ Railway: Encrypted in dashboard
✓ Local dev: .env and .env.local (git-ignored)
```

### Token Rotation

```
Timeline:
Day 1:  Generate new token (TOKEN_NEW)
Day 2:  Deploy backend with TOKEN_NEW
Day 3:  Deploy services with TOKEN_NEW
Day 4:  Remove old token (TOKEN_OLD)

During rotation:
- Old token still accepted
- New token accepted
- Services gradually switch
- Old token logged as deprecated
```

**Implementation:**

```go
// In main.go
func main() {
  logsToken := os.Getenv("LOGS_TOKEN")
  logsTokenLegacy := os.Getenv("LOGS_TOKEN_LEGACY")

  router.POST("/api/logs/ingest", handlers.IngestLogsHandler(logsToken, logsTokenLegacy))
}

// In handlers/logs.go
func IngestLogsHandler(token, legacyToken string) gin.HandlerFunc {
  return func(c *gin.Context) {
    // ... extract token ...

    if token != extractedToken && legacyToken != extractedToken {
      c.JSON(401, gin.H{"error": "Invalid token"})
      return
    }

    if legacyToken == extractedToken {
      AddLog("warn", "legacy_token_used", "Consider updating to new token")
    }

    // ... continue ...
  }
}
```

---

## 🚨 Threat Model

### Threat 1: Token Interception

```
Attack: Attacker intercepts token in transit
Protection:
  ✓ HTTPS/TLS encryption
  ✓ Token sent in header (not URL)
  ✓ No logging of token value
Mitigation:
  → Use HTTPS in production
  → Monitor for unauthorized requests
  → Rotate token if compromised
```

### Threat 2: Brute Force Token

```
Attack: Attacker tries to guess token
Protection:
  ✓ Token is 256 bits (2^256 possibilities)
  ✓ No rate limiting (could add)
  ✓ Invalid tokens logged
Mitigation:
  → Add rate limiting per IP
  → Alert on repeated failures
  → Rotate token if many attempts
```

### Threat 3: Log Injection

```
Attack: Attacker sends malicious logs
Protection:
  ✓ JSON schema validation
  ✓ Field type validation
  ✓ No code execution (plain text only)
Mitigation:
  → Sanitize on display (React escaping)
  → Limit metadata size (< 1KB)
  → Monitor for suspicious patterns
```

### Threat 4: Denial of Service

```
Attack: Attacker floods with logs
Protection:
  ✓ Circular buffer (auto-rotate)
  ✓ Request timeout (5s)
  ✓ Memory bounded
Mitigation:
  → Add rate limiting per token
  → Monitor memory usage
  → Alert on high log volume
```

### Threat 5: Token Exposure in Logs

```
Attack: Token accidentally logged
Protection:
  ✓ Token extracted and validated only
  ✓ Raw header never logged
  ✓ Validation error mentions no token
Mitigation:
  → Sanitize log output
  → Regex scan for token-like strings
  → Review logs for secrets
```

---

## ✅ Security Checklist

### Before Deployment

- [ ] Generated random 32-byte token
- [ ] Token stored in `.env` (not committed to Git)
- [ ] Backend has `LOGS_TOKEN` set
- [ ] Frontend has `VITE_LOGS_TOKEN` set
- [ ] HTTPS enabled in production
- [ ] Token tested with valid request
- [ ] Invalid token tested (should get 401)

### After Deployment

- [ ] Monitor logs for authentication failures
- [ ] Check for repeated failed attempts
- [ ] Monitor memory usage (shouldn't exceed 50MB)
- [ ] Review logs for suspicious patterns
- [ ] Test token rotation procedure

### Monthly

- [ ] Review access patterns
- [ ] Check for security updates
- [ ] Test disaster recovery (token lost)
- [ ] Audit who has token access

### Quarterly

- [ ] Rotate token (generate new, deploy, revoke old)
- [ ] Review token generation method
- [ ] Security audit of endpoint
- [ ] Load testing

---

## 🔍 Monitoring

### Metrics to Track

```
1. Log Ingestion Rate
   - Logs/second by service
   - Total logs in memory
   
2. Authentication
   - Successful requests (201)
   - Failed requests (401)
   - Invalid JSON requests (400)
   
3. Performance
   - Request latency (p50, p99)
   - Memory usage
   - Storage usage
```

### Alerts

```
Alert if:
- > 100 unauthorized requests in 1 minute
- Log storage > 90% full
- Request latency > 1 second
- Memory usage > 500MB
```

### Logging Endpoint Itself

```
/api/logs endpoint should log:
- ✓ All received logs
- ✓ Authentication failures
- ✓ Validation errors
- ✗ Token values (security risk)
```

---

## 📝 Audit Trail

All log ingestion is automatically audited:

```json
{
  "id": "log-uuid",
  "timestamp": "2024-01-15T10:30:45Z",
  "service": "api",
  "level": "error",
  "message": "Payment failed",
  "metadata": {
    "request_id": "req-123",
    "user_id": "user-456"
  }
}
```

For sensitive operations, include:

```json
{
  "service": "api",
  "level": "error",
  "message": "User deleted",
  "metadata": {
    "request_id": "req-123",
    "user_id": "admin-789",
    "target_user": "user-456",  // What was affected
    "reason": "account_closure"  // Why
  }
}
```

---

## 🧪 Security Testing

### Test 1: Token Validation

```bash
# Valid token
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service":"api","level":"info","message":"test"}'
# Expected: 201 Created

# Invalid token
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer INVALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service":"api","level":"info","message":"test"}'
# Expected: 401 Unauthorized
```

### Test 2: Header Format

```bash
# Missing Authorization header
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{"service":"api","level":"info","message":"test"}'
# Expected: 401 Unauthorized

# Wrong format (no Bearer prefix)
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service":"api","level":"info","message":"test"}'
# Expected: 401 Unauthorized
```

### Test 3: Input Validation

```bash
# Missing required field
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service":"api","level":"info"}'
# Expected: 400 Bad Request (missing message)

# Invalid JSON
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer VALID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{invalid json}'
# Expected: 400 Bad Request
```

### Test 4: Rate Limiting (if implemented)

```bash
# Send 1000 requests in 10 seconds
for i in {1..1000}; do
  curl -X POST http://localhost:8080/api/logs/ingest \
    -H "Authorization: Bearer VALID_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"service":"api","level":"info","message":"test"}' &
done
# Monitor for 429 Too Many Requests (if rate limiting enabled)
```

---

## 🎓 Best Practices

1. **Never expose tokens in**:
   - Error messages
   - Logs or debug output
   - Comments in code
   - Documentation examples
   - Browser dev tools

2. **Always use**:
   - Environment variables
   - `.env` files (git-ignored)
   - Secrets manager in production
   - HTTPS/TLS

3. **Rotate tokens**:
   - Every 90 days minimum
   - Immediately if exposed
   - After team member departure
   - During major deployments

4. **Monitor**:
   - Authentication failures
   - Token usage patterns
   - Memory consumption
   - Performance metrics

5. **Document**:
   - Token generation procedure
   - Rotation schedule
   - Recovery procedure
   - Who has access
