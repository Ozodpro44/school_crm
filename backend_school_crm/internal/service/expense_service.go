package service

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type ExpenseService struct {
	db *db.Database
}

func NewExpenseService(database *db.Database) *ExpenseService {
	return &ExpenseService{db: database}
}

type CreateExpenseRequest struct {
	Title         string `json:"title" binding:"required"`
	Description   string `json:"description" binding:"required"`
	Amount        float64 `json:"amount" binding:"required,gt=0"`
	Category      string `json:"category" binding:"required"`
	PaymentMethod string `json:"paymentMethod" binding:"required"`
	Date          time.Time `json:"date" binding:"required"`
	BranchID      string `json:"branchId" binding:"required"`
	Notes         *string `json:"notes"`
}

func (s *ExpenseService) Create(ctx context.Context, req *CreateExpenseRequest, createdBy string) (*models.Expense, error) {
	expense := &models.Expense{
		ID:            uuid.New().String(),
		Title:         req.Title,
		Description:   req.Description,
		Amount:        req.Amount,
		Category:      req.Category,
		PaymentMethod: models.PaymentMethod(req.PaymentMethod),
		Date:          req.Date,
		BranchID:      req.BranchID,
		CreatedBy:     createdBy,
		Notes:         req.Notes,
		CreatedAt:     time.Now(),
	}

	query := `INSERT INTO expenses (id, title, description, amount, category, payment_method, date, branch_id, created_by, notes, created_at)
	         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`

	_, err := s.db.GetConn().ExecContext(ctx, query, expense.ID, expense.Title, expense.Description, expense.Amount,
		expense.Category, expense.PaymentMethod, expense.Date, expense.BranchID, expense.CreatedBy, expense.Notes, expense.CreatedAt)

	return expense, err
}

func (s *ExpenseService) GetByID(ctx context.Context, id string) (*models.Expense, error) {
	expense := &models.Expense{}
	query := `SELECT id, title, description, amount, category, payment_method, date, branch_id, created_by, notes, created_at
	         FROM expenses WHERE id = $1`

	err := s.db.GetConn().QueryRowContext(ctx, query, id).Scan(
		&expense.ID, &expense.Title, &expense.Description, &expense.Amount, &expense.Category,
		&expense.PaymentMethod, &expense.Date, &expense.BranchID, &expense.CreatedBy, &expense.Notes, &expense.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("expense not found")
	}
	return expense, err
}

func (s *ExpenseService) GetByBranchID(ctx context.Context, branchID string) ([]models.Expense, error) {
	query := `SELECT id, title, description, amount, category, payment_method, date, branch_id, created_by, notes, created_at
	         FROM expenses WHERE branch_id = $1 ORDER BY date DESC`

	rows, err := s.db.GetConn().QueryContext(ctx, query, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var expenses []models.Expense
	for rows.Next() {
		var expense models.Expense
		if err := rows.Scan(&expense.ID, &expense.Title, &expense.Description, &expense.Amount, &expense.Category,
			&expense.PaymentMethod, &expense.Date, &expense.BranchID, &expense.CreatedBy, &expense.Notes, &expense.CreatedAt); err != nil {
			return nil, err
		}
		expenses = append(expenses, expense)
	}

	return expenses, rows.Err()
}

func (s *ExpenseService) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM expenses WHERE id = $1`
	_, err := s.db.GetConn().ExecContext(ctx, query, id)
	return err
}
