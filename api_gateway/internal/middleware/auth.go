package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
)

// redisClient backs both RateLimiter and the token-blacklist check in JWTAuth.
// It's a package-level singleton set once at startup via InitRedis — every
// route registered through router.New shares it without threading it through
// every handler signature. Both features fail open when it's nil or a call
// errors, so a Redis outage degrades to "no rate limiting / no blacklist
// check" rather than taking the gateway down.
var redisClient *redis.Client

// InitRedis wires the shared Redis client used by RateLimiter and the
// logout/blacklist check in JWTAuth. Call once at startup before serving
// traffic; leaving it uncalled disables both (they fail open).
func InitRedis(rdb *redis.Client) {
	redisClient = rdb
}

// blacklistKey must match auth_service's key format exactly — both services
// share the same Redis instance, and auth_service is what writes this key on
// logout (see auth_service/internal/service/auth_service.go blacklistKey).
func blacklistKey(token string) string { return "auth:blacklist:" + token }

// sessionRevokedKey must match auth_service's key format exactly (see
// auth_service/internal/service/auth_service.go sessionRevokedKey) —
// auth_service sets this when a user signs one specific device out via
// DELETE /auth/sessions/:id, distinct from the blacklist key above which
// covers "sign out everywhere" (Logout).
func sessionRevokedKey(sessionID string) string { return "auth:session:revoked:" + sessionID }

// CustomClaims mirrors the monolith and auth_service JWT payload.
type CustomClaims struct {
	UserID    string `json:"user_id"`
	Role      string `json:"role"`
	BranchID  string `json:"branch_id,omitempty"`
	SessionID string `json:"sid,omitempty"`
	jwt.RegisteredClaims
}

// JWTAuth validates the Bearer token on every request and injects claims into
// the context. Public routes that don't need auth should be registered before
// this middleware or listed in the skip set.
func JWTAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			c.Abort()
			return
		}

		tokenStr := authHeader[7:]
		claims := &CustomClaims{}

		tok, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !tok.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}

		if redisClient != nil {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
			revoked, berr := redisClient.Exists(ctx, blacklistKey(tokenStr)).Result()
			cancel()
			if berr != nil {
				slog.Warn("blacklist check failed, failing open", "error", berr)
			} else if revoked > 0 {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "token has been revoked"})
				c.Abort()
				return
			}
		}

		if redisClient != nil && claims.SessionID != "" {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
			revoked, serr := redisClient.Exists(ctx, sessionRevokedKey(claims.SessionID)).Result()
			cancel()
			if serr != nil {
				slog.Warn("session revocation check failed, failing open", "error", serr)
			} else if revoked > 0 {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "token has been revoked"})
				c.Abort()
				return
			}
		}

		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)
		c.Set("branch_id", claims.BranchID)

		// Forward verified identity to upstream services as trusted internal headers.
		// Upstream services must NOT trust X-User-ID from external clients — only from
		// the gateway (which has already validated the JWT).
		// Always overwrite, never conditionally — a spoofed X-User-Branch-ID on
		// a request whose token carries no branch (e.g. a developer/super_admin
		// token) must not survive by simply skipping the Set call.
		c.Request.Header.Set("X-User-ID", claims.UserID)
		c.Request.Header.Set("X-User-Role", claims.Role)
		c.Request.Header.Set("X-User-Branch-ID", claims.BranchID)

		c.Next()
	}
}

// RateLimiter applies a Redis-backed fixed-window limit of `limit` requests
// per `window`, keyed by client IP + route. Mirrors the monolith's
// internal/middleware/ratelimit.go ByIP behavior. Fails open (allows the
// request) when Redis is unset or unreachable, so an outage never blocks
// traffic outright.
func RateLimiter(limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if redisClient == nil {
			c.Next()
			return
		}

		windowSecs := int64(window.Seconds())
		if windowSecs <= 0 {
			windowSecs = 1
		}
		windowID := time.Now().Unix() / windowSecs
		route := c.FullPath()
		if route == "" {
			route = c.Request.URL.Path
		}
		key := fmt.Sprintf("rl:gw:%s:%s:%d", route, c.ClientIP(), windowID)

		ctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
		defer cancel()

		pipe := redisClient.Pipeline()
		incr := pipe.Incr(ctx, key)
		pipe.Expire(ctx, key, window+time.Second)
		if _, err := pipe.Exec(ctx); err != nil {
			slog.Warn("rate limiter redis error, failing open", "error", err)
			c.Next()
			return
		}

		count := incr.Val()
		remaining := int64(limit) - count
		if remaining < 0 {
			remaining = 0
		}
		c.Header("X-RateLimit-Limit", strconv.Itoa(limit))
		c.Header("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))

		if count > int64(limit) {
			retry := int(windowSecs - (time.Now().Unix() % windowSecs))
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

// RequestID injects a unique request ID header.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader("X-Request-ID")
		if id == "" {
			id = newRequestID()
		}
		c.Header("X-Request-ID", id)
		c.Set("request_id", id)
		c.Next()
	}
}

// newRequestID returns a random 16-byte hex string. time.Now().UnixNano()
// (the previous approach) can collide under concurrent requests on
// platforms/runtimes where the clock's effective resolution is coarser than
// a nanosecond — crypto/rand doesn't have that failure mode.
func newRequestID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand read failure is effectively unreachable in practice;
		// fall back to a timestamp rather than leaving the header empty.
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}
