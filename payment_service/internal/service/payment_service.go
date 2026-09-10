// Package service contains the payment domain logic extracted from the monolith.
// During the Strangler Fig migration (Phase 3) this service reads from the same
// PostgreSQL instance as the monolith via the shared `public` schema.
// Once the monolith is decommissioned (P5.5), switch search_path to `payment`.
package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/school-crm/payment-service/internal/audit"
	"github.com/school-crm/payment-service/internal/db"
)

// ── Models ─────────────────────────────────────────────────────────────────────

type Payment struct {
	ID               string     `json:"id"`
	StudentID        string     `json:"studentId"`
	StudentName      string     `json:"studentName,omitempty"`
	Amount           float64    `json:"amount"`
	Month            string     `json:"month"`
	Year             int        `json:"year"`
	PaymentMethod    string     `json:"paymentMethod"`
	Status           string     `json:"status"`
	InvoiceNumber    string     `json:"invoiceNumber"`
	Notes            *string    `json:"notes,omitempty"`
	PaidDate         *time.Time `json:"paidDate,omitempty"`
	BranchID         string     `json:"branchId"`
	CreatedBy        *string    `json:"createdBy,omitempty"`
	CreatedByName    *string    `json:"createdByName,omitempty"`
	FinancialMonthID *string    `json:"financialMonthId,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
}

type StudentInfo struct {
	ID             string  `json:"id"`
	FullName       string  `json:"fullName"`
	Phone          string  `json:"phone"`
	ClassID        string  `json:"classId"`
	ClassName      string  `json:"className"`
	MonthlyPayment float64 `json:"monthlyPayment"`
}

type PaymentListResponse struct {
	Items      []Payment     `json:"items"`
	Students   []StudentInfo `json:"students"`
	Total      int           `json:"total"`
	Page       int           `json:"page"`
	Limit      int           `json:"limit"`
	NextCursor string        `json:"nextCursor,omitempty"`
}

// ── Requests ──────────────────────────────────────────────────────────────────

type CreatePaymentRequest struct {
	StudentID     string     `json:"studentId"      binding:"required"`
	Amount        float64    `json:"amount"         binding:"required,gt=0"`
	Month         string     `json:"month"          binding:"required"`
	Year          int        `json:"year"           binding:"required"`
	PaymentMethod string     `json:"paymentMethod"  binding:"required"`
	Status        string     `json:"status"         binding:"required"`
	InvoiceNumber string     `json:"invoiceNumber"  binding:"required"`
	Notes         *string    `json:"notes"`
	PaidDate      *time.Time `json:"paidDate"`
	BranchID      string     `json:"branchId"       binding:"required"`
}

type UpdatePaymentRequest struct {
	Amount        *float64   `json:"amount"         binding:"omitempty,gt=0"`
	PaymentMethod *string    `json:"paymentMethod"`
	Status        *string    `json:"status"`
	Notes         *string    `json:"notes"`
	PaidDate      *time.Time `json:"paidDate"`
}

type ListFilter struct {
	BranchID      string
	Month         string
	Year          string
	Status        string
	PaymentMethod string
	ClassID       string
	Search        string
	Page          string
	Limit         string
	Cursor        string // keyset cursor (created_at RFC3339)
}

type BulkEntry struct {
	StudentID     string  `json:"studentId"     binding:"required"`
	Amount        float64 `json:"amount"        binding:"required,gt=0"`
	PaymentMethod string  `json:"paymentMethod" binding:"required"`
	Notes         *string `json:"notes"`
}

// ── Service ───────────────────────────────────────────────────────────────────

var ErrNotFound = errors.New("payment not found")
var ErrMonthLocked = errors.New("financial_month_locked: cannot modify records from a past financial month")

type PaymentService struct {
	db    *db.DB
	redis *redis.Client
}

// HasBranchAccess reports whether userID (JWT-verified, with role) may
// access branchID. developer/super_admin bypass entirely (platform-level
// roles). Otherwise granted if the user's own branch matches, they're
// linked to it via branch_managers, or they're its admin.
//
// This exists because branch switching in the frontend does not reissue a
// JWT — the token's own branch_id stays fixed to the user's home branch,
// while BranchContext lets a manager/admin who legitimately administers
// several branches pick any of them and sends that choice as a plain
// branchId query param. Blindly trusting that query param (the previous
// behavior on List/Summary/ConsolidatedData/SearchStudents) let ANY
// authenticated caller — including a teacher — read another branch's data
// by editing the query string. Blindly preferring the JWT's own branch_id
// instead would break the legitimate multi-branch case. This checks
// authorization for whichever branchId was actually requested.
func (s *PaymentService) HasBranchAccess(ctx context.Context, userID, role, branchID string) (bool, error) {
	if role == "developer" || role == "super_admin" {
		return true, nil
	}
	if userID == "" || branchID == "" {
		return false, nil
	}
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	var exists bool
	err := s.db.Conn().QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM users WHERE id = $1 AND branch_id = $2
			UNION ALL
			SELECT 1 FROM branch_managers WHERE manager_id = $1 AND branch_id = $2
			UNION ALL
			SELECT 1 FROM branches WHERE id = $2 AND admin_id = $1
		)`, userID, branchID).Scan(&exists)
	return exists, err
}

