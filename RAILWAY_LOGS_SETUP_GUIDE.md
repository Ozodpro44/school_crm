# Railway Log Ingestion Setup Guide

## Overview

This guide covers setting up secure log ingestion from your Railway-deployed services to your backend.

## Step 1: Generate a Secure Token

Run this on your local machine to generate a cryptographically secure token:

```bash
# macOS / Linux
openssl rand -base64 32

# Example output:
# eXvK7pL9mNq8xR2wB4cD5fG6hJ1kL2oP3sT4uV5xY6zA=

# Save this token somewhere safe (password manager, secure notes, etc.)
```

### Token Requirements
- **Length**: 32+ characters
- **Format**: Base64 encoded
- **Secrecy**: Treat like a password
- **Rotation**: Change every 3-6 months

---

## Step 2: Add Token to Railway Project Variables

### Via Railway Dashboard

1. **Go to Railway Dashboard**:
   - https://railway.app/dashboard

2. **Select Your Project**:
   - Click on your School CRM project

3. **Open Settings**:
   - Navigate to Settings → Variables

4. **Add New Variable**:
   - Click "Add Variable"
   - Name: `LOGS_TOKEN`
   - Value: `[paste your generated token]`
   - Click "Add"

5. **Redeploy Application**:
   - Go to Deployments
   - Click "Redeploy" on the latest deployment
   - Wait for deployment to complete (~2-3 minutes)

### Via Railway CLI

```bash
# Install Railway CLI if not already installed
npm i -g @railway/cli

# Login to Railway
railway login

# Select your project
railway project select

# Add the token
railway variable set LOGS_TOKEN=eXvK7pL9mNq8xR2wB4cD5fG6hJ1kL2oP3sT4uV5xY6zA=

# Redeploy
railway up
```

---

## Step 3: Update Backend .env (Local Development)

Create or update `.env` in `backend_school_crm/`:

```bash
# Copy from .env.example
cp backend_school_crm/.env.example backend_school_crm/.env

# Edit the file
nano backend_school_crm/.env

# Add this line (use the same token as Railway)
LOGS_TOKEN=eXvK7pL9mNq8xR2wB4cD5fG6hJ1kL2oP3sT4uV5xY6zA=
```

Restart your local backend:

```bash
cd backend_school_crm
go run cmd/main.go
```

---

## Step 4: Verify Token is Working

### Test from Local Machine

```bash
# Set variables
TOKEN="eXvK7pL9mNq8xR2wB4cD5fG6hJ1kL2oP3sT4uV5xY6zA="
API_URL="http://localhost:8080"  # local testing

# Send test log
curl -X POST "$API_URL/api/logs/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "service": "test",
    "level": "info",
    "message": "Token verification successful",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "metadata": {
      "request_id": "test_123",
      "user_id": "test_user"
    }
  }'

# Expected response:
# {"status":"logged"}
```

### Test Production Railway Endpoint

```bash
# Set variables
TOKEN="eXvK7pL9mNq8xR2wB4cD5fG6hJ1kL2oP3sT4uV5xY6zA="
API_URL="https://your-railway-domain.up.railway.app"

# Send test log to production
curl -X POST "$API_URL/api/logs/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "service": "railway-test",
    "level": "info",
    "message": "Production token verification",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

### View Logs in Developer Dashboard

1. **Local**: Navigate to `http://localhost:3000/developer-logs`
2. **Production**: Navigate to `https://your-frontend-domain.com/developer-logs`

---

## Step 5: Configure Services to Send Logs

### For Each Service (API, Workers, Crons)

#### Node.js / Express Service

Create `lib/logger.js`:

```javascript
const LOGS_API = process.env.LOGS_API || 'http://localhost:8080';
const LOGS_TOKEN = process.env.LOGS_TOKEN;

async function sendLog(service, level, message, metadata = {}) {
  if (!LOGS_TOKEN) {
    console.warn('LOGS_TOKEN not configured, skipping log ingestion');
    return;
  }

  try {
    const response = await fetch(`${LOGS_API}/api/logs/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOGS_TOKEN}`,
      },
      body: JSON.stringify({
        service: service || 'api',
        level: level || 'info',
        message: message || 'No message',
        timestamp: new Date().toISOString(),
        metadata: {
          request_id: metadata.request_id,
          user_id: metadata.user_id,
          ...metadata,
        },
      }),
    });

    if (!response.ok) {
      console.error('Failed to send log:', response.statusText);
    }
  } catch (error) {
    console.error('Log ingestion error:', error);
    // Don't throw - logging failures shouldn't crash the app
  }
}

module.exports = { sendLog };
```

