// Package service contains the finance-domain logic extracted from the monolith.
// Owns: expenses, incomes, expense_budgets.
// Heavy read operations (reports, summaries) use db.Read() — the read replica.
// Mutations use db.Write() — the primary.
package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/finance-service/internal/db"
)

// ── Models ─────────────────────────────────────────────────────────────────────

type Expense struct {
	ID            string    `json:"id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	Amount        float64   `json:"amount"`
	Category      string    `json:"category"`
	PaymentMethod string    `json:"paymentMethod"`
	Date          time.Time `json:"date"`
	BranchID      string    `json:"branchId"`
	Notes         *string   `json:"notes,omitempty"`
	CreatedBy     *string   `json:"createdBy,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
}

type ExpenseListResponse struct {
	Items      []Expense       `json:"items"`
	Indicators *ExpenseSummary `json:"indicators,omitempty"`
	Total      int             `json:"total"`
	Page       int             `json:"page"`
	Limit      int             `json:"limit"`
}

type ExpenseSummary struct {
	TotalAmount float64            `json:"totalAmount"`
	ByCategory  map[string]float64 `json:"byCategory"`
}

var ErrNotFound = errors.New("not found")

// ── ExpenseService ─────────────────────────────────────────────────────────────

type ExpenseService struct {
	db *db.DB
}

func NewExpenseService(database *db.DB) *ExpenseService {
	return &ExpenseService{db: database}
}

type ListFilter struct {
	BranchID      string
	Search        string
	Category      string
	PaymentMethod string
	Month         string
	Year          string
	Page          int
	Limit         int
}

