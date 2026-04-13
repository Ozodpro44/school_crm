# Logging API - curl Examples & Integration

## 🔐 Secure Log Ingestion Endpoint

### POST /api/logs/ingest

Endpoint for Railway services to send logs.

**Requirements:**
- Bearer token in Authorization header
- Valid JSON payload
- Required fields: `service`, `level`, `message`

---

## 📤 Examples by Language

### 1. cURL - Basic

```bash
# Simple log
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_LOGS_TOKEN" \
  -d '{
    "service": "api",
    "level": "info",
    "message": "Application started successfully"
  }'
```

### 2. cURL - With Metadata

```bash
# Log with request tracking
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_LOGS_TOKEN" \
  -d '{
    "service": "api",
    "level": "error",
    "message": "Payment processing failed",
    "metadata": {
      "request_id": "req-12345",
      "user_id": "user-67890",
      "order_id": "order-xyz",
      "error_code": "PAYMENT_TIMEOUT"
    }
  }'
```

### 3. cURL - Warning Log

```bash
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_LOGS_TOKEN" \
  -d '{
    "service": "api",
    "level": "warn",
    "message": "High memory usage detected",
    "metadata": {
      "memory_percent": "85",
      "threshold": "80"
    }
  }'
```

### 4. cURL - Test Invalid Token

```bash
# Should return 401 Unauthorized
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer WRONG_TOKEN" \
  -d '{
    "service": "api",
    "level": "info",
    "message": "This should fail"
  }'
```

---

## 🟢 Node.js / Express

```javascript
// lib/logger.ts
import axios from 'axios';

class RailwayLogger {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    metadata: Record<string, string> = {}
  ) {
    try {
      await axios.post(
        `${this.baseUrl}/api/logs/ingest`,
        {
          service: 'api',
          level,
          message,
          metadata: {
            ...metadata,
            hostname: require('os').hostname(),
            timestamp: new Date().toISOString(),
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );
    } catch (error) {
      // Silently fail to not disrupt main app
      console.error('[Logger] Failed to send log:', error);
    }
  }

  info(message: string, metadata?: Record<string, string>) {
    return this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, string>) {
    return this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, string>) {
    return this.log('error', message, metadata);
  }
}

// Usage
const logger = new RailwayLogger(
  process.env.LOG_SERVER_URL || 'http://localhost:8080',
  process.env.LOGS_TOKEN || ''
);

// Send logs
logger.info('User logged in', { userId: '123' });
logger.error('Payment failed', { orderId: '456', errorCode: 'TIMEOUT' });

export default logger;
```

### Express Middleware

```javascript
// middleware/logging.ts
import express from 'express';
import logger from '../lib/logger';

export function loggingMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const start = Date.now();

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel](
      `${req.method} ${req.path} ${res.statusCode}`,
      {
        method: req.method,
        path: req.path,
        status: res.statusCode.toString(),
        duration_ms: duration.toString(),
        user_id: (req as any).userId || '',
        request_id: req.id || '',
      }
    );
  });

  next();
}

// In your Express app:
app.use(loggingMiddleware);
```

---

## 🐍 Python

```python
# lib/logger.py
import requests
import json
import os
from datetime import datetime
from typing import Optional, Dict

class RailwayLogger:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.token = token

    def _send_log(
        self,
        level: str,
        message: str,
        metadata: Optional[Dict[str, str]] = None
    ) -> bool:
        try:
            response = requests.post(
                f"{self.base_url}/api/logs/ingest",
                headers={
                    'Authorization': f'Bearer {self.token}',
                    'Content-Type': 'application/json',
                },
                json={
                    'service': 'worker',
                    'level': level,
                    'message': message,
                    'metadata': {
                        **(metadata or {}),
                        'timestamp': datetime.utcnow().isoformat(),
                    },
                },
                timeout=5
            )
            return response.status_code == 201
        except Exception as e:
            print(f"[Logger] Failed to send log: {e}")
            return False

    def info(self, message: str, **kwargs):
        return self._send_log('info', message, kwargs)

    def warn(self, message: str, **kwargs):
        return self._send_log('warn', message, kwargs)

    def error(self, message: str, **kwargs):
        return self._send_log('error', message, kwargs)

    def debug(self, message: str, **kwargs):
        return self._send_log('debug', message, kwargs)

# Usage
logger = RailwayLogger(
    base_url=os.getenv('LOG_SERVER_URL', 'http://localhost:8080'),
    token=os.getenv('LOGS_TOKEN', '')
)

# Send logs
logger.info("Worker started processing batch")
logger.error("Task failed", task_id="task-123", retry_count="3")
logger.warn("Queue depth increasing", depth="500")
```

