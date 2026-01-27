package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

func RegisterStudentRoutes(router *gin.RouterGroup, studentService *service.StudentService, classService *service.ClassService, userService *service.UserService) {
	students := router.Group("/students")
	// Authenticated users can view and edit
	students.POST("", middleware.PermissionChecker(userService, "canCreateStudents"), createStudent(studentService))
	students.GET("/:id", middleware.PermissionChecker(userService, "canViewStudents"), getStudent(studentService))
	students.GET("", middleware.PermissionChecker(userService, "canViewStudents"), listStudents(studentService))
	students.PUT("/:id", middleware.PermissionChecker(userService, "canEditStudents"), updateStudent(studentService))
	students.DELETE("/:id", middleware.PermissionChecker(userService, "canDeleteStudents"), deleteStudent(studentService))
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

		// Parse pagination params
		pageStr := c.DefaultQuery("page", "1")
		limitStr := c.DefaultQuery("limit", "10")
		
		page := 1
		limit := 10
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
		// Cap limit at 1000
		if limit > 1000 {
			limit = 1000
		}

		// Get filter parameters
		search := c.Query("search")
		classID := c.Query("classId")
		status := c.Query("status")

		// Get all students first (will apply filtering in memory)
		students, total, err := studentService.GetByBranchID(c.Request.Context(), branchID, page, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Apply filters to the results if search/filters provided
		var filteredStudents []models.Student
		filteredTotal := total

		if search != "" || classID != "" || status != "" {
			// Need to fetch all students to filter properly
			allStudents, _, err := studentService.GetByBranchID(c.Request.Context(), branchID, 1, 10000)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			// Apply filters
			for _, student := range allStudents {
				// Search filter (name or phone)
				if search != "" {
					searchLower := strings.ToLower(search)
					nameLower := strings.ToLower(student.FullName)
					phoneLower := strings.ToLower(student.Phone)
					if !strings.Contains(nameLower, searchLower) && !strings.Contains(phoneLower, searchLower) {
						continue
					}
				}

				// Class filter
				if classID != "" && student.ClassID != classID {
					continue
				}

				// Status filter
				if status != "" && string(student.Status) != status {
					continue
				}

				filteredStudents = append(filteredStudents, student)
			}

			filteredTotal = int64(len(filteredStudents))

			// Apply pagination to filtered results
			offset := (page - 1) * limit
			end := offset + limit
			if offset > len(filteredStudents) {
				offset = len(filteredStudents)
			}
			if end > len(filteredStudents) {
				end = len(filteredStudents)
			}
			students = filteredStudents[offset:end]
		}

		c.JSON(http.StatusOK, gin.H{
			"data":       students,
			"total":      filteredTotal,
			"page":       page,
			"limit":      limit,
			"totalPages": (filteredTotal + int64(limit) - 1) / int64(limit),
		})
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
