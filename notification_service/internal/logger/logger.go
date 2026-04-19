package logger

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

// Init sets up the default slog logger.
// JSON handler in production (machine-readable), text handler otherwise (human-readable).
func Init(env string) {
	opts := &slog.HandlerOptions{Level: slog.LevelDebug}
	var h slog.Handler
	if env == "production" {
		opts.Level = slog.LevelInfo
		h = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		h = slog.NewTextHandler(os.Stdout, opts)
	}
	slog.SetDefault(slog.New(h))
}

// RequestLogger returns a Gin middleware that logs every HTTP request.
// 5xx → Error, 4xx → Warn, OPTIONS → skipped, rest → Info.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		start := time.Now()
		path := c.Request.URL.Path
		if raw := c.Request.URL.RawQuery; raw != "" {
			path += "?" + raw
		}

		c.Next()

		status := c.Writer.Status()
		attrs := []any{
			"method",     c.Request.Method,
			"path",       c.FullPath(),
			"status",     status,
			"latency_ms", time.Since(start).Milliseconds(),
			"ip",         c.ClientIP(),
		}
		if rid := c.GetHeader("X-Request-ID"); rid != "" {
			attrs = append(attrs, "request_id", rid)
		}
		if len(c.Errors) > 0 {
			attrs = append(attrs, "gin_errors", c.Errors.String())
		}

		switch {
		case status >= http.StatusInternalServerError:
			slog.Error("http", attrs...)
		case status >= http.StatusBadRequest:
			slog.Warn("http", attrs...)
		default:
			slog.Info("http", attrs...)
		}
	}
}
