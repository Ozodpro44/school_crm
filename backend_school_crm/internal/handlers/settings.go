package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

func RegisterSettingsRoutes(router *gin.RouterGroup, branchService *service.BranchService) {
	settings := router.Group("/settings")
	settings.GET("", getSettings(branchService))
	settings.PUT("", updateSettings(branchService))
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
		// Get branch ID from authenticated user
		branchID, exists := c.Get("branch_id")
		if !exists || branchID == "" {
			log.Printf("[SETTINGS HANDLER ERROR] User has no assigned branch")
			c.JSON(http.StatusBadRequest, gin.H{"error": "user has no assigned branch"})
			return
		}

		log.Printf("[SETTINGS HANDLER] GET /settings called for branch: %s", branchID)

		branch, err := branchService.GetByID(c.Request.Context(), branchID.(string))
		if err != nil {
			log.Printf("[SETTINGS HANDLER ERROR] Failed to get branch: %v", err)
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		response := SettingsResponse{
			Name:           branch.Name,
			MonthlyPayment: branch.MonthlyPayment,
			Currency:       branch.Currency,
			UpdatedDate:    branch.UpdatedDate.Format("2006-01-02T15:04:05Z07:00"),
			CreatedDate:    branch.CreatedDate.Format("2006-01-02T15:04:05Z07:00"),
		}

		log.Printf("[SETTINGS HANDLER SUCCESS] Returned settings for branch: %s", branchID)
		c.JSON(http.StatusOK, response)
	}
}

func updateSettings(branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get branch ID from authenticated user
		branchID, exists := c.Get("branch_id")
		if !exists || branchID == "" {
			log.Printf("[SETTINGS HANDLER ERROR] User has no assigned branch")
			c.JSON(http.StatusBadRequest, gin.H{"error": "user has no assigned branch"})
			return
		}

		log.Printf("[SETTINGS HANDLER] PUT /settings called for branch: %s", branchID)

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			log.Printf("[SETTINGS HANDLER ERROR] Invalid JSON: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		branch, err := branchService.Update(c.Request.Context(), branchID.(string), updates)
		if err != nil {
			log.Printf("[SETTINGS HANDLER ERROR] Failed to update settings: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		response := SettingsResponse{
			Name:           branch.Name,
			MonthlyPayment: branch.MonthlyPayment,
			Currency:       branch.Currency,
			UpdatedDate:    branch.UpdatedDate.Format("2006-01-02T15:04:05Z07:00"),
			CreatedDate:    branch.CreatedDate.Format("2006-01-02T15:04:05Z07:00"),
		}

		log.Printf("[SETTINGS HANDLER SUCCESS] Updated settings for branch: %s", branchID)
		c.JSON(http.StatusOK, response)
	}
}
