package middleware

import (
	"net/http"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/gin-gonic/gin"
)

// SentryMiddleware recovers panics, captures them in Sentry, and returns 500.
// It also attaches request metadata (URL, method, user_id, request_id) to every event.
func SentryMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		hub := sentry.CurrentHub().Clone()
		hub.Scope().SetRequest(c.Request)

		// Attach user_id if available (best-effort, no fatal if absent).
		if userID, err := GetUserID(c); err == nil {
			hub.Scope().SetUser(sentry.User{ID: userID})
		}

		// Attach request-id for log correlation.
		if reqID := GetRequestID(c.Request.Context()); reqID != "" {
			hub.Scope().SetTag("request_id", reqID)
		}

		// Store hub in gin context so handlers can capture custom events.
		c.Set("sentry_hub", hub)

		defer func() {
			if r := recover(); r != nil {
				hub.RecoverWithContext(c.Request.Context(), r)
				hub.Flush(2 * time.Second)
				c.AbortWithStatus(http.StatusInternalServerError)
			}
		}()

		c.Next()

		// Capture 5xx errors that didn't panic (e.g. c.JSON(500, ...)).
		if c.Writer.Status() >= http.StatusInternalServerError {
			if len(c.Errors) > 0 {
				for _, ginErr := range c.Errors {
					hub.CaptureException(ginErr.Err)
				}
			}
			hub.Flush(2 * time.Second)
		}
	}
}

// SentryHubFromContext retrieves the per-request Sentry hub stored by SentryMiddleware.
// Returns the current hub as fallback when called outside a request context.
func SentryHubFromContext(c *gin.Context) *sentry.Hub {
	if hub, exists := c.Get("sentry_hub"); exists {
		if h, ok := hub.(*sentry.Hub); ok {
			return h
		}
	}
	return sentry.CurrentHub()
}
