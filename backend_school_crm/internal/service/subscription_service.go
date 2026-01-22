package service

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type SubscriptionService struct {
	database *db.Database
}

func NewSubscriptionService(database *db.Database) *SubscriptionService {
	return &SubscriptionService{database: database}
}

// GetSubscriptionPlans retrieves all available subscription plans
func (s *SubscriptionService) GetSubscriptionPlans(ctx context.Context) ([]models.SubscriptionPlan, error) {
	query := `
		SELECT id, name, description, price, billing_period, max_branches, max_students, max_classes, features, status, created_at, updated_at
		FROM subscription_plans
		WHERE status = 'active'
		ORDER BY price ASC
	`

	rows, err := s.database.GetConn().QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch subscription plans: %w", err)
	}
	defer rows.Close()

	var plans []models.SubscriptionPlan
	for rows.Next() {
		var plan models.SubscriptionPlan
		if err := rows.Scan(&plan.ID, &plan.Name, &plan.Description, &plan.Price, &plan.BillingPeriod,
			&plan.MaxBranches, &plan.MaxStudents, &plan.MaxClasses, &plan.Features, &plan.Status, &plan.CreatedAt, &plan.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan subscription plan: %w", err)
		}
		plans = append(plans, plan)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating subscription plans: %w", err)
	}

	return plans, nil
}

// GetUserSubscription retrieves the active subscription for a user
func (s *SubscriptionService) GetUserSubscription(ctx context.Context, userID string) (*models.Subscription, error) {
	query := `
		SELECT s.id, s.user_id, s.plan_id, s.branch_id, s.status, s.start_date, s.end_date, s.renewal_date,
		       s.auto_renew, s.payment_method, s.stripe_subscription_id, s.notes, s.cancelled_at, s.cancelled_by,
		       s.created_at, s.updated_at
		FROM subscriptions s
		WHERE s.user_id = $1 AND s.status IN ('active', 'paused', 'pending_payment')
		ORDER BY s.created_at DESC
		LIMIT 1
	`

	var sub models.Subscription
	err := s.database.GetConn().QueryRowContext(ctx, query, userID).Scan(
		&sub.ID, &sub.UserID, &sub.PlanID, &sub.BranchID, &sub.Status, &sub.StartDate, &sub.EndDate, &sub.RenewalDate,
		&sub.AutoRenew, &sub.PaymentMethod, &sub.StripeSubscriptionID, &sub.Notes, &sub.CancelledAt, &sub.CancelledBy,
		&sub.CreatedAt, &sub.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil // No active subscription
	}
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user subscription: %w", err)
	}

	return &sub, nil
}

// CreateSubscription creates a new subscription for a user
func (s *SubscriptionService) CreateSubscription(ctx context.Context, sub *models.Subscription) error {
	query := `
		INSERT INTO subscriptions (user_id, plan_id, branch_id, status, start_date, renewal_date, auto_renew, payment_method, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, renewal_date, created_at, updated_at
	`

	renewalDate := sub.StartDate.AddDate(0, 1, 0) // Default to 1 month from start
	if sub.RenewalDate != nil {
		renewalDate = *sub.RenewalDate
	}

	err := s.database.GetConn().QueryRowContext(ctx, query,
		sub.UserID, sub.PlanID, sub.BranchID, sub.Status, sub.StartDate, renewalDate, sub.AutoRenew, sub.PaymentMethod, sub.Notes,
	).Scan(&sub.ID, &sub.RenewalDate, &sub.CreatedAt, &sub.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create subscription: %w", err)
	}

	return nil
}

// UpdateSubscriptionStatus updates the status of a subscription
func (s *SubscriptionService) UpdateSubscriptionStatus(ctx context.Context, subscriptionID, status string) error {
	query := `
		UPDATE subscriptions
		SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`

	_, err := s.database.GetConn().ExecContext(ctx, query, status, subscriptionID)
	if err != nil {
		return fmt.Errorf("failed to update subscription status: %w", err)
	}

	return nil
}

// CancelSubscription cancels a user's subscription
func (s *SubscriptionService) CancelSubscription(ctx context.Context, subscriptionID, userID string) error {
	query := `
		UPDATE subscriptions
		SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`

	_, err := s.database.GetConn().ExecContext(ctx, query, userID, subscriptionID)
	if err != nil {
		return fmt.Errorf("failed to cancel subscription: %w", err)
	}

	return nil
}