### Flask Integration

```python
# app/middleware.py
from flask import request, g
import time
import logger

@app.before_request
def before_request():
    g.start_time = time.time()

@app.after_request
def after_request(response):
    if hasattr(g, 'start_time'):
        duration = (time.time() - g.start_time) * 1000
        level = 'warn' if response.status_code >= 400 else 'info'
        
        logger.send_log(
            level=level,
            message=f"{request.method} {request.path}",
            metadata={
                'status': str(response.status_code),
                'duration_ms': str(int(duration)),
                'user_id': getattr(g, 'user_id', ''),
                'request_id': request.headers.get('X-Request-ID', ''),
            }
        )
    
    return response
```

---

## 🔷 Go

```go
// pkg/logger/logger.go
package logger

import (
  "bytes"
  "encoding/json"
  "fmt"
  "io"
  "net/http"
  "os"
  "time"
)

type LogPayload struct {
  Service  string            `json:"service"`
  Level    string            `json:"level"`
  Message  string            `json:"message"`
  Metadata map[string]string `json:"metadata,omitempty"`
}

type RailwayLogger struct {
  baseURL string
  token   string
  client  *http.Client
}

func NewRailwayLogger(baseURL, token string) *RailwayLogger {
  return &RailwayLogger{
    baseURL: baseURL,
    token:   token,
    client: &http.Client{
      Timeout: 5 * time.Second,
    },
  }
}

func (l *RailwayLogger) Log(
  level string,
  message string,
  metadata map[string]string,
) error {
  if l.token == "" {
    // Silently skip if no token configured
    return nil
  }

  payload := LogPayload{
    Service:  "api",
    Level:    level,
    Message:  message,
    Metadata: metadata,
  }

  body, err := json.Marshal(payload)
  if err != nil {
    return fmt.Errorf("failed to marshal log: %w", err)
  }

  req, err := http.NewRequest(
    "POST",
    fmt.Sprintf("%s/api/logs/ingest", l.baseURL),
    bytes.NewReader(body),
  )
  if err != nil {
    return fmt.Errorf("failed to create request: %w", err)
  }

  req.Header.Set("Content-Type", "application/json")
  req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", l.token))

  resp, err := l.client.Do(req)
  if err != nil {
    return fmt.Errorf("request failed: %w", err)
  }
  defer resp.Body.Close()

  if resp.StatusCode != http.StatusCreated {
    body, _ := io.ReadAll(resp.Body)
    return fmt.Errorf("unexpected status %d: %s", resp.StatusCode, string(body))
  }

  return nil
}

func (l *RailwayLogger) Info(message string, metadata map[string]string) error {
  return l.Log("info", message, metadata)
}

func (l *RailwayLogger) Warn(message string, metadata map[string]string) error {
  return l.Log("warn", message, metadata)
}

func (l *RailwayLogger) Error(message string, metadata map[string]string) error {
  return l.Log("error", message, metadata)
}

// Usage
logger := NewRailwayLogger(
  os.Getenv("LOG_SERVER_URL"),
  os.Getenv("LOGS_TOKEN"),
)

logger.Info("Request processed", map[string]string{
  "request_id": "req-123",
  "user_id": "user-456",
  "duration_ms": "250",
})

logger.Error("Database connection failed", map[string]string{
  "host": "db.example.com",
  "error_code": "TIMEOUT",
})
```

---

## 🐳 Docker / Docker Compose

### Environment Variables

