// Package middleware provides JWT authentication for notification_service.
//
// api_gateway already validates the JWT and forwards trusted X-User-*
// headers, so in normal operation this is defense-in-depth. But this
// service's HTTP port is not currently firewalled to gateway-only traffic —
// without its own check, POST /notifications was reachable by anyone,
// letting an outside caller spam arbitrary branches. No other service calls
// this HTTP API today (confirmed by grep — the roadmap comments referencing
// service-to-service notification calls aren't implemented yet), so gating
// the whole group behind a user JWT doesn't break anything currently wired
// up; a future service-to-service caller will need its own mechanism
// (a service token or the gRPC path), not a shared end-user JWT.
package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// CustomClaims mirrors the payload issued by auth_service / api_gateway.
type CustomClaims struct {
	UserID   string `json:"user_id"`
	Role     string `json:"role"`
	BranchID string `json:"branch_id,omitempty"`
	jwt.RegisteredClaims
}

// JWTAuth validates the Bearer token on every request in the group it's
// attached to and overwrites X-User-ID/X-User-Role/X-User-Branch-ID with the
// verified claims — a client-supplied value for these headers is never
// trusted, only what a valid signature backs.
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

		// Always overwrite, never conditionally — a spoofed X-User-Branch-ID on
		// a request whose token carries no branch (e.g. a developer/super_admin
		// token) must not survive by simply skipping the Set call.
		c.Request.Header.Set("X-User-ID", claims.UserID)
		c.Request.Header.Set("X-User-Role", claims.Role)
		c.Request.Header.Set("X-User-Branch-ID", claims.BranchID)

		c.Next()
	}
}
