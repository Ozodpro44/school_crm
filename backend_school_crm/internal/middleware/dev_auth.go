package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// DevAuthMiddleware validates developer JWT tokens and sets developer_id in context.
// Developer tokens are issued by /api/dev/auth/login and carry type="developer".
func DevAuthMiddleware(jwtSecret string) gin.HandlerFunc {
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

		c.Set("developer_id", developerID)
		c.Next()
	}
}
