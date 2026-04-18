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

// DEPRECATED (P5): Routed by api_gateway to teacher_service. Kept as fallback until P5.5.
func RegisterSalaryRoutes(router *gin.RouterGroup, salaryService *service.SalaryService, branchService *service.BranchService, userService *service.UserService) {
	salaries := router.Group("/salaries")
	salaries.POST("", middleware.PermissionChecker(userService, "canCreateSalaries"), createSalary(salaryService))
	salaries.GET("/:id", middleware.PermissionChecker(userService, "canViewSalaries"), getSalary(salaryService))
	salaries.GET("", middleware.PermissionChecker(userService, "canViewSalaries"), listSalaries(salaryService, branchService, userService))
	salaries.PUT("/:id", middleware.PermissionChecker(userService, "canEditSalaries"), updateSalary(salaryService, userService))
	salaries.DELETE("/:id", middleware.PermissionChecker(userService, "canEditSalaries"), deleteSalary(salaryService, branchService, userService))
}

func createSalary(salaryService *service.SalaryService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := middleware.GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		var req service.CreateSalaryRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		salary, err := salaryService.Create(c.Request.Context(), &req, userID)
		if err != nil {
			if errors.Is(err, service.ErrFinancialMonthLocked) {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, salary)
	}
}

func getSalary(salaryService *service.SalaryService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		salary, err := salaryService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, salary)
	}
}

func listSalaries(salaryService *service.SalaryService, branchService *service.BranchService, userService *service.UserService) gin.HandlerFunc {
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

		// Admin can see all salaries, Manager only sees current month
		if isAdmin {
			// Check if specific month/year filter is provided
			month := c.Query("month")
			year := c.Query("year")
			if month != "" && year != "" {
				yearInt, _ := strconv.Atoi(year)
				salaries, err := salaryService.GetByBranchIDAndPeriod(c.Request.Context(), branchID, month, yearInt)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, salaries)
				return
			}
			// If no filter, return all
			salaries, err := salaryService.GetByBranchID(c.Request.Context(), branchID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, salaries)
			return
		}

		// Manager: only current month
		salaries, err := salaryService.GetByBranchIDAndPeriod(c.Request.Context(), branchID, currentMonth, currentYear)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, salaries)
	}
}

func updateSalary(salaryService *service.SalaryService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		userRole, _ := middleware.GetUserRole(c, userService)
		isAdmin := userRole == models.RoleAdmin

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		salary, err := salaryService.Update(c.Request.Context(), id, updates, isAdmin)
		if err != nil {
			if errors.Is(err, service.ErrFinancialMonthLocked) {
				c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, salary)
	}
}

func deleteSalary(salaryService *service.SalaryService, branchService *service.BranchService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// Get existing salary
		existingSalary, err := salaryService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		// Get branch's current month
		currentMonth, currentYear, err := branchService.GetCurrentMonth(c.Request.Context(), existingSalary.BranchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get branch current month"})
			return
		}

		// Check if salary is from a past month - only Admin can delete past months
		userRole, _ := middleware.GetUserRole(c, userService)
		isAdmin := userRole == models.RoleAdmin

		isPastMonth := existingSalary.Month != currentMonth || existingSalary.Year != currentYear
		if isPastMonth && !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "cannot delete salaries from past months"})
			return
		}

		if err := salaryService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "salary deleted"})
	}
}
