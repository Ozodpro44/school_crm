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

// RequireBranchIDQueryAccess validates that the caller belongs to whatever
// branchId is passed as a query parameter. TenantBranchMiddleware only ever
// validates the X-Branch-ID header — its own doc comment says handlers must
// self-validate a query/body branchId — but the report and messaging
// handlers never did: they read branchId straight from the query string and
// passed it to the service layer unchecked, letting any authenticated
// caller (any role, since these routes are gated by a boolean permission
// flag like canViewReports, not branch membership) read another branch's
// full payment/salary/expense/debtor data or message history by editing
// the query string.
func RequireBranchIDQueryAccess(userSvc *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
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
			log.Printf("[RequireBranchIDQueryAccess] DB error for user=%s branch=%s: %v", userID, branchID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error verifying branch access"})
			c.Abort()
			return
		}
		if !ok {
			log.Printf("[RequireBranchIDQueryAccess] BOLA attempt blocked: user=%s tried to access branch=%s", userID, branchID)
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied: you do not belong to this branch"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireResourceBranchAccess protects routes of the form /<resource>/:id.
// Those handlers look the row up by id alone, so without this check any
// authenticated user could read, edit or delete another branch's student,
// class, payment, expense or salary just by knowing its UUID. It resolves the
// row's branch_id from the given table and requires the caller to belong to it.
// Missing rows and rows of foreign branches both yield 404, so existence of
// other tenants' ids is not revealed.
func RequireResourceBranchAccess(userSvc *service.UserService, table string) gin.HandlerFunc {
	return RequireResourceBranchAccessParam(userSvc, table, "id")
}

// RequireResourceBranchAccessParam is RequireResourceBranchAccess for routes
// whose path parameter is not called "id" (e.g. /me/link/:teacherId).
func RequireResourceBranchAccessParam(userSvc *service.UserService, table, param string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		branchID, found, err := userSvc.ResourceBranchID(c.Request.Context(), table, c.Param(param))
		if err != nil {
			log.Printf("[RequireResourceBranchAccess] DB error table=%s id=%s: %v", table, c.Param(param), err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error verifying branch access"})
			c.Abort()
			return
		}
		if !found {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			c.Abort()
			return
		}

		ok, err := userSvc.BelongsToBranch(c.Request.Context(), userID, branchID)
		if err != nil {
			log.Printf("[RequireResourceBranchAccess] DB error for user=%s branch=%s: %v", userID, branchID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error verifying branch access"})
			c.Abort()
			return
		}
		if !ok {
			log.Printf("[RequireResourceBranchAccess] BOLA attempt blocked: user=%s tried to access %s/%s of branch=%s", userID, table, c.Param(param), branchID)
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// EnsureBranchAccess is for handlers that receive a branchId in the request
// body (where no middleware can see it). It returns true when the caller
// belongs to branchID; otherwise it writes the error response and returns false.
func EnsureBranchAccess(c *gin.Context, userSvc *service.UserService, branchID string) bool {
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return false
	}
	userID, err := GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return false
	}
	ok, err := userSvc.BelongsToBranch(c.Request.Context(), userID, branchID)
	if err != nil {
		log.Printf("[EnsureBranchAccess] DB error for user=%s branch=%s: %v", userID, branchID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error verifying branch access"})
		return false
	}
	if !ok {
		log.Printf("[EnsureBranchAccess] BOLA attempt blocked: user=%s tried to access branch=%s", userID, branchID)
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied: you do not belong to this branch"})
		return false
	}
	return true
}
