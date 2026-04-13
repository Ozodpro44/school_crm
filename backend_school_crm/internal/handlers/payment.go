package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

func RegisterPaymentRoutes(router *gin.RouterGroup, paymentService *service.PaymentService, branchService *service.BranchService, userService *service.UserService, financeService *service.FinanceService, notifService *service.NotificationService) {
	payments := router.Group("/payments")
	payments.POST("", middleware.PermissionChecker(userService, "canCreatePayments"), createPayment(paymentService, notifService))
	payments.GET("/:id", middleware.PermissionChecker(userService, "canViewPayments"), getPayment(paymentService))
	payments.GET("", middleware.PermissionChecker(userService, "canViewPayments"), listPayments(paymentService, branchService, userService))
	payments.GET("/consolidated/data", middleware.PermissionChecker(userService, "canViewPayments"), getPaymentsConsolidatedData(paymentService, branchService, userService, financeService))
	payments.PUT("/:id", middleware.PermissionChecker(userService, "canEditPayments"), updatePayment(paymentService, userService, notifService))
	payments.DELETE("/:id", middleware.PermissionChecker(userService, "canEditPayments"), deletePayment(paymentService, branchService, userService))
	payments.GET("/branch/:branchId/summary", middleware.PermissionChecker(userService, "canViewPayments"), getPaymentSummary(paymentService, branchService))
	payments.GET("/payments/:branchId/indicators", middleware.PermissionChecker(userService, "canViewPayments"), getPaymentIndicators(paymentService))
	payments.GET("/student/:studentId/history", middleware.PermissionChecker(userService, "canViewPayments"), getStudentPaymentHistory(paymentService, userService))
	payments.GET("/status/:studentId", middleware.PermissionChecker(userService, "canViewPayments"), getStudentPaymentStatus(financeService))
	payments.GET("/search/students", middleware.PermissionChecker(userService, "canViewPayments"), searchStudentsWithPaymentStatus(financeService))
}

func createPayment(paymentService *service.PaymentService, notifService *service.NotificationService) gin.HandlerFunc {
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

		payment, err := paymentService.Create(c.Request.Context(), &req, userID)
		if err != nil {
			if errors.Is(err, service.ErrFinancialMonthLocked) {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Fire notification (non-blocking, failure is silently ignored)
		if notifService != nil {
			msg := formatPaymentNotifMsg(payment.Amount, payment.Month, payment.Year, string(payment.Status))
			_ = notifService.Create(c.Request.Context(), req.BranchID,
				"Payment recorded", msg,
				service.NotifTypePayment, "payment", payment.ID)
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
		search := c.Query("search")
		status := c.Query("status")

		pageInt, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limitInt, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		if pageInt < 1 {
			pageInt = 1
		}
		if limitInt < 1 {
			limitInt = 10
		}
		if limitInt > 10000 {
			limitInt = 10000
		}

		userRole, _ := middleware.GetUserRole(c, userService)
		isAdmin := userRole == models.RoleAdmin || userRole == models.RoleBranchAdmin

		if branchID != "" {
			currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), branchID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
				return
			}

			if month != "" && year != "" && isAdmin {
				result, err := paymentService.GetByBranchIDAndPeriodPaginatedWithSearch(c.Request.Context(), branchID, month, year, search, status, pageInt, limitInt)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, result)
				return
			}

			result, err := paymentService.GetByBranchIDAndPeriodPaginatedWithSearch(c.Request.Context(), branchID, currentMonth, strconv.Itoa(currentYear), search, status, pageInt, limitInt)
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

func updatePayment(paymentService *service.PaymentService, userService *service.UserService, notifService *service.NotificationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		userRole, _ := middleware.GetUserRole(c, userService)
		isAdmin := userRole == models.RoleAdmin

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		payment, err := paymentService.Update(c.Request.Context(), id, updates, isAdmin)
		if err != nil {
			if errors.Is(err, service.ErrFinancialMonthLocked) {
				c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Notify when payment is confirmed as paid
		if notifService != nil {
			if newStatus, ok := updates["status"].(string); ok && newStatus == "paid" {
				msg := formatPaymentNotifMsg(payment.Amount, payment.Month, payment.Year, "paid")
				_ = notifService.Create(c.Request.Context(), payment.BranchID,
					"Payment confirmed", msg,
					service.NotifTypePayment, "payment", payment.ID)
			}
		}

		c.JSON(http.StatusOK, payment)
	}
}

// formatPaymentNotifMsg builds a human-readable notification message for a payment event.
func formatPaymentNotifMsg(amount float64, month string, year int, status string) string {
	statusLabel := "recorded"
	if status == "paid" {
		statusLabel = "confirmed as paid"
	} else if status == "partial" {
		statusLabel = "partial payment recorded"
	}
	return fmt.Sprintf("Payment of %.0f for %s/%d %s", amount, month, year, statusLabel)
}

func deletePayment(paymentService *service.PaymentService, branchService *service.BranchService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		existingPayment, err := paymentService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), existingPayment.BranchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
			return
		}

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

		currentYear, err := strconv.Atoi(c.Query("year"))
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

func getStudentPaymentHistory(paymentService *service.PaymentService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		studentID := c.Param("studentId")

		userRole, _ := middleware.GetUserRole(c, userService)
		isAdmin := userRole == models.RoleAdmin || userRole == models.RoleBranchAdmin

		if isAdmin {
			payments, err := paymentService.GetByStudentID(c.Request.Context(), studentID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, payments)
			return
		}

		if c.Query("branchId") == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required for non-admin users"})
			return
		}
		c.JSON(http.StatusOK, []interface{}{})
	}
}

