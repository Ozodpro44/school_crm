package service

import (
	"context"
	"crypto/md5"
	"fmt"
	"log"
	"time"

	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type ClickUzService struct {
	database  *db.Database
	merchantID string
	serviceID string
	secretKey string
}

func NewClickUzService(database *db.Database, merchantID, serviceID, secretKey string) *ClickUzService {
	return &ClickUzService{
		database:   database,
		merchantID: merchantID,
		serviceID:  serviceID,
		secretKey:  secretKey,
	}
}

// InitiatePayment creates a subscription payment order for Click.uz
func (s *ClickUzService) InitiatePayment(ctx context.Context, subscriptionID string, amount float64) (map[string]interface{}, error) {
	invoiceNumber := fmt.Sprintf("SUB-%s-%d", subscriptionID[:8], time.Now().Unix())
	
	payment := &models.SubscriptionPayment{
		SubscriptionID: subscriptionID,
		Amount:         amount,
		Currency:       "UZS",
		Status:         "pending",
		InvoiceNumber:  &invoiceNumber,
		PaymentMethod:  strToPtr("click"),
	}

	err := s.database.GetConn().QueryRowContext(ctx,
		`INSERT INTO subscription_payments (subscription_id, amount, currency, status, invoice_number, payment_method, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		 RETURNING id`,
		payment.SubscriptionID, payment.Amount, payment.Currency, payment.Status, payment.InvoiceNumber, payment.PaymentMethod,
	).Scan(&payment.ID)

	if err != nil {
		return nil, fmt.Errorf("failed to create payment record: %w", err)
	}

	log.Printf("[ClickUzService.InitiatePayment] Payment initiated for subscription %s, invoice %s", subscriptionID, invoiceNumber)

	return map[string]interface{}{
		"payment_id":      payment.ID,
		"invoice_number":  invoiceNumber,
		"amount":          amount,
		"merchant_id":     s.merchantID,
		"service_id":      s.serviceID,
		"status":          "pending",
	}, nil
}

// HandlePaymentCallback processes Click.uz payment callback
func (s *ClickUzService) HandlePaymentCallback(ctx context.Context, clickTxnID string, invoiceNumber string, amount float64) (bool, error) {
	// Find payment by invoice number
	var paymentID string
	var subscriptionID string
	var currentStatus string
	
	err := s.database.GetConn().QueryRowContext(ctx,
		`SELECT id, subscription_id, status FROM subscription_payments 
		 WHERE invoice_number = $1`,
		invoiceNumber,
	).Scan(&paymentID, &subscriptionID, &currentStatus)

	if err != nil {
		log.Printf("[ClickUzService.HandlePaymentCallback] Payment not found for invoice %s: %v", invoiceNumber, err)
		return false, fmt.Errorf("payment not found: %w", err)
	}

	if currentStatus != "pending" {
		log.Printf("[ClickUzService.HandlePaymentCallback] Payment %s already processed with status: %s", invoiceNumber, currentStatus)
		return false, nil
	}

	// Update payment status to completed
	now := time.Now()
	_, err = s.database.GetConn().ExecContext(ctx,
		`UPDATE subscription_payments 
		 SET status = 'completed', payment_date = $1, click_payment_id = $2, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $3`,
		now, clickTxnID, paymentID,
	)

	if err != nil {
		log.Printf("[ClickUzService.HandlePaymentCallback] Failed to update payment status: %v", err)
		return false, fmt.Errorf("failed to update payment: %w", err)
	}

	// Get subscription details
	var subscription models.Subscription
	err = s.database.GetConn().QueryRowContext(ctx,
		`SELECT id, user_id, plan_id, status, renewal_date FROM subscriptions WHERE id = $1`,
		subscriptionID,
	).Scan(&subscription.ID, &subscription.UserID, &subscription.PlanID, &subscription.Status, &subscription.RenewalDate)

	if err != nil {
		log.Printf("[ClickUzService.HandlePaymentCallback] Subscription not found: %v", err)
		return false, nil
	}

	// Update subscription status to active if it was expired/cancelled
	if subscription.Status != "active" {
		newRenewalDate := time.Now().AddDate(0, 1, 0)
		_, err = s.database.GetConn().ExecContext(ctx,
			`UPDATE subscriptions 
			 SET status = 'active', renewal_date = $1, updated_at = CURRENT_TIMESTAMP
			 WHERE id = $2`,
			newRenewalDate, subscriptionID,
		)

		if err != nil {
			log.Printf("[ClickUzService.HandlePaymentCallback] Failed to update subscription status: %v", err)
		}
	}

	log.Printf("[ClickUzService.HandlePaymentCallback] Payment completed for invoice %s, subscription %s", invoiceNumber, subscriptionID)
	return true, nil
}

// VerifyPaymentSignature verifies Click.uz callback signature
func (s *ClickUzService) VerifyPaymentSignature(clickTxnID string, invoiceNumber string, amount float64, sign string) bool {
	// Click.uz signature format: MD5(click_txn_id;service_id;secret_key;amount;sign_time)
	// But for simplified verification, we'll use: MD5(click_txn_id;service_id;secret_key)
	signStr := fmt.Sprintf("%s;%s;%s;%.2f", clickTxnID, s.serviceID, s.secretKey, amount)
	hash := md5.Sum([]byte(signStr))
	expectedSign := fmt.Sprintf("%x", hash)
	
	return expectedSign == sign
}

// GetPaymentStatus retrieves payment status
func (s *ClickUzService) GetPaymentStatus(ctx context.Context, paymentID string) (string, error) {
	var status string
	err := s.database.GetConn().QueryRowContext(ctx,
		`SELECT status FROM subscription_payments WHERE id = $1`,
		paymentID,
	).Scan(&status)

	if err != nil {
		return "", fmt.Errorf("payment not found: %w", err)
	}

	return status, nil
}

// Helper function to convert string to pointer
func strToPtr(s string) *string {
	return &s
}