// List queries the READ replica — safe for heavy report queries.
func (s *ExpenseService) List(ctx context.Context, f ListFilter) (*ExpenseListResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, db.ReportTimeout)
	defer cancel()

	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 500 {
		f.Limit = 20
	}
	offset := (f.Page - 1) * f.Limit

	where := "WHERE branch_id = $1"
	args := []interface{}{f.BranchID}
	n := 2

	if f.Category != "" {
		where += fmt.Sprintf(" AND category = $%d", n); args = append(args, f.Category); n++
	}
	if f.PaymentMethod != "" {
		where += fmt.Sprintf(" AND payment_method = $%d", n); args = append(args, f.PaymentMethod); n++
	}
	if f.Month != "" {
		where += fmt.Sprintf(" AND EXTRACT(month FROM date) = $%d", n); args = append(args, f.Month); n++
	}
	if f.Year != "" {
		where += fmt.Sprintf(" AND EXTRACT(year FROM date) = $%d", n); args = append(args, f.Year); n++
	}
	if f.Search != "" {
		where += fmt.Sprintf(" AND LOWER(title) LIKE LOWER($%d)", n)
		args = append(args, "%"+f.Search+"%"); n++
	}

	var total int
	if err := s.db.Read().QueryRowContext(ctx, "SELECT COUNT(*) FROM expenses "+where, args...).Scan(&total); err != nil {
		return nil, err
	}

	dataArgs := append([]interface{}{}, args...)
	dataArgs = append(dataArgs, f.Limit, offset)

	rows, err := s.db.Read().QueryContext(ctx,
		`SELECT id, title, COALESCE(description,''), amount, category, payment_method,
		        date, branch_id, notes, created_by, created_at
		 FROM expenses `+where+` ORDER BY date DESC LIMIT $`+
			fmt.Sprintf("%d OFFSET $%d", n, n+1), dataArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var expenses []Expense
	for rows.Next() {
		var e Expense
		if err := rows.Scan(&e.ID, &e.Title, &e.Description, &e.Amount, &e.Category,
			&e.PaymentMethod, &e.Date, &e.BranchID, &e.Notes, &e.CreatedBy, &e.CreatedAt); err != nil {
			return nil, err
		}
		expenses = append(expenses, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &ExpenseListResponse{Items: expenses, Total: total, Page: f.Page, Limit: f.Limit}, nil
}

// Summary returns totals grouped by category — uses READ replica.
func (s *ExpenseService) Summary(ctx context.Context, branchID, month, year string) (*ExpenseSummary, error) {
	ctx, cancel := context.WithTimeout(ctx, db.ReportTimeout)
	defer cancel()

	where := "WHERE branch_id = $1"
	args := []interface{}{branchID}
	n := 2
	if month != "" {
		where += fmt.Sprintf(" AND EXTRACT(month FROM date) = $%d", n); args = append(args, month); n++
	}
	if year != "" {
		where += fmt.Sprintf(" AND EXTRACT(year FROM date) = $%d", n); args = append(args, year); n++
	}

	rows, err := s.db.Read().QueryContext(ctx,
		"SELECT category, SUM(amount) FROM expenses "+where+" GROUP BY category", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	summary := &ExpenseSummary{ByCategory: map[string]float64{}}
	for rows.Next() {
		var cat string
		var amt float64
		if err := rows.Scan(&cat, &amt); err != nil {
			return nil, err
		}
		summary.ByCategory[cat] = amt
		summary.TotalAmount += amt
	}
	return summary, rows.Err()
}

// ConsolidatedData returns paginated expenses + summary for the branch's current financial month.
// Falls back to the calendar month when no open financial_months row exists.
func (s *ExpenseService) ConsolidatedData(ctx context.Context, branchID, month, year, search, category, paymentMethod, page, limit string) (*ExpenseListResponse, error) {
	if month == "" || year == "" {
		var curMonth string
		var curYear int
		err := s.db.Read().QueryRowContext(ctx,
			`SELECT month, year FROM financial_months
			 WHERE branch_id = $1 AND status = 'OPEN'
			 ORDER BY opened_at DESC LIMIT 1`, branchID,
		).Scan(&curMonth, &curYear)
		if err != nil {
			now := time.Now()
			curMonth = fmt.Sprintf("%d", int(now.Month()))
			curYear = now.Year()
		}
		if month == "" {
			month = curMonth
		}
		if year == "" {
			year = fmt.Sprintf("%d", curYear)
		}
	}

	pageInt, _ := strconv.Atoi(page)
	limitInt, _ := strconv.Atoi(limit)

	list, err := s.List(ctx, ListFilter{
		BranchID:      branchID,
		Month:         month,
		Year:          year,
		Search:        search,
		Category:      category,
		PaymentMethod: paymentMethod,
		Page:          pageInt,
		Limit:         limitInt,
	})
	if err != nil {
		return nil, err
	}

	summary, _ := s.Summary(ctx, branchID, month, year)
	list.Indicators = summary
	return list, nil
}

func (s *ExpenseService) GetByID(ctx context.Context, id string) (*Expense, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var e Expense
	err := s.db.Read().QueryRowContext(ctx,
		`SELECT id, title, COALESCE(description,''), amount, category, payment_method,
		        date, branch_id, notes, created_by, created_at
		 FROM expenses WHERE id = $1`, id,
	).Scan(&e.ID, &e.Title, &e.Description, &e.Amount, &e.Category,
		&e.PaymentMethod, &e.Date, &e.BranchID, &e.Notes, &e.CreatedBy, &e.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &e, err
}

func (s *ExpenseService) Create(ctx context.Context, e *Expense) (*Expense, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	e.ID = uuid.New().String()
	e.CreatedAt = time.Now().UTC()

	_, err := s.db.Write().ExecContext(ctx, `
		INSERT INTO expenses (id, title, description, amount, category, payment_method, date, branch_id, notes, created_by, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		e.ID, e.Title, e.Description, e.Amount, e.Category, e.PaymentMethod,
		e.Date, e.BranchID, e.Notes, e.CreatedBy, e.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return e, nil
}

func (s *ExpenseService) Update(ctx context.Context, id string, fields map[string]interface{}) (*Expense, error) {
	allowed := map[string]bool{
		"title": true, "description": true, "amount": true, "category": true,
		"payment_method": true, "date": true, "notes": true,
	}
	parts := []string{}
	args := []interface{}{}
	n := 1
	for k, v := range fields {
		if !allowed[k] {
			continue
		}
		parts = append(parts, fmt.Sprintf("%s = $%d", k, n))
		args = append(args, v)
		n++
	}
	if len(parts) == 0 {
		return s.GetByID(ctx, id)
	}
	args = append(args, id)

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	_, err := s.db.Write().ExecContext(ctx,
		"UPDATE expenses SET "+strings.Join(parts, ", ")+" WHERE id = $"+fmt.Sprintf("%d", n), args...)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *ExpenseService) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	_, err := s.db.Write().ExecContext(ctx, "DELETE FROM expenses WHERE id = $1", id)
	return err
}

// ── BudgetService ──────────────────────────────────────────────────────────────

type BudgetEntry struct {
	ID        string    `json:"id"`
	BranchID  string    `json:"branchId"`
	Category  string    `json:"category"`
	Month     string    `json:"month"`
	Year      int       `json:"year"`
	Amount    float64   `json:"amount"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type BudgetWithActual struct {
	BudgetEntry
	Actual      float64 `json:"actual"`
	UsedPct     float64 `json:"usedPct"`
	IsExceeded  bool    `json:"isExceeded"`
	IsNearLimit bool    `json:"isNearLimit"`
}

type UpsertBudgetRequest struct {
	BranchID string  `json:"branchId" binding:"required"`
	Category string  `json:"category" binding:"required"`
	Month    string  `json:"month"    binding:"required"`
	Year     int     `json:"year"     binding:"required"`
	Amount   float64 `json:"amount"   binding:"required,gte=0"`
}

type BudgetService struct {
	db *db.DB
}

func NewBudgetService(database *db.DB) *BudgetService {
	return &BudgetService{db: database}
}

func (s *BudgetService) Upsert(ctx context.Context, req *UpsertBudgetRequest) (*BudgetEntry, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	now := time.Now().UTC()
	var entry BudgetEntry
	err := s.db.Write().QueryRowContext(ctx, `
		INSERT INTO expense_budgets (branch_id, category, month, year, amount, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (branch_id, category, month, year)
		DO UPDATE SET amount = EXCLUDED.amount, updated_at = EXCLUDED.updated_at
		RETURNING id, branch_id, category, month, year, amount, created_at, updated_at
	`, req.BranchID, req.Category, req.Month, req.Year, req.Amount, now).
		Scan(&entry.ID, &entry.BranchID, &entry.Category, &entry.Month, &entry.Year,
			&entry.Amount, &entry.CreatedAt, &entry.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

func (s *BudgetService) GetByBranch(ctx context.Context, branchID, month string, year int) ([]BudgetWithActual, error) {
	ctx, cancel := context.WithTimeout(ctx, db.ReportTimeout)
	defer cancel()

	rows, err := s.db.Read().QueryContext(ctx, `
		SELECT
			eb.id, eb.branch_id, eb.category, eb.month, eb.year, eb.amount,
			eb.created_at, eb.updated_at,
			COALESCE(
				(SELECT SUM(e.amount)
				 FROM expenses e
				 WHERE e.branch_id = eb.branch_id
				   AND e.category  = eb.category
				   AND LPAD(EXTRACT(MONTH FROM e.date)::text, 2, '0') = eb.month
				   AND EXTRACT(YEAR  FROM e.date)::int = eb.year),
				0
			) AS actual
		FROM expense_budgets eb
		WHERE eb.branch_id = $1 AND eb.month = $2 AND eb.year = $3
		ORDER BY eb.category
	`, branchID, month, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []BudgetWithActual{}
	for rows.Next() {
		var b BudgetWithActual
		if err := rows.Scan(
			&b.ID, &b.BranchID, &b.Category, &b.Month, &b.Year, &b.Amount,
			&b.CreatedAt, &b.UpdatedAt, &b.Actual,
		); err != nil {
			return nil, err
		}
		if b.Amount > 0 {
			b.UsedPct = (b.Actual / b.Amount) * 100
		}
		b.IsExceeded = b.Actual > b.Amount
		b.IsNearLimit = b.UsedPct >= 90
		result = append(result, b)
	}
	return result, rows.Err()
}

func (s *BudgetService) Delete(ctx context.Context, branchID, category, month string, year int) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	res, err := s.db.Write().ExecContext(ctx,
		`DELETE FROM expense_budgets WHERE branch_id=$1 AND category=$2 AND month=$3 AND year=$4`,
		branchID, category, month, year)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("budget not found")
	}
	return nil
}
