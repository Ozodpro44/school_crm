package service

import (
	"context"
	"database/sql"
	"time"

	"github.com/school-crm/backend/internal/db"
)

type ReportService struct {
	db *db.Database
}

func NewReportService(database *db.Database) *ReportService {
	return &ReportService{db: database}
}

// PaymentReportItem represents a payment report entry
type PaymentReportItem struct {
	ID            string     `json:"id"`
	StudentID     string     `json:"studentId"`
	StudentName   string     `json:"studentName"`
	ClassName     string     `json:"className"`
	Amount        float64    `json:"amount"`
	Month         string     `json:"month"`
	Year          int        `json:"year"`
	Status        string     `json:"status"`
	PaymentMethod string     `json:"paymentMethod"`
	PaidDate      *time.Time `json:"paidDate"`
	CreatedBy     *string    `json:"createdBy"`
	CreatedAt     time.Time  `json:"createdAt"`
}

// SalaryReportItem represents a salary report entry
type SalaryReportItem struct {
	ID            string     `json:"id"`
	TeacherID     string     `json:"teacherId"`
	TeacherName   string     `json:"teacherName"`
	Amount        float64    `json:"amount"`
	Month         string     `json:"month"`
	Year          int        `json:"year"`
	Status        string     `json:"status"`
	PaymentMethod string     `json:"paymentMethod"`
	PaidDate      *time.Time `json:"paidDate"`
	CreatedBy     *string    `json:"createdBy"`
	CreatedAt     time.Time  `json:"createdAt"`
}

// DebtorReportItem represents a debtor report entry
type DebtorReportItem struct {
	ID             string  `json:"id"`
	StudentID      string  `json:"studentId"`
	StudentName    string  `json:"studentName"`
	ClassName      string  `json:"className"`
	Month          string  `json:"month"`
	Year           int     `json:"year"`
	MonthlyPayment float64 `json:"monthlyPayment"`
	PaidAmount     float64 `json:"paidAmount"`
	DueAmount      float64 `json:"dueAmount"`
	Status         string  `json:"status"`
}

