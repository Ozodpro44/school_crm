# Log Ingestion System - Implementation Checklist

## Phase 1: Setup & Verification (Day 1)

### Backend Configuration
- [ ] Open `.env.example` and verify structure
- [ ] Create `.env` in `backend_school_crm/`
- [ ] Generate token: `openssl rand -base64 32`
- [ ] Add `LOGS_TOKEN=<generated-token>` to `.env`
- [ ] Verify `main.go` has log initialization code
- [ ] Check `internal/handlers/logs.go` exists and is complete
- [ ] Verify config structure includes `LogsToken` field
- [ ] Restart backend: `cd backend_school_crm && go run cmd/main.go`

### Token Generation & Storage
- [ ] Generate primary token (keep in password manager)
- [ ] Generate staging token (for testing)
- [ ] Generate development token (for local dev)
- [ ] Document token rotation schedule

### Railway Configuration
- [ ] Access Railway Dashboard
- [ ] Select School CRM project
- [ ] Navigate to Settings → Variables
- [ ] Create new variable: `LOGS_TOKEN`
- [ ] Paste primary token value
- [ ] Deploy/redeploy application
- [ ] Wait for deployment to complete (2-3 min)
- [ ] Verify application is running: check logs

### Local Testing
- [ ] Start backend locally: `go run cmd/main.go`
- [ ] Test health endpoint: `curl http://localhost:8080/health`
- [ ] Set local token: `export TOKEN="<your-token>"`
- [ ] Test valid token:
  ```bash
  curl -X POST http://localhost:8080/api/logs/ingest \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"service":"test","level":"info","message":"Test"}'
  # Expected: 201 Created
  ```
- [ ] Test invalid token: expect 401 Unauthorized
- [ ] Test missing header: expect 401 Unauthorized
- [ ] Retrieve logs: `curl http://localhost:8080/api/logs`

---

## Phase 2: Frontend Dashboard (Day 1-2)

### Developer Logs Page
- [ ] Copy `developer-logs.tsx` to `frontend_school_crm/src/pages/`
- [ ] Verify file path is correct
- [ ] Install missing dependencies (if any):
  ```bash
  npm install lucide-react  # Already installed
  ```
- [ ] Check for import issues
- [ ] Format file: `prettier --write src/pages/developer-logs.tsx`

### Add Navigation Link
- [ ] Open main navigation component
- [ ] Add route/link to `/developer-logs`
- [ ] Only show to admin/developer users
- [ ] Test navigation works
- [ ] Verify page loads without errors

### Frontend Testing (Local)
- [ ] Start frontend: `npm run dev`
- [ ] Navigate to `http://localhost:3000/developer-logs`
- [ ] Page should load and show "No logs found" initially
- [ ] Send test logs to backend
- [ ] Refresh page: logs should appear
- [ ] Test filter by level: select "error"
- [ ] Test search: type "test"
- [ ] Test service filter: select "test"
- [ ] Test auto-refresh toggle: verify refreshes every 5s
- [ ] Test sort by different fields
- [ ] Test copy-to-clipboard functionality
- [ ] Verify timestamp formatting looks correct

---

## Phase 3: Service Integration (Day 2-3)

### For Each Service (API, Worker, Cron, Scheduler)

#### If Node.js / Express
- [ ] Create `lib/logger.js` (see quick reference)
- [ ] Import in main `app.js` or server file
- [ ] Add log calls to:
  - [ ] Authentication routes (login, register)
  - [ ] Payment processing endpoints
  - [ ] Student management routes
  - [ ] Error handlers (catch blocks)
  - [ ] Service startup
- [ ] Test locally: send logs while calling endpoints
- [ ] Verify logs appear in dashboard

#### If Python / FastAPI
- [ ] Create `app/logger.py` (see quick reference)
- [ ] Import LogClient in routes
- [ ] Add log calls to:
  - [ ] Request handlers
  - [ ] Error middleware
  - [ ] Database operations
  - [ ] External API calls
- [ ] Test locally
- [ ] Verify logs appear in dashboard

#### If Go
- [ ] Create `lib/logger.go` (see quick reference)
- [ ] Import in relevant packages
- [ ] Add log calls to:
  - [ ] HTTP handlers
  - [ ] Service methods
  - [ ] Error scenarios
  - [ ] Important business logic
- [ ] Test locally
- [ ] Verify logs appear in dashboard

### Add Environment Variables to Each Service

In Railway Dashboard, for each service:
- [ ] Navigate to Service → Variables
- [ ] Add `LOGS_API=https://api.railway.app`
- [ ] Add `LOGS_TOKEN=<your-primary-token>`
- [ ] Add `SERVICE_NAME=api` (or worker, scheduler, etc.)
- [ ] Redeploy service
- [ ] Monitor logs for any errors

