package middleware

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
)

// RequestTimeout wraps each request context with a deadline so runaway DB
// queries or slow downstream calls cannot hold a connection indefinitely.
// When the deadline is exceeded the handler receives a cancelled context and
// the next DB/service call returns an error, which the handler propagates as
// 500. The middleware itself does not write a 504 because the handler may
// already have started streaming a response.
//
// getTimeout is called on every request rather than baking in a fixed value,
// so the platform-wide "Request Timeout" setting (see internal/platformsettings)
// takes effect without a redeploy.
func RequestTimeout(getTimeout func() time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), getTimeout())
		defer cancel()
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}
