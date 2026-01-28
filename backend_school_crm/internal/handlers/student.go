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

func RegisterStudentRoutes(router *gin.RouterGroup, studentService *service.StudentService, classService *service.ClassService, userService *service.UserService, paymentService *service.PaymentService) {
	students := router.Group("/students")
	// Authenticated users can view and edit
	students.POST("", middleware.PermissionChecker(userService, "canCreateStudents"), createStudent(studentService))
	students.GET("/:id", middleware.PermissionChecker(userService, "canViewStudents"), getStudent(studentService))
	students.GET("", middleware.PermissionChecker(userService, "canViewStudents"), listStudents(studentService))
	students.PUT("/:id", middleware.PermissionChecker(userService, "canEditStudents"), updateStudent(studentService))
	students.DELETE("/:id", middleware.PermissionChecker(userService, "canDeleteStudents"), deleteStudent(studentService))
	// Consolidated data endpoint for students page
	students.GET("/consolidated/data", middleware.PermissionChecker(userService, "canViewStudents"), getStudentsConsolidatedData(studentService, classService))
	// Search students with payment status for payment modal
	students.GET("/search/with-payments", middleware.PermissionChecker(userService, "canViewStudents"), searchStudentsWithPayments(studentService, classService, paymentService))
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

// getStudentsConsolidatedData returns students, classes in a single API call
func getStudentsConsolidatedData(studentService *service.StudentService, classService *service.ClassService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		// Pagination parameters
		page := c.DefaultQuery("page", "1")
		limit := c.DefaultQuery("limit", "10")

		pageInt, _ := strconv.Atoi(page)
		limitInt, _ := strconv.Atoi(limit)

		if pageInt < 1 {
			pageInt = 1
		}
		if limitInt < 1 {
			limitInt = 10
		}
		if limitInt > 10000 {
			limitInt = 10000
		}

		// Get filters
		search := c.Query("search")
		status := c.Query("status")
		classID := c.Query("classId")
		paymentStatus := c.Query("paymentStatus")

		// Fetch students and classes in parallel
		studentsData, err := studentService.GetByBranchIDWithFilters(c.Request.Context(), branchID, page, limit, search, status, classID, paymentStatus)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, studentsData)
	}
}

// searchStudentsWithPayments returns students matching search term with their payment info
func searchStudentsWithPayments(studentService *service.StudentService, classService *service.ClassService, paymentService *service.PaymentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		search := c.Query("search")
		month := c.Query("month")
		year := c.Query("year")

		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		// Search students by name or phone (only active students)
		students, err := studentService.SearchByBranchID(c.Request.Context(), branchID, search)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search students"})
			return
		}

		// Build response with payment info
		type StudentWithPayment struct {
			ID             string  `json:"id"`
			FullName       string  `json:"fullName"`
			Phone          string  `json:"phone"`
			ClassID        string  `json:"classId"`
			ClassName      string  `json:"className"`
			MonthlyPayment float64 `json:"monthlyPayment"`
			PaidAmount     float64 `json:"paidAmount"`
			Status         string  `json:"status"`
		}

		var result []StudentWithPayment
		for _, student := range students {
			// Get class name
			className := "N/A"
			if student.ClassID != "" {
				classData, err := classService.GetByID(c.Request.Context(), student.ClassID)
				if err == nil && classData != nil {
					className = classData.Name
				}
			}

			// Get paid amount for current month
			paidAmount := 0.0
			if month != "" && year != "" {
				yearInt, err := strconv.Atoi(year)
				if err == nil {
					payments, err := paymentService.GetByStudentAndPeriod(c.Request.Context(), student.ID, month, yearInt)
					if err == nil {
						for _, p := range payments {
							paidAmount += p.Amount
						}
					}
				}
			}

			// Determine payment status
			paymentStatus := "none"
			if paidAmount > 0 {
				if paidAmount >= student.MonthlyPayment {
					paymentStatus = "paid"
				} else {
					paymentStatus = "partial"
				}
			}

			result = append(result, StudentWithPayment{
				ID:             student.ID,
				FullName:       student.FullName,
				Phone:          student.Phone,
				ClassID:        student.ClassID,
				ClassName:      className,
				MonthlyPayment: student.MonthlyPayment,
				PaidAmount:     paidAmount,
				Status:         paymentStatus,
			})
		}

		c.JSON(http.StatusOK, result)
	}
}
