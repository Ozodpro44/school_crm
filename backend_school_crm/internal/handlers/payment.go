package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

func RegisterPaymentRoutes(router *gin.RouterGroup, paymentService *service.PaymentService, branchService *service.BranchService, userService *service.UserService, studentService *service.StudentService) {
	payments := router.Group("/payments")
	// Authenticated users can view and edit payments
	payments.POST("", middleware.PermissionChecker(userService, "canCreatePayments"), createPayment(paymentService, branchService))
	payments.GET("/:id", middleware.PermissionChecker(userService, "canViewPayments"), getPayment(paymentService))
	payments.GET("", middleware.PermissionChecker(userService, "canViewPayments"), listPayments(paymentService, branchService, userService))
	payments.PUT("/:id", middleware.PermissionChecker(userService, "canEditPayments"), updatePayment(paymentService, branchService, userService))
	payments.DELETE("/:id", middleware.PermissionChecker(userService, "canEditPayments"), deletePayment(paymentService, branchService, userService))
	payments.GET("/branch/:branchId/summary", middleware.PermissionChecker(userService, "canViewPayments"), getPaymentSummary(paymentService, branchService))
	payments.GET("/payments/:branchId/indicators", middleware.PermissionChecker(userService, "canViewPayments"), getPaymentIndicators(paymentService))
	// Student payment history - separate endpoint for viewing all payments for a student
	payments.GET("/student/:studentId/history", middleware.PermissionChecker(userService, "canViewPayments"), getStudentPaymentHistory(paymentService, userService))
	// Student payment status for current month - used in payment modal
	payments.GET("/status/:studentId", middleware.PermissionChecker(userService, "canViewPayments"), getStudentPaymentStatus(paymentService, branchService))
	// Search students with payment status and filters
	payments.GET("/search/students", middleware.PermissionChecker(userService, "canViewPayments"), searchStudentsWithPaymentStatus(paymentService, branchService, studentService))
}

func createPayment(paymentService *service.PaymentService, branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var req service.CreatePaymentRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Validate that payment is for the branch's current month
		currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), req.BranchID)
		if err != nil {
			fmt.Printf("[CreatePayment] Error getting branch current month: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month: " + err.Error()})
			return
		}

		// Only allow creating payments for the current month of the branch
		if req.Month != currentMonth || req.Year != currentYear {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("can only create payments for current month (%s/%d)", currentMonth, currentYear)})
			return
		}

		payment, err := paymentService.Create(c.Request.Context(), &req, userID)
		if err != nil {
			fmt.Printf("[CreatePayment] Error creating payment: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, payment)
	}
}

func getPayment(paymentService *service.PaymentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		payment, err := paymentService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, payment)
	}
}

func listPayments(paymentService *service.PaymentService, branchService *service.BranchService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		studentID := c.Query("studentId")
		month := c.Query("month")
		year := c.Query("year")
		
		// Pagination parameters
		page := c.DefaultQuery("page", "1")
		limit := c.DefaultQuery("limit", "10")
		
		pageInt, _ := strconv.Atoi(page)
		limitInt, _ := strconv.Atoi(limit)
		
		// Validate pagination params
		if pageInt < 1 {
			pageInt = 1
		}
		if limitInt < 1 {
			limitInt = 10
		}
		// Allow larger limits for data analysis and reporting (max 10000)
		if limitInt > 10000 {
			limitInt = 10000
		}

		// Get user role for access control
		userRole, _ := middleware.GetUserRole(c, userService)
		isAdmin := userRole == models.RoleAdmin || userRole == models.RoleBranchAdmin

		if branchID != "" {
			// Get branch's current month
			currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), branchID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
				return
			}

			// If month and year are provided and user is admin, allow viewing any month
			if month != "" && year != "" && isAdmin {
				result, err := paymentService.GetByBranchIDAndPeriodPaginated(c.Request.Context(), branchID, month, year, pageInt, limitInt)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, result)
				return
			}

			// For managers or when no specific period requested: return branch's current month only
			result, err := paymentService.GetByBranchIDAndPeriodPaginated(c.Request.Context(), branchID, currentMonth, strconv.Itoa(currentYear), pageInt, limitInt)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, result)
			return
		}

		if studentID != "" && month != "" && year != "" {
			yearInt, _ := strconv.Atoi(year)
			payments, err := paymentService.GetByStudentIDAndPeriod(c.Request.Context(), studentID, month, yearInt)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, payments)
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{"error": "branchId or (studentId, month, year) required"})
	}
}

