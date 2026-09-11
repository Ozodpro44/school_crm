package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

func RegisterReportRoutes(router *gin.RouterGroup, reportService *service.ReportService, userService *service.UserService, branchService *service.BranchService) {
	reports := router.Group("/reports")
	{
		// Dashboard accessible to all users
		reports.GET("/dashboard", getDashboardData(reportService))

		// Protected report endpoints
		protected := reports.Group("")
		protected.Use(middleware.PermissionChecker(userService, "canViewReports"))
		protected.Use(middleware.RequireBranchIDQueryAccess(userService))
		{
			protected.GET("/payments", getPaymentReport(reportService))
			protected.GET("/salaries", getSalaryReport(reportService))
			protected.GET("/debtors", getDebtorsReport(reportService))
			protected.GET("/expenses", getExpensesReport(reportService))
			protected.GET("/financial-summary", getFinancialSummary(reportService))
			protected.GET("/forecast", getForecastReport(reportService))
			protected.GET("/branches-overview", getBranchesOverview(reportService, userService, branchService))
		}
	}
}

func getPaymentReport(reportService *service.ReportService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		month := c.Query("month")
		yearStr := c.Query("year")
		classID := c.Query("classId")
		pageStr := c.DefaultQuery("page", "1")
		limitStr := c.DefaultQuery("limit", "10")

		if branchID == "" || month == "" || yearStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId, month, and year are required"})
			return
		}

		// Parse pagination params
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

		var year int
		parsedTime, err := time.Parse("2006", yearStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year format"})
			return
		}
		year = parsedTime.Year()

		// Parse month as integer
		monthInt := 0
		_, err = time.Parse("01", month)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid month format (use MM)"})
			return
		}
		// Parse month manually
		monthStr := month
		for i := 1; i <= 12; i++ {
			if fmt.Sprintf("%02d", i) == monthStr {
				monthInt = i
				break
			}
		}
		if monthInt == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid month (use 01-12)"})
			return
		}

		// Create dummy dates (not used anymore but required by function signature)
		startDate := time.Date(year, time.Month(monthInt), 1, 0, 0, 0, 0, time.UTC)
		endDate := startDate

		items, total, err := reportService.GetPaymentReport(c.Request.Context(), branchID, startDate, endDate, "", classID, page, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"data":        items,
			"total":       total,
			"page":        page,
			"limit":       limit,
			"totalPages": (total + int64(limit) - 1) / int64(limit),
		})
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
		parsedTime, err := time.Parse("2006", yearStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year format"})
			return
		}
		year = parsedTime.Year()

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

func getBranchesOverview(reportService *service.ReportService, userService *service.UserService, branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		monthStr := c.DefaultQuery("month", fmt.Sprintf("%d", time.Now().Month()))
		yearStr := c.DefaultQuery("year", fmt.Sprintf("%d", time.Now().Year()))

		var month, year int
		if _, err := fmt.Sscanf(monthStr, "%d", &month); err != nil || month < 1 || month > 12 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid month (1-12)"})
			return
		}
		if _, err := fmt.Sscanf(yearStr, "%d", &year); err != nil || year < 1900 || year > 2100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year"})
			return
		}

		// Collect branch IDs accessible to the current user
		var branchIDs []string
		userIDRaw, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		uid := userIDRaw.(string)
		user, err := userService.GetByID(c.Request.Context(), uid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
			return
		}

		var branches []interface{ GetID() string }
		if user.Role == "admin" {
			bs, err := branchService.GetByAdminID(c.Request.Context(), uid)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			for _, b := range bs {
				branchIDs = append(branchIDs, b.ID)
			}
		} else {
			bs, err := userService.GetUserBranches(c.Request.Context(), uid)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			for _, b := range bs {
				branchIDs = append(branchIDs, b.ID)
			}
		}
		_ = branches

		data, err := reportService.GetBranchesOverview(c.Request.Context(), branchIDs, month, year)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, data)
	}
}

func getForecastReport(reportService *service.ReportService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		monthStr := c.DefaultQuery("month", fmt.Sprintf("%d", time.Now().Month()))
		yearStr := c.DefaultQuery("year", fmt.Sprintf("%d", time.Now().Year()))

		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId is required"})
			return
		}

		var month, year int
		if _, err := fmt.Sscanf(monthStr, "%d", &month); err != nil || month < 1 || month > 12 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid month (1-12)"})
			return
		}
		if _, err := fmt.Sscanf(yearStr, "%d", &year); err != nil || year < 1900 || year > 2100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year"})
			return
		}

		data, err := reportService.GetForecastData(c.Request.Context(), branchID, month, year)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, data)
	}
}

func getDashboardData(reportService *service.ReportService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		monthStr := c.Query("month")
		yearStr := c.Query("year")

		if branchID == "" || monthStr == "" || yearStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId, month, and year are required"})
			return
		}

		var month, year int
		_, err := fmt.Sscanf(monthStr, "%d", &month)
		if err != nil || month < 1 || month > 12 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid month format (use 1-12)"})
			return
		}

		_, err = fmt.Sscanf(yearStr, "%d", &year)
		if err != nil || year < 1900 || year > 2100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year format"})
			return
		}

		data, err := reportService.GetDashboardData(c.Request.Context(), branchID, month, year)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, data)
	}
}
