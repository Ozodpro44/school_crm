package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type TelegramPaymentService struct {
	database *db.Database
	botToken string
}

func NewTelegramPaymentService(database *db.Database, botToken string) *TelegramPaymentService {
	return &TelegramPaymentService{
		database: database,
		botToken: botToken,
	}
}

// GenerateTelegramPaymentLink generates a Click.uz Telegram bot payment link
func (s *TelegramPaymentService) GenerateTelegramPaymentLink(ctx context.Context, subscriptionID string, amount float64) (map[string]interface{}, error) {
	invoiceNumber := fmt.Sprintf("SUB-%s-%d", subscriptionID[:8], time.Now().Unix())
	
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

	// Generate Click.uz Telegram bot payment link
	// Format: https://t.me/CLICKtest?start=TOKEN
	// Token format: bot_token:invoice_id:amount_in_cents
	amountInCents := int64(amount * 100)
	startParam := fmt.Sprintf("%s:%s:%d", s.botToken, invoiceNumber, amountInCents)
	telegramLink := fmt.Sprintf("https://t.me/CLICKtest?start=%s", startParam)

	log.Printf("[TelegramPaymentService.GenerateTelegramPaymentLink] Payment link generated for subscription %s, invoice %s", subscriptionID, invoiceNumber)

	return map[string]interface{}{
		"payment_id":      payment.ID,
		"invoice_number":  invoiceNumber,
		"amount":          amount,
		"status":          "pending",
		"telegram_link":   telegramLink,
		"telegram_url":    telegramLink,
		"instruction":     "Click to pay via Telegram bot @CLICKtest",
	}, nil
}

// HandleTelegramCallback processes payment confirmation from Telegram bot
func (s *TelegramPaymentService) HandleTelegramCallback(ctx context.Context, invoiceNumber string, status string) (bool, error) {
	if status != "confirmed" && status != "completed" {
		return false, fmt.Errorf("invalid payment status: %s", status)
	}

	var paymentID string
	var subscriptionID string
	var currentStatus string
	
	err := s.database.GetConn().QueryRowContext(ctx,
		`SELECT id, subscription_id, status FROM subscription_payments 
		 WHERE invoice_number = $1`,
		invoiceNumber,
	).Scan(&paymentID, &subscriptionID, &currentStatus)

	if err != nil {
		log.Printf("[TelegramPaymentService.HandleTelegramCallback] Payment not found for invoice %s: %v", invoiceNumber, err)
		return false, fmt.Errorf("payment not found: %w", err)
	}

	if currentStatus == "completed" {
		log.Printf("[TelegramPaymentService.HandleTelegramCallback] Payment %s already completed", invoiceNumber)
		return false, nil
	}

	// Update payment status to completed
	now := time.Now()
	_, err = s.database.GetConn().ExecContext(ctx,
		`UPDATE subscription_payments 
		 SET status = 'completed', payment_date = $1, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $2`,
		now, paymentID,
	)

	if err != nil {
		log.Printf("[TelegramPaymentService.HandleTelegramCallback] Failed to update payment status: %v", err)
		return false, fmt.Errorf("failed to update payment: %w", err)
	}

	// Update subscription status to active
	newRenewalDate := time.Now().AddDate(0, 1, 0)
	_, err = s.database.GetConn().ExecContext(ctx,
		`UPDATE subscriptions 
		 SET status = 'active', renewal_date = $1, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $2`,
		newRenewalDate, subscriptionID,
	)

	if err != nil {
		log.Printf("[TelegramPaymentService.HandleTelegramCallback] Failed to update subscription status: %v", err)
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