// ExpenseReportItem represents an expense report entry
type ExpenseReportItem struct {
	ID            string    `json:"id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	Category      string    `json:"category"`
	Amount        float64   `json:"amount"`
	PaymentMethod string    `json:"paymentMethod"`
	Date          time.Time `json:"date"`
	CreatedBy     string    `json:"createdBy"`
	Notes         *string   `json:"notes"`
	CreatedAt     time.Time `json:"createdAt"`
}

// FinancialSummary represents financial summary data
type FinancialSummary struct {
	TotalIncome      float64            `json:"totalIncome"`
	TotalSalaries    float64            `json:"totalSalaries"`
	TotalExpenses    float64            `json:"totalExpenses"`
	NetProfit        float64            `json:"netProfit"`
	PaymentsByMethod map[string]float64 `json:"paymentsByMethod"`
	SalariesByStatus map[string]float64 `json:"salariesByStatus"`
}

// GetPaymentReport returns a list of payments with student and class info
func (s *ReportService) GetPaymentReport(ctx context.Context, branchID string, startDate, endDate time.Time, status, classID string) ([]PaymentReportItem, error) {
	query := `
	SELECT 
		p.id,
		p.student_id,
		st.full_name as student_name,
		c.name as class_name,
		p.amount,
		p.month,
		p.year,
		p.status,
		p.payment_method,
		p.paid_date,
		p.created_by,
		p.created_at
	FROM payments p
	JOIN students st ON p.student_id = st.id
	LEFT JOIN classes c ON st.class_id = c.id
	WHERE p.branch_id = $1
		AND p.created_at >= $2
		AND p.created_at <= $3
	`

	args := []interface{}{branchID, startDate, endDate.AddDate(0, 0, 1)}

	if status != "all" && status != "" {
		query += " AND p.status = $4"
		args = append([]interface{}{branchID, startDate, endDate.AddDate(0, 0, 1), status}, args[3:]...)
	}

	if classID != "all" && classID != "" {
		query += " AND st.class_id = $5"
		args = append(args, classID)
	}

	query += " ORDER BY p.created_at DESC"

	rows, err := s.db.GetConn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []PaymentReportItem
	for rows.Next() {
		var item PaymentReportItem
		if err := rows.Scan(
			&item.ID,
			&item.StudentID,
			&item.StudentName,
			&item.ClassName,
			&item.Amount,
			&item.Month,
			&item.Year,
			&item.Status,
			&item.PaymentMethod,
			&item.PaidDate,
			&item.CreatedBy,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

// GetSalaryReport returns a list of salaries with teacher info
func (s *ReportService) GetSalaryReport(ctx context.Context, branchID string, startDate, endDate time.Time, status string) ([]SalaryReportItem, error) {
	query := `
	SELECT 
		sal.id,
		sal.teacher_id,
		t.full_name as teacher_name,
		sal.amount,
		sal.month,
		sal.year,
		sal.status,
		sal.payment_method,
		sal.paid_date,
		sal.created_by,
		sal.created_at
	FROM salaries sal
	JOIN teachers t ON sal.teacher_id = t.id
	WHERE sal.branch_id = $1
		AND sal.created_at >= $2
		AND sal.created_at <= $3
	`

	args := []interface{}{branchID, startDate, endDate.AddDate(0, 0, 1)}

	if status != "all" && status != "" {
		query += " AND sal.status = $4"
		args = append(args, status)
	}

	query += " ORDER BY sal.created_at DESC"

	rows, err := s.db.GetConn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []SalaryReportItem
	for rows.Next() {
		var item SalaryReportItem
		if err := rows.Scan(
			&item.ID,
			&item.TeacherID,
			&item.TeacherName,
			&item.Amount,
			&item.Month,
			&item.Year,
			&item.Status,
			&item.PaymentMethod,
			&item.PaidDate,
			&item.CreatedBy,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

// GetDebtorsReport returns students who owe money for a specific month/year
func (s *ReportService) GetDebtorsReport(ctx context.Context, branchID string, month string, year int, classID string) ([]DebtorReportItem, error) {
	query := `
	SELECT 
		st.id,
		st.full_name,
		c.name as class_name,
		st.monthly_payment,
		st.status,
		COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) as paid_amount
	FROM students st
	LEFT JOIN classes c ON st.class_id = c.id
	LEFT JOIN payments p ON st.id = p.student_id AND p.month = $1 AND p.year = $2 AND p.branch_id = $3
	WHERE st.branch_id = $3 AND st.status = 'active'
	`

	args := []interface{}{month, year, branchID}

	if classID != "all" && classID != "" {
		query += " AND st.class_id = $4"
		args = append(args, classID)
	}

	query += " GROUP BY st.id, st.full_name, c.name, st.monthly_payment, st.status"
	query += " ORDER BY st.full_name ASC"

	rows, err := s.db.GetConn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []DebtorReportItem
	for rows.Next() {
		var (
			id             string
			name           string
			className      sql.NullString
			monthlyPayment float64
			status         string
			paidAmount     float64
		)

		if err := rows.Scan(&id, &name, &className, &monthlyPayment, &status, &paidAmount); err != nil {
			return nil, err
		}

		dueAmount := monthlyPayment - paidAmount
		if dueAmount < 0 {
			dueAmount = 0
		}

		if dueAmount > 0 { // Only include actual debtors
			item := DebtorReportItem{
				ID:             id + "-" + month + "-" + string(rune(year)),
				StudentID:      id,
				StudentName:    name,
				ClassName:      className.String,
				Month:          month,
				Year:           year,
				MonthlyPayment: monthlyPayment,
				PaidAmount:     paidAmount,
				DueAmount:      dueAmount,
				Status:         status,
			}
			items = append(items, item)
		}
	}

	return items, rows.Err()
}

// GetExpensesReport returns a list of expenses
func (s *ReportService) GetExpensesReport(ctx context.Context, branchID string, startDate, endDate time.Time, category string) ([]ExpenseReportItem, error) {
	query := `
	SELECT 
		id,
		title,
		description,
		category,
		amount,
		payment_method,
		date,
		created_by,
		notes,
		created_at
	FROM expenses
	WHERE branch_id = $1
		AND date >= $2
		AND date <= $3
	`

	args := []interface{}{branchID, startDate, endDate.AddDate(0, 0, 1)}

	if category != "all" && category != "" {
		query += " AND category = $4"
		args = append(args, category)
	}

	query += " ORDER BY date DESC"

	rows, err := s.db.GetConn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []ExpenseReportItem
	for rows.Next() {
		var item ExpenseReportItem
		if err := rows.Scan(
			&item.ID,
			&item.Title,
			&item.Description,
			&item.Category,
			&item.Amount,
			&item.PaymentMethod,
			&item.Date,
			&item.CreatedBy,
			&item.Notes,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

// GetFinancialSummary returns a financial summary for a date range
func (s *ReportService) GetFinancialSummary(ctx context.Context, branchID string, startDate, endDate time.Time) (*FinancialSummary, error) {
	// Get payment income
	var totalIncome, totalPaid, totalUnpaid, totalPartial sql.NullFloat64
	incomeQuery := `
	SELECT 
		COALESCE(SUM(amount), 0) as total,
		COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid,
		COALESCE(SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END), 0) as unpaid,
		COALESCE(SUM(CASE WHEN status = 'partial' THEN amount ELSE 0 END), 0) as partial
	FROM payments
	WHERE branch_id = $1 AND created_at >= $2 AND created_at <= $3
	`

	err := s.db.GetConn().QueryRowContext(ctx, incomeQuery, branchID, startDate, endDate.AddDate(0, 0, 1)).Scan(
		&totalIncome, &totalPaid, &totalUnpaid, &totalPartial,
	)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Get salaries expense
	var totalSalaries sql.NullFloat64
	salaryQuery := `
	SELECT COALESCE(SUM(amount), 0)
	FROM salaries
	WHERE branch_id = $1 AND created_at >= $2 AND created_at <= $3 AND status = 'paid'
	`

	err = s.db.GetConn().QueryRowContext(ctx, salaryQuery, branchID, startDate, endDate.AddDate(0, 0, 1)).Scan(&totalSalaries)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Get other expenses
	var totalExpenses sql.NullFloat64
	expenseQuery := `
	SELECT COALESCE(SUM(amount), 0)
	FROM expenses
	WHERE branch_id = $1 AND date >= $2 AND date <= $3
	`

	err = s.db.GetConn().QueryRowContext(ctx, expenseQuery, branchID, startDate, endDate.AddDate(0, 0, 1)).Scan(&totalExpenses)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Get payments by method
	paymentsByMethod := make(map[string]float64)
	methodQuery := `
	SELECT payment_method, COALESCE(SUM(amount), 0)
	FROM payments
	WHERE branch_id = $1 AND created_at >= $2 AND created_at <= $3 AND status = 'paid'
	GROUP BY payment_method
	`

	rows, err := s.db.GetConn().QueryContext(ctx, methodQuery, branchID, startDate, endDate.AddDate(0, 0, 1))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var method string
		var amount float64
		if err := rows.Scan(&method, &amount); err != nil {
			return nil, err
		}
		paymentsByMethod[method] = amount
	}

	// Get salaries by status
	salariesByStatus := make(map[string]float64)
	statusQuery := `
	SELECT status, COALESCE(SUM(amount), 0)
	FROM salaries
	WHERE branch_id = $1 AND created_at >= $2 AND created_at <= $3
	GROUP BY status
	`

	rows, err = s.db.GetConn().QueryContext(ctx, statusQuery, branchID, startDate, endDate.AddDate(0, 0, 1))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var amount float64
		if err := rows.Scan(&status, &amount); err != nil {
			return nil, err
		}
		salariesByStatus[status] = amount
	}

	income := totalIncome.Float64
	salaries := totalSalaries.Float64
	expenses := totalExpenses.Float64
	totalExp := salaries + expenses
	profit := income - totalExp

	return &FinancialSummary{
		TotalIncome:      income,
		TotalSalaries:    salaries,
		TotalExpenses:    totalExp,
		NetProfit:        profit,
		PaymentsByMethod: paymentsByMethod,
		SalariesByStatus: salariesByStatus,
	}, nil
}
