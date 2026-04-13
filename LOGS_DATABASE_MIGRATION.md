# Log Ingestion - Database Migration Guide

## When to Migrate to Database

### Current In-Memory Storage (Phase 1)
✅ Good for:
- 1-10 services
- 100-1000 logs/second
- 1-2 weeks retention
- Development/staging

### When to Upgrade (Phase 2)
🔄 Migrate to PostgreSQL when:
- [ ] Logs exceed 10,000 per day
- [ ] Need retention > 2 weeks
- [ ] Need full-text search
- [ ] Planning multi-instance deployment
- [ ] Want log archives and audit trails

---

## Phase 2: PostgreSQL Storage

### Database Schema

```sql
-- Create logs table
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL,
    module VARCHAR(100),
    message TEXT NOT NULL,
    details TEXT,
    stack_trace TEXT,
    request_id VARCHAR(100),
    user_id VARCHAR(100),
    branch VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Indexes for common queries
    CONSTRAINT chk_level CHECK (level IN ('debug', 'info', 'warn', 'error'))
);

-- Create indexes for performance
CREATE INDEX idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_service ON logs(service);
CREATE INDEX idx_logs_request_id ON logs(request_id);
CREATE INDEX idx_logs_user_id ON logs(user_id);
CREATE INDEX idx_logs_level_created_at ON logs(level, created_at DESC);

-- Create index for full-text search (optional)
CREATE INDEX idx_logs_message_search ON logs USING GIN(
    to_tsvector('english', message || ' ' || COALESCE(details, ''))
);

-- Create table for log retention policies
CREATE TABLE log_retention_policies (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) UNIQUE NOT NULL,
    retention_days INTEGER NOT NULL DEFAULT 90,
    
    CONSTRAINT chk_retention CHECK (retention_days > 0)
);

INSERT INTO log_retention_policies (level, retention_days) VALUES
    ('debug', 7),
    ('info', 30),
    ('warn', 90),
    ('error', 365);

-- Create archived logs table (optional, for long-term storage)
CREATE TABLE logs_archived (
    LIKE logs INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create partition for each month
CREATE TABLE logs_archived_2024_01 PARTITION OF logs_archived
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Migration Steps

#### Step 1: Add Database Queries

Create `internal/db/logs.go`:

```go
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type LogRecord struct {
	ID        string
	Timestamp time.Time
	Level     string
	Service   string
	Module    string
	Message   string
	Details   string
	Stack     string
	RequestID string
	UserID    string
	Branch    string
}

// InsertLog stores a log entry in the database
func (db *Database) InsertLog(ctx context.Context, log LogRecord) error {
	query := `
		INSERT INTO logs (
			id, service, level, module, message, details, 
			stack_trace, request_id, user_id, branch, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
		)
	`

	if log.ID == "" {
		log.ID = uuid.New().String()
	}
	if log.Timestamp.IsZero() {
		log.Timestamp = time.Now()
	}

	_, err := db.pool.Exec(ctx, query,
		log.ID, log.Service, log.Level, log.Module,
		log.Message, log.Details, log.Stack,
		log.RequestID, log.UserID, log.Branch, log.Timestamp,
	)
	return err
}

// GetLogs retrieves logs with filtering
func (db *Database) GetLogs(
	ctx context.Context,
	filter LogFilter,
	limit int,
) ([]LogRecord, error) {
	query := "SELECT id, service, level, module, message, details, stack_trace, request_id, user_id, branch, created_at FROM logs WHERE 1=1"
	args := []interface{}{}
	argNum := 1

	if filter.Level != "" && filter.Level != "all" {
		query += fmt.Sprintf(" AND level = $%d", argNum)
		args = append(args, filter.Level)
		argNum++
	}

	if filter.Service != "" {
		query += fmt.Sprintf(" AND service = $%d", argNum)
		args = append(args, filter.Service)
		argNum++
	}

	if filter.Module != "" {
		query += fmt.Sprintf(" AND module = $%d", argNum)
		args = append(args, filter.Module)
		argNum++
	}

	if !filter.StartTime.IsZero() {
		query += fmt.Sprintf(" AND created_at >= $%d", argNum)
		args = append(args, filter.StartTime)
		argNum++
	}

	if !filter.EndTime.IsZero() {
		query += fmt.Sprintf(" AND created_at <= $%d", argNum)
		args = append(args, filter.EndTime)
		argNum++
	}

	query += " ORDER BY created_at DESC"
	query += fmt.Sprintf(" LIMIT $%d", argNum)
	args = append(args, limit)

	rows, err := db.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []LogRecord
	for rows.Next() {
		var log LogRecord
		if err := rows.Scan(
			&log.ID, &log.Service, &log.Level, &log.Module,
			&log.Message, &log.Details, &log.Stack,
			&log.RequestID, &log.UserID, &log.Branch, &log.Timestamp,
		); err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}

	return logs, rows.Err()
}

