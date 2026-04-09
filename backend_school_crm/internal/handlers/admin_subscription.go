// Package handlers — developer-admin subscription management endpoints.
// These are mounted under /api/dev/... and require a developer JWT.
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

// RegisterAdminSubscriptionRoutes mounts all /dev/subscriptions endpoints.
// Caller must have already applied DevAuthMiddleware to the router group.
func RegisterAdminSubscriptionRoutes(router *gin.RouterGroup, subSvc *service.SubscriptionService) {
	grp := router.Group("/dev/subscriptions")
	grp.GET("", adminListSubscriptions(subSvc))
	grp.POST("", adminCreateSubscription(subSvc))
	grp.GET("/:id", adminGetSubscription(subSvc))
	grp.PUT("/:id", adminUpdateSubscription(subSvc))
	grp.DELETE("/:id", adminDeleteSubscription(subSvc))
}

// RegisterAdminPlatformStatsRoute mounts GET /dev/stats.
func RegisterAdminPlatformStatsRoute(router *gin.RouterGroup, subSvc *service.SubscriptionService) {
	router.GET("/dev/stats", adminGetPlatformStats(subSvc))
}

// RegisterAdminPlansRoutes mounts /dev/plans (all plans, including inactive).
func RegisterAdminPlansRoutes(router *gin.RouterGroup, subSvc *service.SubscriptionService) {
	router.GET("/dev/plans", adminListAllPlans(subSvc))
}

// ─── List all subscriptions ───────────────────────────────────────────────────

func adminListSubscriptions(svc *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		subs, err := svc.AdminListSubscriptions(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if subs == nil {
			subs = []models.AdminSubscriptionView{}
		}
		c.JSON(http.StatusOK, subs)
	}
}

// ─── Get single subscription ──────────────────────────────────────────────────

func adminGetSubscription(svc *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		sub, err := svc.AdminGetSubscription(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if sub == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
			return
		}
		c.JSON(http.StatusOK, sub)
	}
}

// ─── Create subscription for a user ──────────────────────────────────────────

func adminCreateSubscription(svc *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.AdminCreateSubscriptionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Resolve billing period from plan if not supplied
		if req.BillingPeriod == "" {
			plan, err := svc.GetSubscriptionPlanByID(c.Request.Context(), req.PlanID)
			if err == nil && plan != nil {
				req.BillingPeriod = plan.BillingPeriod
			}
		}

		sub, err := svc.AdminCreateSubscription(c.Request.Context(), &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, sub)
	}
}

// ─── Update subscription ──────────────────────────────────────────────────────

func adminUpdateSubscription(svc *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req models.AdminUpdateSubscriptionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		sub, err := svc.AdminUpdateSubscription(c.Request.Context(), id, &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if sub == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
			return
		}
		c.JSON(http.StatusOK, sub)
	}
}

// ─── Delete subscription ──────────────────────────────────────────────────────

func adminDeleteSubscription(svc *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if err := svc.AdminDeleteSubscription(c.Request.Context(), id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "subscription deleted"})
	}
}

// ─── Platform stats ───────────────────────────────────────────────────────────

func adminGetPlatformStats(svc *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		stats, err := svc.GetPlatformStats(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, stats)
	}
}

// ─── All plans (including inactive) ──────────────────────────────────────────

func adminListAllPlans(svc *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		plans, err := svc.GetAllSubscriptionPlans(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if plans == nil {
			plans = []models.SubscriptionPlan{}
		}
		c.JSON(http.StatusOK, plans)
	}
}
