package handler

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/user-service/internal/service"
)

type Handler struct {
	users       *service.UserService
	branches    *service.BranchService
	permissions *service.PermissionService
	db          *sql.DB
}

func New(
	users *service.UserService,
	branches *service.BranchService,
	permissions *service.PermissionService,
	rawDB *sql.DB,
) *Handler {
	return &Handler{users: users, branches: branches, permissions: permissions, db: rawDB}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	// Users
	r.GET("/users", h.ListUsers)
	r.GET("/users/:id", h.GetUser)
	r.PUT("/users/:id", h.UpdateUser)
	r.DELETE("/users/:id", h.DeleteUser)

	// Branches
	r.GET("/branches", h.ListBranches)
	r.POST("/branches", h.CreateBranch)
	r.GET("/branches/:id", h.GetBranch)
	r.PUT("/branches/:id", h.UpdateBranch)
	r.DELETE("/branches/:id", h.DeleteBranch)
	r.POST("/branches/:id/switch-month", h.SwitchMonth)

	// Permissions
	r.GET("/permissions/:userId", h.GetPermissions)
	r.PUT("/permissions/:userId", h.UpdatePermissions)

	// Settings (thin wrapper around branches)
	r.GET("/settings", h.GetSettings)
	r.PUT("/settings", h.UpdateSettings)

	// Audit logs
	r.GET("/audit-logs", h.ListAuditLogs)
}

// ── Users ─────────────────────────────────────────────────────────────────────

// ListUsers previously let a caller omit branchId to get every user across
// every branch — a cross-tenant data leak, and it also let a caller pass
// any branchId at all, not just their own. Now a non-super caller is always
// pinned to their own branch (from the verified JWT), and only a
// platform-level role may request an explicit branchId or all branches.
func (h *Handler) ListUsers(c *gin.Context) {
	// Query param first (not the JWT header) so a multi-branch manager who
	// switched branches client-side — the JWT's own branch_id never changes
	// on switch — sees the branch they actually picked, same as
	// GetSettings/UpdateSettings and notification_service's requestBranchID.
	// HasBranchAccess is what actually authorizes it; the param alone is
	// never trusted.
	branchID := c.Query("branchId")
	if branchID == "" {
		branchID = c.GetHeader("X-User-Branch-ID")
	}
	callerRole := c.GetHeader("X-User-Role")
	if !isSuperRole(callerRole) {
		if branchID == "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "no branch associated with this account"})
			return
		}
		allowed, err := h.branches.HasBranchAccess(c.Request.Context(),
			c.GetHeader("X-User-ID"), callerRole, branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "no branch associated with this account"})
			return
		}
	}
	users, err := h.users.GetAll(c.Request.Context(), branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": users})
}

// canAccessUser reports whether callerID/callerRole may read/modify target:
// a platform-level role, anyone with branch access to the target's branch,
// or the caller accessing their own record, can. Without this, any
// authenticated caller could read/modify/delete any user in any branch by
// GUID.
// It used to compare target.BranchID against the caller's raw
// X-User-Branch-ID header — a single equality check that ignores
// branch_managers entirely. A manager granted a second branch only via
// branch_managers (not their own home branch_id) could list that branch's
// users fine (ListUsers correctly uses HasBranchAccess) but got 404 from
// GetUser/UpdateUser/GetPermissions/UpdatePermissions for anyone in it —
// under-restrictive rather than a security hole, but it broke exactly the
// multi-branch-manager case this whole pattern exists for.
func (h *Handler) canAccessUser(ctx context.Context, callerID, callerRole string, target *service.User) bool {
	if callerID == target.ID {
		return true
	}
	if isSuperRole(callerRole) {
		return true
	}
	if target.BranchID == nil {
		return false
	}
	allowed, _ := h.branches.HasBranchAccess(ctx, callerID, callerRole, *target.BranchID)
	return allowed
}

