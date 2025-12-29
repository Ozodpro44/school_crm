package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

func RegisterExpenseRoutes(router *gin.RouterGroup, expenseService *service.ExpenseService, userService *service.UserService) {
	expenses := router.Group("/expenses")
	// Authenticated users can view and edit expenses
	expenses.POST("", middleware.PermissionChecker(userService, "canCreateExpenses"), createExpense(expenseService))
	expenses.GET("/:id", middleware.PermissionChecker(userService, "canViewExpenses"), getExpense(expenseService))
	expenses.GET("", middleware.PermissionChecker(userService, "canViewExpenses"), listExpenses(expenseService))
	expenses.PUT("/:id", middleware.PermissionChecker(userService, "canEditExpenses"), updateExpense(expenseService))
	expenses.DELETE("/:id", middleware.PermissionChecker(userService, "canDeleteExpenses"), deleteExpense(expenseService))
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

func listExpenses(expenseService *service.ExpenseService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		expenses, err := expenseService.GetByBranchID(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, expenses)
	}
}

func updateExpense(expenseService *service.ExpenseService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var req service.UpdateExpenseRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		expense, err := expenseService.Update(c.Request.Context(), id, &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, expense)
	}
}

func deleteExpense(expenseService *service.ExpenseService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := expenseService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "expense deleted"})
	}
}