Usage in your Express routes:

```javascript
const { sendLog } = require('./lib/logger');

app.post('/api/payments', async (req, res) => {
  try {
    // Process payment
    const result = await processPayment(req.body);
    
    // Send success log
    await sendLog('api', 'info', 'Payment processed successfully', {
      request_id: req.id,
      user_id: req.user?.id,
    });
    
    res.json(result);
  } catch (error) {
    // Send error log
    await sendLog('api', 'error', error.message, {
      request_id: req.id,
      user_id: req.user?.id,
    });
    
    res.status(500).json({ error: error.message });
  }
});
```

Add to your Railway environment variables:

```
LOGS_API=https://your-railway-domain.up.railway.app
LOGS_TOKEN=eXvK7pL9mNq8xR2wB4cD5fG6hJ1kL2oP3sT4uV5xY6zA=
```

#### Python / FastAPI Service

Create `app/logger.py`:

```python
import httpx
import os
from datetime import datetime
from typing import Optional, Dict, Any

class LogClient:
    def __init__(self):
        self.logs_api = os.getenv("LOGS_API", "http://localhost:8080")
        self.logs_token = os.getenv("LOGS_TOKEN")
        self.service = os.getenv("SERVICE_NAME", "python-service")
    
    async def send_log(
        self, 
        level: str, 
        message: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        if not self.logs_token:
            print("LOGS_TOKEN not configured, skipping log ingestion")
            return
        
        headers = {
            "Authorization": f"Bearer {self.logs_token}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "service": self.service,
            "level": level,
            "message": message,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "metadata": metadata or {},
        }
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(
                    f"{self.logs_api}/api/logs/ingest",
                    json=payload,
                    headers=headers,
                )
                
                if response.status_code != 201:
                    print(f"Failed to send log: {response.status_code}")
        except Exception as e:
            print(f"Log ingestion error: {e}")

# Global instance
log_client = LogClient()
```

Usage in your routes:

```python
from app.logger import log_client

@app.post("/api/payments")
async def create_payment(request: PaymentRequest):
    try:
        result = await process_payment(request)
        
        await log_client.send_log(
            level="info",
            message="Payment processed successfully",
            metadata={
                "request_id": request.id,
                "user_id": request.user_id,
            }
        )
        
        return result
    except Exception as error:
        await log_client.send_log(
            level="error",
            message=str(error),
            metadata={
                "request_id": request.id,
                "user_id": request.user_id,
            }
        )
        raise
```

#### Go Service

Use the `SendLog` function from the main architecture guide:

```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type LogPayload struct {
	Service   string            `json:"service"`
	Level     string            `json:"level"`
	Message   string            `json:"message"`
	Timestamp string            `json:"timestamp"`
	Metadata  map[string]string `json:"metadata"`
}

func SendLog(level, message string, metadata map[string]string) {
	logsAPI := os.Getenv("LOGS_API")
	if logsAPI == "" {
		logsAPI = "http://localhost:8080"
	}
	logsToken := os.Getenv("LOGS_TOKEN")
	serviceName := os.Getenv("SERVICE_NAME")
	if serviceName == "" {
		serviceName = "go-service"
	}

	payload := LogPayload{
		Service:   serviceName,
		Level:     level,
		Message:   message,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Metadata:  metadata,
	}

	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest(
		"POST",
		logsAPI+"/api/logs/ingest",
		bytes.NewBuffer(body),
	)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", logsToken))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	
	go func() {
		if _, err := client.Do(req); err != nil {
			fmt.Printf("Log ingestion error: %v\n", err)
		}
	}()
}

// Usage
SendLog("info", "Payment processed", map[string]string{
	"user_id": "user_123",
	"request_id": "req_456",
})
```

---

## Step 6: Configure Each Railway Service

For each service deployed on Railway (API, Worker, Cron):

### 1. Add Environment Variables

In Railway Dashboard → Your Service → Variables:

```
LOGS_API=https://your-railway-domain.up.railway.app
LOGS_TOKEN=eXvK7pL9mNq8xR2wB4cD5fG6hJ1kL2oP3sT4uV5xY6zA=
SERVICE_NAME=api  (or worker, cron, etc.)
```

### 2. Update Code

Add log calls at strategic points:

- **API**: After request processing, before response
- **Worker**: Before and after job execution
- **Cron**: Start, end, error handling
- **Database**: Connection errors, slow queries
- **Auth**: Login attempts, token validation

### 3. Redeploy

