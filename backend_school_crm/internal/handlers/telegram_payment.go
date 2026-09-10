package handlers

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

// InitiateTelegramPayment initiates a Telegram/Click.uz payment for a subscription
// @Summary Initiate Telegram payment
// @Description Create a payment via Click.uz Telegram bot
// @Tags payments
// @Accept json
// @Produce json
// @Param id path string true "Subscription ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /subscriptions/{id}/pay-telegram [post]
func InitiateTelegramPayment(telegramService *service.TelegramPaymentService, subscriptionService *service.SubscriptionService) gin.HandlerFunc {
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

		// Generate Telegram payment link
		result, err := telegramService.GenerateTelegramPaymentLink(c.Request.Context(), subscriptionID, planPrice)
		if err != nil {
			log.Printf("[InitiateTelegramPayment] Error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initiate payment"})
			return
		}

		c.JSON(http.StatusOK, result)
	}
}

// TelegramPaymentCallback handles Click.uz Telegram bot payment callback
// @Summary Telegram payment callback
// @Description Handle callback from Click.uz Telegram bot
// @Tags payments
// @Accept json
// @Produce json
// @Param invoice_id query string true "Invoice number"
// @Param status query string true "Payment status (confirmed/completed)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /webhooks/telegram-callback [post]
func TelegramPaymentCallback(telegramService *service.TelegramPaymentService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Previously this callback trusted invoice_id/status with no proof
		// the request actually came from the payment bot — anyone who knew
		// or guessed an invoice number could activate that subscription for
		// free. Require the shared bot-token secret as a bearer token.
		auth := c.GetHeader("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") || !telegramService.VerifyWebhookSecret(strings.TrimPrefix(auth, "Bearer ")) {
			log.Printf("[TelegramPaymentCallback] Rejected: missing or invalid webhook secret")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook credentials"})
			return
		}

		invoiceID := c.Query("invoice_id")
		status := c.Query("status")

		if invoiceID == "" || status == "" {
			log.Printf("[TelegramPaymentCallback] Missing required parameters")
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing required parameters"})
			return
		}

		// Process callback
		success, err := telegramService.HandleTelegramCallback(c.Request.Context(), invoiceID, status)
		if err != nil || !success {
			log.Printf("[TelegramPaymentCallback] Failed to process callback: %v", err)
			c.JSON(http.StatusOK, gin.H{"error": "failed to process payment"})
			return
		}

		log.Printf("[TelegramPaymentCallback] Payment processed successfully for invoice %s", invoiceID)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Payment confirmed",
			"invoice_id": invoiceID,
		})
	}
}

// RegisterTelegramPaymentRoutes registers Telegram payment routes
func RegisterTelegramPaymentRoutes(router *gin.RouterGroup, telegramService *service.TelegramPaymentService, subscriptionService *service.SubscriptionService) {
	// Protected routes
	router.POST("/subscriptions/:id/pay-telegram", InitiateTelegramPayment(telegramService, subscriptionService))
}

// RegisterTelegramPaymentWebhooks registers Telegram payment webhook routes (public, no auth)
func RegisterTelegramPaymentWebhooks(router *gin.RouterGroup, telegramService *service.TelegramPaymentService) {
	router.POST("/webhooks/telegram-callback", TelegramPaymentCallback(telegramService))
}
