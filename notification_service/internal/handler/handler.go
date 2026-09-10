package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/notification-service/internal/service"
)

type Handler struct {
	svc *service.NotificationService
}

func New(svc *service.NotificationService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r *gin.RouterGroup) {
	r.GET("/notifications", h.List)
	r.GET("/notifications/unread-count", h.UnreadCount)
	r.GET("/notifications/count", h.UnreadCount) // alias used by frontend
	r.POST("/notifications", h.Create)
	r.PUT("/notifications/:id/read", h.MarkRead)
	r.PUT("/notifications/read-all", h.MarkAllRead)
	r.DELETE("/notifications/:id", h.Delete)
}

// requestBranchID resolves which branch a request targets: an explicit
// branchId query param wins (a manager/admin who legitimately administers
// several branches picks among them client-side — branch switching in the
// frontend does not reissue a JWT, so the token's own branch_id stays fixed
// to the user's home branch and can't be used to infer which branch they
// currently mean). Falls back to X-User-Branch-ID, set by api_gateway's
// JWTAuth middleware (and this service's own, see middleware.JWTAuth), when
// no explicit choice is given.
//
// Resolving a branch here is NOT an authorization decision — every caller
// of this function MUST also call requireBranchAccess before using the
// resolved value.
func requestBranchID(c *gin.Context) string {
	if v := c.Query("branchId"); v != "" {
		return v
	}
	return c.GetHeader("X-User-Branch-ID")
}

// requireBranchAccess checks that the caller (identified by the
// JWT-verified X-User-ID/X-User-Role headers) is authorized for branchID —
// granted if it's their own branch, they're linked to it via
// branch_managers, they're its admin, or their role is developer/
// super_admin. Writes a response and returns false if not authorized.
func (h *Handler) requireBranchAccess(c *gin.Context, branchID string) bool {
	allowed, err := h.svc.HasBranchAccess(c.Request.Context(),
		c.GetHeader("X-User-ID"), c.GetHeader("X-User-Role"), branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return false
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "not authorized for this branch"})
		return false
	}
	return true
}

func (h *Handler) List(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		// No branchId yet (app init before branch selection) — return an
		// empty list so the UI initializes without an error toast.
		c.JSON(http.StatusOK, gin.H{"items": []interface{}{}})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	unreadOnly := c.Query("unread") == "true"
	notifs, err := h.svc.List(c.Request.Context(), branchID, unreadOnly, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": notifs})
}

func (h *Handler) UnreadCount(c *gin.Context) {
	branchID := requestBranchID(c)
	// No branchId yet (app init before branch selection) — return 0 so the
	// notification bell initializes without an error toast.
	if branchID == "" {
		c.JSON(http.StatusOK, gin.H{"count": 0})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	count, err := h.svc.UnreadCount(c.Request.Context(), branchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func (h *Handler) Create(c *gin.Context) {
	var body struct {
		BranchID     string `json:"branchId"     binding:"required"`
		Title        string `json:"title"        binding:"required"`
		Message      string `json:"message"      binding:"required"`
		Type         string `json:"type"         binding:"required"`
		ResourceType string `json:"resourceType"`
		ResourceID   string `json:"resourceId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !h.requireBranchAccess(c, body.BranchID) {
		return
	}
	if err := h.svc.Create(c.Request.Context(), body.BranchID, body.Title, body.Message,
		body.Type, body.ResourceType, body.ResourceID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "notification created"})
}

func (h *Handler) MarkRead(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	if err := h.svc.MarkRead(c.Request.Context(), c.Param("id"), branchID); err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "notification not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "marked as read"})
}

func (h *Handler) MarkAllRead(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	if err := h.svc.MarkAllRead(c.Request.Context(), branchID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "all notifications marked as read"})
}

func (h *Handler) Delete(c *gin.Context) {
	branchID := requestBranchID(c)
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if !h.requireBranchAccess(c, branchID) {
		return
	}
	if err := h.svc.Delete(c.Request.Context(), c.Param("id"), branchID); err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "notification not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "notification deleted"})
}