```bash
# Via Railway CLI
railway deploy --service api

# Or via Dashboard: Click Redeploy
```

---

## Step 7: Verify Logs Flow

### 1. Generate Some Activity

```bash
# Test your API endpoints to generate logs
curl http://localhost:3000/api/students
curl http://localhost:3000/api/payments
```

### 2. Check Developer Dashboard

Visit the Logs page and verify:
- Logs appear in real-time
- Timestamps are correct
- Services are identified correctly
- Metadata is populated

### 3. Monitor Production

Once deployed:
1. Access your frontend app
2. Navigate to `/developer-logs`
3. Verify logs from Railway are flowing

---

## Monitoring Checklist

- [ ] Token is set in Railway Variables
- [ ] Token is set in local `.env`
- [ ] Backend redeployed with token
- [ ] All services have LOGS_API and LOGS_TOKEN variables
- [ ] Services have log calls in key code paths
- [ ] Developer dashboard shows logs in real-time
- [ ] Error logs are captured
- [ ] Metadata (request_id, user_id) is populated

---

## Troubleshooting

### Logs Not Appearing

**Check 1**: Token is set
```bash
railway variable list
# Should show LOGS_TOKEN
```

**Check 2**: Endpoint is accessible
```bash
curl -i https://your-railway-domain.up.railway.app/health
# Should return 200 OK
```

**Check 3**: Token validation
```bash
TOKEN="your_token"
API="https://your-railway-domain.up.railway.app"

curl -X POST "$API/api/logs/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service":"test","level":"info","message":"Test"}'

# Should return 201 Created
```

**Check 4**: Service is sending logs
```bash
# In your service code, add console output:
console.log('Sending log to:', LOGS_API);
console.log('Token length:', LOGS_TOKEN.length);

# Look for these in Railway logs:
railway logs --service api
```

### Invalid Token Error

```
Response: {"error":"Invalid token"}
```

**Solution**:
1. Verify token in Railway variables: `railway variable list`
2. Verify token in service code matches
3. Check Bearer format: `Authorization: Bearer <token>` (note the space)

### Connection Timeout

```
Error: Connect timeout
```

**Solution**:
1. Verify endpoint URL is correct
2. Check backend is running: `curl https://your-domain.up.railway.app/health`
3. Increase timeout if needed (backend processes could be slow on free tier)

### High Latency

- Increase ingestion timeout from 5s to 10s
- Implement log batching (send 10-50 logs at once)
- Reduce log verbosity in production

---

## Security Best Practices

### Token Security

✅ **DO**:
- Store in Railway Variables (not in code)
- Store in `.env` locally (add to `.gitignore`)
- Rotate every 3-6 months
- Use different tokens for dev/staging/prod

❌ **DON'T**:
- Commit token to git
- Share token in Slack/email
- Hardcode token in source code
- Use same token across environments

### Token Rotation

When rotating the token:

1. Generate new token: `openssl rand -base64 32`
2. Update Railway Variable: `LOGS_TOKEN=<new-token>`
3. Redeploy application
4. Update all services: `LOGS_TOKEN=<new-token>`
5. Redeploy all services
6. Monitor logs for errors
7. Delete old token from secure storage

---

## Performance Notes

- **Throughput**: ~1000 logs/second
- **Latency**: <10ms average
- **Max Retention**: 10,000 logs (~1-2 hours)
- **Memory**: ~10MB for 10,000 logs

For higher volume:
- Implement log sampling (send every Nth log)
- Batch logs (wait for 50 logs before sending)
- Archive old logs to database
- Consider dedicated logging service (ELK, Datadog, etc.)

---

## Production Deployment Checklist

- [ ] Token generated and securely stored
- [ ] Token added to Railway Variables
- [ ] Token added to local .env
- [ ] Backend code verified and redeployed
- [ ] All services updated with LOGS_API and LOGS_TOKEN
- [ ] All services redeployed
- [ ] Developer dashboard is accessible
- [ ] Test logs appear in dashboard
- [ ] Error handling implemented
- [ ] Token rotation process documented
- [ ] Team trained on log ingestion system
- [ ] Monitoring dashboards created

---

## Next Steps

1. ✅ **Complete Setup** (this guide)
2. 📊 **View Logs** in developer dashboard
3. 📈 **Add More Logs** to critical code paths
4. 🔄 **Set Up Rotation** process for tokens
5. 📤 **Archive to Database** for long-term storage (future upgrade)

---

**Questions?** Check the main `LOGS_INGESTION_SYSTEM.md` for technical details.
