package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// CustomClaims mirrors the monolith and auth_service JWT payload.
type CustomClaims struct {
	UserID   string `json:"user_id"`
	Role     string `json:"role"`
	BranchID string `json:"branch_id,omitempty"`
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

		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)
		c.Set("branch_id", claims.BranchID)
		c.Next()
	}
}

// RateLimiter is a placeholder — replace with Redis sliding-window implementation.
// See monolith internal/middleware/rate_limiter.go for the real implementation.
func RateLimiter(_ int, _ time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) { c.Next() }
}

// RequestID injects a unique request ID header.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader("X-Request-ID")
		if id == "" {
			id = fmt.Sprintf("%d", time.Now().UnixNano())
		}
		c.Header("X-Request-ID", id)
		c.Set("request_id", id)
		c.Next()
	}
}