// GetSubscriptionUsage retrieves usage metrics for a subscription
func (s *SubscriptionService) GetSubscriptionUsage(ctx context.Context, subscriptionID string) ([]models.SubscriptionUsage, error) {
	query := `
		SELECT id, subscription_id, metric_name, current_usage, limit_value, reset_date, updated_at
		FROM subscription_usage
		WHERE subscription_id = $1
	`

	rows, err := s.database.GetConn().QueryContext(ctx, query, subscriptionID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch subscription usage: %w", err)
	}
	defer rows.Close()

	var usages []models.SubscriptionUsage
	for rows.Next() {
		var usage models.SubscriptionUsage
		if err := rows.Scan(&usage.ID, &usage.SubscriptionID, &usage.MetricName, &usage.CurrentUsage, &usage.LimitValue, &usage.ResetDate, &usage.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan subscription usage: %w", err)
		}
		usages = append(usages, usage)
	}

	return usages, rows.Err()
}

// UpdateSubscriptionUsage updates usage metric for a subscription
func (s *SubscriptionService) UpdateSubscriptionUsage(ctx context.Context, subscriptionID, metricName string, increment int) error {
	query := `
		UPDATE subscription_usage
		SET current_usage = current_usage + $1, updated_at = CURRENT_TIMESTAMP
		WHERE subscription_id = $2 AND metric_name = $3
	`

	_, err := s.database.GetConn().ExecContext(ctx, query, increment, subscriptionID, metricName)
	if err != nil {
		return fmt.Errorf("failed to update subscription usage: %w", err)
	}

	return nil
}

// RecordPayment records a subscription payment
func (s *SubscriptionService) RecordPayment(ctx context.Context, payment *models.SubscriptionPayment) error {
	query := `
		INSERT INTO subscription_payments (subscription_id, amount, currency, status, payment_date, invoice_number, stripe_payment_id, payment_method, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`

	paymentDate := time.Now()
	if payment.PaymentDate != nil {
		paymentDate = *payment.PaymentDate
	}

	err := s.database.GetConn().QueryRowContext(ctx, query,
		payment.SubscriptionID, payment.Amount, payment.Currency, payment.Status, paymentDate,
		payment.InvoiceNumber, payment.StripePaymentID, payment.PaymentMethod, payment.Notes,
	).Scan(&payment.ID, &payment.CreatedAt, &payment.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to record subscription payment: %w", err)
	}

	return nil
}

// GetSubscriptionPayments retrieves payment history for a subscription
func (s *SubscriptionService) GetSubscriptionPayments(ctx context.Context, subscriptionID string) ([]models.SubscriptionPayment, error) {
	query := `
		SELECT id, subscription_id, amount, currency, status, payment_date, invoice_number, stripe_payment_id, payment_method, notes, created_at, updated_at
		FROM subscription_payments
		WHERE subscription_id = $1
		ORDER BY created_at DESC
	`

	rows, err := s.database.GetConn().QueryContext(ctx, query, subscriptionID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch subscription payments: %w", err)
	}
	defer rows.Close()

	var payments []models.SubscriptionPayment
	for rows.Next() {
		var payment models.SubscriptionPayment
		if err := rows.Scan(&payment.ID, &payment.SubscriptionID, &payment.Amount, &payment.Currency, &payment.Status,
			&payment.PaymentDate, &payment.InvoiceNumber, &payment.StripePaymentID, &payment.PaymentMethod, &payment.Notes,
			&payment.CreatedAt, &payment.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan subscription payment: %w", err)
		}
		payments = append(payments, payment)
	}

	return payments, rows.Err()
}

// CheckSubscriptionExpiry checks if a subscription has expired and updates status accordingly
func (s *SubscriptionService) CheckSubscriptionExpiry(ctx context.Context, subscriptionID string) (bool, error) {
	query := `
		SELECT end_date FROM subscriptions WHERE id = $1
	`

	var endDate *time.Time
	err := s.database.GetConn().QueryRowContext(ctx, query, subscriptionID).Scan(&endDate)
	if err != nil {
		return false, fmt.Errorf("failed to check subscription expiry: %w", err)
	}

	if endDate != nil && endDate.Before(time.Now()) {
		// Update status to expired
		updateQuery := `
			UPDATE subscriptions SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = $1
		`
		_, err := s.database.GetConn().ExecContext(ctx, updateQuery, subscriptionID)
		return true, err
	}

	return false, nil
}

