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
	g.PUT("/me/link/:teacherId", middleware.PermissionChecker(userService, "canEditTeachers"), middleware.RequireResourceBranchAccessParam(userService, "teachers", "teacherId"), linkTeacherUser(portalSvc, userService))
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

func linkTeacherUser(svc *service.TeacherPortalService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		teacherID := c.Param("teacherId")

		var body struct {
			UserID string `json:"userId" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// The user being linked must belong to the teacher's branch too —
		// otherwise a teacher record could be handed to an outsider's account.
		teacherBranch, _, err := userService.ResourceBranchID(c.Request.Context(), "teachers", teacherID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error verifying branch access"})
			return
		}
		if ok, err := userService.BelongsToBranch(c.Request.Context(), body.UserID, teacherBranch); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error verifying branch access"})
			return
		} else if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user does not belong to the teacher's branch"})
			return
		}

		if err := svc.LinkUserToTeacher(c.Request.Context(), teacherID, body.UserID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
