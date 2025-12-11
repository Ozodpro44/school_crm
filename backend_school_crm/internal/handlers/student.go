package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

func RegisterStudentRoutes(router *gin.RouterGroup, studentService *service.StudentService, classService *service.ClassService) {
	students := router.Group("/students")
	students.POST("", createStudent(studentService))
	students.GET("/:id", getStudent(studentService))
	students.GET("", listStudents(studentService))
	students.PUT("/:id", updateStudent(studentService))
	students.DELETE("/:id", deleteStudent(studentService))
}

func createStudent(studentService *service.StudentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req service.CreateStudentRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		student, err := studentService.Create(c.Request.Context(), &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, student)
	}
}

func getStudent(studentService *service.StudentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		student, err := studentService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, student)
	}
}

func listStudents(studentService *service.StudentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		students, err := studentService.GetByBranchID(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, students)
	}
}

func updateStudent(studentService *service.StudentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		student, err := studentService.Update(c.Request.Context(), id, updates)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, student)
	}
}

func deleteStudent(studentService *service.StudentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := studentService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "student deleted"})
	}
}