func (h *Handler) GetUser(c *gin.Context) {
	u, err := h.users.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !h.canAccessUser(c.Request.Context(), c.GetHeader("X-User-ID"), c.GetHeader("X-User-Role"), u) {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *Handler) UpdateUser(c *gin.Context) {
	existing, err := h.users.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !h.canAccessUser(c.Request.Context(), c.GetHeader("X-User-ID"), c.GetHeader("X-User-Role"), existing) {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// role and branch_id control authorization and tenant scoping. Pull them
	// out of the generic body before it reaches Update (which no longer
	// accepts them at all) and route them through the privileged path below,
	// gated on the caller's role — never let a client grant itself a role or
	// hop branches through the plain profile-update body.
	rawRole, wantsRole := body["role"]
	rawBranch, wantsBranch := body["branch_id"]
	delete(body, "role")
	delete(body, "branch_id")

	callerRole := c.GetHeader("X-User-Role")
	if wantsRole && !canReassignRole(callerRole) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized to change role"})
		return
	}
	if wantsBranch && !canReassignBranch(callerRole) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized to change branch_id"})
		return
	}

	if len(body) > 0 {
		if _, err := h.users.Update(c.Request.Context(), c.Param("id"), body); err != nil {
			if err == service.ErrNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	if wantsRole || wantsBranch {
		rolePtr, err := stringFieldPtr(rawRole, wantsRole)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "role must be a string"})
			return
		}
		branchPtr, err := stringFieldPtr(rawBranch, wantsBranch)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branch_id must be a string"})
			return
		}
		// canReassignRole above only gates "is the caller admin-tier at
		// all" — it never checked the role being GRANTED, so a plain
		// tenant "admin" could set anyone's role to "developer" or
		// "super_admin" (platform-level roles, with no ceiling).
		if rolePtr != nil && !canGrantRole(callerRole, *rolePtr) {
			c.JSON(http.StatusForbidden, gin.H{"error": "cannot grant a platform-level role"})
			return
		}
		if _, err := h.users.UpdateRoleBranch(c.Request.Context(), c.Param("id"), rolePtr, branchPtr); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	u, err := h.users.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, u)
}

// canReassignRole reports whether callerRole may change another user's role
// through UpdateUser. "developer"/"super_admin" are platform-level roles
// granted out-of-band, not through this codepath.
func canReassignRole(callerRole string) bool {
	switch callerRole {
	case "admin", "developer", "super_admin":
		return true
	default:
		return false
	}
}

// canGrantRole reports whether callerRole may set a user's role to newRole.
// A platform-level caller (developer/super_admin) may grant any role.
// A tenant-level "admin" (already allowed past canReassignRole's coarser
// gate) may grant any ordinary tenant role but not a platform-level one —
// without this, a plain admin could hand out "developer"/"super_admin"
// with nothing to stop them.
func canGrantRole(callerRole, newRole string) bool {
	if isSuperRole(callerRole) {
		return true
	}
	return !isSuperRole(newRole)
}

// canReassignBranch is stricter than canReassignRole: moving a user across
// branches crosses tenant boundaries, so it's restricted to platform-level
// roles rather than a branch's own admin.
func canReassignBranch(callerRole string) bool {
	switch callerRole {
	case "developer", "super_admin":
		return true
	default:
		return false
	}
}

// stringFieldPtr extracts v as a *string when present is true, returning an
// error if the JSON value wasn't a string.
func stringFieldPtr(v interface{}, present bool) (*string, error) {
	if !present {
		return nil, nil
	}
	s, ok := v.(string)
	if !ok {
		return nil, fmt.Errorf("expected string")
	}
	return &s, nil
}

func (h *Handler) DeleteUser(c *gin.Context) {
	existing, err := h.users.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Deleting a user is more sensitive than reading/updating one — restrict
	// it to platform-level roles rather than extending it to same-branch
	// staff via canAccessUser (and never allow self-delete through this
	// generic admin endpoint).
	if !isSuperRole(c.GetHeader("X-User-Role")) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized to delete users"})
		return
	}
	if err := h.users.Delete(c.Request.Context(), existing.ID); err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "user deleted"})
}

// ── Branches ──────────────────────────────────────────────────────────────────