// CreateSubscriptionPlan creates a new subscription plan (dev endpoint)
func (s *SubscriptionService) CreateSubscriptionPlan(ctx context.Context, plan *models.SubscriptionPlan) error {
	query := `
		INSERT INTO subscription_plans (id, name, description, price, billing_period, max_branches, max_students, max_classes, features, status, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, name, description, price, billing_period, max_branches, max_students, max_classes, features, status, created_at, updated_at
	`

	err := s.database.GetConn().QueryRowContext(ctx, query,
		plan.Name, plan.Description, plan.Price, plan.BillingPeriod, plan.MaxBranches, plan.MaxStudents, plan.MaxClasses, plan.Features, "active",
	).Scan(&plan.ID, &plan.Name, &plan.Description, &plan.Price, &plan.BillingPeriod, &plan.MaxBranches, &plan.MaxStudents, &plan.MaxClasses, &plan.Features, &plan.Status, &plan.CreatedAt, &plan.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create subscription plan: %w", err)
	}

	return nil
}

// UpdateSubscriptionPlan updates an existing subscription plan (dev endpoint)
func (s *SubscriptionService) UpdateSubscriptionPlan(ctx context.Context, plan *models.SubscriptionPlan) error {
	query := `
		UPDATE subscription_plans
		SET name = $1, description = $2, price = $3, billing_period = $4, max_branches = $5, max_students = $6, max_classes = $7, features = $8, status = $9, updated_at = CURRENT_TIMESTAMP
		WHERE id = $10
	`

	_, err := s.database.GetConn().ExecContext(ctx, query,
		plan.Name, plan.Description, plan.Price, plan.BillingPeriod, plan.MaxBranches, plan.MaxStudents, plan.MaxClasses, plan.Features, plan.Status, plan.ID,
	)

	if err != nil {
		return fmt.Errorf("failed to update subscription plan: %w", err)
	}

	return nil
}

// DeleteSubscriptionPlan deletes a subscription plan (dev endpoint)
func (s *SubscriptionService) DeleteSubscriptionPlan(ctx context.Context, planID string) error {
	query := `
		DELETE FROM subscription_plans WHERE id = $1
	`

	_, err := s.database.GetConn().ExecContext(ctx, query, planID)
	if err != nil {
		return fmt.Errorf("failed to delete subscription plan: %w", err)
	}

	return nil
}

// GetOrCreateFreeTrial gets or creates a free trial subscription plan
func (s *SubscriptionService) GetOrCreateFreeTrial(ctx context.Context) (*models.SubscriptionPlan, error) {
	// Try to find existing free trial plan
	query := `
		SELECT id, name, description, price, billing_period, max_branches, max_students, max_classes, features, status, created_at, updated_at
		FROM subscription_plans
		WHERE name = 'Free Trial' AND status = 'active'
		LIMIT 1
	`

	var plan models.SubscriptionPlan
	err := s.database.GetConn().QueryRowContext(ctx, query).Scan(
		&plan.ID, &plan.Name, &plan.Description, &plan.Price, &plan.BillingPeriod,
		&plan.MaxBranches, &plan.MaxStudents, &plan.MaxClasses, &plan.Features, &plan.Status, &plan.CreatedAt, &plan.UpdatedAt,
	)

	if err == nil {
		// Free trial plan exists
		return &plan, nil
	}

	if err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to fetch free trial plan: %w", err)
	}

	// Create new free trial plan
	createQuery := `
		INSERT INTO subscription_plans (id, name, description, price, billing_period, max_branches, max_students, max_classes, features, status, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, name, description, price, billing_period, max_branches, max_students, max_classes, features, status, created_at, updated_at
	`

	err = s.database.GetConn().QueryRowContext(ctx, createQuery,
		"Free Trial", "14-day free trial for new users", 0, "yearly",
		100, 10000, 1000, `{}`, "active",
	).Scan(
		&plan.ID, &plan.Name, &plan.Description, &plan.Price, &plan.BillingPeriod,
		&plan.MaxBranches, &plan.MaxStudents, &plan.MaxClasses, &plan.Features, &plan.Status, &plan.CreatedAt, &plan.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create free trial plan: %w", err)
	}

	return &plan, nil
}
