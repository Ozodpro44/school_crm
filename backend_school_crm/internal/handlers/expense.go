package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

// DEPRECATED (P5): Routed by api_gateway to finance_service. Kept as fallback until P5.5.
func RegisterExpenseRoutes(router *gin.RouterGroup, expenseService *service.ExpenseService, branchService *service.BranchService, userService *service.UserService) {
	expenses := router.Group("/expenses")
	expenses.POST("", middleware.PermissionChecker(userService, "canCreateExpenses"), createExpense(expenseService))
	expenses.GET("/consolidated/data", middleware.PermissionChecker(userService, "canViewExpenses"), getExpensesConsolidatedData(expenseService, branchService, userService))
	expenses.GET("/:id", middleware.PermissionChecker(userService, "canViewExpenses"), getExpense(expenseService))
	expenses.GET("", middleware.PermissionChecker(userService, "canViewExpenses"), listExpenses(expenseService, branchService, userService))
	expenses.PUT("/:id", middleware.PermissionChecker(userService, "canEditExpenses"), updateExpense(expenseService, userService))
	expenses.DELETE("/:id", middleware.PermissionChecker(userService, "canDeleteExpenses"), deleteExpense(expenseService, branchService, userService))
}

func createExpense(expenseService *service.ExpenseService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var req service.CreateExpenseRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		expense, err := expenseService.Create(c.Request.Context(), &req, userID)
		if err != nil {
			if errors.Is(err, service.ErrFinancialMonthLocked) {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, expense)
	}
}

func getExpense(expenseService *service.ExpenseService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		expense, err := expenseService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, expense)
	}
}

func listExpenses(expenseService *service.ExpenseService, branchService *service.BranchService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		// Get user role for access control
		userRole, _ := middleware.GetUserRole(c, userService)
		isAdmin := userRole == models.RoleAdmin || userRole == models.RoleBranchAdmin

		// Get branch's current month
		currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
			return
		}

		// Admin can see all expenses, Manager only sees current month
		if isAdmin {
			// Check if specific month/year filter is provided
			month := c.Query("month")
			year := c.Query("year")
			if month != "" && year != "" {
				yearInt, _ := strconv.Atoi(year)
				monthInt, _ := strconv.Atoi(month)
				expenses, err := expenseService.GetByBranchIDAndPeriod(c.Request.Context(), branchID, monthInt, yearInt)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, expenses)
				return
			}
			// If no filter, return all
			expenses, err := expenseService.GetByBranchID(c.Request.Context(), branchID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, expenses)
			return
		}

		// Manager: only current month
		currentMonthInt, _ := strconv.Atoi(currentMonth)
		expenses, err := expenseService.GetByBranchIDAndPeriod(c.Request.Context(), branchID, currentMonthInt, currentYear)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, expenses)
	}
}

func updateExpense(expenseService *service.ExpenseService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		userRole, _ := middleware.GetUserRole(c, userService)
		isAdmin := userRole == models.RoleAdmin

		var req service.UpdateExpenseRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		expense, err := expenseService.Update(c.Request.Context(), id, &req, isAdmin)
		if err != nil {
			if errors.Is(err, service.ErrFinancialMonthLocked) {
				c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, expense)
	}
}

func deleteExpense(expenseService *service.ExpenseService, branchService *service.BranchService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// Get existing expense
		existingExpense, err := expenseService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		// Get branch's current month
		currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), existingExpense.BranchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
			return
		}

		// Check if expense is from a past month - only Admin can delete past months
		userRole, _ := middleware.GetUserRole(c, userService)
		isAdmin := userRole == models.RoleAdmin

		expenseMonth := int(existingExpense.Date.Month())
		expenseYear := existingExpense.Date.Year()
		currentMonthInt, _ := strconv.Atoi(currentMonth)

		isPastMonth := expenseMonth != currentMonthInt || expenseYear != currentYear
		if isPastMonth && !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "cannot delete expenses from past months"})
			return
		}

		if err := expenseService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "expense deleted"})
	}
}

// getExpensesConsolidatedData returns expenses with filters, pagination, and indicators
func getExpensesConsolidatedData(expenseService *service.ExpenseService, branchService *service.BranchService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		search := c.Query("search")
		category := c.Query("category")
		paymentMethod := c.Query("paymentMethod")
		month := c.Query("month")
		year := c.Query("year")

		// Pagination parameters
		page := c.DefaultQuery("page", "1")
		limit := c.DefaultQuery("limit", "10")

		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		// Get user role for access control
		userRole, _ := middleware.GetUserRole(c, userService)
		isAdmin := userRole == models.RoleAdmin || userRole == models.RoleBranchAdmin

		// Get branch's current month if not provided
		if month == "" || year == "" {
			currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), branchID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
				return
			}
			month = currentMonth
			year = strconv.Itoa(currentYear)
		}

		// For non-admin users (managers), enforce current month only
		if !isAdmin {
			currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), branchID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
				return
			}
			month = currentMonth
			year = strconv.Itoa(currentYear)
		}

		// Get expenses with filters using service function
		result, err := expenseService.GetByBranchIDWithFilters(c.Request.Context(), service.ExpenseFilterInput{
			BranchID:      branchID,
			Page:          page,
			Limit:         limit,
			Search:        search,
			Category:      category,
			PaymentMethod: paymentMethod,
			Month:         month,
			Year:          year,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Get expense summary/indicators
		yearInt, _ := strconv.Atoi(year)
		indicators, err := expenseService.GetExpenseSummaryForPeriod(c.Request.Context(), branchID, month, yearInt)
		if err != nil {
			// Continue even if summary fails, return empty indicators
			indicators = models.ExpenseSummary{
				TotalAmount: 0,
				ByCategory:  make(map[string]float64),
				ByMethod:    make(map[string]float64),
			}
		}

		// Build consolidated response
		response := models.ExpenseListResponse{
			Items:      result.Items,
			Indicators: indicators,
			Total:      result.Total,
			Page:       result.Page,
			Limit:      result.Limit,
		}

		c.JSON(http.StatusOK, response)
	}
}
