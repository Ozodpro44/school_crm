package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// RateLimiter holds a Redis client and applies fixed-window rate limiting.
// When Redis is unavailable the middleware fails open (requests are allowed).
type RateLimiter struct {
	rdb *redis.Client
}

// NewRateLimiter creates a RateLimiter backed by the given Redis client.
func NewRateLimiter(rdb *redis.Client) *RateLimiter {
	return &RateLimiter{rdb: rdb}
}

// allow checks the fixed-window counter for key. Returns (allowed, current, limit).
// window is the duration of one window (e.g. time.Minute).
func (rl *RateLimiter) allow(ctx context.Context, key string, limit int, window time.Duration) (bool, int64, int) {
	windowID := time.Now().Unix() / int64(window.Seconds())
	redisKey := fmt.Sprintf("rl:%s:%d", key, windowID)

	pipe := rl.rdb.Pipeline()
	incr := pipe.Incr(ctx, redisKey)
	pipe.Expire(ctx, redisKey, window+time.Second) // +1s grace
	_, err := pipe.Exec(ctx)
	if err != nil {
		// Redis unavailable — fail open
		return true, 0, limit
	}

	count := incr.Val()
	return count <= int64(limit), count, limit
}

// retryAfterSeconds returns the seconds until the current window resets.
func retryAfterSeconds(window time.Duration) int {
	windowSecs := int64(window.Seconds())
	now := time.Now().Unix()
	return int(windowSecs - (now % windowSecs))
}

// ByIP returns a Gin middleware that limits to `limit` requests per `window`
// keyed on the client IP. Intended for auth and webhook endpoints.
func (rl *RateLimiter) ByIP(limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		key := fmt.Sprintf("ip:%s:%s", c.FullPath(), ip)

		allowed, count, max := rl.allow(c.Request.Context(), key, limit, window)
		c.Header("X-RateLimit-Limit", strconv.Itoa(max))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(max-int(count)))

		if !allowed {
			retry := retryAfterSeconds(window)
			c.Header("Retry-After", strconv.Itoa(retry))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "too_many_requests",
				"message":     "Rate limit exceeded. Please slow down.",
				"retry_after": retry,
			})
			return
		}
		c.Next()
	}
}

// ByUser returns a Gin middleware that limits to `limit` requests per `window`
// keyed on the authenticated user ID (extracted from the JWT claims set by
// AuthMiddleware). Falls back to IP if no user ID is present.
func (rl *RateLimiter) ByUser(limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		identifier := c.ClientIP() // default fallback
		if userID, exists := c.Get("user_id"); exists {
			if uid, ok := userID.(string); ok && uid != "" {
				identifier = uid
			}
		}

		key := fmt.Sprintf("user:%s", identifier)

		allowed, count, max := rl.allow(c.Request.Context(), key, limit, window)
		c.Header("X-RateLimit-Limit", strconv.Itoa(max))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(max-int(count)))

		if !allowed {
			retry := retryAfterSeconds(window)
			c.Header("Retry-After", strconv.Itoa(retry))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "too_many_requests",
				"message":     "Rate limit exceeded. Please slow down.",
				"retry_after": retry,
			})
			return
		}
		c.Next()
	}
}
