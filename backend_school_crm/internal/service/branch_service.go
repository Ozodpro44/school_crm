package service

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/utils"
)

type BranchService struct {
	db *db.Database
}

func NewBranchService(database *db.Database) *BranchService {
	return &BranchService{db: database}
}

type CreateBranchRequest struct {
	Name           string  `json:"name" binding:"required"`
	Address        string  `json:"address" binding:"required"`
	Phone          string  `json:"phone" binding:"required"`
	MonthlyPayment float64 `json:"monthlyPayment" binding:"required,gt=0"`
	AdminID        *string `json:"adminId"`
}

func (s *BranchService) Create(ctx context.Context, req *CreateBranchRequest) (*models.Branch, error) {
	now := time.Now()
	branch := &models.Branch{
		ID:             uuid.New().String(),
		Name:           req.Name,
		Address:        req.Address,
		Phone:          req.Phone,
		MonthlyPayment: req.MonthlyPayment,
		Currency:       "UZS",
		AdminID:        req.AdminID,
		CreatedAt:      now,
		UpdatedAt:      now,
		CreatedDate:    now,
		UpdatedDate:    now,
	}

	query := `INSERT INTO branches (id, name, address, phone, monthly_payment, currency, admin_id, created_at, updated_at, created_date, updated_date)
	         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`

	_, err := s.db.GetConn().ExecContext(ctx, query, branch.ID, branch.Name, branch.Address, branch.Phone, branch.MonthlyPayment, branch.Currency, branch.AdminID, branch.CreatedAt, branch.UpdatedAt, branch.CreatedDate, branch.UpdatedDate)
	if err != nil {
		return nil, err
	}

	return branch, nil
}

func (s *BranchService) GetByID(ctx context.Context, id string) (*models.Branch, error) {
	branch := &models.Branch{}
	query := `SELECT id, name, address, phone, monthly_payment, currency, admin_id, created_at, updated_at, created_date, updated_date FROM branches WHERE id = $1`

	err := s.db.GetConn().QueryRowContext(ctx, query, id).Scan(
		&branch.ID, &branch.Name, &branch.Address, &branch.Phone, &branch.MonthlyPayment, &branch.Currency, &branch.AdminID, &branch.CreatedAt, &branch.UpdatedAt, &branch.CreatedDate, &branch.UpdatedDate,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("branch not found")
	}
	return branch, err
}

func (s *BranchService) GetAll(ctx context.Context) ([]models.Branch, error) {
	query := `SELECT id, name, address, phone, monthly_payment, currency, admin_id, created_at, updated_at, created_date, updated_date FROM branches ORDER BY name`

	rows, err := s.db.GetConn().QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var branches []models.Branch
	for rows.Next() {
		var branch models.Branch
		if err := rows.Scan(&branch.ID, &branch.Name, &branch.Address, &branch.Phone, &branch.MonthlyPayment, &branch.Currency, &branch.AdminID, &branch.CreatedAt, &branch.UpdatedAt, &branch.CreatedDate, &branch.UpdatedDate); err != nil {
			return nil, err
		}
		branches = append(branches, branch)
	}

	return branches, rows.Err()
}

func (s *BranchService) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.Branch, error) {
	updates = utils.ConvertKeysToSnakeCase(updates)
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

	return s.GetByID(ctx, id)
}

func (s *BranchService) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM branches WHERE id = $1`
	_, err := s.db.GetConn().ExecContext(ctx, query, id)
	return err
}