func New(database *db.DB, redisClient *redis.Client) *PaymentService {
	return &PaymentService{db: database, redis: redisClient}
}

const cacheTTL = 30 * time.Second

// Create inserts a new payment record.
//
// The duplicate-payment guard and the insert run inside one transaction,
// serialized by a Postgres advisory lock keyed on student+month+year. Without
// this, two concurrent requests could both pass the COUNT check before
// either INSERTs, producing two "paid" payments for the same student/month
// (a double-charge). The lock is scoped to the transaction and released
// automatically on commit or rollback.
func (s *PaymentService) Create(ctx context.Context, req *CreatePaymentRequest, createdBy string) (*Payment, error) {
	p, err := s.create(ctx, req, createdBy)
	if err != nil {
		return nil, err
	}
	s.invalidateCache(p.BranchID)
	return p, nil
}

// create is Create without the cache invalidation, so BulkCreate can invoke
// it per-entry and invalidate once after the whole batch instead of once per
// entry (each invalidation is a Redis SCAN+DEL, wasteful to repeat N times
// for what's logically one write operation).
func (s *PaymentService) create(ctx context.Context, req *CreatePaymentRequest, createdBy string) (*Payment, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	locked, err := s.monthLocked(ctx, req.BranchID, req.Month, req.Year)
	if err != nil {
		return nil, err
	}
	if locked {
		return nil, ErrMonthLocked
	}

	tx, err := s.db.Conn().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback() // no-op after Commit

	lockKey := fmt.Sprintf("payment-dedupe:%s:%s:%d", req.StudentID, req.Month, req.Year)
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, lockKey); err != nil {
		return nil, fmt.Errorf("acquire dedupe lock: %w", err)
	}

	// Guard: one paid payment per student per month
	var count int
	if err := tx.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM payments WHERE student_id=$1 AND month=$2 AND year=$3 AND status='paid'`,
		req.StudentID, req.Month, req.Year,
	).Scan(&count); err != nil {
		return nil, fmt.Errorf("check existing payment: %w", err)
	}
	if count > 0 {
		return nil, fmt.Errorf("student already has a paid payment for %s/%d", req.Month, req.Year)
	}

	p := &Payment{
		ID:            uuid.New().String(),
		StudentID:     req.StudentID,
		Amount:        req.Amount,
		Month:         req.Month,
		Year:          req.Year,
		PaymentMethod: req.PaymentMethod,
		Status:        req.Status,
		InvoiceNumber: req.InvoiceNumber,
		Notes:         req.Notes,
		PaidDate:      req.PaidDate,
		BranchID:      req.BranchID,
		CreatedBy:     &createdBy,
		CreatedAt:     time.Now().UTC(),
	}

	_, err = tx.ExecContext(ctx,
		`INSERT INTO payments
		 (id, student_id, amount, month, year, payment_method, status, invoice_number, notes, paid_date, branch_id, created_by, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		p.ID, p.StudentID, p.Amount, p.Month, p.Year, p.PaymentMethod, p.Status,
		p.InvoiceNumber, p.Notes, p.PaidDate, p.BranchID, p.CreatedBy, p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return p, nil
}

