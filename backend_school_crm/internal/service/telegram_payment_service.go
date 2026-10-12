package service

import (
	"context"
	"crypto/subtle"
	"fmt"
	"log"
	"math"
	"net/url"
	"time"

	"github.com/school-crm/backend/internal/cache"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type TelegramPaymentService struct {
	database      *db.Database
	webhookSecret string
	cache         *cache.Client
}

// NewTelegramPaymentService takes the webhook secret (TELEGRAM_WEBHOOK_SECRET),
// which is deliberately independent of the Telegram bot token: the token must
// never appear in links, responses or logs.
func NewTelegramPaymentService(database *db.Database, webhookSecret string) *TelegramPaymentService {
	return &TelegramPaymentService{
		database:      database,
		webhookSecret: webhookSecret,
	}
}

// SetCache wires in the optional Redis cache client — see
// ClickUzService.SetCache for why this matters.
func (s *TelegramPaymentService) SetCache(c *cache.Client) { s.cache = c }

// WebhookEnabled reports whether a webhook secret is configured. Without one
// the callback must not be reachable.
func (s *TelegramPaymentService) WebhookEnabled() bool { return s.webhookSecret != "" }

// VerifyWebhookSecret reports whether the caller presented the configured
// webhook secret, compared in constant time. An empty configured secret never
// matches.
func (s *TelegramPaymentService) VerifyWebhookSecret(provided string) bool {
	if s.webhookSecret == "" || provided == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(provided), []byte(s.webhookSecret)) == 1
}

// GenerateTelegramPaymentLink creates a pending invoice and a Click.uz
// Telegram bot deep link. The start parameter carries only the opaque
// invoice number (no secrets); the bot reports back via the webhook.
func (s *TelegramPaymentService) GenerateTelegramPaymentLink(ctx context.Context, subscriptionID string, amount float64) (map[string]interface{}, error) {
	invoiceNumber := newInvoiceNumber(subscriptionID)

	payment := &models.SubscriptionPayment{
		SubscriptionID: subscriptionID,
		Amount:         amount,
		Currency:       "UZS",
		Status:         "pending",
		InvoiceNumber:  &invoiceNumber,
		PaymentMethod:  strToPtr("telegram_click"),
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

	telegramLink := telegramPaymentLink(invoiceNumber)

	log.Printf("[TelegramPaymentService.GenerateTelegramPaymentLink] Payment link generated for subscription %s, invoice %s", subscriptionID, invoiceNumber)

	return map[string]interface{}{
		"payment_id":     payment.ID,
		"invoice_number": invoiceNumber,
		"amount":         amount,
		"status":         "pending",
		"telegram_link":  telegramLink,
		"telegram_url":   telegramLink,
		"instruction":    "Click to pay via Telegram bot @CLICKtest",
	}, nil
}

func telegramPaymentLink(invoiceNumber string) string {
	return "https://t.me/CLICKtest?start=" + url.QueryEscape(invoiceNumber)
}

// HandleTelegramCallback processes a payment confirmation from the bot. The
// invoice must be pending and the reported amount must match what it was
// created for. The pending -> completed transition and the subscription
// activation are one transaction guarded by `WHERE status = 'pending'`.
func (s *TelegramPaymentService) HandleTelegramCallback(ctx context.Context, invoiceNumber string, status string, amount float64) (bool, error) {
	if status != "confirmed" && status != "completed" {
		return false, fmt.Errorf("invalid payment status: %s", status)
	}

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
		log.Printf("[TelegramPaymentService.HandleTelegramCallback] Payment lookup failed for invoice %s: %v", invoiceNumber, err)
		return false, fmt.Errorf("payment not found: %w", err)
	}

	if currentStatus != "pending" {
		log.Printf("[TelegramPaymentService.HandleTelegramCallback] Payment %s not pending (status %s)", invoiceNumber, currentStatus)
		return false, nil
	}

	if math.Abs(amount-expectedAmount) > 0.01 {
		log.Printf("[TelegramPaymentService.HandleTelegramCallback] Amount mismatch for invoice %s: expected %.2f, got %.2f", invoiceNumber, expectedAmount, amount)
		return false, fmt.Errorf("amount does not match invoice")
	}

	now := time.Now().UTC()
	res, err := tx.ExecContext(ctx,
		`UPDATE subscription_payments
		 SET status = 'completed', payment_date = $1, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $2 AND status = 'pending'`,
		now, paymentID,
	)
	if err != nil {
		return false, fmt.Errorf("failed to update payment: %w", err)
	}
	if n, _ := res.RowsAffected(); n != 1 {
		return false, nil
	}

	userID, err := activateSubscriptionTx(ctx, tx, subscriptionID, now)
	if err != nil {
		log.Printf("[TelegramPaymentService.HandleTelegramCallback] Activation failed for invoice %s: %v", invoiceNumber, err)
		return false, err
	}

	if err := tx.Commit(); err != nil {
		return false, fmt.Errorf("failed to commit payment: %w", err)
	}

	if s.cache != nil && userID != "" {
		_ = s.cache.Delete(ctx, fmt.Sprintf("crm:sub_active:%s", userID))
	}

	log.Printf("[TelegramPaymentService.HandleTelegramCallback] Payment completed for invoice %s, subscription %s", invoiceNumber, subscriptionID)
	return true, nil
}

// GetPaymentStatus retrieves payment status
func (s *TelegramPaymentService) GetPaymentStatus(ctx context.Context, invoiceNumber string) (string, error) {
	var status string
	err := s.database.GetConn().QueryRowContext(ctx,
		`SELECT status FROM subscription_payments WHERE invoice_number = $1`,
		invoiceNumber,
	).Scan(&status)

	if err != nil {
		return "", fmt.Errorf("payment not found: %w", err)
	}

	return status, nil
}
