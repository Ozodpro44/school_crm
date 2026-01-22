package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// SubscriptionPlan represents a subscription plan
type SubscriptionPlan struct {
	ID              string     `json:"id" db:"id"`
	Name            string     `json:"name" db:"name"`
	Description     *string    `json:"description" db:"description"`
	Price           float64    `json:"price" db:"price"`
	BillingPeriod   string     `json:"billingPeriod" db:"billing_period"` // monthly, yearly (accept camelCase from frontend)
	MaxBranches     *int       `json:"maxBranches" db:"max_branches"`
	MaxStudents     *int       `json:"maxStudents" db:"max_students"`
	MaxClasses      *int       `json:"maxClasses" db:"max_classes"`
	Features        JSONMap    `json:"features" db:"features"`
	Status          string     `json:"status" db:"status"` // active, inactive
	CreatedAt       time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time  `json:"updatedAt" db:"updated_at"`
}

// Subscription represents a user's subscription
type Subscription struct {
	ID                    string     `json:"id" db:"id"`
	UserID                string     `json:"user_id" db:"user_id"`
	PlanID                string     `json:"plan_id" db:"plan_id"`
	BranchID              *string    `json:"branch_id" db:"branch_id"`
	Status                string     `json:"status" db:"status"` // active, paused, cancelled, expired
	StartDate             time.Time  `json:"start_date" db:"start_date"`
	EndDate               *time.Time `json:"end_date" db:"end_date"`
	RenewalDate           *time.Time `json:"renewal_date" db:"renewal_date"`
	AutoRenew             bool       `json:"auto_renew" db:"auto_renew"`
	PaymentMethod         *string    `json:"payment_method" db:"payment_method"`
	StripeSubscriptionID  *string    `json:"stripe_subscription_id" db:"stripe_subscription_id"`
	Notes                 *string    `json:"notes" db:"notes"`
	CancelledAt           *time.Time `json:"cancelled_at" db:"cancelled_at"`
	CancelledBy           *string    `json:"cancelled_by" db:"cancelled_by"`
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at" db:"updated_at"`
}

// SubscriptionUsage tracks usage against subscription plan limits
type SubscriptionUsage struct {
	ID               string     `json:"id" db:"id"`
	SubscriptionID   string     `json:"subscription_id" db:"subscription_id"`
	MetricName       string     `json:"metric_name" db:"metric_name"` // branches, students, classes
	CurrentUsage     int        `json:"current_usage" db:"current_usage"`
	LimitValue       *int       `json:"limit_value" db:"limit_value"`
	ResetDate        *time.Time `json:"reset_date" db:"reset_date"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
}

// SubscriptionPayment records a subscription payment/charge
type SubscriptionPayment struct {
	ID              string     `json:"id" db:"id"`
	SubscriptionID  string     `json:"subscription_id" db:"subscription_id"`
	Amount          float64    `json:"amount" db:"amount"`
	Currency        string     `json:"currency" db:"currency"`
	Status          string     `json:"status" db:"status"` // pending, completed, failed, refunded
	PaymentDate     *time.Time `json:"payment_date" db:"payment_date"`
	InvoiceNumber   *string    `json:"invoice_number" db:"invoice_number"`
	StripePaymentID *string    `json:"stripe_payment_id" db:"stripe_payment_id"`
	ClickPaymentID  *string    `json:"click_payment_id" db:"click_payment_id"`
	PaymentMethod   *string    `json:"payment_method" db:"payment_method"`
	Notes           *string    `json:"notes" db:"notes"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

// JSONMap is a custom type for JSONB fields
type JSONMap map[string]interface{}

// Scan implements the sql.Scanner interface
func (j JSONMap) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return json.Unmarshal([]byte("{}"), &j)
	}
	return json.Unmarshal(bytes, &j)
}

// Value implements the driver.Valuer interface
func (j JSONMap) Value() (driver.Value, error) {
	return json.Marshal(j)
}

// Request/Response DTOs

// CreateSubscriptionRequest DTO
type CreateSubscriptionRequest struct {
	PlanID        string `json:"plan_id" binding:"required"`
	BranchID      *string `json:"branch_id"`
	PaymentMethod string `json:"payment_method"`
	Notes         *string `json:"notes"`
}

// UpdateSubscriptionStatusRequest DTO
type UpdateSubscriptionStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=active paused cancelled"`
}

// SubscriptionPaymentRequest DTO
type SubscriptionPaymentRequest struct {
	Amount        float64 `json:"amount" binding:"required,gt=0"`
	PaymentMethod string  `json:"payment_method" binding:"required"`
	Notes         *string `json:"notes"`
}

// SubscriptionResponse DTO with plan details
type SubscriptionResponse struct {
	*Subscription
	Plan *SubscriptionPlan `json:"plan,omitempty"`
}
