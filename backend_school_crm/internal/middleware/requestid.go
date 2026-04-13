package middleware

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// contextKey is an unexported type for context keys in this package.
type contextKey string

const RequestIDKey contextKey = "request_id"

// RequestID generates a UUID for every request, stores it in the Gin context
// and in the request's context.Context, and echoes it as X-Request-ID header.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Honour an existing X-Request-ID from upstream proxies/load-balancers.
		rid := c.GetHeader("X-Request-ID")
		if rid == "" {
			rid = uuid.New().String()
		}

		c.Set("request_id", rid)
		c.Request = c.Request.WithContext(
			context.WithValue(c.Request.Context(), RequestIDKey, rid),
		)
		c.Header("X-Request-ID", rid)
		c.Next()
	}
}

// GetRequestID extracts the request ID from a context.Context (set by RequestID middleware).
func GetRequestID(ctx context.Context) string {
	if v, ok := ctx.Value(RequestIDKey).(string); ok {
		return v
	}
	return ""
}
