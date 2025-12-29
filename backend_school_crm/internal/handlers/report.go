package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

func RegisterReportRoutes(router *gin.RouterGroup, reportService *service.ReportService, userService *service.UserService) {
	reports := router.Group("/reports")
	reports.Use(middleware.PermissionChecker(userService, "canViewReports"))
	{
		reports.GET("/payments", getPaymentReport(reportService))
		reports.GET("/salaries", getSalaryReport(reportService))
		reports.GET("/debtors", getDebtorsReport(reportService))
		reports.GET("/expenses", getExpensesReport(reportService))
		reports.GET("/financial-summary", getFinancialSummary(reportService))
	}
}

func getPaymentReport(reportService *service.ReportService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		startDateStr := c.Query("startDate")
		endDateStr := c.Query("endDate")
		status := c.Query("status")
		classID := c.Query("classId")

		if branchID == "" || startDateStr == "" || endDateStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId, startDate, and endDate are required"})
			return
		}

		startDate, err := time.Parse("2006-01-02", startDateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid startDate format (use YYYY-MM-DD)"})
			return
		}

		endDate, err := time.Parse("2006-01-02", endDateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid endDate format (use YYYY-MM-DD)"})
			return
		}

		items, err := reportService.GetPaymentReport(c.Request.Context(), branchID, startDate, endDate, status, classID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, items)
	}
}

func getSalaryReport(reportService *service.ReportService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		startDateStr := c.Query("startDate")
		endDateStr := c.Query("endDate")
		status := c.Query("status")

		if branchID == "" || startDateStr == "" || endDateStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId, startDate, and endDate are required"})
			return
		}

		startDate, err := time.Parse("2006-01-02", startDateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid startDate format (use YYYY-MM-DD)"})
			return
		}

		endDate, err := time.Parse("2006-01-02", endDateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid endDate format (use YYYY-MM-DD)"})
			return
		}

		items, err := reportService.GetSalaryReport(c.Request.Context(), branchID, startDate, endDate, status)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, items)
	}
}

func getDebtorsReport(reportService *service.ReportService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		month := c.Query("month")
		yearStr := c.Query("year")
		classID := c.Query("classId")

		if branchID == "" || month == "" || yearStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId, month, and year are required"})
			return
		}

		var year int
		if _, err := time.Parse("2006", yearStr); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year format"})
			return
		}
		year = int(time.Now().Year())
		if len(yearStr) == 4 {
			_, _ = time.Parse("2006", yearStr)
		}

		items, err := reportService.GetDebtorsReport(c.Request.Context(), branchID, month, year, classID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, items)
	}
}

func getExpensesReport(reportService *service.ReportService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		startDateStr := c.Query("startDate")
		endDateStr := c.Query("endDate")
		category := c.Query("category")

		if branchID == "" || startDateStr == "" || endDateStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId, startDate, and endDate are required"})
			return
		}

		startDate, err := time.Parse("2006-01-02", startDateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid startDate format (use YYYY-MM-DD)"})
			return
		}

		endDate, err := time.Parse("2006-01-02", endDateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid endDate format (use YYYY-MM-DD)"})
			return
		}

		items, err := reportService.GetExpensesReport(c.Request.Context(), branchID, startDate, endDate, category)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, items)
	}
}

func getFinancialSummary(reportService *service.ReportService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		startDateStr := c.Query("startDate")
		endDateStr := c.Query("endDate")

		if branchID == "" || startDateStr == "" || endDateStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId, startDate, and endDate are required"})
			return
		}

		startDate, err := time.Parse("2006-01-02", startDateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid startDate format (use YYYY-MM-DD)"})
			return
		}

		endDate, err := time.Parse("2006-01-02", endDateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid endDate format (use YYYY-MM-DD)"})
			return
		}

		summary, err := reportService.GetFinancialSummary(c.Request.Context(), branchID, startDate, endDate)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, summary)
	}
}
