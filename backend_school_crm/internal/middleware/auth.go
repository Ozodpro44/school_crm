package middleware

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
)

type CustomClaims struct {
	UserID    string `json:"user_id"`
	Role      string `json:"role"`
	SessionID string `json:"sid,omitempty"`
	jwt.RegisteredClaims
}

// sessionRevokedKey must match auth_service's key format exactly (see
// auth_service/internal/service/auth_service.go sessionRevokedKey) — both
// share the same Redis instance, and auth_service is what writes this key
// when a user signs a specific device/session out.
func sessionRevokedKey(sessionID string) string { return "auth:session:revoked:" + sessionID }

// AuthMiddleware validates the regular-user Bearer token. rdb is optional —
// pass nil to skip the session-revocation check entirely (e.g. in tests, or
// if Redis is unavailable); when present, a token whose sid claim has been
// revoked (via "sign this device out") is rejected even though the JWT
// itself is still validly signed and unexpired. Tokens minted before the sid
// claim existed simply have no session to check and are never rejected here.
func AuthMiddleware(jwtSecret string, rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims := &CustomClaims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		if rdb != nil && claims.SessionID != "" {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
			revoked, rerr := rdb.Exists(ctx, sessionRevokedKey(claims.SessionID)).Result()
			cancel()
			if rerr != nil {
				log.Printf("[AuthMiddleware] session revocation check failed, failing open: %v", rerr)
			} else if revoked > 0 {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "token has been revoked"})
				c.Abort()
				return
			}
		}

		c.Set("user_id", claims.UserID)
		c.Set("userID", claims.UserID) // Keep for backward compatibility
		c.Set("role", claims.Role)

		// Get branch ID from X-Branch-ID header (set by frontend on branch switch)
		branchID := c.GetHeader("X-Branch-ID")
		if branchID != "" {
			c.Set("branch_id", branchID)
		}

		c.Next()
	}
}

func GetUserID(c *gin.Context) (string, error) {
	userID, exists := c.Get("userID")
	if !exists {
		return "", errors.New("user id not found in context")
	}

	id, ok := userID.(string)
	if !ok {
		return "", errors.New("invalid user id type")
	}

	return id, nil
}
