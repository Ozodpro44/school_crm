package middleware

import (
	"context"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

// branchCtxKeyType is an unexported type used as context key to avoid collisions.
type branchCtxKeyType struct{}

var branchCtxKey = branchCtxKeyType{}

// BranchCtx carries the validated branch ID and user ID. It is injected by
// TenantBranchMiddleware into both gin.Context and the underlying context.Context
// so that service methods can read the trusted identity without relying on
// request body parameters.
type BranchCtx struct {
	BranchID string
	UserID   string
}

// InjectBranchCtx returns a child context carrying bc.
// Called by TenantBranchMiddleware; services use GetBranchCtxFromContext.
func InjectBranchCtx(ctx context.Context, bc BranchCtx) context.Context {
	return context.WithValue(ctx, branchCtxKey, bc)
}

// GetBranchCtxFromContext extracts BranchCtx from a standard context.Context.
// Service methods should use this to obtain the trusted branch/user identity.
func GetBranchCtxFromContext(ctx context.Context) (BranchCtx, bool) {
	bc, ok := ctx.Value(branchCtxKey).(BranchCtx)
	return bc, ok
}

// GetBranchCtx extracts BranchCtx from a gin.Context (convenience for handlers).
func GetBranchCtx(c *gin.Context) (BranchCtx, bool) {
	v, exists := c.Get("branch_ctx")
	if !exists {
		return BranchCtx{}, false
	}
	bc, ok := v.(BranchCtx)
	return bc, ok
}

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
//  4. On success, injects BranchCtx into both gin.Context and the request's
//     context.Context so downstream services can trust it without re-reading headers.
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

		bc := BranchCtx{BranchID: branchID, UserID: userID}

		// Propagate to gin context for handlers that read it directly.
		c.Set("branch_id", branchID) // backward-compat key
		c.Set("branch_ctx", bc)

		// Propagate to request context so service methods can read it via
		// GetBranchCtxFromContext without depending on gin.
		c.Request = c.Request.WithContext(InjectBranchCtx(c.Request.Context(), bc))

		c.Next()
	}
}
