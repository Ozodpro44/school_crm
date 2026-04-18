package middleware

import (
	"log/slog"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

const slowRequestThreshold = 200 * time.Millisecond

// NewLogger returns a configured *slog.Logger.
// JSON handler in production, human-readable text in development.
func NewLogger(env string) *slog.Logger {
	var handler slog.Handler
	opts := &slog.HandlerOptions{Level: slog.LevelDebug}
	if env == "production" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}
	return slog.New(handler)
}

// highFrequencyPaths are polled every ~30 s by the frontend; logging every hit
// burns Railway's 500 log/s limit. Only log them when they are slow or error.
var highFrequencyPaths = map[string]bool{
	"/api/notifications/count":        true,
	"/api/v1/notifications/count":     true,
	"/api/notifications/unread-count": true,
	"/api/v1/notifications/unread-count": true,
}

// StructuredLogger is a Gin middleware that logs every request with:
//   - request_id, method, path, status, latency, user_id, branch_id
//   - WARN level for slow requests (> 200 ms) or 4xx responses
//   - ERROR level for 5xx responses (no stack trace — too verbose for Railway)
func StructuredLogger(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		// Skip health-check and high-frequency polling noise entirely on 2xx
		if path == "/health" || path == "/api/health" {
			c.Next()
			return
		}

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		// For high-frequency paths, only log when something goes wrong or is slow
		if highFrequencyPaths[path] && status < 400 && latency <= slowRequestThreshold {
			return
		}

		rid, _ := c.Get("request_id")
		userID, _ := c.Get("user_id")
		branchID := c.GetHeader("X-Branch-ID")

		fullPath := path
		if query != "" {
			fullPath = path + "?" + query
		}

		attrs := []any{
			slog.String("request_id", toString(rid)),
			slog.String("method", c.Request.Method),
			slog.String("path", fullPath),
			slog.Int("status", status),
			slog.Duration("latency", latency.Round(time.Millisecond)),
			slog.String("user_id", toString(userID)),
			slog.String("branch_id", branchID),
			slog.String("ip", c.ClientIP()),
		}

		switch {
		case status >= 500:
			errMsg := c.Errors.String()
			if errMsg == "" {
				errMsg = "internal server error"
			}
			// No stack trace — each frame is a separate log line and hits Railway's limit fast
			logger.Error("request error", append(attrs, slog.String("error", errMsg))...)
		case latency > slowRequestThreshold:
			logger.Warn("slow request", attrs...)
		case status >= 400:
			logger.Warn("client error", attrs...)
		default:
			logger.Info("request", attrs...)
		}
	}
}

func toString(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
