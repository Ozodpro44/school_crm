package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

// DEPRECATED (P5): Routed by api_gateway to teacher_service. Kept as fallback until P5.5.
func RegisterTeacherRoutes(router *gin.RouterGroup, teacherService *service.TeacherService, userService *service.UserService) {
	teachers := router.Group("/teachers")
	// Authenticated users can view and edit
	teachers.POST("", middleware.PermissionChecker(userService, "canCreateTeachers"), createTeacher(teacherService))
	teachers.GET("/:id", middleware.PermissionChecker(userService, "canViewTeachers"), getTeacher(teacherService))
	teachers.GET("", middleware.PermissionChecker(userService, "canViewTeachers"), listTeachers(teacherService))
	teachers.PUT("/:id", middleware.PermissionChecker(userService, "canEditTeachers"), updateTeacher(teacherService))
	teachers.DELETE("/:id", middleware.PermissionChecker(userService, "canDeleteTeachers"), deleteTeacher(teacherService))
}

func createTeacher(teacherService *service.TeacherService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req service.CreateTeacherRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		teacher, err := teacherService.Create(c.Request.Context(), &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, teacher)
	}
}

func getTeacher(teacherService *service.TeacherService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		teacher, err := teacherService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, teacher)
	}
}

func listTeachers(teacherService *service.TeacherService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		teachers, err := teacherService.GetByBranchID(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, teachers)
	}
}

func updateTeacher(teacherService *service.TeacherService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		teacher, err := teacherService.Update(c.Request.Context(), id, updates)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, teacher)
	}
}

func deleteTeacher(teacherService *service.TeacherService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := teacherService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "teacher deleted"})
	}
}