---

## Phase 4: Production Deployment (Day 3)

### Pre-Deployment Checklist

**Backend**:
- [ ] Token is set in Railway Variables
- [ ] Backend code is production-ready
- [ ] Error handling is robust
- [ ] No debug logging in stdout
- [ ] Tested with real traffic

**Frontend**:
- [ ] Dashboard page is production-ready
- [ ] No hardcoded localhost URLs
- [ ] Uses `NEXT_PUBLIC_API_URL` env var
- [ ] Error messages are user-friendly
- [ ] Performance is acceptable

**Services**:
- [ ] All services have logger integration
- [ ] Environment variables are configured
- [ ] No hardcoded tokens in code
- [ ] Async logging (non-blocking)
- [ ] Error handling for failed logs

### Deployment Steps

1. **Backend**:
   - [ ] Commit and push code
   - [ ] Railway auto-deploys
   - [ ] Monitor deployment logs
   - [ ] Test endpoint: `curl https://api.railway.app/health`

2. **Frontend**:
   - [ ] Build: `npm run build`
   - [ ] Check build succeeds
   - [ ] Commit and push
   - [ ] Deploy to hosting (Vercel, Railway, etc.)
   - [ ] Test dashboard loads
   - [ ] Verify logs appear from production backend

3. **Services**:
   - [ ] Each service has updated env vars
   - [ ] Each service is redeployed
   - [ ] Monitor for log ingestion errors

### Production Verification

- [ ] Developer dashboard is accessible: `/developer-logs`
- [ ] Logs are flowing from production services
- [ ] No errors in backend logs
- [ ] Response times are acceptable (<100ms)
- [ ] Memory usage is stable
- [ ] No token errors in logs

---

## Phase 5: Monitoring & Maintenance (Ongoing)

### Daily Monitoring
- [ ] Check dashboard daily: `/developer-logs`
- [ ] Look for unusual error patterns
- [ ] Verify logs from all services appear
- [ ] Check response times are acceptable

### Weekly Tasks
- [ ] Review error logs: `curl "$API/api/logs?level=error"`
- [ ] Check memory usage (if self-hosted)
- [ ] Verify token is still working
- [ ] Monitor any failed log ingestions

### Monthly Tasks
- [ ] Review log volume: `curl "$API/api/logs" | wc -l`
- [ ] Plan for token rotation (every 3 months)
- [ ] Review log retention needs
- [ ] Assess if database migration is needed

### Documentation
- [ ] Create team runbook with quick reference
- [ ] Document token locations and rotation
- [ ] Add to incident response procedures
- [ ] Train team on dashboard usage

---

## Phase 6: Token Rotation (Every 3 Months)

### Rotation Process

1. **Generate new token**:
   - [ ] Run: `openssl rand -base64 32`
   - [ ] Store in password manager
   - [ ] Document rotation date

2. **Update Railway**:
   - [ ] Dashboard → Variables
   - [ ] Update `LOGS_TOKEN` to new value
   - [ ] Redeploy application
   - [ ] Wait for deployment complete

3. **Update Services**:
   - [ ] For each service, update `LOGS_TOKEN` env var
   - [ ] Redeploy each service
   - [ ] Monitor logs for token errors

4. **Update Local Dev**:
   - [ ] Update `.env` in `backend_school_crm/`
   - [ ] Restart backend
   - [ ] Update `.env` in frontend (if needed)
   - [ ] Test token works locally

5. **Verification**:
   - [ ] Send test log: `curl -H "Authorization: Bearer $NEW_TOKEN" ...`
   - [ ] Verify logs appear in dashboard
   - [ ] Check for any 401 errors in logs
   - [ ] Document rotation completion

---

## Troubleshooting Checklist

### Logs Not Appearing

#### Check 1: Token Configuration
- [ ] Token is set: `echo $LOGS_TOKEN`
- [ ] Token matches between backend and service
- [ ] Token is set in Railway Variables
- [ ] Token is set in local .env
- [ ] Backend was restarted after env change

#### Check 2: Authorization Header
- [ ] Header format: `Authorization: Bearer <token>` (with space)
- [ ] Not: `Authorization: <token>`
- [ ] Not: `Authorization:Bearer<token>` (no space)
- [ ] Not: `Bearer: <token>`

#### Check 3: Network Connectivity
- [ ] Backend is running/accessible
- [ ] Firewall allows outbound HTTPS
- [ ] API endpoint is correct
- [ ] No proxy issues blocking requests