// isSuperRole reports whether callerRole is a platform-level role that
// operates across every branch/tenant, rather than being scoped to one.
func isSuperRole(role string) bool {
	return role == "developer" || role == "super_admin"
}

// canAccessBranch reports whether callerID/callerRole may read or modify
// branch b: platform-level roles always can, and anyone with branch access
// (owner admin or branch_managers) to b can.
// It used to check only b.AdminID == callerID, missing
// branch_managers the same way canAccessUser did — see its comment.
func (h *Handler) canAccessBranch(ctx context.Context, callerID, callerRole string, b *service.Branch) bool {
	if isSuperRole(callerRole) {
		return true
	}
	allowed, _ := h.branches.HasBranchAccess(ctx, callerID, callerRole, b.ID)
	return allowed
}

func (h *Handler) ListBranches(c *gin.Context) {
	// X-User-ID is injected by the api_gateway after JWT validation.
	// Always filter by the authenticated user so each admin only sees their own branches.
	// X-User-Role == "developer" or "super_admin" bypass the filter (see all branches).
	userID := c.GetHeader("X-User-ID")
	userRole := c.GetHeader("X-User-Role")

	var (
		branches []service.Branch
		err      error
	)

	if userID != "" && !isSuperRole(userRole) {
		branches, err = h.branches.GetByAdminID(c.Request.Context(), userID)
	} else {
		branches, err = h.branches.GetAll(c.Request.Context())
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": branches})
}

// CreateBranch is restricted to platform-level roles: a branch is a tenant,
// and letting any authenticated user create one (or assign an arbitrary
// adminId) is a resource-exhaustion / tenant-spoofing vector. Ordinary
// admin-onboarding creates its own branch — see auth_service.Register.
func (h *Handler) CreateBranch(c *gin.Context) {
	if !isSuperRole(c.GetHeader("X-User-Role")) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized to create branches"})
		return
	}
	var body struct {
		Name           string  `json:"name"           binding:"required"`
		Address        string  `json:"address"        binding:"required"`
		Phone          string  `json:"phone"          binding:"required"`
		MonthlyPayment float64 `json:"monthlyPayment" binding:"required,gt=0"`
		AdminID        *string `json:"adminId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	b, err := h.branches.Create(c.Request.Context(), body.Name, body.Address, body.Phone, body.MonthlyPayment, body.AdminID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, b)
}

func (h *Handler) GetBranch(c *gin.Context) {
	b, err := h.branches.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !h.canAccessBranch(c.Request.Context(), c.GetHeader("X-User-ID"), c.GetHeader("X-User-Role"), b) {
		c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
		return
	}
	c.JSON(http.StatusOK, b)
}

func (h *Handler) UpdateBranch(c *gin.Context) {
	existing, err := h.branches.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !h.canAccessBranch(c.Request.Context(), c.GetHeader("X-User-ID"), c.GetHeader("X-User-Role"), existing) {
		c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// admin_id reassignment changes who owns the tenant — restrict it the
	// same way canReassignBranch does for users, rather than letting a
	// branch's own admin hand it off (or take over another branch) via this
	// generic field-map update.
	if _, wantsAdmin := body["admin_id"]; wantsAdmin && !isSuperRole(c.GetHeader("X-User-Role")) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized to change admin_id"})
		return
	}
	b, err := h.branches.Update(c.Request.Context(), c.Param("id"), body)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, b)
}

func (h *Handler) SwitchMonth(c *gin.Context) {
	existing, err := h.branches.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if !h.canAccessBranch(c.Request.Context(), c.GetHeader("X-User-ID"), c.GetHeader("X-User-Role"), existing) {
		c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
		return
	}
	b, err := h.branches.SwitchMonth(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, b)
}

// DeleteBranch is restricted to platform-level roles — deleting a tenant is
// not something a branch's own admin should be able to self-service through
// this endpoint.
func (h *Handler) DeleteBranch(c *gin.Context) {
	if !isSuperRole(c.GetHeader("X-User-Role")) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized to delete branches"})
		return
	}
	if err := h.branches.Delete(c.Request.Context(), c.Param("id")); err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "branch deleted"})
}

// ── Permissions ───────────────────────────────────────────────────────────────

// GetPermissions allows an admin-level caller to view anyone's permissions,
// or any caller to view their own (self-service "what can I do" checks).
// Without this, any authenticated caller could enumerate any user's
// permission flags by userId.
func (h *Handler) GetPermissions(c *gin.Context) {
	targetID := c.Param("userId")
	callerID := c.GetHeader("X-User-ID")
	callerRole := c.GetHeader("X-User-Role")
	if callerID != targetID {
		if !canReassignRole(callerRole) {
			c.JSON(http.StatusForbidden, gin.H{"error": "not authorized to view these permissions"})
			return
		}
		// canReassignRole only checks the caller's role, not whether target
		// is even in a branch the caller administers — without this, a
		// branch-scoped admin could view (and, via UpdatePermissions, grant)
		// permissions for a user in an entirely different branch.
		target, err := h.users.GetByID(c.Request.Context(), targetID)
		if err != nil {
			if err == service.ErrNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !h.canAccessUser(c.Request.Context(), callerID, callerRole, target) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
	}
	p, err := h.permissions.GetByUserID(c.Request.Context(), targetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no permissions found"})
		return
	}
	c.JSON(http.StatusOK, p)
}

// UpdatePermissions is admin-only, including for a caller updating their own
// permissions — self-granting is exactly the privilege-escalation path this
// closes, matching canReassignRole's restriction on role changes.
func (h *Handler) UpdatePermissions(c *gin.Context) {
	callerRole := c.GetHeader("X-User-Role")
	if !canReassignRole(callerRole) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized to change permissions"})
		return
	}
	targetID := c.Param("userId")
	target, err := h.users.GetByID(c.Request.Context(), targetID)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// See GetPermissions: canReassignRole alone doesn't confirm target is in
	// a branch the caller administers.
	if !h.canAccessUser(c.Request.Context(), c.GetHeader("X-User-ID"), callerRole, target) {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p, err := h.permissions.Upsert(c.Request.Context(), targetID, body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

// ── Settings (branch-level config) ────────────────────────────────────────────

type settingsResponse struct {
	Name           string  `json:"name"`
	MonthlyPayment float64 `json:"monthlyPayment"`
	Currency       string  `json:"currency"`
	UpdatedDate    string  `json:"updatedDate"`
	CreatedDate    string  `json:"createdDate"`
}

func (h *Handler) GetSettings(c *gin.Context) {
	branchIDStr := c.Query("branchId")
	if branchIDStr == "" {
		branchIDStr = c.GetHeader("X-User-Branch-ID")
	}
	if branchIDStr == "" {
		if v, ok := c.Get("branch_id"); ok {
			branchIDStr, _ = v.(string)
		}
	}
	// No branchId at app init (admin hasn't selected a branch yet) — return
	// a default response so the frontend initializes without an error toast.
	if branchIDStr == "" {
		c.JSON(http.StatusOK, settingsResponse{Currency: "UZS"})
		return
	}
	if !isSuperRole(c.GetHeader("X-User-Role")) {
		allowed, err := h.branches.HasBranchAccess(c.Request.Context(),
			c.GetHeader("X-User-ID"), c.GetHeader("X-User-Role"), branchIDStr)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !allowed {
			c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
			return
		}
	}
	b, err := h.branches.GetByID(c.Request.Context(), branchIDStr)
	if err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settingsResponse{
		Name:           b.Name,
		MonthlyPayment: b.MonthlyPayment,
		Currency:       b.Currency,
		UpdatedDate:    b.UpdatedAt.Format("2006-01-02 15:04:05"),
		CreatedDate:    b.CreatedAt.Format("2006-01-02 15:04:05"),
	})
}

func (h *Handler) UpdateSettings(c *gin.Context) {
	branchIDStr := c.Query("branchId")
	if branchIDStr == "" {
		branchIDStr = c.GetHeader("X-User-Branch-ID")
	}
	if branchIDStr == "" {
		if v, ok := c.Get("branch_id"); ok {
			branchIDStr, _ = v.(string)
		}
	}
	if branchIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
		return
	}
	if !isSuperRole(c.GetHeader("X-User-Role")) {
		allowed, err := h.branches.HasBranchAccess(c.Request.Context(),
			c.GetHeader("X-User-ID"), c.GetHeader("X-User-Role"), branchIDStr)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !allowed {
			c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
			return
		}
	}
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	b, err := h.branches.Update(c.Request.Context(), branchIDStr, updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, settingsResponse{
		Name:           b.Name,
		MonthlyPayment: b.MonthlyPayment,
		Currency:       b.Currency,
		UpdatedDate:    b.UpdatedAt.Format("2006-01-02 15:04:05"),
		CreatedDate:    b.CreatedAt.Format("2006-01-02 15:04:05"),
	})
}

// ── Audit logs ────────────────────────────────────────────────────────────────

type auditLogEntry struct {
	ID          string    `json:"id"`
	BranchID    *string   `json:"branchId"`
	UserID      *string   `json:"userId"`
	UserName    string    `json:"userName"`
	Action      string    `json:"action"`
	Resource    string    `json:"resource"`
	ResourceID  *string   `json:"resourceId"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (h *Handler) ListAuditLogs(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		branchID = c.GetHeader("X-Branch-ID")
	}
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "X-Branch-ID header or branchId query required"})
		return
	}
	// This handler previously queried audit_logs for whatever branchId was
	// passed with no authorization check at all — any authenticated caller
	// of any role could read another branch's full audit trail (actions,
	// user names, resource IDs, descriptions) by editing the query string.
	if !isSuperRole(c.GetHeader("X-User-Role")) {
		allowed, err := h.branches.HasBranchAccess(c.Request.Context(),
			c.GetHeader("X-User-ID"), c.GetHeader("X-User-Role"), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "not authorized for this branch"})
			return
		}
	}

	resource := c.Query("resource")
	userID := c.Query("userId")
	from := c.Query("from")
	to := c.Query("to")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "25"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}
	offset := (page - 1) * limit

	where := " WHERE al.branch_id = $1 "
	args := []interface{}{branchID}
	idx := 2

	if resource != "" {
		where += " AND al.resource = $" + strconv.Itoa(idx)
		args = append(args, resource)
		idx++
	}
	if userID != "" {
		where += " AND al.user_id = $" + strconv.Itoa(idx)
		args = append(args, userID)
		idx++
	}
	if from != "" {
		where += " AND al.created_at >= $" + strconv.Itoa(idx)
		args = append(args, from)
		idx++
	}
	if to != "" {
		where += " AND al.created_at <= $" + strconv.Itoa(idx)
		args = append(args, to+"T23:59:59Z")
		idx++
	}

	var total int
	if err := h.db.QueryRowContext(c.Request.Context(), "SELECT COUNT(*) FROM audit_logs al"+where, args...).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	dataArgs := append([]interface{}{}, args...)
	dataArgs = append(dataArgs, limit, offset)

	rows, err := h.db.QueryContext(c.Request.Context(), `
		SELECT al.id,
		       al.branch_id::text,
		       al.user_id::text,
		       COALESCE(u.full_name, ''),
		       al.action,
		       al.resource,
		       al.resource_id::text,
		       al.description,
		       al.created_at
		FROM audit_logs al
		LEFT JOIN users u ON u.id = al.user_id
		`+where+`
		ORDER BY al.created_at DESC
		LIMIT $`+strconv.Itoa(idx)+` OFFSET $`+strconv.Itoa(idx+1),
		dataArgs...,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	entries := []auditLogEntry{}
	for rows.Next() {
		var e auditLogEntry
		var bid, uid, rid *string
		if err := rows.Scan(&e.ID, &bid, &uid, &e.UserName,
			&e.Action, &e.Resource, &rid, &e.Description, &e.CreatedAt); err != nil {
			continue
		}
		e.BranchID = bid
		e.UserID = uid
		e.ResourceID = rid
		entries = append(entries, e)
	}
	c.JSON(http.StatusOK, gin.H{
		"data":       entries,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": (total + limit - 1) / limit,
	})
}
