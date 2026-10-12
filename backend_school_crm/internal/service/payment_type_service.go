package service

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

// PaymentTypeService manages the payment_types registry.
type PaymentTypeService struct {
	db *db.Database
}

func NewPaymentTypeService(database *db.Database) *PaymentTypeService {
	return &PaymentTypeService{db: database}
}

func scanPT(r *sql.Row) (*models.PaymentType, error) {
	var pt models.PaymentType
	err := r.Scan(
		&pt.ID, &pt.Code, &pt.DisplayName, &pt.Description,
		&pt.IsActive, &pt.IsSystem, &pt.SortOrder, &pt.Config,
		&pt.CreatedAt, &pt.UpdatedAt,
	)
	return &pt, err
}

func scanPTRow(rows *sql.Rows) (*models.PaymentType, error) {
	var pt models.PaymentType
	err := rows.Scan(
		&pt.ID, &pt.Code, &pt.DisplayName, &pt.Description,
		&pt.IsActive, &pt.IsSystem, &pt.SortOrder, &pt.Config,
		&pt.CreatedAt, &pt.UpdatedAt,
	)
	return &pt, err
}

const ptCols = `id, code, display_name, description, is_active, is_system, sort_order, config, created_at, updated_at`

// GetAll returns all payment types ordered by sort_order.
func (s *PaymentTypeService) GetAll(ctx context.Context) ([]models.PaymentType, error) {
	rows, err := s.db.GetConn().QueryContext(ctx,
		`SELECT `+ptCols+` FROM payment_types ORDER BY sort_order, code`)
	if err != nil {
		return nil, fmt.Errorf("payment_type getall: %w", err)
	}
	defer rows.Close()

	result := make([]models.PaymentType, 0)
	for rows.Next() {
		pt, err := scanPTRow(rows)
		if err != nil {
			return nil, fmt.Errorf("payment_type scan: %w", err)
		}
		result = append(result, *pt)
	}
	return result, rows.Err()
}

// GetActive returns active payment types excluding free_trial (public/billing UI).
func (s *PaymentTypeService) GetActive(ctx context.Context) ([]models.PaymentType, error) {
	rows, err := s.db.GetConn().QueryContext(ctx,
		`SELECT `+ptCols+` FROM payment_types WHERE is_active = true AND code != 'free_trial' ORDER BY sort_order, code`)
	if err != nil {
		return nil, fmt.Errorf("payment_type getactive: %w", err)
	}
	defer rows.Close()

	result := make([]models.PaymentType, 0)
	for rows.Next() {
		pt, err := scanPTRow(rows)
		if err != nil {
			return nil, fmt.Errorf("payment_type scan: %w", err)
		}
		result = append(result, *pt)
	}
	return result, rows.Err()
}

// GetByID returns a single payment type.
func (s *PaymentTypeService) GetByID(ctx context.Context, id string) (*models.PaymentType, error) {
	pt, err := scanPT(s.db.GetConn().QueryRowContext(ctx,
		`SELECT `+ptCols+` FROM payment_types WHERE id = $1`, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("payment_type get: %w", err)
	}
	return pt, nil
}

// Create inserts a new (non-system) payment type.
func (s *PaymentTypeService) Create(ctx context.Context, req *models.CreatePaymentTypeRequest) (*models.PaymentType, error) {
	config := req.Config
	if config == nil {
		config = models.JSONMap{}
	}
	var pt models.PaymentType
	err := s.db.GetConn().QueryRowContext(ctx, `
		INSERT INTO payment_types (code, display_name, description, is_active, is_system, sort_order, config)
		VALUES ($1, $2, $3, $4, false, $5, $6)
		RETURNING `+ptCols,
		req.Code, req.DisplayName, req.Description, req.IsActive, req.SortOrder, config,
	).Scan(
		&pt.ID, &pt.Code, &pt.DisplayName, &pt.Description,
		&pt.IsActive, &pt.IsSystem, &pt.SortOrder, &pt.Config,
		&pt.CreatedAt, &pt.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("payment_type create: %w", err)
	}
	return &pt, nil
}

// Update applies partial updates to a payment type.
func (s *PaymentTypeService) Update(ctx context.Context, id string, req *models.UpdatePaymentTypeRequest) (*models.PaymentType, error) {
	_, err := s.db.GetConn().ExecContext(ctx, `
		UPDATE payment_types SET
			display_name = COALESCE($1, display_name),
			description  = COALESCE($2, description),
			is_active    = COALESCE($3, is_active),
			sort_order   = COALESCE($4, sort_order),
			updated_at   = $5
		WHERE id = $6
	`, req.DisplayName, req.Description, req.IsActive, req.SortOrder, time.Now(), id)
	if err != nil {
		return nil, fmt.Errorf("payment_type update: %w", err)
	}
	return s.GetByID(ctx, id)
}

// ToggleActive flips the is_active flag of a payment type (system types allowed).
func (s *PaymentTypeService) ToggleActive(ctx context.Context, id string) (*models.PaymentType, error) {
	_, err := s.db.GetConn().ExecContext(ctx, `
		UPDATE payment_types SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1
	`, id)
	if err != nil {
		return nil, fmt.Errorf("payment_type toggle: %w", err)
	}
	return s.GetByID(ctx, id)
}

// Delete removes a non-system payment type; returns error for system types.
func (s *PaymentTypeService) Delete(ctx context.Context, id string) error {
	res, err := s.db.GetConn().ExecContext(ctx, `
		DELETE FROM payment_types WHERE id = $1 AND is_system = false
	`, id)
	if err != nil {
		return fmt.Errorf("payment_type delete: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("payment type not found or is a system type that cannot be deleted")
	}
	return nil
}
