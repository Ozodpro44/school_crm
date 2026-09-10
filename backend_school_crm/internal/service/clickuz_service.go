package service

import (
	"context"
	"crypto/md5"
	"fmt"
	"log"
	"math"
	"time"

	"github.com/school-crm/backend/internal/cache"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type ClickUzService struct {
	database  *db.Database
	merchantID string
	serviceID string
	secretKey string
	cache     *cache.Client
}

func NewClickUzService(database *db.Database, merchantID, serviceID, secretKey string) *ClickUzService {
	return &ClickUzService{
		database:   database,
		merchantID: merchantID,
		serviceID:  serviceID,
		secretKey:  secretKey,
	}
}

// SetCache wires in the optional Redis cache client so a successful payment
// can invalidate the cached subscription-active flag immediately instead of
// leaving SubscriptionGate serving a stale "inactive" result for up to the
// cache TTL.
func (s *ClickUzService) SetCache(c *cache.Client) { s.cache = c }

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

// HandlePaymentCallback processes Click.uz payment callback. The caller
// (ClickUzCallback handler) has already verified the signature, but the
// signature alone doesn't protect against a captured/leaked callback for
// one invoice being replayed with a different `amount` or `invoice_number`
// swapped in unless those exact fields were part of what was signed — see
// VerifyPaymentSignature. This function additionally refuses to activate
// anything unless the reported amount matches what this specific invoice
// was actually created for, so a manipulated callback can't buy a
// higher-priced plan than what was paid for.
func (s *ClickUzService) HandlePaymentCallback(ctx context.Context, clickTxnID string, invoiceNumber string, amount float64) (bool, error) {
	// Find payment by invoice number
	var paymentID string
	var subscriptionID string
	var currentStatus string
	var expectedAmount float64

	err := s.database.GetConn().QueryRowContext(ctx,
		`SELECT id, subscription_id, status, amount FROM subscription_payments
		 WHERE invoice_number = $1`,
		invoiceNumber,
	).Scan(&paymentID, &subscriptionID, &currentStatus, &expectedAmount)

	if err != nil {
		log.Printf("[ClickUzService.HandlePaymentCallback] Payment not found for invoice %s: %v", invoiceNumber, err)
		return false, fmt.Errorf("payment not found: %w", err)
	}

	if currentStatus != "pending" {
		log.Printf("[ClickUzService.HandlePaymentCallback] Payment %s already processed with status: %s", invoiceNumber, currentStatus)
		return false, nil
	}

	if math.Abs(amount-expectedAmount) > 0.01 {
		log.Printf("[ClickUzService.HandlePaymentCallback] Amount mismatch for invoice %s: expected %.2f, got %.2f", invoiceNumber, expectedAmount, amount)
		return false, fmt.Errorf("amount does not match invoice")
	}

	// Update payment status to completed
	now := time.Now().UTC()
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

	// Get subscription + plan billing period, so the new end_date reflects
	// what was actually paid for (monthly vs yearly), not a hardcoded month.
	var userID, billingPeriod string
	err = s.database.GetConn().QueryRowContext(ctx,
		`SELECT sub.user_id, COALESCE(sp.billing_period, 'monthly')
		 FROM subscriptions sub
		 LEFT JOIN subscription_plans sp ON sp.id = sub.plan_id
		 WHERE sub.id = $1`,
		subscriptionID,
	).Scan(&userID, &billingPeriod)

	if err != nil {
		log.Printf("[ClickUzService.HandlePaymentCallback] Subscription not found: %v", err)
		return false, nil
	}

	// Always (re)activate and extend end_date/renewal_date from now — not
	// just when the subscription happened to already be non-active. A
	// renewal payment made while still "active" must still push the end
	// date out; previously it was silently dropped in that case.
	var newEnd time.Time
	if billingPeriod == "yearly" {
		newEnd = now.AddDate(1, 0, 0)
	} else {
		newEnd = now.AddDate(0, 1, 0)
	}
	_, err = s.database.GetConn().ExecContext(ctx,
		`UPDATE subscriptions
		 SET status = 'active', end_date = $1, renewal_date = $1, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $2`,
		newEnd, subscriptionID,
	)

	if err != nil {
		log.Printf("[ClickUzService.HandlePaymentCallback] Failed to update subscription status: %v", err)
		return false, fmt.Errorf("failed to activate subscription: %w", err)
	}

	if s.cache != nil && userID != "" {
		_ = s.cache.Delete(ctx, fmt.Sprintf("crm:sub_active:%s", userID))
	}

	log.Printf("[ClickUzService.HandlePaymentCallback] Payment completed for invoice %s, subscription %s", invoiceNumber, subscriptionID)
	return true, nil
}

// VerifyPaymentSignature verifies Click.uz callback signature. The
// invoice_number is included in the signed string (it wasn't before) so a
// signature computed for one invoice/amount pair can't be replayed against
// a different invoice — without this, a single genuine low-value payment's
// callback could be reused to "pay" for an unrelated invoice requiring the
// same click_txn_id/amount.
func (s *ClickUzService) VerifyPaymentSignature(clickTxnID string, invoiceNumber string, amount float64, sign string) bool {
	signStr := fmt.Sprintf("%s;%s;%s;%s;%.2f", clickTxnID, s.serviceID, invoiceNumber, s.secretKey, amount)
	hash := md5.Sum([]byte(signStr))
	expectedSign := fmt.Sprintf("%x", hash)

	return expectedSign == sign
}

// GetInvoiceAmount returns the amount a pending invoice was created for —
// used by the dev test-payment endpoint so it exercises the same amount
// check as a real callback instead of bypassing it with a hardcoded 0.
func (s *ClickUzService) GetInvoiceAmount(ctx context.Context, invoiceNumber string) (float64, error) {
	var amount float64
	err := s.database.GetConn().QueryRowContext(ctx,
		`SELECT amount FROM subscription_payments WHERE invoice_number = $1`, invoiceNumber,
	).Scan(&amount)
	if err != nil {
		return 0, fmt.Errorf("invoice not found: %w", err)
	}
	return amount, nil
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
