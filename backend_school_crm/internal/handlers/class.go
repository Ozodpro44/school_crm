package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/service"
)

func RegisterClassRoutes(router *gin.RouterGroup, classService *service.ClassService, userService *service.UserService, subService *service.SubscriptionService) {
	classes := router.Group("/classes")
	// Authenticated users can view and edit
	classes.POST("", middleware.PermissionChecker(userService, "canCreateClasses"), createClass(classService, subService))
	classes.GET("/:id", middleware.PermissionChecker(userService, "canViewClasses"), getClass(classService))
	classes.GET("", middleware.PermissionChecker(userService, "canViewClasses"), listClasses(classService))
	classes.PUT("/:id", middleware.PermissionChecker(userService, "canEditClasses"), updateClass(classService))
	classes.DELETE("/:id", middleware.PermissionChecker(userService, "canDeleteClasses"), deleteClass(classService))
}

func createClass(classService *service.ClassService, subService *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req service.CreateClassRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Enforce subscription class limit before inserting.
		if req.BranchID != "" {
			ownerID, err := subService.GetOwnerIDFromBranch(c.Request.Context(), req.BranchID)
			if err == nil && ownerID != "" {
				if limitErr := subService.CheckResourceLimit(c.Request.Context(), ownerID, "classes"); limitErr != nil {
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

		class, err := classService.Create(c.Request.Context(), &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, class)
	}
}

func getClass(classService *service.ClassService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		class, err := classService.GetByID(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, class)
	}
}

func listClasses(classService *service.ClassService) gin.HandlerFunc {
	return func(c *gin.Context) {
		branchID := c.Query("branchId")
		if branchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "branchId required"})
			return
		}

		classes, err := classService.GetByBranchID(c.Request.Context(), branchID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, classes)
	}
}

func updateClass(classService *service.ClassService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var updates map[string]interface{}
		if err := c.ShouldBindJSON(&updates); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		class, err := classService.Update(c.Request.Context(), id, updates)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, class)
	}
}

func deleteClass(classService *service.ClassService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := classService.Delete(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "class deleted"})
	}
}
