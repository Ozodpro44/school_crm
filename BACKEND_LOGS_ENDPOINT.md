# Backend Logs Endpoint Implementation

## Overview

To enable real deployment logs in the frontend, your backend needs a `/logs` endpoint that returns application logs.

## Current Behavior

The frontend now tries to fetch logs in this order:
1. **Backend API** (`GET /api/logs`) - Real application logs
2. **Railway API** (if credentials configured) - Railway deployment logs
3. **Mock logs** (fallback) - Hardcoded sample logs

## Backend Implementation

Add this endpoint to your Go backend:

### Option 1: In-Memory Log Storage (Simple)

```go
package main

import (
    "sync"
    "time"
)

var (
    logs []Log
    logMutex sync.RWMutex
)

type Log struct {
    ID        string    `json:"id"`
    Timestamp time.Time `json:"timestamp"`
    Level     string    `json:"level"`      // info, warn, error, debug
    Module    string    `json:"module"`     // auth, payments, students, etc
    Message   string    `json:"message"`
    Details   string    `json:"details,omitempty"`
    StackTrace string  `json:"stackTrace,omitempty"`
    RequestID string   `json:"requestId,omitempty"`
    UserID    string   `json:"userId,omitempty"`
    Branch    string   `json:"branch,omitempty"`
}

// Add this to your router in main.go
func logsHandler(c *gin.Context) {
    limit := 100
    if l := c.Query("limit"); l != "" {
        if parsed, err := strconv.Atoi(l); err == nil {
            limit = parsed
        }
    }

    logMutex.RLock()
    defer logMutex.RUnlock()

    start := 0
    if len(logs) > limit {
        start = len(logs) - limit
    }

    c.JSON(200, logs[start:])
}

// Call this when logging events
func addLog(level, module, message string) {
    logMutex.Lock()
    defer logMutex.Unlock()

    log := Log{
        ID:        uuid.New().String(),
        Timestamp: time.Now(),
        Level:     level,
        Module:    module,
        Message:   message,
    }

    logs = append(logs, log)

    // Keep only last 10000 logs
    if len(logs) > 10000 {
        logs = logs[1:]
    }
}

// In your main router setup:
// api.GET("/logs", logsHandler)
```

### Option 2: Database Storage (Production)

Create a logs table in your database:

```sql
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT NOW(),
    level VARCHAR(10),      -- info, warn, error, debug
    module VARCHAR(50),     -- auth, payments, students, etc
    message TEXT NOT NULL,
    details TEXT,
    stack_trace TEXT,
    request_id UUID,
    user_id UUID REFERENCES users(id),
    branch_id UUID REFERENCES branches(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX idx_logs_module ON logs(module);
CREATE INDEX idx_logs_level ON logs(level);
```

Then in Go:

```go
func getLogsHandler(c *gin.Context) {
    limit := 100
    if l := c.Query("limit"); l != "" {
        if parsed, err := strconv.Atoi(l); err == nil {
            limit = parsed
        }
    }

    module := c.Query("module")
    level := c.Query("level")

    var query string
    args := []interface{}{limit}

    query = "SELECT id, timestamp, level, module, message, details, stack_trace, request_id, user_id FROM logs"

    if module != "" || level != "" {
        query += " WHERE"
        if module != "" {
            query += " module = $2"
            args = append(args, module)
        }
        if level != "" {
            if module != "" {
                query += " AND"
            }
            query += " level = $" + fmt.Sprintf("%d", len(args)+1)
            args = append(args, level)
        }
    }

    query += " ORDER BY timestamp DESC LIMIT $1"

    rows, err := db.Query(query, args...)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    defer rows.Close()

    var logs []Log
    for rows.Next() {
        var log Log
        rows.Scan(&log.ID, &log.Timestamp, &log.Level, &log.Module, 
            &log.Message, &log.Details, &log.StackTrace, &log.RequestID, &log.UserID)
        logs = append(logs, log)
    }

    c.JSON(200, logs)
}

// In main router:
// api.GET("/logs", getLogsHandler)
```

### Option 3: Use Existing Logs from File/Docker

If you're already logging to a file or Docker container:

