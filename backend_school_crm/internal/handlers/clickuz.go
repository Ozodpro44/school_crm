package handlers

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

// InitiateClickUzPayment initiates a Click.uz payment for a subscription
// @Summary Initiate Click.uz payment
// @Description Create a payment order for subscription renewal via Click.uz
// @Tags payments
// @Accept json
// @Produce json
// @Param id path string true "Subscription ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /subscriptions/{id}/pay-click [post]
func InitiateClickUzPayment(clickUzService *service.ClickUzService, subscriptionService *service.SubscriptionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		subscriptionID := c.Param("id")
		if subscriptionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "subscription_id is required"})
			return
		}

		// Get subscription
		subscription, err := subscriptionService.GetUserSubscription(c.Request.Context(), userID.(string))
		if err != nil || subscription == nil || subscription.ID != subscriptionID {
			c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
			return
		}

		// Get subscription plan to get price
		plans, err := subscriptionService.GetSubscriptionPlans(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get plan details"})
			return
		}

		var planPrice float64
		for _, plan := range plans {
			if plan.ID == subscription.PlanID {
				planPrice = plan.Price
				break
			}
		}

		if planPrice == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "free plans cannot be paid"})
			return
		}

		// Initiate payment
		result, err := clickUzService.InitiatePayment(c.Request.Context(), subscriptionID, planPrice)
		if err != nil {
			log.Printf("[InitiateClickUzPayment] Error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initiate payment"})
			return
		}

		c.JSON(http.StatusOK, result)
	}
}

// ClickUzCallback handles Click.uz payment callback (POST from Click.uz server)
// @Summary Click.uz payment callback
// @Description Handle callback from Click.uz payment gateway
// @Tags payments
// @Accept json
// @Produce json
// @Param click_txn_id query string true "Click transaction ID"
// @Param invoice_id query string true "Invoice number"
// @Param amount query string true "Amount paid"
// @Param sign_time query string true "Sign time"
// @Param sign query string true "Signature"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /webhooks/click-callback [post]
func ClickUzCallback(clickUzService *service.ClickUzService) gin.HandlerFunc {
	return func(c *gin.Context) {
		clickTxnID := c.Query("click_txn_id")
		invoiceID := c.Query("invoice_id")
		amountStr := c.Query("amount")
		sign := c.Query("sign")

		if clickTxnID == "" || invoiceID == "" || amountStr == "" || sign == "" {
			log.Printf("[ClickUzCallback] Missing required parameters")
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "missing required parameters",
				"click_txn_id": 0,
			})
			return
		}

		// Parse amount
		amount, err := strconv.ParseFloat(amountStr, 64)
		if err != nil {
			log.Printf("[ClickUzCallback] Invalid amount: %s", amountStr)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "invalid amount",
				"click_txn_id": 0,
			})
			return
		}

		// Verify signature
		if !clickUzService.VerifyPaymentSignature(clickTxnID, invoiceID, amount, sign) {
			log.Printf("[ClickUzCallback] Invalid signature for transaction %s", clickTxnID)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "invalid signature",
				"click_txn_id": 0,
			})
			return
		}

		// Process callback
		success, err := clickUzService.HandlePaymentCallback(c.Request.Context(), clickTxnID, invoiceID, amount)
		if err != nil || !success {
			log.Printf("[ClickUzCallback] Failed to process callback: %v", err)
			c.JSON(http.StatusOK, gin.H{
				"error": "failed to process payment",
				"click_txn_id": clickTxnID,
			})
			return
		}

		log.Printf("[ClickUzCallback] Payment processed successfully for invoice %s", invoiceID)
		c.JSON(http.StatusOK, gin.H{
			"error": 0,
			"error_note": "success",
			"click_txn_id": clickTxnID,
		})
	}
}

// GetPaymentStatus retrieves the status of a payment
// @Summary Get payment status
// @Description Retrieve the current status of a subscription payment
// @Tags payments
// @Produce json
// @Param payment_id query string true "Payment ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /subscriptions/payment-status [get]
func GetPaymentStatus(clickUzService *service.ClickUzService) gin.HandlerFunc {
	return func(c *gin.Context) {
		paymentID := c.Query("payment_id")
		if paymentID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "payment_id is required"})
			return
		}

		status, err := clickUzService.GetPaymentStatus(c.Request.Context(), paymentID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"payment_id": paymentID,
			"status":     status,
		})
	}
}

// RegisterClickUzRoutes registers Click.uz payment routes
func RegisterClickUzRoutes(router *gin.RouterGroup, clickUzService *service.ClickUzService, subscriptionService *service.SubscriptionService) {
	// Protected routes
	router.POST("/subscriptions/:id/pay-click", InitiateClickUzPayment(clickUzService, subscriptionService))
	router.GET("/subscriptions/payment-status", GetPaymentStatus(clickUzService))
}

// TestPaymentCallback completes payment for testing (dev endpoint)
// @Summary Test payment completion
// @Description Manually complete a payment for testing
// @Tags payments
// @Produce json
// @Param invoice_id query string true "Invoice number"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /dev/test-payment [post]
func TestPaymentCallback(clickUzService *service.ClickUzService) gin.HandlerFunc {
	return func(c *gin.Context) {
		invoiceID := c.Query("invoice_id")
		if invoiceID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invoice_id is required"})
			return
		}

		success, err := clickUzService.HandlePaymentCallback(c.Request.Context(), "test-txn-"+invoiceID, invoiceID, 0)
		if err != nil || !success {
			c.JSON(http.StatusOK, gin.H{
				"error": "failed to process test payment",
				"invoice_id": invoiceID,
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Test payment completed",
			"invoice_id": invoiceID,
		})
	}
}

// RegisterClickUzWebhooks registers Click.uz webhook routes (public, no auth)
func RegisterClickUzWebhooks(router *gin.RouterGroup, clickUzService *service.ClickUzService) {
	router.POST("/webhooks/click-callback", ClickUzCallback(clickUzService))
}

// RegisterClickUzDevRoutes registers developer-only Click.uz test endpoints (requires DevAuth)
func RegisterClickUzDevRoutes(router *gin.RouterGroup, clickUzService *service.ClickUzService) {
	router.POST("/dev/test-payment", TestPaymentCallback(clickUzService))
}
