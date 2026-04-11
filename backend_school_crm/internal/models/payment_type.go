package models

import "time"

// PaymentType is a developer-managed registry of accepted payment methods.
// The `code` column is the canonical string stored in subscriptions.payment_method.
type PaymentType struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	DisplayName string    `json:"displayName"`
	Description *string   `json:"description"`
	IsActive    bool      `json:"isActive"`
	IsSystem    bool      `json:"isSystem"` // system types cannot be deleted
	SortOrder   int       `json:"sortOrder"`
	Config      JSONMap   `json:"config"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// CreatePaymentTypeRequest is the payload for creating a new payment type.
type CreatePaymentTypeRequest struct {
	Code        string  `json:"code"        binding:"required"`
	DisplayName string  `json:"displayName" binding:"required"`
	Description *string `json:"description"`
	IsActive    bool    `json:"isActive"`
	SortOrder   int     `json:"sortOrder"`
	Config      JSONMap `json:"config"`
}

// UpdatePaymentTypeRequest allows partial updates of a payment type.
type UpdatePaymentTypeRequest struct {
	DisplayName *string  `json:"displayName"`
	Description *string  `json:"description"`
	IsActive    *bool    `json:"isActive"`
	SortOrder   *int     `json:"sortOrder"`
	Config      *JSONMap `json:"config"`
}
