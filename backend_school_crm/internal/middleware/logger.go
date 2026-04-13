package middleware

import (
	"log/slog"
	"os"
	"runtime/debug"
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

// StructuredLogger is a Gin middleware that logs every request with:
//   - request_id, method, path, status, latency, user_id, branch_id
//   - WARN level for slow requests (> 200 ms)
//   - ERROR level + stack trace for 5xx responses
func StructuredLogger(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		// Skip health-check noise
		if path == "/health" || path == "/api/health" {
			c.Next()
			return
		}

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
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
			logger.Error("request error",
				append(attrs,
					slog.String("error", errMsg),
					slog.String("stack", string(debug.Stack())),
				)...,
			)
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
