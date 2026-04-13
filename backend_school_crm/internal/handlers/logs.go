package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/db"
)

// LogEntry represents a stored log record.
type LogEntry struct {
	ID        string                 `json:"id"`
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Module    string                 `json:"module,omitempty"`
	Message   string                 `json:"message"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// IngestLogRequest is the payload sent by log forwarders (e.g. Railway).
type IngestLogRequest struct {
	Service  string                 `json:"service"`
	Level    string                 `json:"level"`
	Message  string                 `json:"message"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// RegisterDevLogsRoutes registers log-related endpoints that require a developer JWT.
func RegisterDevLogsRoutes(router *gin.RouterGroup, database *db.Database) {
	router.GET("/dev/logs", GetDevLogs(database))
	router.DELETE("/dev/logs", ClearDevLogs(database))
}

// RegisterLogsIngestRoute registers the public log ingestion endpoint.
// It uses a separate LOGS_TOKEN bearer (not the user/dev JWT).
func RegisterLogsIngestRoute(router gin.IRouter, database *db.Database, logsToken string) {
	router.POST("/api/v1/logs/ingest", IngestLog(database, logsToken))
}

// GetDevLogs handles GET /api/dev/logs
// Query params: limit (default 100), level, module
func GetDevLogs(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 100
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 1000 {
				limit = parsed
			}
		}
		level := strings.ToUpper(c.Query("level"))
		module := c.Query("module")

		query := `
			SELECT id, timestamp, level, COALESCE(module, ''), message, COALESCE(metadata, '{}')
			FROM logs
			WHERE ($1 = '' OR level = $1)
			  AND ($2 = '' OR module = $2)
			ORDER BY timestamp DESC
			LIMIT $3
		`
		rows, err := database.GetConn().QueryContext(c.Request.Context(), query, level, module, limit)
		if err != nil {
			log.Printf("[LOGS] DB query error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch logs"})
			return
		}
		defer rows.Close()

		entries := []LogEntry{}
		for rows.Next() {
			var e LogEntry
			var rawMeta []byte
			var ts time.Time
			if err := rows.Scan(&e.ID, &ts, &e.Level, &e.Module, &e.Message, &rawMeta); err != nil {
				continue
			}
			e.Timestamp = ts.UTC().Format(time.RFC3339)
			if err := json.Unmarshal(rawMeta, &e.Metadata); err != nil {
				e.Metadata = nil
			}
			entries = append(entries, e)
		}

		c.JSON(http.StatusOK, entries)
	}
}

// ClearDevLogs handles DELETE /api/dev/logs — truncates the logs table.
func ClearDevLogs(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, err := database.GetConn().ExecContext(c.Request.Context(), "DELETE FROM logs")
		if err != nil {
			log.Printf("[LOGS] Failed to clear logs: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to clear logs"})
			return
		}
		log.Println("[LOGS] Logs cleared by developer")
		c.JSON(http.StatusOK, gin.H{"message": "logs cleared"})
	}
}

// IngestLog handles POST /api/logs/ingest
// Authenticated by a static LOGS_TOKEN bearer (not user JWT).
func IngestLog(database *db.Database, logsToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Validate LOGS_TOKEN
		if logsToken != "" {
			auth := c.GetHeader("Authorization")
			if !strings.HasPrefix(auth, "Bearer ") || strings.TrimPrefix(auth, "Bearer ") != logsToken {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid logs token"})
				return
			}
		}

		var req IngestLogRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		level := strings.ToUpper(req.Level)
		if level == "" {
			level = "INFO"
		}
		module := req.Service
		message := req.Message
		if message == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "message is required"})
			return
		}

		metaJSON := "{}"
		if req.Metadata != nil {
			if b, err := json.Marshal(req.Metadata); err == nil {
				metaJSON = string(b)
			}
		}

		var id string
		err := database.GetConn().QueryRowContext(
			c.Request.Context(),
			`INSERT INTO logs (level, module, message, metadata)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id`,
			level, module, message, metaJSON,
		).Scan(&id)
		if err != nil {
			log.Printf("[LOGS INGEST] Failed to store log: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store log"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"id": id})
	}
}

