package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

// RegisterNotificationRoutes mounts notification endpoints (all require auth + active subscription).
//
//	GET  /notifications          — list recent notifications for the current branch
//	GET  /notifications/count    — unread count
//	PUT  /notifications/read-all — mark all as read
//	PUT  /notifications/:id/read — mark one as read
func RegisterNotificationRoutes(router *gin.RouterGroup, notifService *service.NotificationService) {
	g := router.Group("/notifications")
	g.GET("", listNotifications(notifService))
	g.GET("/count", countUnread(notifService))
	g.PUT("/read-all", markAllRead(notifService))
	g.PUT("/:id/read", markRead(notifService))
}

func listNotifications(svc *service.NotificationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.GetHeader("X-Branch-ID")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "X-Branch-ID header required"})
			return
		}
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		notifications, err := svc.ListByBranch(c.Request.Context(), branchID, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, notifications)
	}
}

func countUnread(svc *service.NotificationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.GetHeader("X-Branch-ID")
		if branchID == "" {
			c.JSON(http.StatusOK, gin.H{"count": 0})
			return
		}
		count, err := svc.CountUnread(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"count": count})
	}
}

func markRead(svc *service.NotificationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		branchID := c.GetHeader("X-Branch-ID")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "X-Branch-ID header required"})
			return
		}
		if err := svc.MarkRead(c.Request.Context(), id, branchID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

func markAllRead(svc *service.NotificationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.GetHeader("X-Branch-ID")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "X-Branch-ID header required"})
			return
		}
		if err := svc.MarkAllRead(c.Request.Context(), branchID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}
