package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

func RegisterSettingsRoutes(router *gin.RouterGroup, branchService *service.BranchService, userService *service.UserService) {
	settings := router.Group("/settings")
	settings.GET("", getSettings(branchService))
	settings.PUT("", middleware.PermissionChecker(userService, "canEditSettings"), updateSettings(branchService))
}

type SettingsResponse struct {
	Name        string  `json:"name"`
	MonthlyPayment float64 `json:"monthlyPayment"`
	Currency    string  `json:"currency"`
	UpdatedDate string  `json:"updatedDate"`
	CreatedDate string  `json:"createdDate"`
}

func getSettings(branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check for branchId query parameter first (for branch switching)
		branchIDStr := c.Query("branchId")
		
		// Fall back to user's assigned branch from context
		if branchIDStr == "" {
			branchID, exists := c.Get("branch_id")
			if !exists || branchID == "" {
				log.Printf("[SETTINGS HANDLER ERROR] User has no assigned branch")
				c.JSON(http.StatusBadRequest, gin.H{"error": "user has no assigned branch"})
				return
			}
			branchIDStr = branchID.(string)
		}

		log.Printf("[SETTINGS HANDLER] GET /settings called for branch: %s", branchIDStr)

		branch, err := branchService.GetByID(c.Request.Context(), branchIDStr)
		if err != nil {
			log.Printf("[SETTINGS HANDLER ERROR] Failed to get branch: %v", err)
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		response := SettingsResponse{
			Name:           branch.Name,
			MonthlyPayment: branch.MonthlyPayment,
			Currency:       branch.Currency,
			UpdatedDate:    branch.UpdatedAt.Format("2006-01-02 15:04:05"),
			CreatedDate:    branch.CreatedAt.Format("2006-01-02 15:04:05"),
		}

		log.Printf("[SETTINGS HANDLER SUCCESS] Returned settings for branch: %s", branchIDStr)
		c.JSON(http.StatusOK, response)
	}
}

func updateSettings(branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check for branchId query parameter first (for branch switching)
		branchIDStr := c.Query("branchId")
		
		// Fall back to user's assigned branch from context
		if branchIDStr == "" {
			branchID, exists := c.Get("branch_id")
			if !exists || branchID == "" {
				log.Printf("[SETTINGS HANDLER ERROR] User has no assigned branch")
				c.JSON(http.StatusBadRequest, gin.H{"error": "user has no assigned branch"})
				return
			}
			branchIDStr = branchID.(string)
		}

		log.Printf("[SETTINGS HANDLER] PUT /settings called for branch: %s", branchIDStr)

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			log.Printf("[SETTINGS HANDLER ERROR] Invalid JSON: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		branch, err := branchService.Update(c.Request.Context(), branchIDStr, updates)
		if err != nil {
			log.Printf("[SETTINGS HANDLER ERROR] Failed to update settings: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		response := SettingsResponse{
			Name:           branch.Name,
			MonthlyPayment: branch.MonthlyPayment,
			Currency:       branch.Currency,
			UpdatedDate:    branch.UpdatedAt.Format("2006-01-02 15:04:05"),
			CreatedDate:    branch.CreatedAt.Format("2006-01-02 15:04:05"),
		}

		log.Printf("[SETTINGS HANDLER SUCCESS] Updated settings for branch: %s", branchIDStr)
		c.JSON(http.StatusOK, response)
	}
}
