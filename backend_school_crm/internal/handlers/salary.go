package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

func RegisterSalaryRoutes(router *gin.RouterGroup, salaryService *service.SalaryService) {
	salaries := router.Group("/salaries")
	salaries.POST("", createSalary(salaryService))
	salaries.GET("/:id", getSalary(salaryService))
	salaries.GET("", listSalaries(salaryService))
	salaries.PUT("/:id", updateSalary(salaryService))
	salaries.DELETE("/:id", deleteSalary(salaryService))
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

func listSalaries(salaryService *service.SalaryService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		salaries, err := salaryService.GetByBranchID(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, salaries)
	}
}

func updateSalary(salaryService *service.SalaryService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		salary, err := salaryService.Update(c.Request.Context(), id, updates)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, salary)
	}
}

func deleteSalary(salaryService *service.SalaryService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := salaryService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "salary deleted"})
	}
}
