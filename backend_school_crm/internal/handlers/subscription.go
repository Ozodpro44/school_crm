package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

// GetSubscriptionPlans retrieves all available subscription plans
// @Summary Get subscription plans
// @Description Retrieve all active subscription plans
// @Tags subscriptions
// @Produce json
// @Success 200 {array} models.SubscriptionPlan
// @Failure 500 {object} map[string]interface{}
// @Router /subscriptions/plans [get]
func GetSubscriptionPlans(subscriptionService *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		plans, err := subscriptionService.GetSubscriptionPlans(c.Request.Context())
		if err != nil {
			// Check if it's a table not found error
			if err.Error() == "pq: relation \"subscription_plans\" does not exist" {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "Subscription plans table not initialized. Please run migrations or seed the database.",
					"details": "POST /api/dev/seed-subscription-plans",
				})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if plans == nil {
			plans = []models.SubscriptionPlan{}
		}

		c.JSON(http.StatusOK, plans)
	}
}

// GetUserSubscription retrieves the current user's subscription with plan details.
func GetUserSubscription(subscriptionService *service.SubscriptionService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user_id not found in context"})
			return
		}

		sub, err := subscriptionService.GetUserSubscriptionWithPlan(c.Request.Context(), userID.(string))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if sub == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "no active subscription found"})
			return
		}
		c.JSON(http.StatusOK, sub)
	}
}

// GetSubscriptionPlanByID returns a single plan by ID (public endpoint).
func GetSubscriptionPlanByID(subscriptionService *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		planID := c.Param("id")
		plan, err := subscriptionService.GetSubscriptionPlanByID(c.Request.Context(), planID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if plan == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "plan not found"})
			return
		}
		c.JSON(http.StatusOK, plan)
	}
}

