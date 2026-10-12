package service

import (
	"context"
	"crypto/md5"
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	"github.com/school-crm/backend/internal/cache"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type ClickUzService struct {
	database   *db.Database
	merchantID string
	serviceID  string
	secretKey  string
	cache      *cache.Client
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

// Configured reports whether all Click credentials are present. Webhooks must
// not be exposed (and signatures never verify) when this is false.
func (s *ClickUzService) Configured() bool {
	return s.serviceID != "" && s.secretKey != "" && s.merchantID != ""
}

// newInvoiceNumber builds an unguessable, collision-proof invoice number. The
// old "<sub>-<unix seconds>" format collided for two payments created within
// the same second and was trivially enumerable.
func newInvoiceNumber(subscriptionID string) string {
	prefix := subscriptionID
	if len(prefix) > 8 {
		prefix = prefix[:8]
	}
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("SUB-%s-%d", prefix, time.Now().UnixNano())
	}
	return fmt.Sprintf("SUB-%s-%d-%s", prefix, time.Now().Unix(), hex.EncodeToString(b))
}

// InitiatePayment creates a subscription payment order for Click.uz
func (s *ClickUzService) InitiatePayment(ctx context.Context, subscriptionID string, amount float64) (map[string]interface{}, error) {
	invoiceNumber := newInvoiceNumber(subscriptionID)

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
		"payment_id":     payment.ID,
		"invoice_number": invoiceNumber,
		"amount":         amount,
		"merchant_id":    s.merchantID,
		"service_id":     s.serviceID,
		"status":         "pending",
	}, nil
}

// HandlePaymentCallback processes a Click.uz payment callback whose signature
// the handler has already verified. Everything happens in one transaction:
// the invoice row is locked (FOR UPDATE), must still be pending, must match
// the amount it was created for, is moved to completed with a guarded UPDATE
// (RowsAffected must be 1) and the subscription is activated. If activation
// fails the whole thing rolls back so a payment is never completed without
// the subscription being extended.
func (s *ClickUzService) HandlePaymentCallback(ctx context.Context, clickTxnID string, invoiceNumber string, amount float64) (bool, error) {
	tx, err := s.database.GetConn().BeginTx(ctx, nil)
	if err != nil {
		return false, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var paymentID, subscriptionID, currentStatus string
	var expectedAmount float64
	err = tx.QueryRowContext(ctx,
		`SELECT id, subscription_id, status, amount FROM subscription_payments
		 WHERE invoice_number = $1 FOR UPDATE`,
		invoiceNumber,
	).Scan(&paymentID, &subscriptionID, &currentStatus, &expectedAmount)
	if err != nil {
		log.Printf("[ClickUzService.HandlePaymentCallback] Lookup failed for invoice %s: %v", invoiceNumber, err)
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

	now := time.Now().UTC()
	res, err := tx.ExecContext(ctx,
		`UPDATE subscription_payments
		 SET status = 'completed', payment_date = $1, click_payment_id = $2, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $3 AND status = 'pending'`,
		now, clickTxnID, paymentID,
	)
	if err != nil {
		return false, fmt.Errorf("failed to update payment: %w", err)
	}
	if n, _ := res.RowsAffected(); n != 1 {
		return false, nil
	}

	userID, err := activateSubscriptionTx(ctx, tx, subscriptionID, now)
	if err != nil {
		log.Printf("[ClickUzService.HandlePaymentCallback] Activation failed for invoice %s: %v", invoiceNumber, err)
		return false, err
	}

	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("failed to commit payment: %w", err)
	}

	if s.cache != nil && userID != "" {
		_ = s.cache.Delete(ctx, fmt.Sprintf("crm:sub_active:%s", userID))
	}

	log.Printf("[ClickUzService.HandlePaymentCallback] Payment completed for invoice %s, subscription %s", invoiceNumber, subscriptionID)
	return true, nil
}

// activateSubscriptionTx (re)activates a subscription and pushes end_date /
// renewal_date out by the plan's billing period, inside the caller's
// transaction. It returns the owning user id for cache invalidation.
func activateSubscriptionTx(ctx context.Context, tx *sql.Tx, subscriptionID string, now time.Time) (string, error) {
	var userID, billingPeriod string
	err := tx.QueryRowContext(ctx,
		`SELECT sub.user_id, COALESCE(sp.billing_period, 'monthly')
		 FROM subscriptions sub
		 LEFT JOIN subscription_plans sp ON sp.id = sub.plan_id
		 WHERE sub.id = $1`,
		subscriptionID,
	).Scan(&userID, &billingPeriod)
	if err != nil {
		return "", fmt.Errorf("subscription not found: %w", err)
	}

	newEnd := now.AddDate(0, 1, 0)
	if billingPeriod == "yearly" {
		newEnd = now.AddDate(1, 0, 0)
	}
	res, err := tx.ExecContext(ctx,
		`UPDATE subscriptions
		 SET status = 'active', end_date = $1, renewal_date = $1, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $2`,
		newEnd, subscriptionID,
	)
	if err != nil {
		return "", fmt.Errorf("failed to activate subscription: %w", err)
	}
	if n, _ := res.RowsAffected(); n != 1 {
		return "", errors.New("failed to activate subscription: no rows updated")
	}
	return userID, nil
}

// VerifyPaymentSignature verifies the Click.uz callback signature. It fails
// closed when the service id or secret key is not configured (an empty key
// would make the signature computable by anyone), compares in constant time,
// and covers sign_time when the caller sent one. The invoice number is part
// of the signed string so a signature for one invoice cannot be replayed
// against another.
func (s *ClickUzService) VerifyPaymentSignature(clickTxnID, invoiceNumber string, amount float64, signTime, sign string) bool {
	if s.secretKey == "" || s.serviceID == "" || sign == "" {
		return false
	}
	signStr := fmt.Sprintf("%s;%s;%s;%s;%.2f", clickTxnID, s.serviceID, invoiceNumber, s.secretKey, amount)
	if signTime != "" {
		signStr += ";" + signTime
	}
	hash := md5.Sum([]byte(signStr))
	expectedSign := hex.EncodeToString(hash[:])
	return subtle.ConstantTimeCompare([]byte(expectedSign), []byte(strings.ToLower(sign))) == 1
}

// GetPaymentStatus returns the status of a payment, scoped to the caller's
// own subscription so payment IDs of other tenants cannot be probed.
func (s *ClickUzService) GetPaymentStatus(ctx context.Context, paymentID, userID string) (string, error) {
	var status string
	err := s.database.GetConn().QueryRowContext(ctx,
		`SELECT sp.status FROM subscription_payments sp
		 JOIN subscriptions sub ON sub.id = sp.subscription_id
		 WHERE sp.id = $1 AND sub.user_id = $2`,
		paymentID, userID,
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
