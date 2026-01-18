package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
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
	// Only real application logs, no sample data
	AddLog("info", "api", "Application started")
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

// GetRailwayLogsHandler handles GET /api/logs/railway - fetches logs from Railway API
func GetRailwayLogsHandler(c *gin.Context) {
	limit := 100
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 1000 {
			limit = parsed
		}
	}

	apiKey := os.Getenv("RAILWAY_API_KEY")
	projectID := os.Getenv("RAILWAY_PROJECT_ID")

	if apiKey == "" || projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Railway credentials not configured in backend environment",
		})
		return
	}

	logs, err := fetchRailwayLogs(apiKey, projectID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to fetch Railway logs: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, logs)
}

// fetchRailwayLogs calls Railway GraphQL API to get logs
func fetchRailwayLogs(apiKey, projectID string, limit int) ([]map[string]interface{}, error) {
	query := fmt.Sprintf(`
		query {
			project(id: "%s") {
				deployments(first: 1, sort: DESC) {
					edges {
						node {
							logs(first: %d) {
								edges {
									node {
										timestamp
										message
										level
									}
								}
							}
						}
					}
				}
			}
		}
	`, projectID, limit)

	payload := map[string]interface{}{
		"query": query,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", "https://api.railway.app/graphql", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Railway API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var data map[string]interface{}
	if err := json.Unmarshal(respBody, &data); err != nil {
		return nil, err
	}

	// Check for errors in response
	if errs, ok := data["errors"].([]interface{}); ok && len(errs) > 0 {
		if errObj, ok := errs[0].(map[string]interface{}); ok {
			if msg, ok := errObj["message"].(string); ok {
				return nil, fmt.Errorf("Railway API error: %s", msg)
			}
		}
		return nil, fmt.Errorf("Railway API error occurred")
	}

	// Parse logs from response
	logs := []map[string]interface{}{}

	if dataObj, ok := data["data"].(map[string]interface{}); ok {
		if project, ok := dataObj["project"].(map[string]interface{}); ok {
			if deployments, ok := project["deployments"].(map[string]interface{}); ok {
				if edges, ok := deployments["edges"].([]interface{}); ok && len(edges) > 0 {
					if edge, ok := edges[0].(map[string]interface{}); ok {
						if node, ok := edge["node"].(map[string]interface{}); ok {
							if logsObj, ok := node["logs"].(map[string]interface{}); ok {
								if logEdges, ok := logsObj["edges"].([]interface{}); ok {
									for _, logEdge := range logEdges {
										if le, ok := logEdge.(map[string]interface{}); ok {
											if logNode, ok := le["node"].(map[string]interface{}); ok {
												logs = append(logs, logNode)
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}

	return logs, nil
}
