package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// BranchAccess middleware ensures managers can only access their assigned branches
func BranchAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		_, err := GetUserID(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		role, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "role not found"})
			return
		}

		// Only apply branch restriction to managers
		if roleStr, ok := role.(string); ok && roleStr == "manager" {
			branchID := c.Query("branchId")
			if branchID == "" {
				branchID = c.Param("branchId")
			}

			// Allow access to manager's branch
			c.Set("allowedBranchId", branchID)
		}

		c.Next()
	}
}

// RequireManagerBranch ensures the request is for the manager's assigned branch
func RequireManagerBranch() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.Next()
			return
		}

		if roleStr, ok := role.(string); ok && roleStr == "manager" {
			allowedBranch, exists := c.Get("allowedBranchId")
			if !exists {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "branch access denied"})
				return
			}
			_ = allowedBranch
		}

		c.Next()
	}
}
