package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type FinancialMonthService struct {
	db *db.Database
}

func NewFinancialMonthService(database *db.Database) *FinancialMonthService {
	return &FinancialMonthService{
		db: database,
	}
}

// GetOrCreateCurrentMonth gets or creates the current financial month for a branch
func (s *FinancialMonthService) GetOrCreateCurrentMonth(ctx context.Context, branchID string) (*models.FinancialMonth, error) {
	now := time.Now()
	year := now.Year()
	month := int(now.Month())

	// Try to get existing month
	// An existing row is returned as-is, even when it is CLOSED: a closed
	// month must never be silently reopened.
	month_obj, err := s.GetByBranchAndYearMonth(ctx, branchID, year, month)
	if err == nil && month_obj != nil {
		return month_obj, nil
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	// Create new month if it doesn't exist
	return s.Create(ctx, branchID, year, month)
}

// monthQuerier is the subset of *sql.DB / *sql.Tx needed to create a month.
type monthQuerier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Create creates a new financial month (or returns the existing one).
func (s *FinancialMonthService) Create(ctx context.Context, branchID string, year, month int) (*models.FinancialMonth, error) {
	return s.CreateWith(ctx, s.db.GetConn(), branchID, year, month)
}

// CreateWith is Create on a caller-supplied connection or transaction, so a
// caller (e.g. BranchService.Create) can make it atomic with its own writes.
//
// On conflict the existing row is returned UNCHANGED - in particular a CLOSED
// month stays closed. (The previous ON CONFLICT DO UPDATE overwrote status
// with 'OPEN', silently reopening a reconciled month.)
func (s *FinancialMonthService) CreateWith(ctx context.Context, q monthQuerier, branchID string, year, month int) (*models.FinancialMonth, error) {
	id := uuid.New().String()

	// Get branch's monthly payment
	var paymentAmount float64
	err := q.QueryRowContext(ctx, "SELECT monthly_payment FROM branches WHERE id = $1", branchID).Scan(&paymentAmount)
	if err != nil {
		return nil, fmt.Errorf("failed to get branch payment amount: %w", err)
	}

	query := `
		INSERT INTO financial_months (id, branch_id, year, month, status, payment_amount, opened_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (branch_id, year, month) DO UPDATE
		SET updated_at = financial_months.updated_at
		RETURNING id, branch_id, year, month, status, payment_amount, opened_at, closed_at, created_at, updated_at
	`

	fm := &models.FinancialMonth{}
	err = q.QueryRowContext(ctx, query, id, branchID, year, month, models.MonthStatusOpen, paymentAmount, time.Now()).
		Scan(&fm.ID, &fm.BranchID, &fm.Year, &fm.Month, &fm.Status, &fm.PaymentAmount, &fm.OpenedAt, &fm.ClosedAt, &fm.CreatedAt, &fm.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create financial month: %w", err)
	}

	return fm, nil
}

// GetByID gets a financial month by ID
func (s *FinancialMonthService) GetByID(ctx context.Context, id string) (*models.FinancialMonth, error) {
	fm := &models.FinancialMonth{}
	err := s.db.GetConn().QueryRowContext(ctx, `
		SELECT id, branch_id, year, month, status, payment_amount, opened_at, closed_at, created_at, updated_at
		FROM financial_months
		WHERE id = $1
	`, id).Scan(&fm.ID, &fm.BranchID, &fm.Year, &fm.Month, &fm.Status, &fm.PaymentAmount, &fm.OpenedAt, &fm.ClosedAt, &fm.CreatedAt, &fm.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return fm, nil
}

// GetByBranchAndYearMonth gets a financial month by branch, year, and month
func (s *FinancialMonthService) GetByBranchAndYearMonth(ctx context.Context, branchID string, year, month int) (*models.FinancialMonth, error) {
	fm := &models.FinancialMonth{}
	err := s.db.GetConn().QueryRowContext(ctx, `
		SELECT id, branch_id, year, month, status, payment_amount, opened_at, closed_at, created_at, updated_at
		FROM financial_months
		WHERE branch_id = $1 AND year = $2 AND month = $3
	`, branchID, year, month).Scan(&fm.ID, &fm.BranchID, &fm.Year, &fm.Month, &fm.Status, &fm.PaymentAmount, &fm.OpenedAt, &fm.ClosedAt, &fm.CreatedAt, &fm.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return fm, nil
}

// GetCurrentOpenMonth gets the current OPEN month for a branch
func (s *FinancialMonthService) GetCurrentOpenMonth(ctx context.Context, branchID string) (*models.FinancialMonth, error) {
	fm := &models.FinancialMonth{}
	err := s.db.GetConn().QueryRowContext(ctx, `
		SELECT id, branch_id, year, month, status, payment_amount, opened_at, closed_at, created_at, updated_at
		FROM financial_months
		WHERE branch_id = $1 AND status = $2
		ORDER BY opened_at DESC
		LIMIT 1
	`, branchID, models.MonthStatusOpen).Scan(&fm.ID, &fm.BranchID, &fm.Year, &fm.Month, &fm.Status, &fm.PaymentAmount, &fm.OpenedAt, &fm.ClosedAt, &fm.CreatedAt, &fm.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return fm, nil
}

// ListByBranch lists all financial months for a branch
func (s *FinancialMonthService) ListByBranch(ctx context.Context, branchID string) ([]models.FinancialMonth, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT id, branch_id, year, month, status, payment_amount, opened_at, closed_at, created_at, updated_at
		FROM financial_months
		WHERE branch_id = $1
		ORDER BY year DESC, month DESC
	`, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var months []models.FinancialMonth
	for rows.Next() {
		fm := models.FinancialMonth{}
		err := rows.Scan(&fm.ID, &fm.BranchID, &fm.Year, &fm.Month, &fm.Status, &fm.PaymentAmount, &fm.OpenedAt, &fm.ClosedAt, &fm.CreatedAt, &fm.UpdatedAt)
		if err != nil {
			return nil, err
		}
		months = append(months, fm)
	}

	return months, rows.Err()
}

// CloseMonth closes current month and opens next one (transactional)
func (s *FinancialMonthService) CloseMonth(ctx context.Context, branchID string) (*models.FinancialMonth, error) {
	tx, err := s.db.BeginTx(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Get current open month
	var currentID string
	var currentYear, currentMonth int
	err = tx.QueryRowContext(ctx, `
		SELECT id, year, month FROM financial_months
		WHERE branch_id = $1 AND status = $2
		ORDER BY opened_at DESC LIMIT 1
	`, branchID, models.MonthStatusOpen).Scan(&currentID, &currentYear, &currentMonth)
	if err != nil {
		return nil, fmt.Errorf("failed to get current month: %w", err)
	}

	// Close current month
	_, err = tx.ExecContext(ctx, `
		UPDATE financial_months
		SET status = $1, closed_at = $2, updated_at = $3
		WHERE id = $4
	`, models.MonthStatusClosed, time.Now(), time.Now(), currentID)
	if err != nil {
		return nil, fmt.Errorf("failed to close month: %w", err)
	}

	// Calculate next month
	nextMonth := currentMonth + 1
	nextYear := currentYear
	if nextMonth > 12 {
		nextMonth = 1
		nextYear++
	}

	// Create new month
	nextID := uuid.New().String()
	var paymentAmount float64
	err = tx.QueryRowContext(ctx, "SELECT monthly_payment FROM branches WHERE id = $1", branchID).Scan(&paymentAmount)
	if err != nil {
		return nil, fmt.Errorf("failed to get branch payment: %w", err)
	}

	// ON CONFLICT DO NOTHING: the next month may already exist (e.g. created
	// ahead of time). Never overwrite it; resolve the surviving row's id and
	// make sure it is OPEN only if it was not already closed earlier.
	_, err = tx.ExecContext(ctx, `
		INSERT INTO financial_months (id, branch_id, year, month, status, payment_amount, opened_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (branch_id, year, month) DO NOTHING
	`, nextID, branchID, nextYear, nextMonth, models.MonthStatusOpen, paymentAmount, time.Now())
	if err != nil {
		return nil, fmt.Errorf("failed to create next month: %w", err)
	}
	var nextStatus string
	if err := tx.QueryRowContext(ctx, `
		SELECT id, status FROM financial_months WHERE branch_id = $1 AND year = $2 AND month = $3
	`, branchID, nextYear, nextMonth).Scan(&nextID, &nextStatus); err != nil {
		return nil, fmt.Errorf("failed to load next month: %w", err)
	}
	if nextStatus == string(models.MonthStatusClosed) {
		return nil, fmt.Errorf("next financial month %02d/%d is already closed", nextMonth, nextYear)
	}

	// Update branch's current_financial_month_id
	_, err = tx.ExecContext(ctx, `
		UPDATE branches SET current_financial_month_id = $1, updated_at = $2
		WHERE id = $3
	`, nextID, time.Now(), branchID)
	if err != nil {
		return nil, fmt.Errorf("failed to update branch: %w", err)
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Return new month
	fm := &models.FinancialMonth{}
	err = s.db.GetConn().QueryRowContext(ctx, `
		SELECT id, branch_id, year, month, status, payment_amount, opened_at, closed_at, created_at, updated_at
		FROM financial_months
		WHERE id = $1
	`, nextID).Scan(&fm.ID, &fm.BranchID, &fm.Year, &fm.Month, &fm.Status, &fm.PaymentAmount, &fm.OpenedAt, &fm.ClosedAt, &fm.CreatedAt, &fm.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("month closed but failed to load the new month: %w", err)
	}

	return fm, nil
}

// IsMonthClosed checks if a month is closed
func (s *FinancialMonthService) IsMonthClosed(ctx context.Context, monthID string) (bool, error) {
	var status string
	err := s.db.GetConn().QueryRowContext(ctx, "SELECT status FROM financial_months WHERE id = $1", monthID).Scan(&status)
	if err != nil {
		return false, err
	}
	return status == string(models.MonthStatusClosed), nil
}
