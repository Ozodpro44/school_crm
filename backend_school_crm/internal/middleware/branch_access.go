package middleware

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

// TenantBranchMiddleware enforces that the authenticated user actually belongs
// to the branch indicated by the X-Branch-ID request header (set by the frontend
// on every request after a branch is selected).
//
// Without this check any authenticated user could forge the header and read or
// mutate data that belongs to a completely different school — a classic BOLA/IDOR
// vulnerability.
//
// The middleware:
//  1. Reads the X-Branch-ID header (skips if absent — individual handlers still
//     validate branchId from query/body where required).
//  2. Calls UserService.BelongsToBranch which runs a single UNION query covering
//     all three access paths (owner, branch_manager, staff member).
//  3. Returns 403 Forbidden if the mapping cannot be confirmed.
func TenantBranchMiddleware(userSvc *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.GetHeader("X-Branch-ID")
		if branchID == "" {
			// No branch selected — skip the check; handlers that require a
			// branchId will enforce it themselves.
			c.Next()
			return
		}

		userID, err := GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		ok, err := userSvc.BelongsToBranch(c.Request.Context(), userID, branchID)
		if err != nil {
			// DB error — fail closed to avoid leaking data.
			log.Printf("[TenantBranchMiddleware] DB error for user=%s branch=%s: %v", userID, branchID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error verifying branch access"})
			c.Abort()
			return
		}
		if !ok {
			log.Printf("[TenantBranchMiddleware] BOLA attempt blocked: user=%s tried to access branch=%s", userID, branchID)
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied: you do not belong to this branch"})
			c.Abort()
			return
		}

		// Confirmed — propagate to context so handlers can trust it.
		c.Set("branch_id", branchID)
		c.Next()
	}
}
