package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/cache"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/utils"
)

// ErrFinancialMonthLocked is returned when a Create or Update is attempted on
// a record that belongs to a closed (past) financial month and the caller does
// not have admin override rights.
var ErrFinancialMonthLocked = errors.New("financial_month_locked: cannot modify records from a past financial month")

type PaymentService struct {
	db        *db.Database
	branchSvc *BranchService
	cache     *cache.Client
}

func NewPaymentService(database *db.Database, branchSvc *BranchService) *PaymentService {
	return &PaymentService{db: database, branchSvc: branchSvc}
}

// SetCache wires in the optional Redis cache client.
func (s *PaymentService) SetCache(c *cache.Client) { s.cache = c }

const paymentCacheTTL = 30 * time.Second

// PaymentFilterInput replaces the long parameter list of GetByBranchIDWithFilters.
type PaymentFilterInput struct {
	BranchID      string
	Page          string
	Limit         string
	// Cursor is the created_at timestamp (RFC3339) of the last item from the previous page.
	// When set, Page/offset is ignored and results start strictly before this timestamp.
	Cursor        string
	Search        string
	Status        string
	PaymentMethod string
	Month         string
	Year          string
	ClassID       string
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
	// Guard: financial month lock — only allow payments for the branch's current month.
	if s.branchSvc != nil && req.BranchID != "" {
		currentMonth, currentYear, err := s.branchSvc.GetCurrentMonth(ctx, req.BranchID)
		if err != nil {
			return nil, fmt.Errorf("failed to verify financial month: %w", err)
		}
		if req.Month != currentMonth || req.Year != currentYear {
			return nil, fmt.Errorf("%w: can only create payments for current month (%s/%d)", ErrFinancialMonthLocked, currentMonth, currentYear)
		}
	}

	// Check if student already has a paid payment for this month/year
	existingPayments, err := s.GetByStudentIDAndPeriod(ctx, req.StudentID, req.Month, req.Year)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Check if there's already a paid payment for this period
	for _, p := range existingPayments {
		if p.Status == "paid" {
			return nil, fmt.Errorf("student already has a paid payment for %s/%d", req.Month, req.Year)
		}
	}

	payment := &models.Payment{
		ID:            uuid.New().String(),
		StudentID:     req.StudentID,
		Amount:        req.Amount,
		Month:         req.Month,
		Year:          req.Year,
		PaymentMethod: models.PaymentMethod(normalizeStudentPaymentMethod(req.PaymentMethod)),
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

	_, err = s.db.GetConn().ExecContext(ctx, query, payment.ID, payment.StudentID, payment.Amount, payment.Month, payment.Year,
		payment.PaymentMethod, payment.Status, payment.InvoiceNumber, payment.Notes, payment.PaidDate, payment.BranchID, payment.CreatedBy, payment.CreatedAt)
	if err == nil && s.cache != nil {
		_ = s.cache.DeleteByPrefix(ctx, fmt.Sprintf("crm:payments:%s:", req.BranchID))
	}

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
	payment.PaymentMethod = models.PaymentMethod(normalizeStudentPaymentMethod(string(payment.PaymentMethod)))
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
		payment.PaymentMethod = models.PaymentMethod(normalizeStudentPaymentMethod(string(payment.PaymentMethod)))
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
		payment.PaymentMethod = models.PaymentMethod(normalizeStudentPaymentMethod(string(payment.PaymentMethod)))
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
		payment.PaymentMethod = models.PaymentMethod(normalizeStudentPaymentMethod(string(payment.PaymentMethod)))
		payments = append(payments, payment)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	totalPages := (total + int64(limit) - 1) / int64(limit)

	return map[string]interface{}{
		"data":       payments,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": totalPages,
	}, nil
}

func (s *PaymentService) GetByBranchIDAndPeriodPaginatedWithSearch(ctx context.Context, branchID, month, year, search, statusFilter string, page, limit int) (map[string]interface{}, error) {
	// Build WHERE clause dynamically
	whereClause := "WHERE p.branch_id = $1 AND p.month = $2 AND p.year = $3"
	args := []interface{}{branchID, month, year}
	argCount := 3

	// Add search filter (search in student name and invoice number)
	if search != "" {
		argCount++
		whereClause += fmt.Sprintf(` AND (LOWER(s.full_name) LIKE LOWER($%d) OR LOWER(p.invoice_number) LIKE LOWER($%d))`, argCount, argCount)
		args = append(args, "%"+search+"%", "%"+search+"%")
	}

	// Add status filter
	if statusFilter != "" && statusFilter != "all" {
		argCount++
		whereClause += fmt.Sprintf(` AND p.status = $%d`, argCount)
		args = append(args, statusFilter)
	}

	// Get total count
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM payments p LEFT JOIN students s ON p.student_id = s.id %s`, whereClause)
	var total int64
	countArgs := args
	err := s.db.GetConn().QueryRowContext(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, err
	}

	// Get paginated results
	offset := (page - 1) * limit
	argCount++
	limitArg := argCount
	argCount++
	offsetArg := argCount

	args = append(args, limit, offset)

	query := fmt.Sprintf(`SELECT p.id, p.student_id, p.amount, p.month, p.year, p.payment_method, p.status, p.invoice_number, p.notes, p.paid_date, p.branch_id, p.created_by, p.created_at, u.full_name
	         FROM payments p
	         LEFT JOIN users u ON p.created_by = u.id
	         LEFT JOIN students s ON p.student_id = s.id
	         %s ORDER BY p.created_at DESC LIMIT $%d OFFSET $%d`, whereClause, limitArg, offsetArg)

	rows, err := s.db.GetConn().QueryContext(ctx, query, args...)
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
		payment.PaymentMethod = models.PaymentMethod(normalizeStudentPaymentMethod(string(payment.PaymentMethod)))
		payments = append(payments, payment)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	totalPages := (total + int64(limit) - 1) / int64(limit)

	return map[string]interface{}{
		"data":       payments,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": totalPages,
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

func (s *PaymentService) Update(ctx context.Context, id string, updates map[string]interface{}, isAdmin bool) (*models.Payment, error) {
	// Check if payment exists and fetch for month-lock validation.
	existing, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Guard: financial month lock — non-admin users cannot edit past-month payments.
	if s.branchSvc != nil {
		currentMonth, currentYear, err := s.branchSvc.GetCurrentMonth(ctx, existing.BranchID)
		if err != nil {
			return nil, fmt.Errorf("failed to verify financial month: %w", err)
		}
		isPast := existing.Month != currentMonth || existing.Year != currentYear
		if isPast && !isAdmin {
			return nil, fmt.Errorf("%w: cannot modify payments from past months", ErrFinancialMonthLocked)
		}
	}

	updates = utils.ConvertKeysToSnakeCase(updates)
	if paymentMethodValue, ok := updates["payment_method"].(string); ok {
		updates["payment_method"] = normalizeStudentPaymentMethod(paymentMethodValue)
	}

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

	updated, err := s.GetByID(ctx, id)
	if err == nil && s.cache != nil {
		_ = s.cache.DeleteByPrefix(ctx, fmt.Sprintf("crm:payments:%s:", existing.BranchID))
	}
	return updated, err
}

func (s *PaymentService) Delete(ctx context.Context, id string) error {
	// Check if payment exists
	existing, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}

	query := `DELETE FROM payments WHERE id = $1`
	_, err = s.db.GetConn().ExecContext(ctx, query, id)
	if err == nil && s.cache != nil {
		_ = s.cache.DeleteByPrefix(ctx, fmt.Sprintf("crm:payments:%s:", existing.BranchID))
	}
	return err
}

func (s *PaymentService) GetPaymentSummary(ctx context.Context, branchID string) (map[string]interface{}, error) {
	statusQuery := `
	SELECT 
		SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
		SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as total_unpaid,
		SUM(CASE WHEN status = 'partial' THEN amount ELSE 0 END) as total_partial
	FROM payments WHERE branch_id = $1
	`

	var totalPaid, totalUnpaid, totalPartial sql.NullFloat64

	err := s.db.GetConn().QueryRowContext(ctx, statusQuery, branchID).Scan(&totalPaid, &totalUnpaid, &totalPartial)
	if err != nil {
		return nil, err
	}

	byMethod := newStudentPaymentMethodTotals()
	methodRows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT payment_method, COALESCE(SUM(amount), 0)
		FROM payments
		WHERE branch_id = $1
		GROUP BY payment_method
	`, branchID)
	if err != nil {
		return nil, err
	}
	defer methodRows.Close()

	for methodRows.Next() {
		var method string
		var amount float64
		if err := methodRows.Scan(&method, &amount); err != nil {
			return nil, err
		}
		addStudentPaymentAmountByMethod(byMethod, method, amount)
	}

	if err := methodRows.Err(); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"totalPaid":    totalPaid.Float64,
		"totalUnpaid":  totalUnpaid.Float64,
		"totalPartial": totalPartial.Float64,
		"byMethod":     byMethod,
	}, nil
}

