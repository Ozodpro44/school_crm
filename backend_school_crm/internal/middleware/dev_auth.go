package middleware

import (
	"context"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/school-crm/backend/internal/service"
)

// DevAuthMiddleware validates developer JWT tokens and sets developer_id in context.
// Developer tokens are issued by /api/dev/auth/login and carry type="developer".
//
// developerService is used to enforce per-session revocation (a "sid" claim
// checked directly against Postgres, since developer traffic is low-volume
// enough that a Redis round-trip isn't needed the way it is for regular
// users) and to best-effort bump last_seen_at on every authenticated
// request. Tokens issued before the sessions feature existed carry no "sid"
// and skip this check entirely — they're still bounded by their own expiry.
func DevAuthMiddleware(jwtSecret string, developerService *service.DeveloperService) gin.HandlerFunc {
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

		token, err := jwt.Parse(parts[1], func(t *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token claims"})
			c.Abort()
			return
		}

		tokenType, _ := claims["type"].(string)
		if tokenType != "developer" {
			c.JSON(http.StatusForbidden, gin.H{"error": "developer token required"})
			c.Abort()
			return
		}

		developerID, _ := claims["developer_id"].(string)
		if developerID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid developer token"})
			c.Abort()
			return
		}

		role, _ := claims["role"].(string)
		sessionID, _ := claims["sid"].(string)

		if sessionID != "" {
			revoked, serr := developerService.IsSessionRevoked(c.Request.Context(), sessionID)
			if serr != nil {
				log.Printf("[DevAuthMiddleware] session check failed, failing open: %v", serr)
			} else if revoked {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "token has been revoked"})
				c.Abort()
				return
			} else {
				go developerService.TouchSession(context.Background(), sessionID)
			}
		}

		c.Set("developer_id", developerID)
		c.Set("developer_role", role)
		c.Set("developer_session_id", sessionID)
		c.Next()
	}
}

// RequireDeveloperRole gates a route to developers whose JWT `role` claim is
// in the allowed list — must run after DevAuthMiddleware. DevAuthMiddleware
// alone only proves "some developer account", not which tier; before this,
// nothing anywhere distinguished a "developer" account from an "admin" one
// even though the Developer model has always had that Role field, so any
// developer could reach every dev-portal action including destructive ones
// (delete a subscription, override a user's trial).
func RequireDeveloperRole(allowed ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("developer_role")
		roleStr, _ := role.(string)
		for _, a := range allowed {
			if roleStr == a {
				c.Next()
				return
			}
		}
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient developer role"})
		c.Abort()
	}
}
