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

type PaymentService struct {
	db *db.Database
}

func NewPaymentService(database *db.Database) *PaymentService {
	return &PaymentService{db: database}
}

type CreatePaymentRequest struct {
	StudentID     string `json:"studentId" binding:"required"`
	Amount        float64 `json:"amount" binding:"required,gt=0"`
	Month         string `json:"month" binding:"required"`
	Year          int `json:"year" binding:"required"`
	PaymentMethod string `json:"paymentMethod" binding:"required"`
	Status        string `json:"status" binding:"required"`
	InvoiceNumber string `json:"invoiceNumber" binding:"required"`
	Notes         *string `json:"notes"`
	PaidDate      *time.Time `json:"paidDate"`
	BranchID      string `json:"branchId" binding:"required"`
}

func (s *PaymentService) Create(ctx context.Context, req *CreatePaymentRequest, createdBy string) (*models.Payment, error) {
	payment := &models.Payment{
		ID:            uuid.New().String(),
		StudentID:     req.StudentID,
		Amount:        req.Amount,
		Month:         req.Month,
		Year:          req.Year,
		PaymentMethod: models.PaymentMethod(req.PaymentMethod),
		Status:        models.PaymentStatus(req.Status),
		InvoiceNumber: req.InvoiceNumber,
		Notes:         req.Notes,
		PaidDate:      req.PaidDate,
		BranchID:      req.BranchID,
		CreatedBy:     &createdBy,
		CreatedAt:     time.Now(),
	}

	query := `INSERT INTO payments (id, student_id, amount, month, year, payment_method, status, invoice_number, notes, paid_date, branch_id, created_by, created_at)
	         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`

	_, err := s.db.GetConn().ExecContext(ctx, query, payment.ID, payment.StudentID, payment.Amount, payment.Month, payment.Year,
		payment.PaymentMethod, payment.Status, payment.InvoiceNumber, payment.Notes, payment.PaidDate, payment.BranchID, payment.CreatedBy, payment.CreatedAt)

	return payment, err
}

func (s *PaymentService) GetByID(ctx context.Context, id string) (*models.Payment, error) {
	payment := &models.Payment{}
	query := `SELECT id, student_id, amount, month, year, payment_method, status, invoice_number, notes, paid_date, branch_id, created_by, created_at
	         FROM payments WHERE id = $1`

	err := s.db.GetConn().QueryRowContext(ctx, query, id).Scan(
		&payment.ID, &payment.StudentID, &payment.Amount, &payment.Month, &payment.Year,
		&payment.PaymentMethod, &payment.Status, &payment.InvoiceNumber, &payment.Notes, &payment.PaidDate, &payment.BranchID, &payment.CreatedBy, &payment.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("payment not found")
	}
	return payment, err
}

func (s *PaymentService) GetByBranchID(ctx context.Context, branchID string) ([]models.Payment, error) {
	query := `SELECT id, student_id, amount, month, year, payment_method, status, invoice_number, notes, paid_date, branch_id, created_by, created_at
	         FROM payments WHERE branch_id = $1 ORDER BY created_at DESC`

	rows, err := s.db.GetConn().QueryContext(ctx, query, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []models.Payment
	for rows.Next() {
		var payment models.Payment
		if err := rows.Scan(&payment.ID, &payment.StudentID, &payment.Amount, &payment.Month, &payment.Year,
			&payment.PaymentMethod, &payment.Status, &payment.InvoiceNumber, &payment.Notes, &payment.PaidDate, &payment.BranchID, &payment.CreatedBy, &payment.CreatedAt); err != nil {
			return nil, err
		}
		payments = append(payments, payment)
	}

	return payments, rows.Err()
}

func (s *PaymentService) GetByStudentIDAndPeriod(ctx context.Context, studentID, month string, year int) ([]models.Payment, error) {
	query := `SELECT id, student_id, amount, month, year, payment_method, status, invoice_number, notes, paid_date, branch_id, created_by, created_at
	         FROM payments WHERE student_id = $1 AND month = $2 AND year = $3`

	rows, err := s.db.GetConn().QueryContext(ctx, query, studentID, month, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []models.Payment
	for rows.Next() {
		var payment models.Payment
		if err := rows.Scan(&payment.ID, &payment.StudentID, &payment.Amount, &payment.Month, &payment.Year,
			&payment.PaymentMethod, &payment.Status, &payment.InvoiceNumber, &payment.Notes, &payment.PaidDate, &payment.BranchID, &payment.CreatedBy, &payment.CreatedAt); err != nil {
			return nil, err
		}
		payments = append(payments, payment)
	}

	return payments, rows.Err()
}

func (s *PaymentService) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.Payment, error) {
	query := `UPDATE payments SET `
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

func (s *PaymentService) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM payments WHERE id = $1`
	_, err := s.db.GetConn().ExecContext(ctx, query, id)
	return err
}

func (s *PaymentService) GetPaymentSummary(ctx context.Context, branchID string) (map[string]interface{}, error) {
	query := `
	SELECT 
		SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
		SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as total_unpaid,
		SUM(CASE WHEN status = 'partial' THEN amount ELSE 0 END) as total_partial,
		SUM(CASE WHEN payment_method = 'card' THEN amount ELSE 0 END) as card,
		SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END) as cash,
		SUM(CASE WHEN payment_method = 'bank' THEN amount ELSE 0 END) as bank
	FROM payments WHERE branch_id = $1
	`

	var totalPaid, totalUnpaid, totalPartial, card, cash, bank sql.NullFloat64

	err := s.db.GetConn().QueryRowContext(ctx, query, branchID).Scan(&totalPaid, &totalUnpaid, &totalPartial, &card, &cash, &bank)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"totalPaid":     totalPaid.Float64,
		"totalUnpaid":   totalUnpaid.Float64,
		"totalPartial":  totalPartial.Float64,
		"byMethod": map[string]float64{
			"card": card.Float64,
			"cash": cash.Float64,
			"bank": bank.Float64,
		},
	}, nil
}
