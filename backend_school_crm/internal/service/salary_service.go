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

type SalaryService struct {
	db *db.Database
}

func NewSalaryService(database *db.Database) *SalaryService {
	return &SalaryService{db: database}
}

type CreateSalaryRequest struct {
	TeacherID     string `json:"teacherId" binding:"required"`
	Amount        float64 `json:"amount" binding:"required,gt=0"`
	Month         string `json:"month" binding:"required"`
	Year          int `json:"year" binding:"required"`
	PaymentMethod string `json:"paymentMethod" binding:"required"`
	Status        string `json:"status" binding:"required"`
	Notes         *string `json:"notes"`
	PaidDate      *time.Time `json:"paidDate"`
	BranchID      string `json:"branchId" binding:"required"`
}

func (s *SalaryService) Create(ctx context.Context, req *CreateSalaryRequest, createdBy string) (*models.Salary, error) {
	salary := &models.Salary{
		ID:            uuid.New().String(),
		TeacherID:     req.TeacherID,
		Amount:        req.Amount,
		Month:         req.Month,
		Year:          req.Year,
		PaymentMethod: models.PaymentMethod(req.PaymentMethod),
		Status:        models.PaymentStatus(req.Status),
		Notes:         req.Notes,
		PaidDate:      req.PaidDate,
		BranchID:      req.BranchID,
		CreatedBy:     &createdBy,
		CreatedAt:     time.Now(),
	}

	query := `INSERT INTO salaries (id, teacher_id, amount, month, year, payment_method, status, notes, paid_date, branch_id, created_by, created_at)
	         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

	_, err := s.db.GetConn().ExecContext(ctx, query, salary.ID, salary.TeacherID, salary.Amount, salary.Month, salary.Year,
		salary.PaymentMethod, salary.Status, salary.Notes, salary.PaidDate, salary.BranchID, salary.CreatedBy, salary.CreatedAt)

	return salary, err
}

func (s *SalaryService) GetByID(ctx context.Context, id string) (*models.Salary, error) {
	salary := &models.Salary{}
	query := `SELECT id, teacher_id, amount, month, year, payment_method, status, notes, paid_date, branch_id, created_by, created_at
	         FROM salaries WHERE id = $1`

	err := s.db.GetConn().QueryRowContext(ctx, query, id).Scan(
		&salary.ID, &salary.TeacherID, &salary.Amount, &salary.Month, &salary.Year,
		&salary.PaymentMethod, &salary.Status, &salary.Notes, &salary.PaidDate, &salary.BranchID, &salary.CreatedBy, &salary.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("salary not found")
	}
	return salary, err
}

func (s *SalaryService) GetByBranchID(ctx context.Context, branchID string) ([]models.Salary, error) {
	query := `SELECT id, teacher_id, amount, month, year, payment_method, status, notes, paid_date, branch_id, created_by, created_at
	         FROM salaries WHERE branch_id = $1 ORDER BY created_at DESC`

	rows, err := s.db.GetConn().QueryContext(ctx, query, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var salaries []models.Salary
	for rows.Next() {
		var salary models.Salary
		if err := rows.Scan(&salary.ID, &salary.TeacherID, &salary.Amount, &salary.Month, &salary.Year,
			&salary.PaymentMethod, &salary.Status, &salary.Notes, &salary.PaidDate, &salary.BranchID, &salary.CreatedBy, &salary.CreatedAt); err != nil {
			return nil, err
		}
		salaries = append(salaries, salary)
	}

	return salaries, rows.Err()
}

func (s *SalaryService) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.Salary, error) {
	query := `UPDATE salaries SET `
	args := []interface{}{}
	argCount := 1

	for key, value := range updates {
		if argCount > 1 {
			query += ", "
		}
		query += key + " = $" + fmt.Sprintf("%d", argCount)
		args = append(args, value)
		argCount++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argCount)
	args = append(args, id)

	_, err := s.db.GetConn().ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	return s.GetByID(ctx, id)
}

func (s *SalaryService) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM salaries WHERE id = $1`
	_, err := s.db.GetConn().ExecContext(ctx, query, id)
	return err
}