// GetByID returns a single payment by ID, with the creator's name joined.
func (s *PaymentService) GetByID(ctx context.Context, id string) (*Payment, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var p Payment
	var createdByName sql.NullString
	err := s.db.Conn().QueryRowContext(ctx, `
		SELECT p.id, p.student_id, p.amount, p.month, p.year, p.payment_method,
		       p.status, p.invoice_number, p.notes, p.paid_date,
		       p.branch_id, p.created_by, p.financial_month_id, p.created_at,
		       u.full_name
		FROM payments p
		LEFT JOIN users u ON u.id = p.created_by
		WHERE p.id = $1`, id,
	).Scan(
		&p.ID, &p.StudentID, &p.Amount, &p.Month, &p.Year, &p.PaymentMethod,
		&p.Status, &p.InvoiceNumber, &p.Notes, &p.PaidDate,
		&p.BranchID, &p.CreatedBy, &p.FinancialMonthID, &p.CreatedAt,
		&createdByName,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if createdByName.Valid {
		p.CreatedByName = &createdByName.String
	}
	return &p, nil
}

// monthLocked reports whether the financial month a payment belongs to has
// been closed. Payments in a closed month are historical/reconciled and
// must not be modified or deleted. Absent a financial_months row for that
// branch+month+year (older data predating financial-month tracking), the
// month is treated as open.
func (s *PaymentService) monthLocked(ctx context.Context, branchID, month string, year int) (bool, error) {
	var status string
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT status FROM financial_months WHERE branch_id=$1 AND month=$2 AND year=$3`,
		branchID, month, year,
	).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return status == "CLOSED", nil
}

// Update applies a partial update to an existing payment.
func (s *PaymentService) Update(ctx context.Context, id string, req *UpdatePaymentRequest) (*Payment, error) {
	existing, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	locked, err := s.monthLocked(ctx, existing.BranchID, existing.Month, existing.Year)
	if err != nil {
		return nil, err
	}
	if locked {
		return nil, ErrMonthLocked
	}

	setParts := []string{}
	args := []interface{}{}
	n := 1

	if req.Amount != nil {
		setParts = append(setParts, fmt.Sprintf("amount = $%d", n))
		args = append(args, *req.Amount)
		n++
	}
	if req.PaymentMethod != nil {
		setParts = append(setParts, fmt.Sprintf("payment_method = $%d", n))
		args = append(args, *req.PaymentMethod)
		n++
	}
	if req.Status != nil {
		setParts = append(setParts, fmt.Sprintf("status = $%d", n))
		args = append(args, *req.Status)
		n++
	}
	if req.Notes != nil {
		setParts = append(setParts, fmt.Sprintf("notes = $%d", n))
		args = append(args, *req.Notes)
		n++
	}
	if req.PaidDate != nil {
		setParts = append(setParts, fmt.Sprintf("paid_date = $%d", n))
		args = append(args, *req.PaidDate)
		n++
	}

	if len(setParts) == 0 {
		return existing, nil
	}

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	query := fmt.Sprintf("UPDATE payments SET %s WHERE id = $%d",
		strings.Join(setParts, ", "), n)
	args = append(args, id)

	if _, err := s.db.Conn().ExecContext(ctx, query, args...); err != nil {
		return nil, err
	}

	s.invalidateCache(existing.BranchID)
	return s.GetByID(ctx, id)
}

// Delete removes a payment by ID.
func (s *PaymentService) Delete(ctx context.Context, id string) error {
	existing, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}

	locked, err := s.monthLocked(ctx, existing.BranchID, existing.Month, existing.Year)
	if err != nil {
		return err
	}
	if locked {
		return ErrMonthLocked
	}

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	_, err = s.db.Conn().ExecContext(ctx, `DELETE FROM payments WHERE id = $1`, id)
	if err == nil {
		s.invalidateCache(existing.BranchID)
	}
	return err
}

// List returns payments with pagination, filtering, and optional cursor.
// P3.4 NOTE: student data is fetched via a JOIN on the shared DB.
// When student_service is extracted, replace with a gRPC call.
func (s *PaymentService) List(ctx context.Context, f ListFilter) (*PaymentListResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	page, _ := strconv.Atoi(f.Page)
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(f.Limit)
	if limit < 1 || limit > 200 {
		limit = 20
	}

	yearInt, _ := strconv.Atoi(f.Year)
	useCursor := f.Cursor != ""
	offset := (page - 1) * limit

	// Dynamic WHERE clause
	where := "WHERE p.branch_id = $1"
	args := []interface{}{f.BranchID}
	n := 2

	if f.Month != "" {
		where += fmt.Sprintf(" AND p.month = $%d", n)
		args = append(args, f.Month)
		n++
	}
	if yearInt > 0 {
		where += fmt.Sprintf(" AND p.year = $%d", n)
		args = append(args, yearInt)
		n++
	}
	if f.Status != "" {
		where += fmt.Sprintf(" AND p.status = $%d", n)
		args = append(args, f.Status)
		n++
	}
	if f.PaymentMethod != "" {
		where += fmt.Sprintf(" AND p.payment_method = $%d", n)
		args = append(args, f.PaymentMethod)
		n++
	}
	if f.ClassID != "" {
		where += fmt.Sprintf(" AND s.class_id = $%d", n)
		args = append(args, f.ClassID)
		n++
	}
	if f.Search != "" {
		where += fmt.Sprintf(" AND (LOWER(s.full_name) LIKE LOWER($%d) OR s.phone LIKE $%d)", n, n)
		args = append(args, "%"+f.Search+"%")
		n++
	}
	if useCursor {
		where += fmt.Sprintf(" AND p.created_at < $%d", n)
		args = append(args, f.Cursor)
		n++
	}

	// Count
	var total int
	countSQL := `SELECT COUNT(*) FROM payments p JOIN students s ON s.id = p.student_id ` + where
	if err := s.db.Conn().QueryRowContext(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, err
	}

	// Data
	var dataArgs []interface{}
	dataArgs = append(dataArgs, args...)
	var pagingClause string
	if useCursor {
		pagingClause = fmt.Sprintf(" LIMIT $%d", n)
		dataArgs = append(dataArgs, limit)
	} else {
		pagingClause = fmt.Sprintf(" LIMIT $%d OFFSET $%d", n, n+1)
		dataArgs = append(dataArgs, limit, offset)
	}

	dataSQL := `
		SELECT p.id, p.student_id, p.amount, p.month, p.year, p.payment_method,
		       p.status, p.invoice_number, p.notes, p.paid_date,
		       p.branch_id, p.created_by, p.financial_month_id, p.created_at,
		       u.full_name  AS created_by_name,
		       s.full_name  AS student_name,
		       COALESCE(s.phone,'')        AS student_phone,
		       COALESCE(s.class_id::text,'') AS student_class_id,
		       COALESCE(c.name,'')         AS student_class_name,
		       COALESCE(s.monthly_payment,0) AS student_monthly_payment
		FROM payments p
		JOIN students s ON s.id = p.student_id
		LEFT JOIN users u ON u.id = p.created_by
		LEFT JOIN classes c ON c.id = s.class_id
		` + where + `
		ORDER BY p.created_at DESC` + pagingClause

	rows, err := s.db.Conn().QueryContext(ctx, dataSQL, dataArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []Payment
	studentMap := map[string]StudentInfo{}

	for rows.Next() {
		var p Payment
		var createdByName sql.NullString
		var stuName, stuPhone, stuClassID, stuClassName string
		var stuMonthly float64

		if err := rows.Scan(
			&p.ID, &p.StudentID, &p.Amount, &p.Month, &p.Year, &p.PaymentMethod,
			&p.Status, &p.InvoiceNumber, &p.Notes, &p.PaidDate,
			&p.BranchID, &p.CreatedBy, &p.FinancialMonthID, &p.CreatedAt,
			&createdByName, &stuName, &stuPhone, &stuClassID, &stuClassName, &stuMonthly,
		); err != nil {
			return nil, err
		}
		if createdByName.Valid {
			p.CreatedByName = &createdByName.String
		}
		p.StudentName = stuName
		payments = append(payments, p)

		if _, seen := studentMap[p.StudentID]; !seen {
			studentMap[p.StudentID] = StudentInfo{
				ID: p.StudentID, FullName: stuName, Phone: stuPhone,
				ClassID: stuClassID, ClassName: stuClassName, MonthlyPayment: stuMonthly,
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	students := make([]StudentInfo, 0, len(studentMap))
	for _, si := range studentMap {
		students = append(students, si)
	}

	var nextCursor string
	if len(payments) == limit {
		nextCursor = payments[len(payments)-1].CreatedAt.Format(time.RFC3339Nano)
	}

	return &PaymentListResponse{
		Items: payments, Students: students,
		Total: total, Page: page, Limit: limit, NextCursor: nextCursor,
	}, nil
}

// BulkCreate creates payments for multiple students in the current financial month.
func (s *PaymentService) BulkCreate(ctx context.Context, branchID, defaultMethod string, entries []BulkEntry, createdBy string) []map[string]interface{} {
	// Fetch current financial month for the branch
	var curMonth string
	var curYear int
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT month, year FROM financial_months
		 WHERE branch_id = $1 AND status = 'OPEN'
		 ORDER BY created_at DESC LIMIT 1`, branchID,
	).Scan(&curMonth, &curYear)
	if err != nil {
		// Fallback to calendar month
		now := time.Now()
		curMonth = fmt.Sprintf("%02d", int(now.Month()))
		curYear = now.Year()
	}

	results := make([]map[string]interface{}, 0, len(entries))
	anySucceeded := false
	for _, e := range entries {
		method := e.PaymentMethod
		if method == "" {
			method = defaultMethod
		}
		p, err := s.create(ctx, &CreatePaymentRequest{
			StudentID:     e.StudentID,
			Amount:        e.Amount,
			Month:         curMonth,
			Year:          curYear,
			PaymentMethod: method,
			Status:        "paid",
			InvoiceNumber: fmt.Sprintf("BULK-%s-%s", time.Now().Format("200601"), uuid.New().String()[:8]),
			Notes:         e.Notes,
			BranchID:      branchID,
		}, createdBy)

		if err != nil {
			results = append(results, map[string]interface{}{"studentId": e.StudentID, "error": err.Error()})
		} else {
			results = append(results, map[string]interface{}{"studentId": e.StudentID, "payment": p})
			anySucceeded = true
		}
	}
	// One cache invalidation for the whole batch instead of one per entry.
	if anySucceeded {
		s.invalidateCache(branchID)
	}
	return results
}

