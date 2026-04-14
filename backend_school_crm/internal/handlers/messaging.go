package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

// RegisterMessagingRoutes mounts messaging endpoints.
//
//	GET  /messages?branchId=&limit=  — history
//	POST /messages/send              — send
//	PUT  /messages/student/:id/telegram — set telegram chat_id on student
func RegisterMessagingRoutes(router *gin.RouterGroup, svc *service.MessagingService, userService *service.UserService) {
	g := router.Group("/messages")
	g.GET("", middleware.PermissionChecker(userService, "canViewStudents"), listMessages(svc))
	g.POST("/send", middleware.PermissionChecker(userService, "canEditStudents"), sendMessage(svc))
	g.PUT("/student/:id/telegram", middleware.PermissionChecker(userService, "canEditStudents"), setStudentTelegram(svc))
}

func listMessages(svc *service.MessagingService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			branchID = c.GetHeader("X-Branch-ID")
		}
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}
		limit := 50
		if l := c.Query("limit"); l != "" {
			if v, err := strconv.Atoi(l); err == nil {
				limit = v
			}
		}
		logs, err := svc.ListHistory(c.Request.Context(), branchID, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, logs)
	}
}

func sendMessage(svc *service.MessagingService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var req models.SendMessageRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		result, err := svc.Send(c.Request.Context(), &req, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, result)
	}
}

func setStudentTelegram(svc *service.MessagingService) gin.HandlerFunc {
	return func(c *gin.Context) {
		studentID := c.Param("id")
		var body struct {
			ChatID string `json:"chatId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := svc.UpdateStudentTelegramID(c.Request.Context(), studentID, body.ChatID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
