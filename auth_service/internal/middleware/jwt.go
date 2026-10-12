package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// JWTAuth validates the Bearer token (HMAC only), rejects developer tokens
// and tokens without a user_id, and overwrites X-User-ID / X-User-Role with
// the verified claims so a client-supplied value is never trusted.
func JWTAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			return
		}
		claims := &CustomClaims{}
		tok, err := jwt.ParseWithClaims(h[7:], claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		}, jwt.WithValidMethods([]string{"HS256", "HS384", "HS512"}))
		if err != nil || !tok.Valid || claims.UserID == "" || claims.Type == "developer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}
		c.Set("user_id", claims.UserID)
		c.Request.Header.Set("X-User-ID", claims.UserID)
		c.Request.Header.Set("X-User-Role", claims.Role)
		c.Request.Header.Set("X-User-Branch-ID", claims.BranchID)
		c.Next()
	}
}
