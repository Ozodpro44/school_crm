package handlers

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Log represents a single application log entry
type Log struct {
	ID         string    `json:"id"`
	Timestamp  time.Time `json:"timestamp"`
	Level      string    `json:"level"`      // info, warn, error, debug
	Module     string    `json:"module"`     // auth, payments, students, api, etc
	Message    string    `json:"message"`
	Details    string    `json:"details,omitempty"`
	StackTrace string    `json:"stackTrace,omitempty"`
	RequestID  string    `json:"requestId,omitempty"`
	UserID     string    `json:"userId,omitempty"`
	Branch     string    `json:"branch,omitempty"`
}

var (
	logs     []Log
	logMutex sync.RWMutex
)

// InitLogs initializes the logs storage
func InitLogs() {
	logs = make([]Log, 0)
	addSampleLogs()
}

// AddLog adds a new log entry to storage
func AddLog(level, module, message string) {
	addLogWithDetails(level, module, message, "", "", "", "")
}

// AddLogWithDetails adds a new log entry with full details
func AddLogWithDetails(level, module, message, details, requestID, userID, branch string) {
	addLogWithDetails(level, module, message, details, "", requestID, userID, branch)
}

// addLogWithDetails is the internal function
func addLogWithDetails(level, module, message, details, stackTrace, requestID, userID string, branch ...string) {
	logMutex.Lock()
	defer logMutex.Unlock()

	branchStr := ""
	if len(branch) > 0 {
		branchStr = branch[0]
	}

	log := Log{
		ID:         uuid.New().String(),
		Timestamp:  time.Now(),
		Level:      level,
		Module:     module,
		Message:    message,
		Details:    details,
		StackTrace: stackTrace,
		RequestID:  requestID,
		UserID:     userID,
		Branch:     branchStr,
	}

	logs = append(logs, log)

	// Keep only last 10000 logs in memory
	if len(logs) > 10000 {
		logs = logs[1:]
	}
}

// addSampleLogs adds sample logs for testing
func addSampleLogs() {
	sampleLogs := []Log{
		{
			ID:        uuid.New().String(),
			Timestamp: time.Now().Add(-10 * time.Minute),
			Level:     "info",
			Module:    "api",
			Message:   "API server started on port 8080",
			Details:   "Server initialization complete",
		},
		{
			ID:        uuid.New().String(),
			Timestamp: time.Now().Add(-9 * time.Minute),
			Level:     "info",
			Module:    "database",
			Message:   "Database connection established",
			Details:   "Connected to PostgreSQL database",
		},
		{
			ID:        uuid.New().String(),
			Timestamp: time.Now().Add(-8 * time.Minute),
			Level:     "info",
			Module:    "auth",
			Message:   "Authentication middleware initialized",
			Details:   "JWT validation enabled",
		},
		{
			ID:        uuid.New().String(),
			Timestamp: time.Now().Add(-7 * time.Minute),
			Level:     "info",
			Module:    "api",
			Message:   "CORS middleware configured",
			Details:   "Cross-origin requests allowed",
		},
		{
			ID:        uuid.New().String(),
			Timestamp: time.Now().Add(-6 * time.Minute),
			Level:     "info",
			Module:    "students",
			Message:   "Student enrollment endpoint initialized",
			Details:   "Ready to accept student enrollments",
		},
		{
			ID:        uuid.New().String(),
			Timestamp: time.Now().Add(-5 * time.Minute),
			Level:     "info",
			Module:    "payments",
			Message:   "Payment processing service started",
			Details:   "Payment gateway integration active",
		},
		{
			ID:        uuid.New().String(),
			Timestamp: time.Now().Add(-4 * time.Minute),
			Level:     "warn",
			Module:    "cache",
			Message:   "Redis cache connection established",
			Details:   "Cache TTL set to 1 hour",
		},
		{
			ID:        uuid.New().String(),
			Timestamp: time.Now().Add(-3 * time.Minute),
			Level:     "info",
			Module:    "auth",
			Message:   "User login attempt successful",
			Details:   "User: admin@school.ru, IP: 127.0.0.1",
			UserID:    "user_1",
		},
		{
			ID:        uuid.New().String(),
			Timestamp: time.Now().Add(-2 * time.Minute),
			Level:     "info",
			Module:    "students",
			Message:   "Student data fetched successfully",
			Details:   "Total students: 150, Active: 145",
		},
		{
			ID:        uuid.New().String(),
			Timestamp: time.Now().Add(-1 * time.Minute),
			Level:     "info",
			Module:    "payments",
			Message:   "Payment record created",
			Details:   "Amount: 100000, Status: paid, Method: cash",
		},
	}

	logMutex.Lock()
	defer logMutex.Unlock()
	logs = append(logs, sampleLogs...)
}

// GetLogsHandler handles GET /api/logs
// Query parameters:
//   - limit: number of logs to return (default: 100)
//   - module: filter by module (optional)
//   - level: filter by level (optional)
func GetLogsHandler(c *gin.Context) {
	limit := 100
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 1000 {
			limit = parsed
		}
	}

	module := c.Query("module")
	level := c.Query("level")

	logMutex.RLock()
	defer logMutex.RUnlock()

	// Filter logs
	var filtered []Log
	for _, log := range logs {
		if module != "" && log.Module != module {
			continue
		}
		if level != "" && log.Level != level {
			continue
		}
		filtered = append(filtered, log)
	}

	// Return last 'limit' logs (most recent first)
	start := 0
	if len(filtered) > limit {
		start = len(filtered) - limit
	}

	result := make([]Log, 0)
	for i := len(filtered) - 1; i >= start; i-- {
		result = append(result, filtered[i])
	}

	c.JSON(http.StatusOK, result)
}

// ClearLogsHandler handles DELETE /api/logs (admin only)
func ClearLogsHandler(c *gin.Context) {
	logMutex.Lock()
	defer logMutex.Unlock()

	logs = make([]Log, 0)

	c.JSON(http.StatusOK, gin.H{
		"message": "logs cleared",
	})
}