func (s *PaymentService) GetPaymentSummaryForPeriod(ctx context.Context, branchID string, month string, year int) (map[string]interface{}, error) {
	// First query: Get paid amounts and payment methods
	paymentQuery := `
	SELECT 
		SUM(CASE WHEN status = 'paid' OR status = 'partial' THEN amount ELSE 0 END) as total_paid
	FROM payments WHERE branch_id = $1 AND month = $2 AND year = $3
	`

	var totalPaid sql.NullFloat64

	err := s.db.GetConn().QueryRowContext(ctx, paymentQuery, branchID, month, year).Scan(&totalPaid)
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
		WHERE s.branch_id = $1 
		AND s.status = 'active'
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

	byMethod := newStudentPaymentMethodTotals()
	methodRows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT payment_method, COALESCE(SUM(amount), 0)
		FROM payments
		WHERE branch_id = $1 AND month = $2 AND year = $3
		GROUP BY payment_method
	`, branchID, month, year)
	if err != nil {
		return nil, err
	}
	defer methodRows.Close()

	for methodRows.Next() {
		var method string
		var amount float64
		if err := methodRows.Scan(&method, &amount); err != nil {
			return nil, err
		}
		addStudentPaymentAmountByMethod(byMethod, method, amount)
	}

	if err := methodRows.Err(); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"totalPaid":   totalPaid.Float64,
		"totalUnpaid": totalUnpaid.Float64,
		"byMethod":    byMethod,
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
		payment.PaymentMethod = models.PaymentMethod(normalizeStudentPaymentMethod(string(payment.PaymentMethod)))
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

// GetByBranchIDWithFilters returns payments with pagination and dynamic filtering
// Similar to StudentService.GetByBranchIDWithFilters
func (s *PaymentService) GetByBranchIDWithFilters(ctx context.Context, in PaymentFilterInput) (*models.PaymentListResponse, error) {
	if s.cache != nil {
		cacheKey := fmt.Sprintf("crm:payments:%s:%s:%s:%s:%s:%s:%s:%s:%s",
			in.BranchID, in.Page, in.Limit, in.Search, in.Status, in.PaymentMethod, in.Month, in.Year, in.ClassID)
		var cached models.PaymentListResponse
		if hit, _ := s.cache.Get(ctx, cacheKey, &cached); hit {
			return &cached, nil
		}
		result, err := s.getByBranchIDWithFiltersDB(ctx, in)
		if err == nil && result != nil {
			_ = s.cache.Set(ctx, cacheKey, result, paymentCacheTTL)
		}
		return result, err
	}
	return s.getByBranchIDWithFiltersDB(ctx, in)
}

func (s *PaymentService) getByBranchIDWithFiltersDB(ctx context.Context, in PaymentFilterInput) (*models.PaymentListResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	intPage, err := strconv.Atoi(in.Page)
	if err != nil || intPage < 1 {
		intPage = 1
	}

	intLimit, err := strconv.Atoi(in.Limit)
	if err != nil || intLimit < 1 {
		intLimit = 10
	}

	// Cursor pagination: when a cursor is supplied, ignore page/offset entirely.
	// Cursor = created_at timestamp of the last item (ordering is DESC, so we use <).
	useCursor := in.Cursor != ""
	offset := (intPage - 1) * intLimit

	branchID := in.BranchID
	search := in.Search
	status := in.Status
	paymentMethod := in.PaymentMethod
	month := in.Month
	year := in.Year
	classID := in.ClassID

	// -------------------------
	// dynamic filters
	// -------------------------
	where := `WHERE p.branch_id = $1`
	args := []interface{}{branchID}
	argID := 2

	// Month and year are required
	where += fmt.Sprintf(" AND p.month = $%d AND p.year = $%d", argID, argID+1)
	args = append(args, month, year)
	argID += 2

	if search != "" {
		where += fmt.Sprintf(
			" AND (LOWER(s.full_name) LIKE LOWER($%d) OR s.phone LIKE $%d)",
			argID, argID,
		)
		args = append(args, "%"+search+"%")
		argID++
	}

	if status != "" {
		where += fmt.Sprintf(" AND p.status = $%d", argID)
		args = append(args, status)
		argID++
	}

	if paymentMethod != "" {
		filterValues := studentPaymentMethodFilterValues(paymentMethod)
		switch len(filterValues) {
		case 1:
			where += fmt.Sprintf(" AND p.payment_method = $%d", argID)
			args = append(args, filterValues[0])
			argID++
		case 2:
			where += fmt.Sprintf(" AND p.payment_method IN ($%d, $%d)", argID, argID+1)
			args = append(args, filterValues[0], filterValues[1])
			argID += 2
		}
	}

	if classID != "" {
		where += fmt.Sprintf(" AND s.class_id = $%d", argID)
		args = append(args, classID)
		argID++
	}

	// Cursor: return only payments created before this timestamp (keyset, order DESC)
	if useCursor {
		where += fmt.Sprintf(" AND p.created_at < $%d", argID)
		args = append(args, in.Cursor)
		argID++
	}

	// -------------------------
	// count query
	// -------------------------
	countQuery := `
		SELECT COUNT(*)
		FROM payments p
		JOIN students s ON s.id = p.student_id
		` + where

	var total int
	err = s.db.GetConn().QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, err
	}

	// -------------------------
	// data query — also selects student info so the frontend can display
	// student name, phone, class without a second round-trip.
	// -------------------------
	dataQuery := `
		SELECT
			p.id, p.student_id, p.amount, p.month, p.year,
			p.payment_method, p.status, p.invoice_number, p.notes, p.paid_date,
			p.branch_id, p.created_by, p.financial_month_id, p.created_at,
			u.full_name as created_by_name,
			s.full_name  as student_full_name,
			COALESCE(s.phone, '') as student_phone,
			COALESCE(s.class_id::text, '') as student_class_id,
			COALESCE(c.name, '') as student_class_name,
			COALESCE(s.monthly_payment, 0) as student_monthly_payment
		FROM payments p
		JOIN students s ON s.id = p.student_id
		LEFT JOIN users u ON u.id = p.created_by
		LEFT JOIN classes c ON c.id = s.class_id
		` + where + `
		ORDER BY p.created_at DESC
		LIMIT $` + strconv.Itoa(argID) + func() string {
		if useCursor {
			return ""
		}
		return ` OFFSET $` + strconv.Itoa(argID+1)
	}()

	if useCursor {
		args = append(args, intLimit)
	} else {
		args = append(args, intLimit, offset)
	}

	rows, err := s.db.GetConn().QueryContext(ctx, dataQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []models.Payment
	studentMap := make(map[string]models.StudentInfo)
	for rows.Next() {
		var p models.Payment
		var createdByName sql.NullString
		var stuName, stuPhone, stuClassID, stuClassName string
		var stuMonthlyPayment float64
		err := rows.Scan(
			&p.ID, &p.StudentID, &p.Amount, &p.Month, &p.Year,
			&p.PaymentMethod, &p.Status, &p.InvoiceNumber, &p.Notes, &p.PaidDate,
			&p.BranchID, &p.CreatedBy, &p.FinancialMonthID, &p.CreatedAt,
			&createdByName,
			&stuName, &stuPhone, &stuClassID, &stuClassName, &stuMonthlyPayment,
		)
		if err != nil {
			return nil, err
		}
		if createdByName.Valid {
			p.CreatedByName = &createdByName.String
		}
		p.PaymentMethod = models.PaymentMethod(normalizeStudentPaymentMethod(string(p.PaymentMethod)))
		payments = append(payments, p)

		if _, seen := studentMap[p.StudentID]; !seen {
			studentMap[p.StudentID] = models.StudentInfo{
				ID:             p.StudentID,
				FullName:       stuName,
				Phone:          stuPhone,
				ClassID:        stuClassID,
				ClassName:      stuClassName,
				MonthlyPayment: stuMonthlyPayment,
			}
		}
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	students := make([]models.StudentInfo, 0, len(studentMap))
	for _, si := range studentMap {
		students = append(students, si)
	}

	// Build next cursor from the last payment's created_at (keyset, order DESC)
	var nextCursor string
	if len(payments) == intLimit {
		nextCursor = payments[len(payments)-1].CreatedAt.Format(time.RFC3339Nano)
	}

	return &models.PaymentListResponse{
		Items:      payments,
		Students:   students,
		Total:      total,
		Page:       intPage,
		Limit:      intLimit,
		NextCursor: nextCursor,
	}, nil
}

// BulkCreateRequest is a single entry in a bulk payment request.
type BulkCreateRequest struct {
	StudentID     string  `json:"studentId"     binding:"required"`
	Amount        float64 `json:"amount"        binding:"required,gt=0"`
	PaymentMethod string  `json:"paymentMethod" binding:"required"`
	Notes         *string `json:"notes"`
}

// BulkCreateResult is returned per-student from BulkCreate.
type BulkCreateResult struct {
	StudentID string          `json:"studentId"`
	Payment   *models.Payment `json:"payment,omitempty"`
	Error     string          `json:"error,omitempty"`
}

// BulkCreate creates payments for multiple students in the branch's current
// financial month. Each student is processed independently so a failure on one
// does not roll back the others. Returns per-student results.
func (s *PaymentService) BulkCreate(ctx context.Context, branchID, paymentMethod string, entries []BulkCreateRequest, createdBy string) []BulkCreateResult {
	currentMonth, currentYear, err := s.branchSvc.GetCurrentMonth(ctx, branchID)
	if err != nil {
		// Propagate as a universal error across all entries
		results := make([]BulkCreateResult, len(entries))
		for i, e := range entries {
			results[i] = BulkCreateResult{StudentID: e.StudentID, Error: "could not determine current month"}
		}
		return results
	}

	results := make([]BulkCreateResult, 0, len(entries))
	for _, e := range entries {
		method := e.PaymentMethod
		if method == "" {
			method = paymentMethod
		}
		now := time.Now().UTC()
		req := &CreatePaymentRequest{
			StudentID:     e.StudentID,
			Amount:        e.Amount,
			Month:         currentMonth,
			Year:          currentYear,
			PaymentMethod: method,
			Status:        "paid",
			InvoiceNumber: fmt.Sprintf("QP-%d", time.Now().UnixMilli()),
			Notes:         e.Notes,
			PaidDate:      &now,
			BranchID:      branchID,
		}
		p, err := s.Create(ctx, req, createdBy)
		if err != nil {
			results = append(results, BulkCreateResult{StudentID: e.StudentID, Error: err.Error()})
		} else {
			results = append(results, BulkCreateResult{StudentID: e.StudentID, Payment: p})
		}
	}
	return results
}

// GetByStudentAndPeriod returns payments for a student in a specific month/year
func (s *PaymentService) GetByStudentAndPeriod(ctx context.Context, studentID, month string, year int) ([]models.Payment, error) {
	query := `
		SELECT 
			id, student_id, amount, month, year, 
			payment_method, status, invoice_number, notes, paid_date,
			branch_id, created_by, financial_month_id, created_at
		FROM payments
		WHERE student_id = $1 AND month = $2 AND year = $3
		ORDER BY created_at DESC
	`

	rows, err := s.db.GetConn().QueryContext(ctx, query, studentID, month, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []models.Payment
	for rows.Next() {
		var p models.Payment
		err := rows.Scan(
			&p.ID, &p.StudentID, &p.Amount, &p.Month, &p.Year,
			&p.PaymentMethod, &p.Status, &p.InvoiceNumber, &p.Notes, &p.PaidDate,
			&p.BranchID, &p.CreatedBy, &p.FinancialMonthID, &p.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		p.PaymentMethod = models.PaymentMethod(normalizeStudentPaymentMethod(string(p.PaymentMethod)))
		payments = append(payments, p)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return payments, nil
}
