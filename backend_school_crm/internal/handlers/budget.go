package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

// RegisterBudgetRoutes mounts expense-budget endpoints.
// All routes require canViewExpenses (GET) or canCreateExpenses (PUT/DELETE).
func RegisterBudgetRoutes(router *gin.RouterGroup, budgetService *service.BudgetService, userService *service.UserService) {
	g := router.Group("/expense-budgets")
	{
		g.GET("", middleware.PermissionChecker(userService, "canViewExpenses"), listBudgets(budgetService))
		g.PUT("", middleware.PermissionChecker(userService, "canCreateExpenses"), upsertBudget(budgetService))
		g.DELETE("", middleware.PermissionChecker(userService, "canDeleteExpenses"), deleteBudget(budgetService))
	}
}

func listBudgets(budgetService *service.BudgetService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		now := time.Now()
		month := c.DefaultQuery("month", now.Format("01"))
		yearStr := c.DefaultQuery("year", strconv.Itoa(now.Year()))
		year, err := strconv.Atoi(yearStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year"})
			return
		}

		items, err := budgetService.GetByBranch(c.Request.Context(), branchID, month, year)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, items)
	}
}

func upsertBudget(budgetService *service.BudgetService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req service.UpsertBudgetRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		entry, err := budgetService.Upsert(c.Request.Context(), &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, entry)
	}
}

func deleteBudget(budgetService *service.BudgetService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		category := c.Query("category")
		month := c.Query("month")
		yearStr := c.Query("year")

		if branchID == "" || category == "" || month == "" || yearStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId, category, month, year required"})
			return
		}
		year, err := strconv.Atoi(yearStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year"})
			return
		}

		if err := budgetService.Delete(c.Request.Context(), branchID, category, month, year); err != nil {
			if err.Error() == "budget not found" {
				c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "budget deleted"})
	}
}

// GetUserID is already in middleware, but we reference it here to satisfy the compiler.
var _ = middleware.GetUserID
