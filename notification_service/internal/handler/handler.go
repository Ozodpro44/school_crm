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

func (h *Handler) List(c *gin.Context) {
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
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
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
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
		BranchID     string  `json:"branchId"     binding:"required"`
		Title        string  `json:"title"        binding:"required"`
		Message      string  `json:"message"      binding:"required"`
		Type         string  `json:"type"         binding:"required"`
		ResourceType string  `json:"resourceType"`
		ResourceID   string  `json:"resourceId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
	if err := h.svc.MarkRead(c.Request.Context(), c.Param("id")); err != nil {
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
	branchID := c.Query("branchId")
	if branchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
		return
	}
	if err := h.svc.MarkAllRead(c.Request.Context(), branchID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "all notifications marked as read"})
}

func (h *Handler) Delete(c *gin.Context) {
	if err := h.svc.Delete(c.Request.Context(), c.Param("id")); err != nil {
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "notification not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "notification deleted"})
}