// Summary returns totals by status and by payment method for a branch+period.
func (s *PaymentService) Summary(ctx context.Context, branchID, month string, year int) (map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var paid, unpaid, partial sql.NullFloat64
	err := s.db.Conn().QueryRowContext(ctx, `
		SELECT
			SUM(CASE WHEN status = 'paid'    THEN amount ELSE 0 END),
			SUM(CASE WHEN status = 'unpaid'  THEN amount ELSE 0 END),
			SUM(CASE WHEN status = 'partial' THEN amount ELSE 0 END)
		FROM payments
		WHERE branch_id = $1 AND month = $2 AND year = $3`,
		branchID, month, year,
	).Scan(&paid, &unpaid, &partial)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"totalPaid":    paid.Float64,
		"totalUnpaid":  unpaid.Float64,
		"totalPartial": partial.Float64,
	}, nil
}

// StudentHistory returns all payments for a student, sorted newest first.
// StudentBranch returns the branch a student belongs to — used to authorize
// StudentHistory, which (unlike other endpoints) has no branchId parameter
// of its own; the caller's access is checked against the student's actual
// branch instead.
func (s *PaymentService) StudentBranch(ctx context.Context, studentID string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	var branchID string
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT branch_id FROM students WHERE id = $1`, studentID,
	).Scan(&branchID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	return branchID, err
}

func (s *PaymentService) StudentHistory(ctx context.Context, studentID string) ([]Payment, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT p.id, p.student_id, p.amount, p.month, p.year, p.payment_method,
		       p.status, p.invoice_number, p.notes, p.paid_date,
		       p.branch_id, p.created_by, p.financial_month_id, p.created_at,
		       u.full_name
		FROM payments p
		LEFT JOIN users u ON u.id = p.created_by
		WHERE p.student_id = $1
		ORDER BY p.year DESC, p.month DESC, p.created_at DESC`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []Payment
	for rows.Next() {
		var p Payment
		var createdByName sql.NullString
		if err := rows.Scan(
			&p.ID, &p.StudentID, &p.Amount, &p.Month, &p.Year, &p.PaymentMethod,
			&p.Status, &p.InvoiceNumber, &p.Notes, &p.PaidDate,
			&p.BranchID, &p.CreatedBy, &p.FinancialMonthID, &p.CreatedAt,
			&createdByName,
		); err != nil {
			return nil, err
		}
		if createdByName.Valid {
			p.CreatedByName = &createdByName.String
		}
		payments = append(payments, p)
	}
	return payments, rows.Err()
}

