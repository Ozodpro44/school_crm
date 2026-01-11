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
	"github.com/school-crm/backend/internal/utils"
)

type PaymentService struct {
	db *db.Database
}

func NewPaymentService(database *db.Database) *PaymentService {
	return &PaymentService{db: database}
}

type CreatePaymentRequest struct {
	StudentID     string     `json:"studentId" binding:"required"`
	Amount        float64    `json:"amount" binding:"required,gt=0"`
	Month         string     `json:"month" binding:"required"`
	Year          int        `json:"year" binding:"required"`
	PaymentMethod string     `json:"paymentMethod" binding:"required"`
	Status        string     `json:"status" binding:"required"`
	InvoiceNumber string     `json:"invoiceNumber" binding:"required"`
	Notes         *string    `json:"notes"`
	PaidDate      *time.Time `json:"paidDate"`
	BranchID      string     `json:"branchId" binding:"required"`
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
		CreatedAt:     time.Now().UTC(),
	}

	query := `INSERT INTO payments (id, student_id, amount, month, year, payment_method, status, invoice_number, notes, paid_date, branch_id, created_by, created_at)
	         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`

	_, err := s.db.GetConn().ExecContext(ctx, query, payment.ID, payment.StudentID, payment.Amount, payment.Month, payment.Year,
		payment.PaymentMethod, payment.Status, payment.InvoiceNumber, payment.Notes, payment.PaidDate, payment.BranchID, payment.CreatedBy, payment.CreatedAt)

	return payment, err
}

func (s *PaymentService) GetByID(ctx context.Context, id string) (*models.Payment, error) {
	payment := &models.Payment{}
	query := `SELECT p.id, p.student_id, p.amount, p.month, p.year, p.payment_method, p.status, p.invoice_number, p.notes, p.paid_date, p.branch_id, p.created_by, p.created_at, u.full_name
	         FROM payments p
	         LEFT JOIN users u ON p.created_by = u.id
	         WHERE p.id = $1`

	err := s.db.GetConn().QueryRowContext(ctx, query, id).Scan(
		&payment.ID, &payment.StudentID, &payment.Amount, &payment.Month, &payment.Year,
		&payment.PaymentMethod, &payment.Status, &payment.InvoiceNumber, &payment.Notes, &payment.PaidDate, &payment.BranchID, &payment.CreatedBy, &payment.CreatedAt, &payment.CreatedByName,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("payment not found")
	}
	return payment, err
}

