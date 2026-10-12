package middleware

import (
	"bytes"
	"encoding/json"
	"log"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/db"
)

// uuidPattern matches a UUID in a URL path segment.
var uuidPattern = regexp.MustCompile(`(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)

// resourceFromPath extracts a human-readable resource name from a URL path.
// Returns ("", false) when the path should not be audited.
func resourceFromPath(path string) (string, bool) {
	// Remove the versioned prefix /api/v1/
	trimmed := strings.TrimPrefix(path, "/api/v1/")
	if trimmed == path {
		// Not a versioned API path
		return "", false
	}

	// First non-UUID, non-numeric path segment is the resource
	parts := strings.Split(trimmed, "/")
	segment := parts[0]

	// Resources we audit
	auditable := map[string]string{
		"payments":  "payment",
		"students":  "student",
		"teachers":  "teacher",
		"salaries":  "salary",
		"expenses":  "expense",
		"classes":   "class",
		"branches":  "branch",
		"users":     "user",
	}
	if name, ok := auditable[segment]; ok {
		return name, true
	}
	return "", false
}

// extractUUIDFromPath returns the last UUID-shaped segment from a URL path,
// which is the resource ID for PUT / DELETE calls.
func extractUUIDFromPath(path string) string {
	matches := uuidPattern.FindAllString(path, -1)
	if len(matches) == 0 {
		return ""
	}
	return matches[len(matches)-1]
}

// bodyCapturingWriter wraps gin.ResponseWriter to capture the written body.
type bodyCapturingWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *bodyCapturingWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// AuditMiddleware records create / update / delete operations into the audit_logs table.
// It only runs on mutating HTTP methods (POST / PUT / PATCH / DELETE) and only stores
// a record when the handler succeeds (status 200–204).
func AuditMiddleware(database *db.Database) gin.HandlerFunc {
	return func(c *gin.Context) {
		method := c.Request.Method
		if method == "GET" || method == "HEAD" || method == "OPTIONS" {
			c.Next()
			return
		}

		path := c.Request.URL.Path
		resource, ok := resourceFromPath(path)
		if !ok {
			c.Next()
			return
		}

		// For POST we need to capture the response body to get the created ID.
		var bcw *bodyCapturingWriter
		if method == "POST" {
			bcw = &bodyCapturingWriter{ResponseWriter: c.Writer, body: &bytes.Buffer{}}
			c.Writer = bcw
		}

		c.Next()

		status := c.Writer.Status()
		if status < 200 || status > 204 {
			return
		}

		// Determine action
		var action string
		switch method {
		case "POST":
			action = "create"
		case "PUT", "PATCH":
			action = "update"
		case "DELETE":
			action = "delete"
		default:
			return
		}

		// Extract resource ID
		resourceID := extractUUIDFromPath(path)
		if resourceID == "" && bcw != nil {
			// Try to get id from the JSON response body
			var body map[string]interface{}
			if err := json.Unmarshal(bcw.body.Bytes(), &body); err == nil {
				for _, key := range []string{"id", "ID"} {
					if v, ok := body[key].(string); ok && uuidPattern.MatchString(v) {
						resourceID = v
						break
					}
				}
			}
		}

		// Get context values set by AuthMiddleware / TenantBranchMiddleware
		userID, _ := c.Get("userID")
		branchID, _ := c.Get("branch_id")

		userIDStr, _ := userID.(string)
		branchIDStr, _ := branchID.(string)

		actionCap := strings.ToUpper(action[:1]) + action[1:]
		description := action + "d " + resource
		if resourceID != "" {
			description = actionCap + "d " + resource + " " + resourceID[:8] + "…"
		}

		// Write asynchronously so we don't slow down the response
		go func() {
			var uid, bid interface{}
			if userIDStr != "" {
				uid = userIDStr
			}
			if branchIDStr != "" {
				bid = branchIDStr
			}
			var rid interface{}
			if resourceID != "" {
				rid = resourceID
			}
			_, err := database.GetConn().Exec(
				`INSERT INTO audit_logs (branch_id, user_id, action, resource, resource_id, description)
				 VALUES ($1, $2, $3, $4, $5, $6)`,
				bid, uid, action, resource, rid, description,
			)
			if err != nil {
				log.Printf("[AUDIT] write failed: %v", err)
			}
		}()
	}
}