// ClearOldLogs deletes logs older than retention period
func (db *Database) ClearOldLogs(ctx context.Context) error {
	query := `
		DELETE FROM logs
		WHERE created_at < NOW() - INTERVAL '1 day' * (
			SELECT retention_days FROM log_retention_policies 
			WHERE level = logs.level
			LIMIT 1
		)
	`
	_, err := db.pool.Exec(ctx, query)
	return err
}

// GetLogStats returns statistics about logs
func (db *Database) GetLogStats(ctx context.Context) (map[string]int, error) {
	query := `
		SELECT level, COUNT(*) as count
		FROM logs
		WHERE created_at > NOW() - INTERVAL '24 hours'
		GROUP BY level
	`

	rows, err := db.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make(map[string]int)
	for rows.Next() {
		var level string
		var count int
		if err := rows.Scan(&level, &count); err != nil {
			return nil, err
		}
		stats[level] = count
	}

	return stats, rows.Err()
}
```

#### Step 2: Update Log Handler

Modify `internal/handlers/logs.go`:

```go
package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/db"
)

// IngestLogsHandler with database storage
func IngestLogsHandlerDB(database *db.Database, logsToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Validate token (same as before)
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Missing Authorization header",
			})
			return
		}

		var token string
		if _, err := fmt.Sscanf(authHeader, "Bearer %s", &token); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid Authorization format",
			})
			return
		}

		if logsToken == "" || token != logsToken {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid token",
			})
			return
		}

		// Parse payload
		var payload RailwayLogPayload
		if err := c.BindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Invalid JSON: %v", err),
			})
			return
		}

		// Validate required fields
		if payload.Message == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Message is required",
			})
			return
		}

		if payload.Level == "" {
			payload.Level = "info"
		}
		if payload.Service == "" {
			payload.Service = "unknown"
		}

		// Insert into database
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		logRecord := db.LogRecord{
			Timestamp: time.Now(),
			Level:     payload.Level,
			Service:   payload.Service,
			Module:    "railway",
			Message:   payload.Message,
		}

		if payload.Metadata != nil {
			if rid, ok := payload.Metadata["request_id"]; ok {
				logRecord.RequestID = rid
			}
			if uid, ok := payload.Metadata["user_id"]; ok {
				logRecord.UserID = uid
			}
		}

		if err := database.InsertLog(ctx, logRecord); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("Failed to store log: %v", err),
			})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"status": "logged",
		})
	}
}

// GetLogsHandler with database queries
func GetLogsHandlerDB(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 100
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 1000 {
				limit = parsed
			}
		}

		filter := db.LogFilter{
			Level:   c.Query("level"),
			Service: c.Query("service"),
			Module:  c.Query("module"),
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		logs, err := database.GetLogs(ctx, filter, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("Failed to fetch logs: %v", err),
			})
			return
		}

		c.JSON(http.StatusOK, logs)
	}
}
```

#### Step 3: Add Migration to Database Initialization

Update `internal/db/migrations.go`:

```go
// RunMigrations executes all pending migrations
func (db *Database) RunMigrations(ctx context.Context) error {
	migrationSql := `
	-- Create logs table if not exists
	CREATE TABLE IF NOT EXISTS logs (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		service VARCHAR(50) NOT NULL,
		level VARCHAR(20) NOT NULL,
		module VARCHAR(100),
		message TEXT NOT NULL,
		details TEXT,
		stack_trace TEXT,
		request_id VARCHAR(100),
		user_id VARCHAR(100),
		branch VARCHAR(100),
		created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
		CONSTRAINT chk_level CHECK (level IN ('debug', 'info', 'warn', 'error'))
	);

	-- Create indexes
	CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
	CREATE INDEX IF NOT EXISTS idx_logs_service ON logs(service);
	CREATE INDEX IF NOT EXISTS idx_logs_level_created_at ON logs(level, created_at DESC);

	-- Create retention policies table
	CREATE TABLE IF NOT EXISTS log_retention_policies (
		id SERIAL PRIMARY KEY,
		level VARCHAR(20) UNIQUE NOT NULL,
		retention_days INTEGER NOT NULL DEFAULT 90,
		CONSTRAINT chk_retention CHECK (retention_days > 0)
	);

	-- Insert default policies
	INSERT INTO log_retention_policies (level, retention_days) VALUES
		('debug', 7),
		('info', 30),
		('warn', 90),
		('error', 365)
	ON CONFLICT (level) DO NOTHING;
	`

	_, err := db.pool.Exec(ctx, migrationSql)
	return err
}
```

#### Step 4: Add Cleanup Background Job

Create `internal/service/log_cleanup_service.go`:

```go
package service