func getStudentPaymentStatus(financeService *service.FinanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		studentID := c.Param("studentId")
		branchID := c.Query("branchId")

		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		result, err := financeService.GetStudentCurrentPaymentStatus(c.Request.Context(), studentID, branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, result)
	}
}

func searchStudentsWithPaymentStatus(financeService *service.FinanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		limitInt, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
		offsetInt, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
		if limitInt < 1 {
			limitInt = 50
		}
		if limitInt > 500 {
			limitInt = 500
		}
		if offsetInt < 0 {
			offsetInt = 0
		}

		all, err := financeService.SearchStudentsWithPaymentStatus(
			c.Request.Context(),
			branchID,
			c.Query("search"),
			c.Query("classId"),
			c.Query("status"),
			c.Query("paymentStatus"),
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get students"})
			return
		}

		total := len(all)
		start, end := offsetInt, offsetInt+limitInt
		if start > total {
			start = total
		}
		if end > total {
			end = total
		}

		c.JSON(http.StatusOK, gin.H{
			"data":   all[start:end],
			"total":  total,
			"limit":  limitInt,
			"offset": offsetInt,
		})
	}
}

func getPaymentsConsolidatedData(paymentService *service.PaymentService, branchService *service.BranchService, userService *service.UserService, financeService *service.FinanceService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		month := c.Query("month")
		year := c.Query("year")

		if month == "" || year == "" {
			currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), branchID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
				return
			}
			month = currentMonth
			year = strconv.Itoa(currentYear)
		}

		result, err := paymentService.GetByBranchIDWithFilters(c.Request.Context(), service.PaymentFilterInput{
			BranchID:      branchID,
			Page:          c.DefaultQuery("page", "1"),
			Limit:         c.DefaultQuery("limit", "10"),
			Search:        c.Query("search"),
			Status:        c.Query("status"),
			PaymentMethod: c.Query("paymentMethod"),
			Month:         month,
			Year:          year,
			ClassID:       c.Query("classId"),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		yearInt, _ := strconv.Atoi(year)
		summaryData, err := paymentService.GetPaymentSummaryForPeriod(c.Request.Context(), branchID, month, yearInt)
		if err != nil {
			summaryData = map[string]interface{}{
				"totalPaid":   0,
				"totalUnpaid": 0,
				"byMethod":    map[string]float64{"click": 0, "cash": 0, "bank": 0, "terminal": 0},
			}
		}

		indicators := models.PaymentSummary{}
		if v, ok := summaryData["totalPaid"].(float64); ok {
			indicators.TotalPaid = v
		}
		if v, ok := summaryData["totalUnpaid"].(float64); ok {
			indicators.TotalUnpaid = v
		}
		if byMethod, ok := summaryData["byMethod"].(map[string]float64); ok {
			indicators.ByMethod = byMethod
		} else if byMethodMap, ok := summaryData["byMethod"].(map[string]interface{}); ok {
			indicators.ByMethod = make(map[string]float64)
			for k, v := range byMethodMap {
				if val, ok := v.(float64); ok {
					indicators.ByMethod[k] = val
				}
			}
		}

		c.JSON(http.StatusOK, models.PaymentListResponse{
			Items:      result.Items,
			Indicators: indicators,
			Total:      result.Total,
			Page:       result.Page,
			Limit:      result.Limit,
		})
	}
}