```go
import (
    "bufio"
    "os"
    "strings"
)

func getLogsFromFile(c *gin.Context) {
    limit := 100
    if l := c.Query("limit"); l != "" {
        if parsed, err := strconv.Atoi(l); err == nil {
            limit = parsed
        }
    }

    file, err := os.Open("/var/log/app.log")
    if err != nil {
        c.JSON(500, gin.H{"error": "logs not available"})
        return
    }
    defer file.Close()

    scanner := bufio.NewScanner(file)
    var lines []string
    
    for scanner.Scan() {
        lines = append(lines, scanner.Text())
    }

    start := 0
    if len(lines) > limit {
        start = len(lines) - limit
    }

    var logs []Log
    for i := start; i < len(lines); i++ {
        // Parse your log format and create Log struct
        // Example assumes format: [TIMESTAMP] [LEVEL] [MODULE] message
        parts := strings.Split(lines[i], "]")
        if len(parts) >= 4 {
            log := Log{
                ID:      uuid.New().String(),
                Message: strings.TrimSpace(parts[3]),
            }
            // Parse timestamp, level, module from parts[0], parts[1], parts[2]
            logs = append(logs, log)
        }
    }

    c.JSON(200, logs)
}
```

## API Endpoint

### GET /api/logs

**Query Parameters:**
- `limit` (optional) - Number of logs to return (default: 100)
- `module` (optional) - Filter by module (auth, payments, students, etc)
- `level` (optional) - Filter by level (info, warn, error, debug)

**Response:**
```json
[
  {
    "id": "uuid",
    "timestamp": "2024-01-18T18:39:31.932Z",
    "level": "INFO",
    "module": "backend",
    "message": "API server started on port 8080",
    "details": "optional details",
    "stackTrace": "optional stack trace",
    "requestId": "optional request id",
    "userId": "optional user id",
    "branch": "optional branch name"
  }
]
```

## How to Log Events

Wrap your logging in a function that adds to the logs:

```go
func LogEvent(level, module, message string, details ...map[string]interface{}) {
    // Log to your logging system (stdout, file, etc)
    log.Printf("[%s] [%s] %s", level, module, message)
    
    // Also add to database/in-memory logs
    addLog(level, module, message)
}
```

Then use it:

```go
LogEvent("info", "auth", "User logged in", map[string]interface{}{"userId": user.ID})
LogEvent("error", "payments", "Payment failed", map[string]interface{}{"amount": 5000})
LogEvent("warn", "students", "Multiple failed login attempts", map[string]interface{}{"ip": c.ClientIP()})
```

## Integration Points

Log these events in your existing handlers:

### Auth Module
```go
LogEvent("info", "auth", fmt.Sprintf("User %s logged in", user.Email))
LogEvent("warn", "auth", fmt.Sprintf("Failed login attempt for %s from %s", email, c.ClientIP()))
```

### Payments Module
```go
LogEvent("info", "payments", fmt.Sprintf("Payment created: %d", amount))
LogEvent("error", "payments", fmt.Sprintf("Payment failed: %v", err))
```

### Students Module
```go
LogEvent("info", "students", fmt.Sprintf("Student %s enrolled", student.FullName))
LogEvent("warn", "students", fmt.Sprintf("Student %s status changed", student.ID))
```

## Frontend Usage

Once implemented, the frontend will:

1. Fetch logs from `/api/logs` automatically
2. Display real application logs in the Logs page
3. Fall back to Railway logs if backend not available
4. Fall back to mock logs as last resort

No frontend code changes needed after backend implementation.

## Testing

```bash
# Test the endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/logs?limit=10

# Test with filters
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/logs?module=payments&level=error
```

## Performance Considerations

- **Database:** Create indexes on timestamp, module, level for fast queries
- **In-Memory:** Limit to 10,000 most recent logs to save memory
- **Retention:** Consider archiving old logs (older than 30 days)
- **Pagination:** For large datasets, add offset/page parameters

## Deployment

After implementing the logs endpoint:

1. Deploy backend with `/api/logs` endpoint
2. Frontend will automatically start showing real logs
3. No frontend configuration needed
4. Logs page will show actual deployment logs

See `REAL_DATA_INTEGRATION_COMPLETE.md` for frontend status.