// RequestLogger returns a Gin middleware that stores ERROR-level log entries
// for every 4xx/5xx API response automatically.
func RequestLogger(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		status := c.Writer.Status()
		// Only log client errors (4xx) and server errors (5xx)
		if status < 400 {
			return
		}

		level := "WARN"
		if status >= 500 {
			level = "ERROR"
		}

		path := c.Request.URL.Path
		method := c.Request.Method
		message := strings.Join(c.Errors.Errors(), "; ")
		if message == "" {
			message = http.StatusText(status)
		}

		// Derive module from path segments (e.g. /api/students -> students)
		module := "api"
		parts := strings.Split(strings.Trim(path, "/"), "/")
		for i, p := range parts {
			if p == "api" && i+1 < len(parts) {
				module = parts[i+1]
				break
			}
		}

		meta, _ := json.Marshal(map[string]interface{}{
			"method": method,
			"path":   path,
			"status": status,
		})

		_, err := database.GetConn().ExecContext(
			c.Request.Context(),
			`INSERT INTO logs (level, module, message, metadata) VALUES ($1, $2, $3, $4)`,
			level, module,
			method+" "+path+" — "+message,
			string(meta),
		)
		if err != nil {
			// Don't crash on log write failure
			log.Printf("[REQUEST LOGGER] Failed to write log: %v", err)
		}
	}
}

// WriteLog is a helper used by other handlers/services to store a log entry directly.
func WriteLog(database *db.Database, level, module, message string, meta map[string]interface{}) {
	metaJSON := "{}"
	if meta != nil {
		if b, err := json.Marshal(meta); err == nil {
			metaJSON = string(b)
		}
	}
	_, err := database.GetConn().ExecContext(
		nil,
		`INSERT INTO logs (level, module, message, metadata) VALUES ($1, $2, $3, $4)`,
		strings.ToUpper(level), module, message, metaJSON,
	)
	if err != nil {
		log.Printf("[WRITE LOG] %v", err)
	}
}

// isLogsTableReady checks the logs table exists (used to skip logging before migrations run).
func isLogsTableReady(database *db.Database) bool {
	var exists bool
	err := database.GetConn().QueryRow(
		`SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = 'logs'
		)`,
	).Scan(&exists)
	return err == nil && exists
}

// SafeRequestLogger is like RequestLogger but skips if the logs table doesn't exist yet.
func SafeRequestLogger(database *db.Database) gin.HandlerFunc {
	ready := false
	return func(c *gin.Context) {
		c.Next()
		if !ready {
			ready = isLogsTableReady(database)
		}
		if !ready {
			return
		}

		status := c.Writer.Status()
		if status < 400 {
			return
		}

		path := c.Request.URL.Path

		// Skip dev dashboard's own requests to avoid self-pollution in logs
		if strings.HasPrefix(path, "/api/dev/") || strings.HasPrefix(path, "/health") {
			return
		}

		level := "WARN"
		if status >= 500 {
			level = "ERROR"
		}

		method := c.Request.Method
		message := strings.Join(c.Errors.Errors(), "; ")
		if message == "" {
			message = http.StatusText(status)
		}

		module := "api"
		parts := strings.Split(strings.Trim(path, "/"), "/")
		for i, p := range parts {
			if p == "api" && i+1 < len(parts) {
				module = parts[i+1]
				break
			}
		}

		meta, _ := json.Marshal(map[string]interface{}{
			"method": method,
			"path":   path,
			"status": status,
		})

		ctx := c.Request.Context()
		if ctx.Err() != nil {
			return
		}

		_, err := database.GetConn().ExecContext(
			ctx,
			`INSERT INTO logs (level, module, message, metadata) VALUES ($1, $2, $3, $4)`,
			level, module,
			method+" "+path+" — "+message,
			string(meta),
		)
		if err != nil {
			log.Printf("[REQUEST LOGGER] Failed to write log: %v", err)
		}
	}
}

// validateLogsToken is used by IngestLog to check auth.
// Exposed for testing.
func validateLogsToken(expected, header string) bool {
	if expected == "" {
		return true // no token configured — allow all (dev mode)
	}
	return strings.HasPrefix(header, "Bearer ") &&
		strings.TrimPrefix(header, "Bearer ") == expected
}

// CheckLogsTable verifies logs table exists, used at startup.
func CheckLogsTable(database *db.Database) {
	var count int
	err := database.GetConn().QueryRow("SELECT COUNT(*) FROM logs").Scan(&count)
	if err != nil {
		if strings.Contains(err.Error(), "does not exist") {
			log.Println("[LOGS] Warning: logs table not found — run migrations")
		} else {
			log.Printf("[LOGS] Table check error: %v", err)
		}
	} else {
		log.Printf("[LOGS] Logs table ready — %d entries", count)
	}
}

// dropDuplicateSQL silences "table already exists" migration errors.
func dropDuplicateSQL(err error) bool {
	if err == nil {
		return true
	}
	msg := err.Error()
	return strings.Contains(msg, "already exists") ||
		strings.Contains(msg, sql.ErrNoRows.Error())
}
