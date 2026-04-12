package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

func RegisterBranchRoutes(router *gin.RouterGroup, branchService *service.BranchService, userService *service.UserService, subService *service.SubscriptionService) {
	branches := router.Group("/branches")
	branches.POST("", createBranch(branchService, subService))
	branches.GET("/:id", getBranch(branchService))
	branches.GET("", listBranches(branchService, userService))
	branches.PUT("/:id", updateBranch(branchService))
	branches.DELETE("/:id", deleteBranch(branchService))
	// Switch month - Admin only
	branches.POST("/:id/switch-month", middleware.RoleChecker(userService, models.RoleAdmin), switchMonth(branchService))
}

func createBranch(branchService *service.BranchService, subService *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req service.CreateBranchRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Enforce subscription branch limit (skipped when subService is nil, e.g. dev path).
		if subService != nil {
			if userIDRaw, exists := c.Get("user_id"); exists {
				if ownerID, ok := userIDRaw.(string); ok && ownerID != "" {
					if limitErr := subService.CheckResourceLimit(c.Request.Context(), ownerID, "branches"); limitErr != nil {
						if errors.Is(limitErr, service.ErrSubscriptionLimitReached) {
							c.JSON(http.StatusPaymentRequired, gin.H{
								"error":  "subscription_limit_reached",
								"detail": limitErr.Error(),
							})
							return
						}
					}
				}
			}
		}

		branch, err := branchService.Create(c.Request.Context(), &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, branch)
	}
}

func getBranch(branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		branch, err := branchService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, branch)
	}
}

func listBranches(branchService *service.BranchService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDRaw, exists := c.Get("user_id")
		if !exists {
			// Developer/admin context — return all branches unfiltered
			branches, err := branchService.GetAll(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if branches == nil {
				branches = []models.Branch{}
			}
			c.JSON(http.StatusOK, branches)
			return
		}

		uid := userIDRaw.(string)
		user, err := userService.GetByID(c.Request.Context(), uid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to resolve user"})
			return
		}

		var branches []models.Branch
		if user.Role == models.RoleAdmin {
			branches, err = branchService.GetByAdminID(c.Request.Context(), uid)
		} else {
			branches, err = userService.GetUserBranches(c.Request.Context(), uid)
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if branches == nil {
			branches = []models.Branch{}
		}
		c.JSON(http.StatusOK, branches)
	}
}

func updateBranch(branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// Enforce ownership only for school users (not developer routes)
		if userIDRaw, exists := c.Get("user_id"); exists {
			uid := userIDRaw.(string)
			branch, err := branchService.GetByID(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
				return
			}
			if branch.AdminID == nil || *branch.AdminID != uid {
				c.JSON(http.StatusForbidden, gin.H{"error": "you do not have permission to update this branch"})
				return
			}
		}

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		branch, err := branchService.Update(c.Request.Context(), id, updates)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, branch)
	}
}

func deleteBranch(branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// Enforce ownership only for school users (not developer routes)
		if userIDRaw, exists := c.Get("user_id"); exists {
			uid := userIDRaw.(string)
			branch, err := branchService.GetByID(c.Request.Context(), id)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "branch not found"})
				return
			}
			if branch.AdminID == nil || *branch.AdminID != uid {
				c.JSON(http.StatusForbidden, gin.H{"error": "you do not have permission to delete this branch"})
				return
			}
		}

		if err := branchService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "branch deleted"})
	}
}

func switchMonth(branchService *service.BranchService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		branch, err := branchService.SwitchMonth(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, branch)
	}
}