// UpdateSubscriptionStatus allows the owner to pause/activate their own subscription.
func UpdateSubscriptionStatus(subscriptionService *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, _ := c.Get("user_id")
		subscriptionID := c.Param("id")

		var req struct {
			Status string `json:"status" binding:"required,oneof=active paused"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Verify ownership
		sub, err := subscriptionService.GetUserSubscriptionWithPlan(c.Request.Context(), userID.(string))
		if err != nil || sub == nil || sub.ID != subscriptionID {
			c.JSON(http.StatusForbidden, gin.H{"error": "subscription not found or access denied"})
			return
		}

		// This endpoint exists for self-service pause/resume only — it must
		// not let a subscription that hasn't actually been paid for
		// (pending_payment / past_due / expired / cancelled) be flipped
		// straight to "active" with no payment involved. Only a genuine
		// active<->paused toggle is a valid self-service transition; every
		// other path to "active" goes through a real payment callback.
		validTransition := (req.Status == "active" && sub.Status == "paused") ||
			(req.Status == "paused" && sub.Status == "active")
		if !validTransition {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "cannot change status from " + sub.Status + " to " + req.Status + " — pay for the subscription to activate it",
			})
			return
		}

		if err := subscriptionService.UpdateSubscriptionStatus(c.Request.Context(), subscriptionID, req.Status); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "subscription status updated"})
	}
}

// CreateSubscription creates a new subscription for the user
// @Summary Create subscription
// @Description Create a new subscription for the current user
// @Tags subscriptions
// @Accept json
// @Produce json
// @Param request body models.CreateSubscriptionRequest true "Create subscription request"
// @Success 201 {object} models.Subscription
// @Failure 400 {object} map[string]interface{}
// @Failure 403 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /subscriptions [post]
func CreateSubscription(subscriptionService *service.SubscriptionService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user_id not found in context"})
			return
		}

		var req models.CreateSubscriptionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Get the plan to check if it's free or paid
		plans, err := subscriptionService.GetSubscriptionPlans(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify plan"})
			return
		}

		var plan *models.SubscriptionPlan
		for i := range plans {
			if plans[i].ID == req.PlanID {
				plan = &plans[i]
				break
			}
		}

		if plan == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "plan not found"})
			return
		}

		now := time.Now()
		status := "active"
		paymentMethod := req.PaymentMethod
		// For paid plans, require payment first
		if plan.Price > 0 {
			status = "pending_payment"
		} else {
			// A $0 plan activates immediately with no payment step — that's
			// fine for a one-time trial, but without this check a user
			// could call this endpoint repeatedly for unlimited free
			// months. payment_method is forced to "free_trial" here
			// (not trusted from the request) so HasUsedTrial's check can't
			// be evaded by sending some other payment_method string for a
			// free plan.
			usedTrial, err := subscriptionService.HasUsedTrial(c.Request.Context(), userID.(string))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify trial eligibility"})
				return
			}
			if usedTrial {
				c.JSON(http.StatusForbidden, gin.H{"error": "free trial already used — choose a paid plan"})
				return
			}
			paymentMethod = "free_trial"
		}

		subscription := &models.Subscription{
			UserID:        userID.(string),
			PlanID:        req.PlanID,
			BranchID:      req.BranchID,
			Status:        status,
			StartDate:     now,
			PaymentMethod: &paymentMethod,
			Notes:         req.Notes,
		}

		if err := subscriptionService.CreateSubscription(c.Request.Context(), subscription); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		response := gin.H{
			"subscription": subscription,
		}

		// For paid plans, include payment instruction
		if plan.Price > 0 {
			response["payment_required"] = true
			response["message"] = "Payment required. Use /api/subscriptions/{id}/pay-click to initiate Click.uz payment"
		}

		c.JSON(http.StatusCreated, response)
	}
}

// CancelSubscription cancels the user's subscription
// @Summary Cancel subscription
// @Description Cancel the current user's subscription
// @Tags subscriptions
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 403 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /subscriptions/{id}/cancel [post]
func CancelSubscription(subscriptionService *service.SubscriptionService, userService *service.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user_id not found in context"})
			return
		}

		// Check permissions
		permissions, err := userService.GetUserPermissions(c.Request.Context(), userID.(string))
		if err != nil || !permissions.CanManageSubscriptions {
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			return
		}

		subscriptionID := c.Param("id")
		if subscriptionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "subscription_id is required"})
			return
		}

		if err := subscriptionService.CancelSubscription(c.Request.Context(), subscriptionID, userID.(string)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "subscription cancelled successfully"})
	}
}

// GetSubscriptionUsage retrieves usage metrics for a subscription
// @Summary Get subscription usage
// @Description Retrieve usage metrics for a subscription
// @Tags subscriptions
// @Produce json
// @Param id path string true "Subscription ID"
// @Success 200 {array} models.SubscriptionUsage
// @Failure 500 {object} map[string]interface{}
// @Router /subscriptions/{id}/usage [get]
func GetSubscriptionUsage(subscriptionService *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		subscriptionID := c.Param("id")
		if subscriptionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "subscription_id is required"})
			return
		}

		usage, err := subscriptionService.GetSubscriptionUsage(c.Request.Context(), subscriptionID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if usage == nil {
			usage = []models.SubscriptionUsage{}
		}

		c.JSON(http.StatusOK, usage)
	}
}

// GetSubscriptionPayments retrieves payment history for a subscription
// @Summary Get subscription payments
// @Description Retrieve payment history for a subscription
// @Tags subscriptions
// @Produce json
// @Param id path string true "Subscription ID"
// @Success 200 {array} models.SubscriptionPayment
// @Failure 500 {object} map[string]interface{}
// @Router /subscriptions/{id}/payments [get]
func GetSubscriptionPayments(subscriptionService *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		subscriptionID := c.Param("id")
		if subscriptionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "subscription_id is required"})
			return
		}

		payments, err := subscriptionService.GetSubscriptionPayments(c.Request.Context(), subscriptionID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if payments == nil {
			payments = []models.SubscriptionPayment{}
		}

		c.JSON(http.StatusOK, payments)
	}
}

// CreateSubscriptionPlan creates a new subscription plan (dev endpoint)
// @Summary Create subscription plan
// @Description Create a new subscription plan (dev/admin only)
// @Tags subscriptions
// @Accept json
// @Produce json
// @Param request body models.SubscriptionPlan true "Create subscription plan request"
// @Success 201 {object} models.SubscriptionPlan
// @Failure 400 {object} map[string]interface{}
// @Failure 403 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /dev/subscription-plans [post]
func CreateSubscriptionPlanHandler(subscriptionService *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var plan models.SubscriptionPlan
		if err := c.ShouldBindJSON(&plan); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Create plan in database
		if err := subscriptionService.CreateSubscriptionPlan(c.Request.Context(), &plan); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, plan)
	}
}

// UpdateSubscriptionPlanHandler updates a subscription plan (dev endpoint)
// @Summary Update subscription plan
// @Description Update an existing subscription plan (dev/admin only)
// @Tags subscriptions
// @Accept json
// @Produce json
// @Param id path string true "Plan ID"
// @Param request body models.SubscriptionPlan true "Update subscription plan request"
// @Success 200 {object} models.SubscriptionPlan
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /dev/subscription-plans/{id} [put]
func UpdateSubscriptionPlanHandler(subscriptionService *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		planID := c.Param("id")
		if planID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "plan_id is required"})
			return
		}

		var plan models.SubscriptionPlan
		if err := c.ShouldBindJSON(&plan); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		plan.ID = planID
		if err := subscriptionService.UpdateSubscriptionPlan(c.Request.Context(), &plan); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, plan)
	}
}

// DeleteSubscriptionPlanHandler deletes a subscription plan (dev endpoint)
// @Summary Delete subscription plan
// @Description Delete a subscription plan (dev/admin only)
// @Tags subscriptions
// @Produce json
// @Param id path string true "Plan ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /dev/subscription-plans/{id} [delete]
func DeleteSubscriptionPlanHandler(subscriptionService *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		planID := c.Param("id")
		if planID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "plan_id is required"})
			return
		}

		if err := subscriptionService.DeleteSubscriptionPlan(c.Request.Context(), planID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "subscription plan deleted successfully"})
	}
}

// RegisterSubscriptionPlanDevRoutes registers developer-only plan management routes (CRUD).
// Caller must have DevAuthMiddleware applied.
func RegisterSubscriptionPlanDevRoutes(router *gin.RouterGroup, subscriptionService *service.SubscriptionService) {
	router.POST("/dev/subscription-plans", CreateSubscriptionPlanHandler(subscriptionService))
	router.PUT("/dev/subscription-plans/:id", UpdateSubscriptionPlanHandler(subscriptionService))
	router.DELETE("/dev/subscription-plans/:id", DeleteSubscriptionPlanHandler(subscriptionService))
}

// AdminGrantTrialHandler grants a new free trial to any user (developer override).
// POST /dev/subscriptions/:userId/grant-trial
// Body: { "days": 14, "notes": "reason" }
func AdminGrantTrialHandler(subscriptionService *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("userId")
		if userID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "userId required"})
			return
		}
		var req struct {
			Days  int    `json:"days"`
			Notes string `json:"notes"`
		}
		_ = c.ShouldBindJSON(&req)
		if req.Days <= 0 {
			req.Days = 14
		}
		if req.Notes == "" {
			req.Notes = "Developer-granted trial override"
		}
		sub, err := subscriptionService.AdminGrantTrial(c.Request.Context(), userID, req.Days, req.Notes)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, sub)
	}
}

// RegisterSubscriptionRoutes registers public subscription routes on a PUBLIC router group.
func RegisterSubscriptionRoutes(router *gin.RouterGroup, subscriptionService *service.SubscriptionService) {
	router.GET("/subscriptions/plans", GetSubscriptionPlans(subscriptionService))
	router.GET("/subscriptions/plans/:id", GetSubscriptionPlanByID(subscriptionService))
}

// RegisterSubscriptionProtectedRoutes registers protected subscription routes.
// Must be called on a router group that already has AuthMiddleware applied.
func RegisterSubscriptionProtectedRoutes(router *gin.RouterGroup, subscriptionService *service.SubscriptionService, userService *service.UserService) {
	router.GET("/subscriptions/current", GetUserSubscription(subscriptionService, userService))
	router.POST("/subscriptions", CreateSubscription(subscriptionService, userService))
	router.POST("/subscriptions/:id/cancel", CancelSubscription(subscriptionService, userService))
	router.PATCH("/subscriptions/:id/status", UpdateSubscriptionStatus(subscriptionService))
	router.GET("/subscriptions/:id/usage", GetSubscriptionUsage(subscriptionService))
	router.GET("/subscriptions/:id/payments", GetSubscriptionPayments(subscriptionService))
}
