package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ByAccount limits requests per (client IP, JSON body "email") pair, so one
// IP cannot brute-force a single account. The body is read (max 64KiB) and
// restored for the downstream handler. Requests without a parsable email are
// passed through (the plain ByIP limiter still applies to them).
func (rl *RateLimiter) ByAccount(limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !rl.isEnabled() || c.Request.Body == nil {
			c.Next()
			return
		}
		raw, err := io.ReadAll(io.LimitReader(c.Request.Body, 64<<10))
		if err != nil {
			c.Next()
			return
		}
		c.Request.Body = io.NopCloser(io.MultiReader(bytes.NewReader(raw), c.Request.Body))
		var body struct {
			Email string `json:"email"`
		}
		_ = json.Unmarshal(raw, &body)
		acct := strings.ToLower(strings.TrimSpace(body.Email))
		if acct == "" {
			c.Next()
			return
		}
		key := fmt.Sprintf("acct:%s:%s:%s", c.FullPath(), c.ClientIP(), acct)
		allowed, _, _ := rl.allow(c.Request.Context(), key, limit, window)
		if !allowed {
			retry := retryAfterSeconds(window)
			c.Header("Retry-After", strconv.Itoa(retry))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "too_many_requests",
				"message":     "Too many attempts for this account. Please try again later.",
				"retry_after": retry,
			})
			return
		}
		c.Next()
	}
}