func (s *PaymentService) GetByBranchID(ctx context.Context, branchID string) ([]models.Payment, error) {
	query := `SELECT p.id, p.student_id, p.amount, p.month, p.year, p.payment_method, p.status, p.invoice_number, p.notes, p.paid_date, p.branch_id, p.created_by, p.created_at, u.full_name
	         FROM payments p
	         LEFT JOIN users u ON p.created_by = u.id
	         WHERE p.branch_id = $1 ORDER BY p.created_at DESC`

	rows, err := s.db.GetConn().QueryContext(ctx, query, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []models.Payment
	for rows.Next() {
		var payment models.Payment
		if err := rows.Scan(&payment.ID, &payment.StudentID, &payment.Amount, &payment.Month, &payment.Year,
			&payment.PaymentMethod, &payment.Status, &payment.InvoiceNumber, &payment.Notes, &payment.PaidDate, &payment.BranchID, &payment.CreatedBy, &payment.CreatedAt, &payment.CreatedByName); err != nil {
			return nil, err
		}
		payments = append(payments, payment)
	}

	return payments, rows.Err()
}

func (s *PaymentService) GetByBranchIDAndPeriod(ctx context.Context, branchID, month, year string) ([]models.Payment, error) {
	query := `SELECT p.id, p.student_id, p.amount, p.month, p.year, p.payment_method, p.status, p.invoice_number, p.notes, p.paid_date, p.branch_id, p.created_by, p.created_at, u.full_name
	         FROM payments p
	         LEFT JOIN users u ON p.created_by = u.id
	         WHERE p.branch_id = $1 AND p.month = $2 AND p.year = $3 ORDER BY p.created_at DESC`

	rows, err := s.db.GetConn().QueryContext(ctx, query, branchID, month, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []models.Payment
	for rows.Next() {
		var payment models.Payment
		if err := rows.Scan(&payment.ID, &payment.StudentID, &payment.Amount, &payment.Month, &payment.Year,
			&payment.PaymentMethod, &payment.Status, &payment.InvoiceNumber, &payment.Notes, &payment.PaidDate, &payment.BranchID, &payment.CreatedBy, &payment.CreatedAt, &payment.CreatedByName); err != nil {
			return nil, err
		}
		payments = append(payments, payment)
	}

	return payments, rows.Err()
}

func (s *PaymentService) GetByBranchIDAndPeriodPaginated(ctx context.Context, branchID, month, year string, page, limit int) (map[string]interface{}, error) {
	// Get total count
	countQuery := `SELECT COUNT(*) FROM payments WHERE branch_id = $1 AND month = $2 AND year = $3`
	var total int64
	err := s.db.GetConn().QueryRowContext(ctx, countQuery, branchID, month, year).Scan(&total)
	if err != nil {
		return nil, err
	}

	// Get paginated results
	offset := (page - 1) * limit
	query := `SELECT p.id, p.student_id, p.amount, p.month, p.year, p.payment_method, p.status, p.invoice_number, p.notes, p.paid_date, p.branch_id, p.created_by, p.created_at, u.full_name
	         FROM payments p
	         LEFT JOIN users u ON p.created_by = u.id
	         WHERE p.branch_id = $1 AND p.month = $2 AND p.year = $3 ORDER BY p.created_at DESC LIMIT $4 OFFSET $5`

	rows, err := s.db.GetConn().QueryContext(ctx, query, branchID, month, year, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []models.Payment
	for rows.Next() {
		var payment models.Payment
		if err := rows.Scan(&payment.ID, &payment.StudentID, &payment.Amount, &payment.Month, &payment.Year,
			&payment.PaymentMethod, &payment.Status, &payment.InvoiceNumber, &payment.Notes, &payment.PaidDate, &payment.BranchID, &payment.CreatedBy, &payment.CreatedAt, &payment.CreatedByName); err != nil {
			return nil, err
		}
		payments = append(payments, payment)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	totalPages := (total + int64(limit) - 1) / int64(limit)

	return map[string]interface{}{
		"data":        payments,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"totalPages":  totalPages,
	}, nil
}

func (s *PaymentService) GetByStudentIDAndPeriod(ctx context.Context, studentID, month string, year int) ([]models.Payment, error) {
	query := `SELECT p.id, p.student_id, p.amount, p.month, p.year, p.payment_method, p.status, p.invoice_number, p.notes, p.paid_date, p.branch_id, p.created_by, p.created_at, u.full_name
	         FROM payments p
	         LEFT JOIN users u ON p.created_by = u.id
	         WHERE p.student_id = $1 AND p.month = $2 AND p.year = $3`

	rows, err := s.db.GetConn().QueryContext(ctx, query, studentID, month, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []models.Payment
	for rows.Next() {
		var payment models.Payment
		if err := rows.Scan(&payment.ID, &payment.StudentID, &payment.Amount, &payment.Month, &payment.Year,
			&payment.PaymentMethod, &payment.Status, &payment.InvoiceNumber, &payment.Notes, &payment.PaidDate, &payment.BranchID, &payment.CreatedBy, &payment.CreatedAt, &payment.CreatedByName); err != nil {
			return nil, err
		}
		payments = append(payments, payment)
	}

	return payments, rows.Err()
}

func (s *PaymentService) GetCurrentMonthYear() (string, string) {
	now := time.Now().UTC()
	month := fmt.Sprintf("%02d", now.Month())
	year := fmt.Sprintf("%d", now.Year())
	return month, year
}

func (s *PaymentService) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.Payment, error) {
	// Check if payment exists
	_, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	updates = utils.ConvertKeysToSnakeCase(updates)

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

	_, err = s.db.GetConn().ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	return s.GetByID(ctx, id)
}

func (s *PaymentService) Delete(ctx context.Context, id string) error {
	// Check if payment exists
	_, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}

	query := `DELETE FROM payments WHERE id = $1`
	_, err = s.db.GetConn().ExecContext(ctx, query, id)
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
		"totalPaid":    totalPaid.Float64,
		"totalUnpaid":  totalUnpaid.Float64,
		"totalPartial": totalPartial.Float64,
		"byMethod": map[string]float64{
			"card": card.Float64,
			"cash": cash.Float64,
			"bank": bank.Float64,
		},
	}, nil
}

func (s *PaymentService) GetPaymentSummaryForPeriod(ctx context.Context, branchID string, month string, year int) (map[string]interface{}, error) {
	// First query: Get paid amounts and payment methods
	paymentQuery := `
	SELECT 
		SUM(CASE WHEN status = 'paid' OR status = 'partial' THEN amount ELSE 0 END) as total_paid,
		SUM(CASE WHEN payment_method = 'card' THEN amount ELSE 0 END) as card,
		SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END) as cash,
		SUM(CASE WHEN payment_method = 'bank' THEN amount ELSE 0 END) as bank
	FROM payments WHERE branch_id = $1 AND month = $2 AND year = $3
	`

	var totalPaid, card, cash, bank sql.NullFloat64

	err := s.db.GetConn().QueryRowContext(ctx, paymentQuery, branchID, month, year).Scan(&totalPaid, &card, &cash, &bank)
	if err != nil {
		return nil, err
	}

	// Second query: Calculate unpaid amount
	// Unpaid = Total monthly fees for all active students - What they've already paid
	unpaidQuery := `
	WITH student_payments AS (
		SELECT 
			s.id,
			s.monthly_payment,
			COALESCE(SUM(CASE WHEN p.status IN ('paid', 'partial') THEN p.amount ELSE 0 END), 0) as paid_amount
		FROM students s
		LEFT JOIN payments p ON s.id = p.student_id AND p.branch_id = $1 AND p.month = $2 AND p.year = $3
		WHERE s.branch_id = $1 AND s.status = 'active'
		GROUP BY s.id, s.monthly_payment
	)
	SELECT COALESCE(SUM(GREATEST(0, monthly_payment - paid_amount)), 0) as total_unpaid
	FROM student_payments
	`

	var totalUnpaid sql.NullFloat64

	err = s.db.GetConn().QueryRowContext(ctx, unpaidQuery, branchID, month, year).Scan(&totalUnpaid)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"totalPaid":    totalPaid.Float64,
		"totalUnpaid":  totalUnpaid.Float64,
		"byMethod": map[string]float64{
			"card": card.Float64,
			"cash": cash.Float64,
			"bank": bank.Float64,
		},
	}, nil
}

func (s *PaymentService) GetByStudentID(ctx context.Context, studentID string) ([]models.Payment, error) {
	query := `SELECT p.id, p.student_id, p.amount, p.month, p.year, p.payment_method, p.status, p.invoice_number, p.notes, p.paid_date, p.branch_id, p.created_by, p.created_at, u.full_name
	         FROM payments p
	         LEFT JOIN users u ON p.created_by = u.id
	         WHERE p.student_id = $1 ORDER BY p.year DESC, p.month DESC, p.created_at DESC`

	rows, err := s.db.GetConn().QueryContext(ctx, query, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []models.Payment
	for rows.Next() {
		var payment models.Payment
		if err := rows.Scan(&payment.ID, &payment.StudentID, &payment.Amount, &payment.Month, &payment.Year,
			&payment.PaymentMethod, &payment.Status, &payment.InvoiceNumber, &payment.Notes, &payment.PaidDate, &payment.BranchID, &payment.CreatedBy, &payment.CreatedAt, &payment.CreatedByName); err != nil {
			return nil, err
		}
		payments = append(payments, payment)
	}

	return payments, rows.Err()
}

// ConsolidatePartialPayments groups multiple partial payments of the same student for the same period into one
func (s *PaymentService) ConsolidatePayments(payments []models.Payment) []models.Payment {
	if len(payments) == 0 {
		return payments
	}

	// Group by studentId + month + year
	groupKey := make(map[string][]models.Payment)
	var consolidated []models.Payment

	for _, p := range payments {
		key := fmt.Sprintf("%s-%s-%d", p.StudentID, p.Month, p.Year)
		groupKey[key] = append(groupKey[key], p)
	}

	// For each group, consolidate if there are multiple partial payments
	for _, group := range groupKey {
		if len(group) == 1 {
			// Single payment, keep as is
			consolidated = append(consolidated, group[0])
		} else {
			// Multiple payments - check if they're all partial or mixed
			hasPartial := false
			hasPaid := false
			totalAmount := 0.0
			var consolidatedPayment models.Payment

			for _, p := range group {
				totalAmount += p.Amount
				if p.Status == "partial" {
					hasPartial = true
				} else if p.Status == "paid" {
					hasPaid = true
				}
				// Use first payment as base
				if consolidatedPayment.ID == "" {
					consolidatedPayment = p
				}
			}

			// Only consolidate if all are partial or if they complete the full amount
			if hasPartial && !hasPaid {
				// All partial - consolidate them
				consolidatedPayment.Amount = totalAmount
				consolidatedPayment.Status = "partial"
				consolidatedPayment.InvoiceNumber = "CONSOLIDATED"
				consolidated = append(consolidated, consolidatedPayment)
			} else {
				// Mixed statuses - keep original payments
				consolidated = append(consolidated, group...)
			}
		}
	}

	return consolidated
}