#### Check 4: Payload Validation
- [ ] Message field is present
- [ ] Service field is present (or defaults to "unknown")
- [ ] JSON is valid (use `jq` to verify)
- [ ] No extra commas or syntax errors

#### Check 5: Service Code
- [ ] Logger is imported
- [ ] sendLog() function is called
- [ ] Correct environment variables are set
- [ ] No try-catch silencing errors

#### Check 6: Frontend
- [ ] Dashboard page loads without errors
- [ ] API_BASE URL is correct
- [ ] CORS is not blocking requests
- [ ] Check browser console for errors

### Invalid Token Error

- [ ] Regenerate token: `openssl rand -base64 32`
- [ ] Update all locations (Railway, .env, services)
- [ ] Redeploy backend
- [ ] Redeploy services
- [ ] Wait 2-3 minutes for propagation
- [ ] Test new token with curl

### Connection Timeout

- [ ] Verify backend is running: `curl https://api.railway.app/health`
- [ ] Check network connectivity: `ping api.railway.app`
- [ ] Increase timeout from 5s to 10s in service code
- [ ] Check backend logs for errors
- [ ] Verify resource limits (CPU, memory)

### High Latency (>1 second)

- [ ] Check backend load: `curl https://api.railway.app/api/logs?limit=1`
- [ ] Reduce log volume (sample logs in production)
- [ ] Check database load (if using Phase 2)
- [ ] Increase timeout window
- [ ] Implement log batching

### Memory Usage High

- [ ] Check current memory usage
- [ ] Reduce max log retention from 10,000 to 5,000
- [ ] Implement log archival to database (Phase 2)
- [ ] Add background cleanup job
- [ ] Monitor over time

### Service Keeps Retrying

- [ ] Check token is correct
- [ ] Look for bearer token format issues
- [ ] Verify LOGS_API URL is correct (HTTPS!)
- [ ] Check if backend is really running
- [ ] Add error logging in service code

---

## Success Criteria

### Phase 1 Complete ✅
- [ ] Token generated and stored securely
- [ ] Local testing passes (valid/invalid tokens work)
- [ ] Railway variable is set and deployed
- [ ] Backend responds to requests with 201/401 correctly

### Phase 2 Complete ✅
- [ ] Dashboard page loads
- [ ] Can retrieve logs via API
- [ ] Filters work (level, service)
- [ ] Auto-refresh shows new logs
- [ ] UI is responsive and clean

### Phase 3 Complete ✅
- [ ] At least 1 service sends logs
- [ ] Logs appear in dashboard within 5 seconds
- [ ] Metadata (request_id, user_id) appears correctly
- [ ] Error logs are captured
- [ ] No blocking or performance issues

### Phase 4 Complete ✅
- [ ] Dashboard is live in production
- [ ] All services send logs
- [ ] Production logs appear in real-time
- [ ] No errors or warnings in deployment logs
- [ ] Response times are <100ms

### Phase 5 Complete ✅
- [ ] Team can access dashboard
- [ ] Team understands how to interpret logs
- [ ] Monitoring process is established
- [ ] Documentation is up-to-date
- [ ] Incident response includes log checking

---

## Files & Documentation

| File | Purpose |
|------|---------|
| `LOGS_INGESTION_SYSTEM.md` | Complete technical overview |
| `RAILWAY_LOGS_SETUP_GUIDE.md` | Step-by-step Railway setup |
| `LOGS_ARCHITECTURE.md` | System design diagrams |
| `LOGS_QUICK_REFERENCE.md` | Quick lookup for commands |
| `LOGS_DATABASE_MIGRATION.md` | PostgreSQL migration guide |
| `developer-logs.tsx` | Frontend React component |
| `internal/handlers/logs.go` | Backend log handlers |
| `internal/config/config.go` | Configuration structure |

---

## Support & Escalation

### Common Issues

| Issue | Solution | Reference |
|-------|----------|-----------|
| Token invalid | Regenerate and redeploy | RAILWAY_LOGS_SETUP_GUIDE.md |
| Logs not appearing | Check token, network, payload | Troubleshooting section |
| High latency | Reduce volume, check backend | LOGS_ARCHITECTURE.md |
| Memory usage | Database migration (Phase 2) | LOGS_DATABASE_MIGRATION.md |

### When to Escalate

- Connection errors persist after redeployment
- Database issues preventing inserts
- Security concerns about token exposure
- Need for >1 month retention

---

**Estimated Total Time**: 3-5 days (depending on team size and number of services)

**Status**: Ready to implement | Last Updated: 2024-01-19
