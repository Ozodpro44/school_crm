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
)

type ExpenseService struct {
	db        *db.Database
	branchSvc *BranchService
}

func NewExpenseService(database *db.Database, branchSvc *BranchService) *ExpenseService {
	return &ExpenseService{db: database, branchSvc: branchSvc}
}

// ExpenseFilterInput replaces the long parameter list of GetByBranchIDWithFilters.
type ExpenseFilterInput struct {
	BranchID      string
	Page          string
	Limit         string
	Search        string
	Category      string
	PaymentMethod string
	Month         string
	Year          string
}

type CreateExpenseRequest struct {
	Title         string    `json:"title" binding:"required"`
	Description   string    `json:"description"`
	Amount        float64   `json:"amount" binding:"required,gt=0"`
	Category      string    `json:"category" binding:"required"`
	PaymentMethod string    `json:"paymentMethod" binding:"required"`
	Date          time.Time `json:"date" binding:"required"`
	BranchID      string    `json:"branchId" binding:"required"`
	Notes         *string   `json:"notes"`
}

type UpdateExpenseRequest struct {
	Title         *string    `json:"title"`
	Description   *string    `json:"description"`
	Amount        *float64   `json:"amount"`
	Category      *string    `json:"category"`
	PaymentMethod *string    `json:"paymentMethod"`
	Date          *time.Time `json:"date"`
	Notes         *string    `json:"notes"`
}

