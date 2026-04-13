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

	_, err := s.db.GetConn().ExecContext(ctx, query, branch.ID, branch.Name, branch.Address, branch.Phone, branch.MonthlyPayment, branch.Currency, branch.AdminID, branch.CreatedAt, branch.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Create initial financial month for the branch
	financialMonthService := NewFinancialMonthService(s.db)
	financialMonth, err := financialMonthService.Create(ctx, branchID, now.Year(), int(now.Month()))
	if err != nil {
		// Log error but don't fail the branch creation
		fmt.Printf("Warning: failed to create initial financial month for branch %s: %v\n", branchID, err)
	} else {
		// Update branch with current_financial_month_id
		_, err = s.db.GetConn().ExecContext(ctx, 
			"UPDATE branches SET current_financial_month_id = $1 WHERE id = $2",
			financialMonth.ID, branchID)
		if err != nil {
			fmt.Printf("Warning: failed to update branch current_financial_month_id: %v\n", err)
		}
		branch.CurrentFinancialMonthID = &financialMonth.ID
		branch.CurrentFinancialMonth = financialMonth
	}

	return branch, nil
}

func (s *BranchService) GetByID(ctx context.Context, id string) (*models.Branch, error) {
	branch := &models.Branch{}
	query := `SELECT id, name, address, phone, monthly_payment, currency, admin_id, current_financial_month_id, created_at, updated_at FROM branches WHERE id = $1`

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
	query := `SELECT id, name, address, phone, monthly_payment, currency, admin_id, current_financial_month_id, created_at, updated_at FROM branches ORDER BY name`

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
	query := `SELECT id, name, address, phone, monthly_payment, currency, admin_id, current_financial_month_id, created_at, updated_at FROM branches WHERE admin_id = $1 ORDER BY name`

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

	_, err := s.db.GetConn().ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	// If monthly_payment was updated, also update all students in this branch to match
	if monthlyPayment, ok := updates["monthly_payment"]; ok {
		studentQuery := `UPDATE students SET monthly_payment = $1, updated_at = $2 WHERE branch_id = $3`
		_, err := s.db.GetConn().ExecContext(ctx, studentQuery, monthlyPayment, now, id)
		if err != nil {
			return nil, err
		}
	}

	return s.GetByID(ctx, id)
}

func (s *BranchService) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM branches WHERE id = $1`
	_, err := s.db.GetConn().ExecContext(ctx, query, id)
	return err
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
