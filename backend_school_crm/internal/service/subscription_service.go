package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/school-crm/backend/internal/cache"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type SubscriptionService struct {
	database *db.Database
	cache    *cache.Client
}

func NewSubscriptionService(database *db.Database) *SubscriptionService {
	return &SubscriptionService{database: database}
}

// SetCache wires in the optional Redis cache client.
func (s *SubscriptionService) SetCache(c *cache.Client) { s.cache = c }

const subActiveCacheTTL = 5 * time.Minute

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
		WHERE s.user_id = $1 AND s.status IN ('active', 'trial', 'paused', 'pending_payment')
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

// CreateSubscription creates a new subscription for a user.
// Callers should populate EndDate for trial subscriptions; for paid subscriptions
// end_date is updated when payment completes.
func (s *SubscriptionService) CreateSubscription(ctx context.Context, sub *models.Subscription) error {
	renewalDate := sub.StartDate.AddDate(0, 1, 0) // default 1 month
	if sub.RenewalDate != nil {
		renewalDate = *sub.RenewalDate
	}
	sub.RenewalDate = &renewalDate

	// end_date: use explicit value if set, otherwise mirror renewal_date for trials
	endDate := sub.EndDate
	if endDate == nil {
		endDate = &renewalDate
	}

	err := s.database.GetConn().QueryRowContext(ctx, `
		INSERT INTO subscriptions (user_id, plan_id, branch_id, status, start_date, end_date, renewal_date, auto_renew, payment_method, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, end_date, renewal_date, created_at, updated_at
	`,
		sub.UserID, sub.PlanID, sub.BranchID, sub.Status, sub.StartDate,
		endDate, renewalDate, sub.AutoRenew, sub.PaymentMethod, sub.Notes,
	).Scan(&sub.ID, &sub.EndDate, &sub.RenewalDate, &sub.CreatedAt, &sub.UpdatedAt)

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

	if s.cache != nil {
		var userID string
		_ = s.database.GetConn().QueryRowContext(ctx, `SELECT user_id FROM subscriptions WHERE id = $1`, subscriptionID).Scan(&userID)
		if userID != "" {
			_ = s.cache.Delete(ctx, fmt.Sprintf("crm:sub_active:%s", userID))
		}
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

	if s.cache != nil && userID != "" {
		_ = s.cache.Delete(ctx, fmt.Sprintf("crm:sub_active:%s", userID))
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

// ExpireLapsedSubscriptions marks every non-terminal subscription whose
// end_date has passed as "expired". Nothing previously called
// CheckSubscriptionExpiry (which only handles one ID at a time) anywhere, so
// a lapsed subscription's status column stayed stuck at trial/active/etc.
// forever — access itself was still correctly cut off by SubscriptionGate's
// separate end_date check, but platform stats, admin listings, and MRR kept
// counting long-lapsed subscriptions as live. Meant to be run periodically.
func (s *SubscriptionService) ExpireLapsedSubscriptions(ctx context.Context) (int, error) {
	rows, err := s.database.GetConn().QueryContext(ctx, `
		UPDATE subscriptions
		SET status = 'expired', updated_at = NOW()
		WHERE status IN ('active', 'trial', 'paused', 'pending_payment', 'past_due')
		  AND end_date IS NOT NULL AND end_date < NOW()
		RETURNING user_id
	`)
	if err != nil {
		return 0, fmt.Errorf("expire lapsed subscriptions: %w", err)
	}
	defer rows.Close()

	var userIDs []string
	for rows.Next() {
		var uid string
		if err := rows.Scan(&uid); err != nil {
			continue
		}
		userIDs = append(userIDs, uid)
	}
	if err := rows.Err(); err != nil {
		return len(userIDs), err
	}

	if s.cache != nil {
		for _, uid := range userIDs {
			_ = s.cache.Delete(ctx, fmt.Sprintf("crm:sub_active:%s", uid))
		}
	}

	return len(userIDs), nil
}

// CreateSubscriptionPlan creates a new subscription plan (dev endpoint).
// plan.Status is respected when the caller provides one (defaults to
// "active" only when left blank) — it previously hardcoded "active"
// unconditionally, silently ignoring a deliberate "inactive" choice at
// creation time.
func (s *SubscriptionService) CreateSubscriptionPlan(ctx context.Context, plan *models.SubscriptionPlan) error {
	status := plan.Status
	if status == "" {
		status = "active"
	}

	query := `
		INSERT INTO subscription_plans (id, name, description, price, billing_period, max_branches, max_students, max_classes, features, status, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, name, description, price, billing_period, max_branches, max_students, max_classes, features, status, created_at, updated_at
	`

	err := s.database.GetConn().QueryRowContext(ctx, query,
		plan.Name, plan.Description, plan.Price, plan.BillingPeriod, plan.MaxBranches, plan.MaxStudents, plan.MaxClasses, plan.Features, status,
	).Scan(&plan.ID, &plan.Name, &plan.Description, &plan.Price, &plan.BillingPeriod, &plan.MaxBranches, &plan.MaxStudents, &plan.MaxClasses, &plan.Features, &plan.Status, &plan.CreatedAt, &plan.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create subscription plan: %w", err)
	}

	return nil
}

// UpdateSubscriptionPlan partially updates an existing subscription plan
// (dev endpoint) — a nil field in req leaves that column untouched. This
// used to take a full SubscriptionPlan and unconditionally overwrite every
// column, so a partial payload (e.g. the toggle-active control, which only
// ever sends {"status": ...}) silently blanked name/price/limits/features.
func (s *SubscriptionService) UpdateSubscriptionPlan(ctx context.Context, id string, req *models.UpdateSubscriptionPlanRequest) (*models.SubscriptionPlan, error) {
	var featuresArg interface{}
	if req.Features != nil {
		featuresArg = []byte(req.Features)
	}

	_, err := s.database.GetConn().ExecContext(ctx, `
		UPDATE subscription_plans
		SET
			name           = COALESCE($1, name),
			description    = COALESCE($2, description),
			price          = COALESCE($3, price),
			billing_period = COALESCE($4, billing_period),
			max_branches   = COALESCE($5, max_branches),
			max_students   = COALESCE($6, max_students),
			max_classes    = COALESCE($7, max_classes),
			features       = COALESCE($8::jsonb, features),
			status         = COALESCE($9, status),
			updated_at     = CURRENT_TIMESTAMP
		WHERE id = $10
	`, req.Name, req.Description, req.Price, req.BillingPeriod, req.MaxBranches, req.MaxStudents, req.MaxClasses, featuresArg, req.Status, id)

	if err != nil {
		return nil, fmt.Errorf("failed to update subscription plan: %w", err)
	}

	return s.GetSubscriptionPlanByID(ctx, id)
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

// ──────────────────────────────────────────────────────────────────────────────
// Admin / Developer endpoints
// ──────────────────────────────────────────────────────────────────────────────

// AdminListSubscriptions returns all subscriptions joined with plan and user details.
// Used by the developer dashboard.
func (s *SubscriptionService) AdminListSubscriptions(ctx context.Context) ([]models.AdminSubscriptionView, error) {
	query := `
		SELECT
			sub.id, sub.user_id, sub.plan_id, sub.branch_id, sub.status,
			sub.start_date, sub.end_date, sub.renewal_date, sub.auto_renew,
			sub.payment_method, sub.notes, sub.cancelled_at, sub.created_at, sub.updated_at,
			u.email, u.full_name,
			COALESCE(sp.name, '[deleted plan]') AS plan_name,
			COALESCE(sp.price, 0)               AS plan_price,
			COALESCE(sp.billing_period, '')      AS billing_period
		FROM subscriptions sub
		JOIN users u ON sub.user_id = u.id
		LEFT JOIN subscription_plans sp ON sub.plan_id = sp.id
		ORDER BY sub.created_at DESC
	`
	rows, err := s.database.GetConn().QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("admin list subscriptions: %w", err)
	}
	defer rows.Close()

	var result []models.AdminSubscriptionView
	for rows.Next() {
		var v models.AdminSubscriptionView
		if err := rows.Scan(
			&v.ID, &v.UserID, &v.PlanID, &v.BranchID, &v.Status,
			&v.StartDate, &v.EndDate, &v.RenewalDate, &v.AutoRenew,
			&v.PaymentMethod, &v.Notes, &v.CancelledAt, &v.CreatedAt, &v.UpdatedAt,
			&v.UserEmail, &v.UserFullName,
			&v.PlanName, &v.PlanPrice, &v.BillingPeriod,
		); err != nil {
			return nil, fmt.Errorf("admin list subscriptions scan: %w", err)
		}
		result = append(result, v)
	}
	return result, rows.Err()
}

// AdminGetSubscription returns a single subscription joined with plan and user details.
func (s *SubscriptionService) AdminGetSubscription(ctx context.Context, id string) (*models.AdminSubscriptionView, error) {
	query := `
		SELECT
			sub.id, sub.user_id, sub.plan_id, sub.branch_id, sub.status,
			sub.start_date, sub.end_date, sub.renewal_date, sub.auto_renew,
			sub.payment_method, sub.notes, sub.cancelled_at, sub.created_at, sub.updated_at,
			u.email, u.full_name,
			sp.name AS plan_name, sp.price AS plan_price, sp.billing_period
		FROM subscriptions sub
		JOIN users u ON sub.user_id = u.id
		JOIN subscription_plans sp ON sub.plan_id = sp.id
		WHERE sub.id = $1
	`
	var v models.AdminSubscriptionView
	err := s.database.GetConn().QueryRowContext(ctx, query, id).Scan(
		&v.ID, &v.UserID, &v.PlanID, &v.BranchID, &v.Status,
		&v.StartDate, &v.EndDate, &v.RenewalDate, &v.AutoRenew,
		&v.PaymentMethod, &v.Notes, &v.CancelledAt, &v.CreatedAt, &v.UpdatedAt,
		&v.UserEmail, &v.UserFullName,
		&v.PlanName, &v.PlanPrice, &v.BillingPeriod,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("admin get subscription: %w", err)
	}
	return &v, nil
}

// AdminCreateSubscription creates a subscription on behalf of a user (developer action).
func (s *SubscriptionService) AdminCreateSubscription(ctx context.Context, req *models.AdminCreateSubscriptionRequest) (*models.AdminSubscriptionView, error) {
	now := time.Now().UTC()
	endDate := now.AddDate(0, 1, 0)
	if req.BillingPeriod == "yearly" {
		endDate = now.AddDate(1, 0, 0)
	}
	if req.Status == "" {
		req.Status = "active"
	}

	// Unlike AdminGrantTrial, this used to leave any subscription the user
	// already had untouched — creating a second simultaneously-"active" row
	// for the same user, which GetPlatformStats's MRR/active-count queries
	// (WHERE status='active', no per-user dedup) then double-count.
	if req.Status == "active" || req.Status == "trial" {
		if _, err := s.database.GetConn().ExecContext(ctx, `
			UPDATE subscriptions
			SET status = 'expired', updated_at = NOW()
			WHERE user_id = $1 AND status IN ('active', 'trial', 'paused', 'pending_payment', 'past_due')
		`, req.UserID); err != nil {
			return nil, fmt.Errorf("admin create subscription: expire old: %w", err)
		}
	}

	var id string
	err := s.database.GetConn().QueryRowContext(ctx, `
		INSERT INTO subscriptions (user_id, plan_id, branch_id, status, start_date, end_date, renewal_date, auto_renew, payment_method, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`, req.UserID, req.PlanID, req.BranchID, req.Status, now, endDate, endDate, req.AutoRenew, req.PaymentMethod, req.Notes,
	).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("admin create subscription: %w", err)
	}
	if s.cache != nil {
		_ = s.cache.Delete(ctx, fmt.Sprintf("crm:sub_active:%s", req.UserID))
	}
	return s.AdminGetSubscription(ctx, id)
}

// AdminUpdateSubscription updates mutable fields of any subscription.
// When status is being set to "active" and the caller did not provide a new
// end_date, we auto-recalculate end_date from NOW + plan billing period if
// the current end_date is in the past or NULL (i.e., the subscription was
// previously expired/cancelled and is now being renewed by a developer).
func (s *SubscriptionService) AdminUpdateSubscription(ctx context.Context, id string, req *models.AdminUpdateSubscriptionRequest) (*models.AdminSubscriptionView, error) {
	// If activating without an explicit end_date, check if we need to fix dates.
	if req.Status != nil && *req.Status == "active" && req.EndDate == nil {
		// Fetch current end_date and plan billing_period to compute a new end_date.
		var currentEndDate *time.Time
		var billingPeriod string
		err := s.database.GetConn().QueryRowContext(ctx, `
			SELECT sub.end_date, COALESCE(sp.billing_period, 'monthly')
			FROM subscriptions sub
			LEFT JOIN subscription_plans sp ON sub.plan_id = sp.id
			WHERE sub.id = $1
		`, id).Scan(&currentEndDate, &billingPeriod)
		if err != nil && err != sql.ErrNoRows {
			return nil, fmt.Errorf("admin update subscription: fetch dates: %w", err)
		}

		// Recalculate if end_date is missing or already in the past.
		if currentEndDate == nil || currentEndDate.Before(time.Now()) {
			now := time.Now().UTC()
			var newEnd time.Time
			if billingPeriod == "yearly" {
				newEnd = now.AddDate(1, 0, 0)
			} else {
				newEnd = now.AddDate(0, 1, 0)
			}
			req.EndDate = &newEnd
			if req.RenewalDate == nil {
				req.RenewalDate = &newEnd
			}
		}
	}

	_, err := s.database.GetConn().ExecContext(ctx, `
		UPDATE subscriptions
		SET
			status         = COALESCE($1, status),
			plan_id        = COALESCE($2, plan_id),
			auto_renew     = COALESCE($3, auto_renew),
			end_date       = COALESCE($4, end_date),
			renewal_date   = COALESCE($5, renewal_date),
			notes          = CASE WHEN $9 THEN NULL ELSE COALESCE($6, notes) END,
			payment_method = COALESCE($7, payment_method),
			updated_at     = NOW()
		WHERE id = $8
	`, req.Status, req.PlanID, req.AutoRenew, req.EndDate, req.RenewalDate, req.Notes, req.PaymentMethod, id, req.ClearNotes)
	if err != nil {
		return nil, fmt.Errorf("admin update subscription: %w", err)
	}

	if s.cache != nil {
		var userID string
		_ = s.database.GetConn().QueryRowContext(ctx, `SELECT user_id FROM subscriptions WHERE id = $1`, id).Scan(&userID)
		if userID != "" {
			_ = s.cache.Delete(ctx, fmt.Sprintf("crm:sub_active:%s", userID))
		}
	}

	return s.AdminGetSubscription(ctx, id)
}

// AdminDeleteSubscription hard-cancels and removes a subscription.
var ErrSubscriptionNotFound = fmt.Errorf("subscription not found")

func (s *SubscriptionService) AdminDeleteSubscription(ctx context.Context, id string) error {
	// Fetch user_id first: needed both to invalidate that user's cached
	// active-subscription flag, and to distinguish "actually deleted" from
	// "no such row" — the DELETE alone previously reported success either way.
	var userID string
	err := s.database.GetConn().QueryRowContext(ctx,
		`SELECT user_id FROM subscriptions WHERE id = $1`, id).Scan(&userID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrSubscriptionNotFound
	}
	if err != nil {
		return fmt.Errorf("admin delete subscription: %w", err)
	}

	if _, err := s.database.GetConn().ExecContext(ctx,
		`DELETE FROM subscriptions WHERE id = $1`, id); err != nil {
		return fmt.Errorf("admin delete subscription: %w", err)
	}

	if s.cache != nil {
		_ = s.cache.Delete(ctx, fmt.Sprintf("crm:sub_active:%s", userID))
	}
	return nil
}

// GetUserSubscriptionWithPlan returns the current user subscription joined with its plan.
func (s *SubscriptionService) GetUserSubscriptionWithPlan(ctx context.Context, userID string) (*models.SubscriptionWithPlan, error) {
	query := `
		SELECT
			sub.id, sub.user_id, sub.plan_id, sub.branch_id, sub.status,
			sub.start_date, sub.end_date, sub.renewal_date, sub.auto_renew,
			sub.payment_method, sub.notes, sub.cancelled_at, sub.created_at, sub.updated_at,
			sp.id, sp.name, sp.description, sp.price, sp.billing_period,
			sp.max_branches, sp.max_students, sp.max_classes, sp.features, sp.status
		FROM subscriptions sub
		JOIN subscription_plans sp ON sub.plan_id = sp.id
		WHERE sub.user_id = $1
		  AND sub.status IN ('active','trial','paused','pending_payment','past_due')
		ORDER BY sub.created_at DESC
		LIMIT 1
	`
	var v models.SubscriptionWithPlan
	v.Plan = &models.SubscriptionPlan{}
	err := s.database.GetConn().QueryRowContext(ctx, query, userID).Scan(
		&v.ID, &v.UserID, &v.PlanID, &v.BranchID, &v.Status,
		&v.StartDate, &v.EndDate, &v.RenewalDate, &v.AutoRenew,
		&v.PaymentMethod, &v.Notes, &v.CancelledAt, &v.CreatedAt, &v.UpdatedAt,
		&v.Plan.ID, &v.Plan.Name, &v.Plan.Description, &v.Plan.Price, &v.Plan.BillingPeriod,
		&v.Plan.MaxBranches, &v.Plan.MaxStudents, &v.Plan.MaxClasses, &v.Plan.Features, &v.Plan.Status,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get user subscription with plan: %w", err)
	}
	return &v, nil
}

// GetPlatformStats returns aggregate subscription/revenue statistics.
func (s *SubscriptionService) GetPlatformStats(ctx context.Context) (*models.PlatformStats, error) {
	stats := &models.PlatformStats{}

	err := s.database.GetConn().QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status = 'active')                      AS active,
			COUNT(*) FILTER (WHERE status = 'trial')                       AS trial,
			COUNT(*) FILTER (WHERE status IN ('expired','cancelled'))       AS expired,
			COUNT(*) FILTER (WHERE status = 'pending_payment')             AS pending,
			COUNT(*)                                                        AS total
		FROM subscriptions
	`).Scan(&stats.ActiveSubscriptions, &stats.TrialSubscriptions, &stats.ExpiredSubscriptions,
		&stats.PendingSubscriptions, &stats.TotalSubscriptions)
	if err != nil {
		return nil, fmt.Errorf("platform stats: %w", err)
	}

	// MRR: sum of active monthly price; yearly plans divided by 12
	err = s.database.GetConn().QueryRowContext(ctx, `
		SELECT COALESCE(SUM(
			CASE sp.billing_period
				WHEN 'yearly'  THEN sp.price / 12.0
				ELSE                sp.price
			END
		), 0)
		FROM subscriptions sub
		JOIN subscription_plans sp ON sub.plan_id = sp.id
		WHERE sub.status = 'active'
	`).Scan(&stats.MRR)
	if err != nil {
		return nil, fmt.Errorf("platform stats MRR: %w", err)
	}

	err = s.database.GetConn().QueryRowContext(ctx,
		`SELECT COUNT(*) FROM users`).Scan(&stats.TotalUsers)
	if err != nil {
		return nil, fmt.Errorf("platform stats users: %w", err)
	}

	return stats, nil
}

// IsUserSubscriptionActive is a lightweight check used by the gating middleware.
// Returns true only when the user has an active or trial subscription that has
// not yet passed its end_date. This catches the case where the end_date expired
// but the status was never updated to 'expired' via the background job.
func (s *SubscriptionService) IsUserSubscriptionActive(ctx context.Context, userID string) (bool, error) {
	if s.cache != nil {
		cacheKey := fmt.Sprintf("crm:sub_active:%s", userID)
		var cached bool
		if hit, _ := s.cache.Get(ctx, cacheKey, &cached); hit {
			return cached, nil
		}
		active, err := s.isUserSubscriptionActiveDB(ctx, userID)
		if err == nil {
			_ = s.cache.Set(ctx, cacheKey, active, subActiveCacheTTL)
		}
		return active, err
	}
	return s.isUserSubscriptionActiveDB(ctx, userID)
}

func (s *SubscriptionService) isUserSubscriptionActiveDB(ctx context.Context, userID string) (bool, error) {
	var count int
	err := s.database.GetConn().QueryRowContext(ctx, `
		SELECT COUNT(*) FROM subscriptions
		WHERE user_id = $1
		  AND status IN ('active','trial')
		  AND (end_date IS NULL OR end_date > NOW())
	`, userID).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check subscription active: %w", err)
	}
	return count > 0, nil
}

// ErrSubscriptionLimitReached is returned by CheckResourceLimit when the tenant
// has reached their plan quota for the given resource type.
var ErrSubscriptionLimitReached = fmt.Errorf("subscription_limit_reached")

// GetOwnerIDFromBranch resolves the admin (school owner) user_id for the branch.
func (s *SubscriptionService) GetOwnerIDFromBranch(ctx context.Context, branchID string) (string, error) {
	var adminID string
	err := s.database.GetConn().QueryRowContext(ctx,
		`SELECT COALESCE(admin_id::text,'') FROM branches WHERE id = $1`, branchID,
	).Scan(&adminID)
	if err == sql.ErrNoRows || adminID == "" {
		return "", fmt.Errorf("branch %s not found or has no admin", branchID)
	}
	return adminID, err
}

// CheckResourceLimit verifies the tenant has not exceeded the plan quota for the
// given metric ("students", "classes", or "branches"). It counts live records
// directly in the DB rather than relying on the subscription_usage cache, so it
// is always consistent even if the cache is stale.
//
// ownerUserID is the school admin's user_id (resolved from the branch before call).
// Returns ErrSubscriptionLimitReached when the quota is full; nil when OK.
func (s *SubscriptionService) CheckResourceLimit(ctx context.Context, ownerUserID, metric string) error {
	sub, err := s.GetUserSubscriptionWithPlan(ctx, ownerUserID)
	if err != nil {
		return fmt.Errorf("CheckResourceLimit: fetch subscription: %w", err)
	}
	if sub == nil || sub.Plan == nil {
		// No active subscription — SubscriptionGate will block the request.
		return nil
	}

	var limitPtr *int
	switch metric {
	case "students":
		limitPtr = sub.Plan.MaxStudents
	case "classes":
		limitPtr = sub.Plan.MaxClasses
	case "branches":
		limitPtr = sub.Plan.MaxBranches
	default:
		return fmt.Errorf("CheckResourceLimit: unknown metric %q", metric)
	}

	if limitPtr == nil {
		// nil limit means unlimited.
		return nil
	}
	limit := *limitPtr

	var currentCount int
	switch metric {
	case "students":
		err = s.database.GetConn().QueryRowContext(ctx, `
			SELECT COUNT(*) FROM students
			WHERE branch_id IN (SELECT id FROM branches WHERE admin_id = $1)
			  AND status != 'left'
		`, ownerUserID).Scan(&currentCount)
	case "classes":
		err = s.database.GetConn().QueryRowContext(ctx, `
			SELECT COUNT(*) FROM classes
			WHERE branch_id IN (SELECT id FROM branches WHERE admin_id = $1)
		`, ownerUserID).Scan(&currentCount)
	case "branches":
		err = s.database.GetConn().QueryRowContext(ctx, `
			SELECT COUNT(*) FROM branches WHERE admin_id = $1
		`, ownerUserID).Scan(&currentCount)
	}
	if err != nil {
		return fmt.Errorf("CheckResourceLimit: count %s: %w", metric, err)
	}

	if currentCount >= limit {
		return fmt.Errorf("%w: %s limit is %d (currently %d)",
			ErrSubscriptionLimitReached, metric, limit, currentCount)
	}
	return nil
}

// GetSubscriptionPlanByID retrieves a single plan by ID.
func (s *SubscriptionService) GetSubscriptionPlanByID(ctx context.Context, planID string) (*models.SubscriptionPlan, error) {
	query := `
		SELECT id, name, description, price, billing_period, max_branches, max_students, max_classes, features, status, created_at, updated_at
		FROM subscription_plans WHERE id = $1
	`
	var p models.SubscriptionPlan
	err := s.database.GetConn().QueryRowContext(ctx, query, planID).Scan(
		&p.ID, &p.Name, &p.Description, &p.Price, &p.BillingPeriod,
		&p.MaxBranches, &p.MaxStudents, &p.MaxClasses, &p.Features, &p.Status,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get plan by id: %w", err)
	}
	return &p, nil
}

// GetAllSubscriptionPlans returns all plans (active and inactive) for admin use.
func (s *SubscriptionService) GetAllSubscriptionPlans(ctx context.Context) ([]models.SubscriptionPlan, error) {
	query := `
		SELECT id, name, description, price, billing_period, max_branches, max_students, max_classes, features, status, created_at, updated_at
		FROM subscription_plans ORDER BY price ASC
	`
	rows, err := s.database.GetConn().QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("get all plans: %w", err)
	}
	defer rows.Close()

	var plans []models.SubscriptionPlan
	for rows.Next() {
		var p models.SubscriptionPlan
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.BillingPeriod,
			&p.MaxBranches, &p.MaxStudents, &p.MaxClasses, &p.Features, &p.Status,
			&p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("plan scan: %w", err)
		}
		plans = append(plans, p)
	}
	return plans, rows.Err()
}

// HasUsedTrial returns true if the user already has or had a free trial.
func (s *SubscriptionService) HasUsedTrial(ctx context.Context, userID string) (bool, error) {
	var count int
	err := s.database.GetConn().QueryRowContext(ctx, `
		SELECT COUNT(*) FROM subscriptions
		WHERE user_id = $1 AND payment_method = 'free_trial'
	`, userID).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("check trial used: %w", err)
	}
	return count > 0, nil
}

// AdminGrantTrial creates a new trial subscription for the given user regardless
// of whether they have used a trial before (developer override).
// It expires any existing active/trial subscription first to avoid conflicts.
func (s *SubscriptionService) AdminGrantTrial(ctx context.Context, userID string, days int, notes string) (*models.AdminSubscriptionView, error) {
	trialPlan, err := s.GetOrCreateFreeTrial(ctx)
	if err != nil {
		return nil, fmt.Errorf("admin grant trial: get plan: %w", err)
	}

	// Expire any existing non-terminal subscriptions for this user. Includes
	// past_due (previously omitted) — GetUserSubscriptionWithPlan treats
	// past_due as a live state, so leaving it out could land a user with
	// two simultaneously non-terminal rows that never reconcile.
	_, err = s.database.GetConn().ExecContext(ctx, `
		UPDATE subscriptions
		SET status = 'expired', updated_at = NOW()
		WHERE user_id = $1 AND status IN ('active', 'trial', 'paused', 'pending_payment', 'past_due')
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("admin grant trial: expire old: %w", err)
	}

	now := time.Now().UTC()
	if days <= 0 {
		days = 14
	}
	endDate := now.AddDate(0, 0, days)
	pm := "free_trial"

	var id string
	err = s.database.GetConn().QueryRowContext(ctx, `
		INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date, renewal_date, auto_renew, payment_method, notes)
		VALUES ($1, $2, 'trial', $3, $4, $4, false, $5, $6)
		RETURNING id
	`, userID, trialPlan.ID, now, endDate, pm, notes).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("admin grant trial: insert: %w", err)
	}

	// Update trial_used_at so one-time check reflects developer override
	_, _ = s.database.GetConn().ExecContext(ctx,
		`UPDATE users SET trial_used_at = NOW() WHERE id = $1`, userID)

	if s.cache != nil {
		_ = s.cache.Delete(ctx, fmt.Sprintf("crm:sub_active:%s", userID))
	}

	return s.AdminGetSubscription(ctx, id)
}

// ─────────────────────────────────────────────────────────────
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