// ── Subscription (read-only) ──────────────────────────────────────────────────

type Subscription struct {
	ID        string     `json:"id"`
	StudentID string     `json:"studentId"`
	PlanID    string     `json:"planId"`
	Status    string     `json:"status"`
	StartDate time.Time  `json:"startDate"`
	EndDate   *time.Time `json:"endDate,omitempty"`
	BranchID  string     `json:"branchId"`
	CreatedAt time.Time  `json:"createdAt"`
}

// ListSubscriptions returns subscriptions for a branch, optionally filtered by status.
// P3.4 NOTE: read directly from shared DB; subscription writes remain in monolith during P3.
func (s *PaymentService) ListSubscriptions(ctx context.Context, branchID, status string) ([]Subscription, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	where := "WHERE branch_id = $1"
	args := []interface{}{branchID}
	if status != "" {
		where += " AND status = $2"
		args = append(args, status)
	}

	rows, err := s.db.Conn().QueryContext(ctx,
		`SELECT id, student_id, plan_id, status, start_date, end_date, branch_id, created_at
		 FROM subscriptions `+where+` ORDER BY created_at DESC`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []Subscription
	for rows.Next() {
		var sub Subscription
		if err := rows.Scan(&sub.ID, &sub.StudentID, &sub.PlanID, &sub.Status,
			&sub.StartDate, &sub.EndDate, &sub.BranchID, &sub.CreatedAt); err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	return subs, rows.Err()
}

// HasActiveSubscription checks a single student directly in SQL, instead of
// listing every active subscription for the branch and scanning for a match
// in Go (the previous approach in the gRPC CheckSubscriptionActive handler)
// — that pattern scales with branch size on every access-gate check.
func (s *PaymentService) HasActiveSubscription(ctx context.Context, branchID, studentID string) (active bool, planID string, err error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	err = s.db.Conn().QueryRowContext(ctx,
		`SELECT plan_id FROM subscriptions
		 WHERE branch_id = $1 AND student_id = $2 AND status = 'active'
		 ORDER BY created_at DESC LIMIT 1`, branchID, studentID,
	).Scan(&planID)
	if errors.Is(err, sql.ErrNoRows) {
		return false, "", nil
	}
	if err != nil {
		return false, "", err
	}
	return true, planID, nil
}

// ── ConsolidatedData ──────────────────────────────────────────────────────────

type Indicators struct {
	TotalPaid   float64            `json:"totalPaid"`
	TotalUnpaid float64            `json:"totalUnpaid"`
	ByMethod    map[string]float64 `json:"byMethod"`
}

type ConsolidatedPaymentResponse struct {
	Items      []Payment     `json:"items"`
	Students   []StudentInfo `json:"students"`
	Indicators Indicators    `json:"indicators"`
	Total      int           `json:"total"`
	Page       int           `json:"page"`
	Limit      int           `json:"limit"`
	NextCursor string        `json:"nextCursor,omitempty"`
}

// ConsolidatedData returns paginated payments + summary indicators for a period.
// If month/year are not supplied, defaults to the branch's open financial month.
// ConsolidatedData is a read-through cache wrapper around
// consolidatedDataUncached: this is the main payments-dashboard endpoint,
// hit on every page load, and cacheTTL/the Redis client were already
// provisioned for exactly this but never actually used for reads (only
// invalidateCache on writes). A cache miss or Redis error falls through to
// the real query — caching is an optimization, never a hard dependency.
// Cursor-paginated requests skip the cache: their key space is effectively
// unbounded (a distinct cursor value on every page), so caching them would
// only fill Redis with entries that are each read once.
func (s *PaymentService) ConsolidatedData(ctx context.Context, branchID, month, year, page, limit, cursor, search, status, paymentMethod, classID string) (*ConsolidatedPaymentResponse, error) {
	if s.redis == nil || cursor != "" {
		return s.consolidatedDataUncached(ctx, branchID, month, year, page, limit, cursor, search, status, paymentMethod, classID)
	}

	key := fmt.Sprintf("crm:payments:%s:consolidated:%s:%s:%s:%s:%s:%s:%s:%s",
		branchID, month, year, page, limit, search, status, paymentMethod, classID)

	if cached, err := s.redis.Get(ctx, key).Result(); err == nil {
		var resp ConsolidatedPaymentResponse
		if jsonErr := json.Unmarshal([]byte(cached), &resp); jsonErr == nil {
			return &resp, nil
		}
		slog.Warn("consolidated data: cache entry unmarshal failed, falling through", "key", key, "error", err)
	} else if err != redis.Nil {
		slog.Warn("consolidated data: cache read failed, falling through", "key", key, "error", err)
	}

	resp, err := s.consolidatedDataUncached(ctx, branchID, month, year, page, limit, cursor, search, status, paymentMethod, classID)
	if err != nil {
		return nil, err
	}

	if encoded, jsonErr := json.Marshal(resp); jsonErr == nil {
		if setErr := s.redis.Set(ctx, key, encoded, cacheTTL).Err(); setErr != nil {
			slog.Warn("consolidated data: cache write failed", "key", key, "error", setErr)
		}
	}
	return resp, nil
}

func (s *PaymentService) consolidatedDataUncached(ctx context.Context, branchID, month, year, page, limit, cursor, search, status, paymentMethod, classID string) (*ConsolidatedPaymentResponse, error) {
	if month == "" || year == "" {
		var curMonth string
		var curYear int
		err := s.db.Conn().QueryRowContext(ctx,
			`SELECT month, year FROM financial_months
			 WHERE branch_id = $1 AND status = 'OPEN'
			 ORDER BY created_at DESC LIMIT 1`, branchID,
		).Scan(&curMonth, &curYear)
		if err != nil {
			now := time.Now()
			curMonth = fmt.Sprintf("%02d", int(now.Month()))
			curYear = now.Year()
		}
		if month == "" {
			month = curMonth
		}
		if year == "" {
			year = fmt.Sprintf("%d", curYear)
		}
	}

	listResult, err := s.List(ctx, ListFilter{
		BranchID:      branchID,
		Month:         month,
		Year:          year,
		Page:          page,
		Limit:         limit,
		Cursor:        cursor,
		Search:        search,
		Status:        status,
		PaymentMethod: paymentMethod,
		ClassID:       classID,
	})
	if err != nil {
		return nil, err
	}

	yearInt, _ := strconv.Atoi(year)
	ind := Indicators{
		ByMethod: map[string]float64{"click": 0, "cash": 0, "bank": 0, "terminal": 0},
	}

	ctxS, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	// Errors here are logged rather than failing the whole request — the
	// payment list above already succeeded and is the primary payload — but
	// they must not be swallowed silently, or a broken summary query reports
	// TotalPaid/TotalUnpaid as 0 with no indication anything went wrong.
	rows, err := s.db.Conn().QueryContext(ctxS, `
		SELECT payment_method,
		       COALESCE(SUM(amount) FILTER (WHERE status IN ('paid','partial')), 0)
		FROM payments
		WHERE branch_id = $1 AND month = $2 AND year = $3
		GROUP BY payment_method`, branchID, month, yearInt)
	if err != nil {
		slog.Warn("consolidated data: totalPaid/byMethod query failed", "branch_id", branchID, "error", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var method string
			var amt float64
			if err := rows.Scan(&method, &amt); err != nil {
				slog.Warn("consolidated data: scan payment_method row failed", "branch_id", branchID, "error", err)
				continue
			}
			ind.TotalPaid += amt
			ind.ByMethod[method] += amt
		}
		if err := rows.Err(); err != nil {
			slog.Warn("consolidated data: totalPaid/byMethod row iteration failed", "branch_id", branchID, "error", err)
		}
	}

	if err := s.db.Conn().QueryRowContext(ctxS, `
		SELECT COALESCE(SUM(s.monthly_payment - COALESCE(pa.paid,0)), 0)
		FROM students s
		LEFT JOIN (
			SELECT student_id, SUM(amount) AS paid
			FROM payments
			WHERE branch_id=$1 AND month=$2 AND year=$3 AND status IN ('paid','partial')
			GROUP BY student_id
		) pa ON pa.student_id=s.id
		WHERE s.branch_id=$1 AND s.status='active'
		  AND COALESCE(pa.paid,0) < s.monthly_payment`, branchID, month, yearInt,
	).Scan(&ind.TotalUnpaid); err != nil {
		slog.Warn("consolidated data: totalUnpaid query failed", "branch_id", branchID, "error", err)
	}

	return &ConsolidatedPaymentResponse{
		Items:      listResult.Items,
		Students:   listResult.Students,
		Indicators: ind,
		Total:      listResult.Total,
		Page:       listResult.Page,
		Limit:      listResult.Limit,
		NextCursor: listResult.NextCursor,
	}, nil
}

// ── SearchStudents ────────────────────────────────────────────────────────────

type StudentPaymentInfo struct {
	ID             string  `json:"id"`
	FullName       string  `json:"fullName"`
	ClassID        string  `json:"classId"`
	Phone          string  `json:"phone"`
	MonthlyPayment float64 `json:"monthlyPayment"`
	Status         string  `json:"status"`
	AmountPaid     float64 `json:"amountPaid"`
	PaymentStatus  string  `json:"paymentStatus"` // paid | partial | not_paid
	Remaining      float64 `json:"remaining"`
}

type SearchStudentsFilter struct {
	BranchID      string
	Search        string
	ClassID       string
	StudentStatus string
	PaymentStatus string
	Limit         int
	Offset        int
}

type SearchStudentsResponse struct {
	Data   []StudentPaymentInfo `json:"data"`
	Total  int                  `json:"total"`
	Limit  int                  `json:"limit"`
	Offset int                  `json:"offset"`
}

// SearchStudents returns students enriched with their payment status for the
// branch's current financial month. Uses a single CTE to avoid N+1 queries.
func (s *PaymentService) SearchStudents(ctx context.Context, f SearchStudentsFilter) (*SearchStudentsResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, db.ReportTimeout)
	defer cancel()

	// Resolve current financial month for this branch.
	var curMonth string
	var curYear int
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT month, year FROM financial_months
		 WHERE branch_id = $1 AND status = 'OPEN'
		 ORDER BY created_at DESC LIMIT 1`, f.BranchID,
	).Scan(&curMonth, &curYear)
	if err != nil {
		now := time.Now()
		curMonth = fmt.Sprintf("%02d", int(now.Month()))
		curYear = now.Year()
	}

	if f.Limit <= 0 || f.Limit > 500 {
		f.Limit = 200
	}

	where := "WHERE s.branch_id = $1"
	args := []interface{}{f.BranchID}
	n := 2

	if f.Search != "" {
		where += fmt.Sprintf(" AND (LOWER(s.full_name) LIKE LOWER($%d) OR s.phone LIKE $%d)", n, n)
		args = append(args, "%"+f.Search+"%")
		n++
	}
	if f.ClassID != "" {
		where += fmt.Sprintf(" AND s.class_id = $%d", n)
		args = append(args, f.ClassID)
		n++
	}
	if f.StudentStatus != "" {
		where += fmt.Sprintf(" AND s.status = $%d", n)
		args = append(args, f.StudentStatus)
		n++
	}

	// payment_status filter applied via HAVING after aggregation
	monthN, yearN, limitN, offsetN := n, n+1, n+2, n+3
	args = append(args, curMonth, curYear, f.Limit, f.Offset)

	query := fmt.Sprintf(`
		WITH pay_agg AS (
			SELECT student_id,
			       COALESCE(SUM(amount) FILTER (WHERE status IN ('paid','partial')), 0) AS amount_paid
			FROM payments
			WHERE branch_id = $1
			  AND month = $%d
			  AND year  = $%d
			GROUP BY student_id
		)
		SELECT s.id, s.full_name, COALESCE(s.class_id::text,''),
		       COALESCE(s.phone,''), s.monthly_payment, s.status,
		       COALESCE(pa.amount_paid, 0) AS amount_paid,
		       CASE
		           WHEN s.monthly_payment = 0 THEN 'paid'
		           WHEN COALESCE(pa.amount_paid, 0) >= s.monthly_payment THEN 'paid'
		           WHEN COALESCE(pa.amount_paid, 0) > 0 THEN 'partial'
		           ELSE 'not_paid'
		       END AS payment_status,
		       GREATEST(s.monthly_payment - COALESCE(pa.amount_paid, 0), 0) AS remaining
		FROM students s
		LEFT JOIN pay_agg pa ON pa.student_id = s.id
		%s
		ORDER BY s.full_name
		LIMIT $%d OFFSET $%d`, monthN, yearN, where, limitN, offsetN)

	// Count query (same filters, no pagination)
	countArgs := args[:len(args)-2] // drop limit/offset
	var total int
	countQuery := fmt.Sprintf(`
		WITH pay_agg AS (
			SELECT student_id,
			       COALESCE(SUM(amount) FILTER (WHERE status IN ('paid','partial')), 0) AS amount_paid
			FROM payments
			WHERE branch_id = $1
			  AND month = $%d
			  AND year  = $%d
			GROUP BY student_id
		)
		SELECT COUNT(*) FROM students s
		LEFT JOIN pay_agg pa ON pa.student_id = s.id
		%s`, monthN, yearN, where)
	if err := s.db.Conn().QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, err
	}

	rows, err := s.db.Conn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	data := make([]StudentPaymentInfo, 0)
	for rows.Next() {
		var sp StudentPaymentInfo
		var classID string
		if err := rows.Scan(&sp.ID, &sp.FullName, &classID, &sp.Phone,
			&sp.MonthlyPayment, &sp.Status, &sp.AmountPaid, &sp.PaymentStatus, &sp.Remaining); err != nil {
			return nil, err
		}
		sp.ClassID = classID
		// Apply in-memory paymentStatus filter (avoids complex HAVING clause)
		if f.PaymentStatus != "" && sp.PaymentStatus != f.PaymentStatus {
			continue
		}
		data = append(data, sp)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &SearchStudentsResponse{Data: data, Total: total, Limit: f.Limit, Offset: f.Offset}, nil
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

func (s *PaymentService) invalidateCache(branchID string) {
	if s.redis == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	// Delete all keys matching the branch pattern
	iter := s.redis.Scan(ctx, 0, "crm:payments:"+branchID+":*", 100).Iterator()
	for iter.Next(ctx) {
		_ = s.redis.Del(ctx, iter.Val())
	}
}

// Audit writes an audit log entry. Best-effort — errors are only logged.
func (s *PaymentService) Audit(ctx context.Context, branchID, userID, action, resource, resourceID, description string) {
	audit.Log(ctx, s.db.Conn(), branchID, userID, action, resource, resourceID, description)
}