func updatePayment(paymentService *service.PaymentService, branchService *service.BranchService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// Get the existing payment to check its month
		existingPayment, err := paymentService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		// Get branch's current month
		currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), existingPayment.BranchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
			return
		}

		// Check if payment is from a past month - only Admin can edit past months
		userRole, _ := middleware.GetUserRole(c, userService)
		isAdmin := userRole == models.RoleAdmin

		isPastMonth := existingPayment.Month != currentMonth || existingPayment.Year != currentYear
		if isPastMonth && !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "cannot modify payments from past months"})
			return
		}

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payment, err := paymentService.Update(c.Request.Context(), id, updates)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, payment)
	}
}

func deletePayment(paymentService *service.PaymentService, branchService *service.BranchService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// Get the existing payment to check its month
		existingPayment, err := paymentService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		// Get branch's current month
		currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), existingPayment.BranchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
			return
		}

		// Check if payment is from a past month - only Admin can delete past months
		userRole, _ := middleware.GetUserRole(c, userService)
		isAdmin := userRole == models.RoleAdmin

		isPastMonth := existingPayment.Month != currentMonth || existingPayment.Year != currentYear
		if isPastMonth && !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "cannot delete payments from past months"})
			return
		}

		if err := paymentService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "payment deleted"})
	}
}

func getPaymentSummary(paymentService *service.PaymentService, branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Param("branchId")

		// Get branch's current month for summary
		currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
			return
		}

		summary, err := paymentService.GetPaymentSummaryForPeriod(c.Request.Context(), branchID, currentMonth, currentYear)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, summary)
	}
}

func getPaymentIndicators(paymentService *service.PaymentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Param("branchId")
		month := c.Query("month")
		year := c.Query("year")

		currentYear, err := strconv.Atoi(year)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year"})
			return
		}

		summary, err := paymentService.GetPaymentSummaryForPeriod(c.Request.Context(), branchID, month, currentYear)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, summary)
	}
}

// getStudentPaymentHistory returns all payment history for a student
// Admin sees all history, Manager sees only current month
func getStudentPaymentHistory(paymentService *service.PaymentService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		studentID := c.Param("studentId")

		// Get user role for access control
		userRole, _ := middleware.GetUserRole(c, userService)
		isAdmin := userRole == models.RoleAdmin || userRole == models.RoleBranchAdmin

		if isAdmin {
			// Admin sees all payment history
			payments, err := paymentService.GetByStudentID(c.Request.Context(), studentID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, payments)
		} else {
			// Manager sees only current month - needs branchId to get current month
			branchID := c.Query("branchId")
			if branchID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required for non-admin users"})
				return
			}
			// For managers, we return empty - they should use the main listPayments endpoint
			c.JSON(http.StatusOK, []interface{}{})
		}
	}
}

// getStudentPaymentStatus returns the payment status for a student in the current month
// Returns: status (paid/partial/not_paid) and amount paid
func getStudentPaymentStatus(paymentService *service.PaymentService, branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		studentID := c.Param("studentId")
		branchID := c.Query("branchId")

		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		// Get branch's current month
		currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
			return
		}

		// Get payments for this student in the current month
		payments, err := paymentService.GetByStudentIDAndPeriod(c.Request.Context(), studentID, currentMonth, currentYear)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Calculate total paid amount
		totalPaid := 0.0
		for _, payment := range payments {
			totalPaid += float64(payment.Amount)
		}

		c.JSON(http.StatusOK, gin.H{
			"status": "pending",
			"amount": totalPaid,
		})
	}
}

