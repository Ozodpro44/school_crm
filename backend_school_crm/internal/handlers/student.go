package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

func RegisterStudentRoutes(router *gin.RouterGroup, studentService *service.StudentService, userService *service.UserService, financeService *service.FinanceService) {
	students := router.Group("/students")
	students.POST("", middleware.PermissionChecker(userService, "canCreateStudents"), createStudent(studentService))
	students.GET("/:id", middleware.PermissionChecker(userService, "canViewStudents"), getStudent(studentService))
	students.GET("", middleware.PermissionChecker(userService, "canViewStudents"), listStudents(studentService))
	students.PUT("/:id", middleware.PermissionChecker(userService, "canEditStudents"), updateStudent(studentService))
	students.DELETE("/:id", middleware.PermissionChecker(userService, "canDeleteStudents"), deleteStudent(studentService))
	students.GET("/consolidated/data", middleware.PermissionChecker(userService, "canViewStudents"), getStudentsConsolidatedData(studentService))
	students.GET("/search/with-payments", middleware.PermissionChecker(userService, "canViewStudents"), searchStudentsWithPayments(financeService))
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
			if errors.Is(err, service.ErrSubscriptionLimitReached) {
				c.JSON(http.StatusPaymentRequired, gin.H{
					"error":  "subscription_limit_reached",
					"detail": err.Error(),
				})
				return
			}
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
		if limit > 1000 {
			limit = 1000
		}

		students, total, err := studentService.GetByBranchID(c.Request.Context(), branchID, page, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"data":       students,
			"total":      total,
			"page":       page,
			"limit":      limit,
			"totalPages": (total + int64(limit) - 1) / int64(limit),
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

func getStudentsConsolidatedData(studentService *service.StudentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		studentsData, err := studentService.GetByBranchIDWithFilters(c.Request.Context(), service.StudentFilterInput{
			BranchID:      branchID,
			Page:          c.DefaultQuery("page", "1"),
			Limit:         c.DefaultQuery("limit", "10"),
			Search:        c.Query("search"),
			Status:        c.Query("status"),
			ClassID:       c.Query("classId"),
			PaymentStatus: c.Query("paymentStatus"),
			Month:         c.Query("month"),
			Year:          c.Query("year"),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, studentsData)
	}
}

func searchStudentsWithPayments(financeService *service.FinanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		yearInt, _ := strconv.Atoi(c.Query("year"))

		result, err := financeService.SearchStudentsWithPayments(
			c.Request.Context(),
			branchID,
			c.Query("search"),
			c.Query("month"),
			yearInt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search students"})
			return
		}
		c.JSON(http.StatusOK, result)
	}
}