Add to your `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    image: your-app:latest
    environment:
      LOG_SERVER_URL: http://api:8080  # Point to backend
      LOGS_TOKEN: ${LOGS_TOKEN}         # From .env
      SERVICE_NAME: api
    depends_on:
      - postgres
      - redis

  worker:
    image: your-worker:latest
    environment:
      LOG_SERVER_URL: http://api:8080
      LOGS_TOKEN: ${LOGS_TOKEN}
      SERVICE_NAME: worker

  scheduler:
    image: your-scheduler:latest
    environment:
      LOG_SERVER_URL: http://api:8080
      LOGS_TOKEN: ${LOGS_TOKEN}
      SERVICE_NAME: scheduler
```

### Health Check with Logging

```bash
#!/bin/bash
# scripts/health-check.sh

BASE_URL=${LOG_SERVER_URL:-http://localhost:8080}
TOKEN=${LOGS_TOKEN}
SERVICE=${SERVICE_NAME:-api}

# Check if API is healthy
if curl -f ${BASE_URL}/health > /dev/null 2>&1; then
  echo "OK: Health check passed"
  # Log success
  curl -X POST ${BASE_URL}/api/logs/ingest \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "{
      \"service\": \"${SERVICE}\",
      \"level\": \"info\",
      \"message\": \"Health check passed\"
    }" || true
  exit 0
else
  echo "FAIL: Health check failed"
  exit 1
fi
```

---

## 🔄 Batch Logging (Multiple Logs at Once)

### Node.js

```typescript
async function sendBatchLogs(logs: LogPayload[]): Promise<void> {
  const promises = logs.map(log =>
    axios.post(
      `${baseUrl}/api/logs/ingest`,
      log,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )
  );

  await Promise.allSettled(promises);
}

// Queue logs and send in batches
const logQueue: LogPayload[] = [];
const BATCH_SIZE = 10;
const BATCH_DELAY = 5000; // 5 seconds

function addLog(log: LogPayload) {
  logQueue.push(log);
  if (logQueue.length >= BATCH_SIZE) {
    flushLogs();
  }
}

function flushLogs() {
  if (logQueue.length === 0) return;
  const batch = logQueue.splice(0, BATCH_SIZE);
  sendBatchLogs(batch);
}

// Flush remaining logs on exit
process.on('SIGTERM', async () => {
  await flushLogs();
  process.exit(0);
});
```

---

## ✅ Testing Endpoint Accessibility

### Check endpoint is reachable

```bash
# From your Docker container
curl -I http://api:8080/api/logs/ingest
# Should return: HTTP/1.1 401 Unauthorized (or 405 Method Not Allowed for GET)
```

### Check token validation

```bash
# Valid token
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer YOUR_ACTUAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"service":"test","level":"info","message":"test"}' \
  -w "\nStatus: %{http_code}\n"

# Invalid token
curl -X POST http://localhost:8080/api/logs/ingest \
  -H "Authorization: Bearer WRONG" \
  -H "Content-Type: application/json" \
  -d '{"service":"test","level":"info","message":"test"}' \
  -w "\nStatus: %{http_code}\n"
```

---

## 📊 Monitoring Log Ingestion

### Check logs are being stored

```bash
# From backend
curl http://localhost:8080/api/logs?limit=10

# Filter by level
curl http://localhost:8080/api/logs?level=error

# Filter by module
curl http://localhost:8080/api/logs?module=railway
```

### Frontend dashboard

Navigate to: `http://localhost:5173/logs`

---

## 🚨 Common Issues & Solutions

### 401 Unauthorized

```bash
# Check LOGS_TOKEN matches
echo $LOGS_TOKEN

# Ensure Bearer format
# Correct: Authorization: Bearer xxxxx
# Wrong:  Authorization: xxxxx
# Wrong:  Bearer: xxxxx
```

### 400 Bad Request

```bash
# Ensure JSON is valid
curl -X POST ... -d '{
  "service": "api",     # Required
  "level": "info",      # Required
  "message": "test"     # Required
}'

# Missing field
curl -X POST ... -d '{"service":"api"}'  # ❌ Missing level and message
```

### Connection Refused

```bash
# Check backend is running
curl http://localhost:8080/health

# Check correct URL
# Local: http://localhost:8080/api/logs/ingest
# Production: https://your-app.railway.app/api/logs/ingest
```

### Logs not appearing in dashboard

1. Verify request returned 201 Created
2. Check `X-Request-ID` header in response
3. Query `/api/logs?limit=100` to see all logs
4. Check browser DevTools → Network tab