func (s *ExpenseService) Create(ctx context.Context, req *CreateExpenseRequest, createdBy string) (*models.Expense, error) {
	// Guard: financial month lock — expense date must fall in the branch's current month.
	if s.branchSvc != nil && req.BranchID != "" {
		currentMonth, currentYear, err := s.branchSvc.GetCurrentMonth(ctx, req.BranchID)
		if err != nil {
			return nil, fmt.Errorf("failed to verify financial month: %w", err)
		}
		expMonth := int(req.Date.Month())
		expYear := req.Date.Year()
		currentMonthInt, _ := strconv.Atoi(currentMonth)
		if expMonth != currentMonthInt || expYear != currentYear {
			return nil, fmt.Errorf("%w: can only create expenses for the branch's current month", ErrFinancialMonthLocked)
		}
	}

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
		CreatedAt:     time.Now().UTC(),
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

func (s *ExpenseService) Update(ctx context.Context, id string, req *UpdateExpenseRequest, isAdmin bool) (*models.Expense, error) {
	// Get existing expense
	expense, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Guard: financial month lock — non-admin users cannot edit past-month expenses.
	if s.branchSvc != nil {
		currentMonth, currentYear, err := s.branchSvc.GetCurrentMonth(ctx, expense.BranchID)
		if err != nil {
			return nil, fmt.Errorf("failed to verify financial month: %w", err)
		}
		expMonth := int(expense.Date.Month())
		expYear := expense.Date.Year()
		currentMonthInt, _ := strconv.Atoi(currentMonth)
		isPast := expMonth != currentMonthInt || expYear != currentYear
		if isPast && !isAdmin {
			return nil, fmt.Errorf("%w: cannot modify expenses from past months", ErrFinancialMonthLocked)
		}
	}

	// Update fields if provided
	if req.Title != nil {
		expense.Title = *req.Title
	}
	if req.Description != nil {
		expense.Description = *req.Description
	}
	if req.Amount != nil {
		expense.Amount = *req.Amount
	}
	if req.Category != nil {
		expense.Category = *req.Category
	}
	if req.PaymentMethod != nil {
		expense.PaymentMethod = models.PaymentMethod(*req.PaymentMethod)
	}
	if req.Date != nil {
		expense.Date = *req.Date
	}
	if req.Notes != nil {
		expense.Notes = req.Notes
	}

	query := `UPDATE expenses SET title = $1, description = $2, amount = $3, category = $4, 
	         payment_method = $5, date = $6, notes = $7 WHERE id = $8`

	_, err = s.db.GetConn().ExecContext(ctx, query, expense.Title, expense.Description, expense.Amount,
		expense.Category, expense.PaymentMethod, expense.Date, expense.Notes, id)

	if err != nil {
		return nil, err
	}

	return expense, nil
}

func (s *ExpenseService) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM expenses WHERE id = $1`
	_, err := s.db.GetConn().ExecContext(ctx, query, id)
	return err
}

func (s *ExpenseService) GetByBranchIDAndPeriod(ctx context.Context, branchID string, month int, year int) ([]models.Expense, error) {
	query := `SELECT id, title, description, amount, category, payment_method, date, branch_id, created_by, notes, created_at
	         FROM expenses 
	         WHERE branch_id = $1 
	         AND EXTRACT(MONTH FROM date) = $2 
	         AND EXTRACT(YEAR FROM date) = $3 
	         ORDER BY date DESC`

	rows, err := s.db.GetConn().QueryContext(ctx, query, branchID, month, year)
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

// GetByBranchIDWithFilters retrieves expenses with search, filters, and pagination
func (s *ExpenseService) GetByBranchIDWithFilters(ctx context.Context, in ExpenseFilterInput) (*models.ExpenseFilterResult, error) {
	page, _ := strconv.Atoi(in.Page)
	limit, _ := strconv.Atoi(in.Limit)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	offset := (page - 1) * limit

	branchID := in.BranchID
	search := in.Search
	category := in.Category
	paymentMethod := in.PaymentMethod
	month := in.Month
	year := in.Year

	// Build the WHERE clause dynamically
	whereClause := "WHERE branch_id = $1"
	args := []interface{}{branchID}
	argCount := 1

	// Add month/year filter
	if month != "" && year != "" {
		argCount++
		whereClause += fmt.Sprintf(" AND EXTRACT(MONTH FROM date) = $%d", argCount)
		monthInt, _ := strconv.Atoi(month)
		args = append(args, monthInt)
		
		argCount++
		whereClause += fmt.Sprintf(" AND EXTRACT(YEAR FROM date) = $%d", argCount)
		yearInt, _ := strconv.Atoi(year)
		args = append(args, yearInt)
	}

	// Add search filter (search in title, description, category)
	if search != "" {
		argCount++
		searchPattern := "%" + search + "%"
		whereClause += fmt.Sprintf(" AND (LOWER(title) LIKE LOWER($%d) OR LOWER(description) LIKE LOWER($%d) OR LOWER(category) LIKE LOWER($%d))", argCount, argCount, argCount)
		args = append(args, searchPattern)
	}

	// Add category filter
	if category != "" {
		argCount++
		whereClause += fmt.Sprintf(" AND category = $%d", argCount)
		args = append(args, category)
	}

	// Add payment method filter
	if paymentMethod != "" {
		argCount++
		whereClause += fmt.Sprintf(" AND payment_method = $%d", argCount)
		args = append(args, paymentMethod)
	}

	// Count total matching records
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM expenses %s", whereClause)
	var total int
	err := s.db.GetConn().QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, err
	}

	// Get paginated results
	argCount++
	limitArg := argCount
	argCount++
	offsetArg := argCount
	
	query := fmt.Sprintf(`SELECT id, title, description, amount, category, payment_method, date, branch_id, created_by, notes, created_at
		FROM expenses %s 
		ORDER BY date DESC 
		LIMIT $%d OFFSET $%d`, whereClause, limitArg, offsetArg)
	
	args = append(args, limit, offset)

	rows, err := s.db.GetConn().QueryContext(ctx, query, args...)
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

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &models.ExpenseFilterResult{
		Items: expenses,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// GetExpenseSummaryForPeriod returns expense statistics for a given period
func (s *ExpenseService) GetExpenseSummaryForPeriod(ctx context.Context, branchID string, month string, year int) (models.ExpenseSummary, error) {
	summary := models.ExpenseSummary{
		ByCategory: make(map[string]float64),
		ByMethod:   make(map[string]float64),
	}

	monthInt, _ := strconv.Atoi(month)

	// Get total amount
	totalQuery := `SELECT COALESCE(SUM(amount), 0) FROM expenses 
		WHERE branch_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3`
	err := s.db.GetConn().QueryRowContext(ctx, totalQuery, branchID, monthInt, year).Scan(&summary.TotalAmount)
	if err != nil {
		return summary, err
	}

	// Get by category
	categoryQuery := `SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses 
		WHERE branch_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3
		GROUP BY category`
	rows, err := s.db.GetConn().QueryContext(ctx, categoryQuery, branchID, monthInt, year)
	if err != nil {
		return summary, err
	}
	defer rows.Close()

	for rows.Next() {
		var cat string
		var amount float64
		if err := rows.Scan(&cat, &amount); err != nil {
			return summary, err
		}
		summary.ByCategory[cat] = amount
	}

	// Get by payment method
	methodQuery := `SELECT payment_method, COALESCE(SUM(amount), 0) as total FROM expenses 
		WHERE branch_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3
		GROUP BY payment_method`
	methodRows, err := s.db.GetConn().QueryContext(ctx, methodQuery, branchID, monthInt, year)
	if err != nil {
		return summary, err
	}
	defer methodRows.Close()

	for methodRows.Next() {
		var method string
		var amount float64
		if err := methodRows.Scan(&method, &amount); err != nil {
			return summary, err
		}
		summary.ByMethod[method] = amount
	}

	return summary, nil
}
