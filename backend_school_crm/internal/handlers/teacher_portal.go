package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

// RegisterTeacherPortalRoutes mounts the teacher portal endpoints.
//
//	GET  /teacher-portal/me            — full portal data for logged-in teacher
//	PUT  /teacher-portal/me/link/:tid  — link a teacher record to current user (admin only)
func RegisterTeacherPortalRoutes(
	router *gin.RouterGroup,
	portalSvc *service.TeacherPortalService,
	userService *service.UserService,
) {
	g := router.Group("/teacher-portal")
	g.GET("/me", getTeacherPortal(portalSvc))
	g.PUT("/me/link/:teacherId", middleware.PermissionChecker(userService, "canEditTeachers"), linkTeacherUser(portalSvc))
}

func getTeacherPortal(svc *service.TeacherPortalService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		data, err := svc.GetPortalData(c.Request.Context(), userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, data)
	}
}

func linkTeacherUser(svc *service.TeacherPortalService) gin.HandlerFunc {
	return func(c *gin.Context) {
		teacherID := c.Param("teacherId")

		var body struct {
			UserID string `json:"userId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := svc.LinkUserToTeacher(c.Request.Context(), teacherID, body.UserID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
