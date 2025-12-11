package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

func RegisterTeacherRoutes(router *gin.RouterGroup, teacherService *service.TeacherService) {
	teachers := router.Group("/teachers")
	teachers.POST("", createTeacher(teacherService))
	teachers.GET("/:id", getTeacher(teacherService))
	teachers.GET("", listTeachers(teacherService))
	teachers.PUT("/:id", updateTeacher(teacherService))
	teachers.DELETE("/:id", deleteTeacher(teacherService))
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
