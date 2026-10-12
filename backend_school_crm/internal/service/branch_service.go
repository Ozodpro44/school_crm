package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/utils"
)

type BranchService struct {
	db     *db.Database
	subSvc *SubscriptionService
}

func NewBranchService(database *db.Database, subSvc *SubscriptionService) *BranchService {
	return &BranchService{db: database, subSvc: subSvc}
}

type CreateBranchRequest struct {
	Name           string  `json:"name" binding:"required"`
	Address        string  `json:"address" binding:"required"`
	Phone          string  `json:"phone" binding:"required"`
	MonthlyPayment float64 `json:"monthlyPayment" binding:"required,gt=0"`
	AdminID        *string `json:"adminId"`
	// OwnerID is populated by the handler from the authenticated user's JWT.
	// It is not read from the request body (json:"-") and is used for subscription
	// limit checks inside Create.
	OwnerID string `json:"-"`
}

func (s *BranchService) Create(ctx context.Context, req *CreateBranchRequest) (*models.Branch, error) {
	// Guard: subscription branch limit.
	if s.subSvc != nil && req.OwnerID != "" {
		if limitErr := s.subSvc.CheckResourceLimit(ctx, req.OwnerID, "branches"); limitErr != nil {
			return nil, limitErr
		}
	}

	now := time.Now().UTC()
	branchID := uuid.New().String()

	branch := &models.Branch{
		ID:             branchID,
		Name:           req.Name,
		Address:        req.Address,
		Phone:          req.Phone,
		MonthlyPayment: req.MonthlyPayment,
		Currency:       "UZS",
		AdminID:        req.AdminID,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	query := `INSERT INTO branches (id, name, address, phone, monthly_payment, currency, admin_id, created_at, updated_at)
	         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	// The branch and its initial financial month are created atomically: a
	// branch without a current month breaks every month-gated write.
	tx, err := s.db.BeginTx(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, query, branch.ID, branch.Name, branch.Address, branch.Phone, branch.MonthlyPayment, branch.Currency, branch.AdminID, branch.CreatedAt, branch.UpdatedAt); err != nil {
		return nil, err
	}

	financialMonthService := NewFinancialMonthService(s.db)
	financialMonth, err := financialMonthService.CreateWith(ctx, tx, branchID, now.Year(), int(now.Month()))
	if err != nil {
		return nil, fmt.Errorf("failed to create initial financial month: %w", err)
	}
	if _, err := tx.ExecContext(ctx,
		"UPDATE branches SET current_financial_month_id = $1 WHERE id = $2",
		financialMonth.ID, branchID); err != nil {
		return nil, fmt.Errorf("failed to set current financial month: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	branch.CurrentFinancialMonthID = &financialMonth.ID
	branch.CurrentFinancialMonth = financialMonth

	return branch, nil
}

func (s *BranchService) GetByID(ctx context.Context, id string) (*models.Branch, error) {
	branch := &models.Branch{}
	query := `SELECT id, name, COALESCE(address, ''), COALESCE(phone, ''), monthly_payment, currency, admin_id, current_financial_month_id, created_at, updated_at FROM branches WHERE id = $1 AND deleted_at IS NULL`

	err := s.db.GetConn().QueryRowContext(ctx, query, id).Scan(
		&branch.ID, &branch.Name, &branch.Address, &branch.Phone, &branch.MonthlyPayment, &branch.Currency, &branch.AdminID, &branch.CurrentFinancialMonthID, &branch.CreatedAt, &branch.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("branch not found")
	}

	// Load current financial month if ID exists
	if branch.CurrentFinancialMonthID != nil {
		financialMonthService := NewFinancialMonthService(s.db)
		fm, err := financialMonthService.GetByID(ctx, *branch.CurrentFinancialMonthID)
		if err == nil {
			branch.CurrentFinancialMonth = fm
		}
	}

	return branch, err
}

func (s *BranchService) GetAll(ctx context.Context) ([]models.Branch, error) {
	query := `SELECT id, name, COALESCE(address, ''), COALESCE(phone, ''), monthly_payment, currency, admin_id, current_financial_month_id, created_at, updated_at FROM branches WHERE deleted_at IS NULL ORDER BY name`

	rows, err := s.db.GetConn().QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var branches []models.Branch
	for rows.Next() {
		var branch models.Branch
		if err := rows.Scan(&branch.ID, &branch.Name, &branch.Address, &branch.Phone, &branch.MonthlyPayment, &branch.Currency, &branch.AdminID, &branch.CurrentFinancialMonthID, &branch.CreatedAt, &branch.UpdatedAt); err != nil {
			return nil, err
		}

		// Load current financial month if ID exists
		if branch.CurrentFinancialMonthID != nil {
			financialMonthService := NewFinancialMonthService(s.db)
			fm, err := financialMonthService.GetByID(ctx, *branch.CurrentFinancialMonthID)
			if err == nil {
				branch.CurrentFinancialMonth = fm
			}
		}

		branches = append(branches, branch)
	}

	return branches, rows.Err()
}

func (s *BranchService) GetByAdminID(ctx context.Context, adminID string) ([]models.Branch, error) {
	query := `SELECT id, name, COALESCE(address, ''), COALESCE(phone, ''), monthly_payment, currency, admin_id, current_financial_month_id, created_at, updated_at FROM branches WHERE admin_id = $1 AND deleted_at IS NULL ORDER BY name`

	rows, err := s.db.GetConn().QueryContext(ctx, query, adminID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var branches []models.Branch
	for rows.Next() {
		var branch models.Branch
		if err := rows.Scan(&branch.ID, &branch.Name, &branch.Address, &branch.Phone, &branch.MonthlyPayment, &branch.Currency, &branch.AdminID, &branch.CurrentFinancialMonthID, &branch.CreatedAt, &branch.UpdatedAt); err != nil {
			return nil, err
		}

		if branch.CurrentFinancialMonthID != nil {
			financialMonthService := NewFinancialMonthService(s.db)
			fm, err := financialMonthService.GetByID(ctx, *branch.CurrentFinancialMonthID)
			if err == nil {
				branch.CurrentFinancialMonth = fm
			}
		}

		branches = append(branches, branch)
	}

	return branches, rows.Err()
}

func (s *BranchService) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.Branch, error) {
	updates = utils.ConvertKeysToSnakeCase(updates)

	// Always update the timestamp fields
	now := time.Now().UTC()
	updates["updated_at"] = now

	query := `UPDATE branches SET `
	args := []interface{}{}
	argCount := 1

	for key, value := range updates {
		if argCount > 1 {
			query += ", "
		}
		query += key + " = $" + strconv.Itoa(argCount)
		args = append(args, value)
		argCount++
	}

	query += " WHERE id = $" + strconv.Itoa(argCount)
	args = append(args, id)

	// Branch update and the student fee cascade are one transaction.
	tx, err := s.db.BeginTx(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Lock the row and capture the OLD default before it is overwritten.
	var oldMonthly float64
	if err := tx.QueryRowContext(ctx, `SELECT monthly_payment FROM branches WHERE id = $1 FOR UPDATE`, id).Scan(&oldMonthly); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("branch not found")
		}
		return nil, err
	}

	if _, err := tx.ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}

	// If the default monthly_payment changed, move only the students who are
	// still on the OLD default; individually negotiated fees are left alone.
	if monthlyPayment, ok := updates["monthly_payment"]; ok {
		studentQuery := `UPDATE students SET monthly_payment = $1, updated_at = $2
		                 WHERE branch_id = $3 AND monthly_payment = $4`
		if _, err := tx.ExecContext(ctx, studentQuery, monthlyPayment, now, id, oldMonthly); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetByID(ctx, id)
}

// Delete soft-deletes the branch: recoverable via Restore for 30 days
// (this path is developer-portal-only — see RegisterDevCRMRoutes — so the
// platform-wide 30-day window always applies, not the 7-day one). branches
// cascade-deletes into nearly every other table (classes, students,
// teachers, payments, salaries, expenses, attendance, ...), so a hard
// DELETE here could wipe a school's whole history — this mirrors the same
// fix already applied to user_service's own, separate copy of BranchService
// for the regular (non-dev) delete path.
func (s *BranchService) Delete(ctx context.Context, id string) error {
	query := `UPDATE branches SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`
	res, err := s.db.GetConn().ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errors.New("branch not found")
	}
	return nil
}

// Restore un-deletes a branch soft-deleted within the last 30 days.
func (s *BranchService) Restore(ctx context.Context, id string) error {
	query := `UPDATE branches SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL`
	res, err := s.db.GetConn().ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errors.New("branch not found in trash")
	}
	return nil
}

// TrashedBranch is a monolith Branch soft-deleted within the last 30 days.
type TrashedBranch struct {
	models.Branch
	DeletedAt time.Time `json:"deletedAt"`
}

// ListTrash returns branches soft-deleted within the last 30 days, platform-wide.
func (s *BranchService) ListTrash(ctx context.Context) ([]TrashedBranch, error) {
	query := `SELECT id, name, COALESCE(address, ''), COALESCE(phone, ''), monthly_payment, currency, admin_id, created_at, updated_at, deleted_at
	          FROM branches WHERE deleted_at IS NOT NULL AND deleted_at > now() - interval '30 days'
	          ORDER BY deleted_at DESC`
	rows, err := s.db.GetConn().QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []TrashedBranch
	for rows.Next() {
		var b TrashedBranch
		if err := rows.Scan(&b.ID, &b.Name, &b.Address, &b.Phone, &b.MonthlyPayment, &b.Currency, &b.AdminID, &b.CreatedAt, &b.UpdatedAt, &b.DeletedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// SwitchMonth advances the branch to the next month (Admin only)
func (s *BranchService) SwitchMonth(ctx context.Context, id string) (*models.Branch, error) {
	// Get current branch
	branch, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Use financial month service to close the month
	if branch.CurrentFinancialMonthID == nil {
		return nil, fmt.Errorf("branch has no current financial month")
	}

	financialMonthService := NewFinancialMonthService(s.db)
	_, err = financialMonthService.CloseMonth(ctx, id)
	if err != nil {
		return nil, err
	}

	return s.GetByID(ctx, id)
}

// GetCurrentMonth returns the current month and year for a branch
func (s *BranchService) GetCurrentMonth(ctx context.Context, id string) (string, int, error) {
	branch, err := s.GetByID(ctx, id)
	if err != nil {
		return "", 0, err
	}

	if branch.CurrentFinancialMonth == nil {
		return "", 0, fmt.Errorf("branch has no current financial month")
	}

	monthStr := fmt.Sprintf("%02d", branch.CurrentFinancialMonth.Month)
	return monthStr, branch.CurrentFinancialMonth.Year, nil
}