import (
	"context"
	"log"
	"time"

	"github.com/school-crm/backend/internal/db"
)

// StartLogCleanupService starts a background job to clean old logs
func StartLogCleanupService(database *db.Database) {
	go func() {
		ticker := time.NewTicker(24 * time.Hour) // Run daily
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
				if err := database.ClearOldLogs(ctx); err != nil {
					log.Printf("Error cleaning old logs: %v", err)
				}
				cancel()
			}
		}
	}()
	
	log.Println("Log cleanup service started")
}
```

#### Step 5: Update main.go

```go
// In main()

// Initialize database (existing)
database, err := db.New(context.Background(), cfg.DatabaseURL)
if err != nil {
	log.Fatalf("Failed to connect to database: %v", err)
}
defer database.Close()

// Run migrations (existing)
if err := database.RunMigrations(context.Background()); err != nil {
	log.Fatalf("Failed to run migrations: %v", err)
}

// Start log cleanup service (NEW)
service.StartLogCleanupService(database)

// ... rest of setup ...

// Replace in-memory handlers with database handlers
router.POST("/api/logs/ingest", handlers.IngestLogsHandlerDB(database, cfg.LogsToken))
router.GET("/api/logs", handlers.GetLogsHandlerDB(database))
```

---

## Phase 3: Advanced Features

### Full-Text Search

```go
// In db/logs.go

// SearchLogs performs full-text search on logs
func (db *Database) SearchLogs(
	ctx context.Context,
	query string,
	limit int,
) ([]LogRecord, error) {
	sqlQuery := `
		SELECT id, service, level, module, message, details, 
		       stack_trace, request_id, user_id, branch, created_at
		FROM logs
		WHERE to_tsvector('english', message || ' ' || COALESCE(details, ''))
		      @@ plainto_tsquery('english', $1)
		ORDER BY created_at DESC
		LIMIT $2
	`

	rows, err := db.pool.Query(ctx, sqlQuery, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []LogRecord
	for rows.Next() {
		var log LogRecord
		if err := rows.Scan(
			&log.ID, &log.Service, &log.Level, &log.Module,
			&log.Message, &log.Details, &log.Stack,
			&log.RequestID, &log.UserID, &log.Branch, &log.Timestamp,
		); err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}

	return logs, rows.Err()
}
```

### Log Aggregation & Analytics

```go
// GetLogAnalytics returns time-series analytics
func (db *Database) GetLogAnalytics(
	ctx context.Context,
	interval string, // hour, day, week
) ([]map[string]interface{}, error) {
	query := fmt.Sprintf(`
		SELECT 
			date_trunc('%s', created_at) as time_bucket,
			level,
			COUNT(*) as count,
			COUNT(*) FILTER (WHERE level = 'error') as error_count
		FROM logs
		WHERE created_at > NOW() - INTERVAL '30 days'
		GROUP BY date_trunc('%s', created_at), level
		ORDER BY time_bucket DESC
	`, interval, interval)

	rows, err := db.pool.Query(ctx, query)
	// Process and return analytics...
	return analytics, err
}
```

---

## Migration Timeline

| Phase | Duration | Logs/Day | Storage | Cost |
|-------|----------|----------|---------|------|
| **1: In-Memory** | Now - 3mo | <10K | RAM | $0 |
| **2: PostgreSQL** | 3-12mo | 10K-1M | Database | ~$15/mo |
| **3: Advanced** | 12mo+ | 1M+ | DB + Archive | ~$50/mo |

---

## Backward Compatibility

The migration maintains API compatibility:

```go
// Both versions use same request/response format
type LogRecord struct {
	ID        string    `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"`
	Service   string    `json:"service"`
	Message   string    `json:"message"`
	// ... etc
}
```

Frontend code requires **zero changes**.

---

## Rollback Plan

If issues occur:

```bash
# Disable database handlers, use in-memory
# In main.go, comment out:
# router.POST("/api/logs/ingest", handlers.IngestLogsHandlerDB(...))
# router.GET("/api/logs", handlers.GetLogsHandlerDB(...))

# Re-enable in-memory handlers:
handlers.InitLogs()
router.POST("/api/logs/ingest", handlers.IngestLogsHandler(cfg.LogsToken))
router.GET("/api/logs", handlers.GetLogsHandler)

# Redeploy
railway deploy
```

---

## Performance Optimization Tips

1. **Add connection pooling**: Set `max_connections = 20` in PostgreSQL
2. **Enable compression**: Use `gzip` for large log responses
3. **Implement caching**: Redis cache for frequently accessed logs
4. **Batch inserts**: Collect 10-50 logs before inserting
5. **Archive old logs**: Move logs > 1 year to separate table

---

**When ready to migrate, follow these steps in order. Start with Phase 2 (PostgreSQL) when hitting in-memory limits.**