// StudentPaymentStatus represents a student with their payment information
type StudentPaymentStatus struct {
	ID              string  `json:"id"`
	FullName        string  `json:"fullName"`
	ClassID         string  `json:"classId"`
	Phone           string  `json:"phone"`
	MonthlyPayment  float64 `json:"monthlyPayment"`
	Status          string  `json:"status"` // active/left/suspended
	AmountPaid      float64 `json:"amountPaid"`
	PaymentStatus   string  `json:"paymentStatus"` // paid/partial/not_paid
	Remaining       float64 `json:"remaining"`
}

// searchStudentsWithPaymentStatus returns students with their payment status, supporting search and filters
func searchStudentsWithPaymentStatus(paymentService *service.PaymentService, branchService *service.BranchService, studentService *service.StudentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		searchQuery := c.Query("search")
		classID := c.Query("classId")
		studentStatus := c.Query("status") // active/left/suspended
		paymentStatus := c.Query("paymentStatus") // paid/partial/not_paid
		limit := c.DefaultQuery("limit", "50")
		offset := c.DefaultQuery("offset", "0")

		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		limitInt, _ := strconv.Atoi(limit)
		offsetInt, _ := strconv.Atoi(offset)

		// Validate pagination
		if limitInt < 1 {
			limitInt = 50
		}
		if limitInt > 500 {
			limitInt = 500
		}
		if offsetInt < 0 {
			offsetInt = 0
		}

		// Get branch's current month
		currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
			return
		}

		// Get all students for the branch (fetch with large limit to handle all pagination locally)
		students, _, err := studentService.GetByBranchID(c.Request.Context(), branchID, 1, 10000)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get students"})
			return
		}

		// Build student payment status list
		filteredStudents := []StudentPaymentStatus{}

		for _, student := range students {
			// Get payments for this student in the current month
			payments, err := paymentService.GetByStudentIDAndPeriod(c.Request.Context(), student.ID, currentMonth, currentYear)
			if err != nil {
				continue
			}

			// Calculate total paid amount
			totalPaid := 0.0
			for _, payment := range payments {
				totalPaid += float64(payment.Amount)
			}

			// Determine payment status
			paymentStatusStr := "not_paid"
			remaining := student.MonthlyPayment - totalPaid

			if totalPaid >= student.MonthlyPayment {
				paymentStatusStr = "paid"
				remaining = 0
			} else if totalPaid > 0 {
				paymentStatusStr = "partial"
			}

			studentPayment := StudentPaymentStatus{
				ID:             student.ID,
				FullName:       student.FullName,
				ClassID:        student.ClassID,
				Phone:          student.Phone,
				MonthlyPayment: student.MonthlyPayment,
				Status:         string(student.Status),
				AmountPaid:     totalPaid,
				PaymentStatus:  paymentStatusStr,
				Remaining:      remaining,
			}

			// Apply search filter (case-insensitive)
			if searchQuery != "" {
				searchLower := strings.ToLower(searchQuery)
				if !strings.Contains(strings.ToLower(studentPayment.FullName), searchLower) &&
					!strings.Contains(strings.ToLower(studentPayment.Phone), searchLower) {
					continue
				}
			}

			// Apply class filter
			if classID != "" && studentPayment.ClassID != classID {
				continue
			}

			// Apply student status filter
			if studentStatus != "" && studentPayment.Status != studentStatus {
				continue
			}

			// Apply payment status filter
			if paymentStatus != "" && studentPayment.PaymentStatus != paymentStatus {
				continue
			}

			filteredStudents = append(filteredStudents, studentPayment)
		}

		// Apply pagination
		total := len(filteredStudents)
		start := offsetInt
		end := offsetInt + limitInt

		if start > total {
			start = total
		}
		if end > total {
			end = total
		}

		paginatedStudents := filteredStudents[start:end]

		c.JSON(http.StatusOK, gin.H{
			"data":   paginatedStudents,
			"total":  total,
			"limit":  limitInt,
			"offset": offsetInt,
		})
	}
}