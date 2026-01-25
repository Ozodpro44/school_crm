package service

import (
	"context"
	"database/sql"
	"fmt"
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
	CreatedByName string     `json:"createdByName"`
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
	CreatedByName string     `json:"createdByName"`
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
	CreatedByName string    `json:"createdByName"`
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

// DashboardData represents consolidated dashboard data
type DashboardData struct {
	Students            int                `json:"totalStudents"`
	ActiveStudents      int                `json:"activeStudents"`
	Teachers            int                `json:"totalTeachers"`
	TotalIncome         float64            `json:"totalIncome"`
	TotalExpenses       float64            `json:"totalExpenses"`
	Profit              float64            `json:"profit"`
	DebtorsCount        int                `json:"debtorsCount"`
	UnpaidSalariesCount int                `json:"unpaidSalariesCount"`
	CashIncome          float64            `json:"cashIncome"`
	CashExpenses        float64            `json:"cashExpenses"`
	CashProfit          float64            `json:"cashProfit"`
	CardIncome          float64            `json:"cardIncome"`
	CardExpenses        float64            `json:"cardExpenses"`
	CardProfit          float64            `json:"cardProfit"`
	BankIncome          float64            `json:"bankIncome"`
	BankExpenses        float64            `json:"bankExpenses"`
	BankProfit          float64            `json:"bankProfit"`
	Payments            []PaymentReportItem `json:"payments"`
	Salaries            []SalaryReportItem  `json:"salaries"`
	Expenses            []ExpenseReportItem `json:"expenses"`
}

// GetPaymentReport returns a paginated list of payments with student and class info
func (s *ReportService) GetPaymentReport(ctx context.Context, branchID string, startDate, endDate time.Time, status, classID string, page, limit int) ([]PaymentReportItem, int64, error) {
	startMonth := int(startDate.Month())
	startYear := startDate.Year()
	endMonth := int(endDate.Month())
	endYear := endDate.Year()
	
	// Get total count first
	countQuery := `
	SELECT COUNT(*)
	FROM payments p
	JOIN students st ON p.student_id = st.id
	LEFT JOIN classes c ON st.class_id = c.id
	LEFT JOIN users u ON p.created_by = u.id
	WHERE p.branch_id = $1
		AND ((p.year = $2 AND p.month >= $3) OR (p.year > $2) OR (p.year = $4 AND p.month <= $5))
	`

	countArgs := []interface{}{branchID, startYear, startMonth, endYear, endMonth}
	paramIdx := 6

	if status != "all" && status != "" {
		countQuery += " AND p.status = $6"
		countArgs = append(countArgs, status)
		paramIdx = 7
	}

	if classID != "all" && classID != "" {
		countQuery += fmt.Sprintf(" AND st.class_id = $%d", paramIdx)
		countArgs = append(countArgs, classID)
	}

	var total int64
	err := s.db.GetConn().QueryRowContext(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get paginated data
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
		COALESCE(u.full_name, p.created_by::TEXT, '') as created_by_name,
		p.created_at
	FROM payments p
	JOIN students st ON p.student_id = st.id
	LEFT JOIN classes c ON st.class_id = c.id
	LEFT JOIN users u ON p.created_by = u.id
	WHERE p.branch_id = $1
		AND ((p.year = $2 AND p.month >= $3) OR (p.year > $2) OR (p.year = $4 AND p.month <= $5))
	`

	args := []interface{}{branchID, startYear, startMonth, endYear, endMonth}
	paramIdx = 6

	if status != "all" && status != "" {
		query += " AND p.status = $6"
		args = append(args, status)
		paramIdx = 7
	}

	if classID != "all" && classID != "" {
		query += fmt.Sprintf(" AND st.class_id = $%d", paramIdx)
		args = append(args, classID)
		paramIdx++
	}

	query += " ORDER BY p.created_at DESC"
	
	// Add pagination
	offset := (page - 1) * limit
	query += fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset)

	rows, err := s.db.GetConn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
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
			&item.CreatedByName,
			&item.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}

	return items, total, rows.Err()
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
		COALESCE(u.full_name, sal.created_by::TEXT, '') as created_by_name,
		sal.created_at
	FROM salaries sal
	JOIN teachers t ON sal.teacher_id = t.id
	LEFT JOIN users u ON sal.created_by = u.id
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
			&item.CreatedByName,
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
		COALESCE(SUM(p.amount), 0) as paid_amount
	FROM students st
	LEFT JOIN classes c ON st.class_id = c.id
	LEFT JOIN payments p ON st.id = p.student_id AND p.month = $1 AND p.year = $2 AND p.branch_id = $3 AND p.amount > 0
	WHERE st.branch_id = $3 AND st.status = 'active'
		AND (st.enrollment_date IS NULL OR (EXTRACT(YEAR FROM st.enrollment_date) < $2 OR (EXTRACT(YEAR FROM st.enrollment_date) = $2 AND EXTRACT(MONTH FROM st.enrollment_date) <= CAST($1 AS INT))))
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
		e.id,
		e.title,
		e.description,
		e.category,
		e.amount,
		e.payment_method,
		e.date,
		e.created_by,
		COALESCE(u.full_name, e.created_by::TEXT, '') as created_by_name,
		e.notes,
		e.created_at
	FROM expenses e
	LEFT JOIN users u ON e.created_by = u.id
	WHERE e.branch_id = $1
		AND e.date >= $2
		AND e.date <= $3
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
			&item.CreatedByName,
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

// GetDashboardData returns consolidated dashboard data
func (s *ReportService) GetDashboardData(ctx context.Context, branchID string, month int, year int) (*DashboardData, error) {
	// Convert month to 2-digit string format (e.g., 1 -> "01")
	monthStr := fmt.Sprintf("%02d", month)
	
	// Count students
	var totalStudents, activeStudents, totalTeachers int
	
	err := s.db.GetConn().QueryRowContext(ctx, 
		"SELECT COUNT(*) FROM students WHERE branch_id = $1", branchID).
		Scan(&totalStudents)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	err = s.db.GetConn().QueryRowContext(ctx,
		"SELECT COUNT(*) FROM students WHERE branch_id = $1 AND status = 'active'", branchID).
		Scan(&activeStudents)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	err = s.db.GetConn().QueryRowContext(ctx,
		"SELECT COUNT(*) FROM teachers WHERE branch_id = $1", branchID).
		Scan(&totalTeachers)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	// Get payments for the month
	var totalIncome sql.NullFloat64
	err = s.db.GetConn().QueryRowContext(ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM payments 
		 WHERE branch_id = $1 AND month = $2 AND year = $3 AND (status = 'paid' OR status = 'partial')`,
		branchID, monthStr, year).
		Scan(&totalIncome)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	// Get salaries and expenses for the month
	var totalSalaries, totalExpensesOnly sql.NullFloat64
	err = s.db.GetConn().QueryRowContext(ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM salaries 
		 WHERE branch_id = $1 AND month = $2 AND year = $3 AND status = 'paid'`,
		branchID, monthStr, year).
		Scan(&totalSalaries)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	err = s.db.GetConn().QueryRowContext(ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM expenses 
		 WHERE branch_id = $1 AND LPAD(EXTRACT(MONTH FROM date)::text, 2, '0') = $2 AND EXTRACT(YEAR FROM date) = $3`,
		branchID, monthStr, year).
		Scan(&totalExpensesOnly)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	totalExpenses := totalSalaries.Float64 + totalExpensesOnly.Float64
	income := totalIncome.Float64
	profit := income - totalExpenses
	
	// Get income by payment method
	cashIncome := 0.0
	cardIncome := 0.0
	bankIncome := 0.0
	
	paymentMethodQuery := `
		SELECT payment_method, COALESCE(SUM(amount), 0)
		FROM payments
		WHERE branch_id = $1 AND month = $2 AND year = $3 AND (status = 'paid' OR status = 'partial')
		GROUP BY payment_method
	`
	
	rows, err := s.db.GetConn().QueryContext(ctx, paymentMethodQuery, branchID, monthStr, year)
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
		switch method {
		case "cash":
			cashIncome = amount
		case "card":
			cardIncome = amount
		case "bank":
			bankIncome = amount
		}
	}
	
	// Get salaries by payment method for expenses calculation
	var cashSalaries, cardSalaries, bankSalaries sql.NullFloat64
	err = s.db.GetConn().QueryRowContext(ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM salaries 
		 WHERE branch_id = $1 AND month = $2 AND year = $3 AND status = 'paid' AND payment_method = 'cash'`,
		branchID, monthStr, year).
		Scan(&cashSalaries)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	err = s.db.GetConn().QueryRowContext(ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM salaries 
		 WHERE branch_id = $1 AND month = $2 AND year = $3 AND status = 'paid' AND payment_method = 'card'`,
		branchID, monthStr, year).
		Scan(&cardSalaries)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	err = s.db.GetConn().QueryRowContext(ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM salaries 
		 WHERE branch_id = $1 AND month = $2 AND year = $3 AND status = 'paid' AND payment_method = 'bank'`,
		branchID, monthStr, year).
		Scan(&bankSalaries)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	// Get expenses by payment method
	var cashExpensesOnly, cardExpensesOnly, bankExpensesOnly sql.NullFloat64
	err = s.db.GetConn().QueryRowContext(ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM expenses 
		 WHERE branch_id = $1 AND LPAD(EXTRACT(MONTH FROM date)::text, 2, '0') = $2 AND EXTRACT(YEAR FROM date) = $3 AND payment_method = 'cash'`,
		branchID, monthStr, year).
		Scan(&cashExpensesOnly)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	err = s.db.GetConn().QueryRowContext(ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM expenses 
		 WHERE branch_id = $1 AND LPAD(EXTRACT(MONTH FROM date)::text, 2, '0') = $2 AND EXTRACT(YEAR FROM date) = $3 AND payment_method = 'card'`,
		branchID, monthStr, year).
		Scan(&cardExpensesOnly)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	err = s.db.GetConn().QueryRowContext(ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM expenses 
		 WHERE branch_id = $1 AND LPAD(EXTRACT(MONTH FROM date)::text, 2, '0') = $2 AND EXTRACT(YEAR FROM date) = $3 AND payment_method = 'bank'`,
		branchID, monthStr, year).
		Scan(&bankExpensesOnly)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	// Calculate total expenses for each payment method (salaries + expenses)
	cashExpenses := cashSalaries.Float64 + cashExpensesOnly.Float64
	cardExpenses := cardSalaries.Float64 + cardExpensesOnly.Float64
	bankExpenses := bankSalaries.Float64 + bankExpensesOnly.Float64
	
	// Calculate profit for each payment method
	cashProfit := cashIncome - cashExpenses
	cardProfit := cardIncome - cardExpenses
	bankProfit := bankIncome - bankExpenses
	
	// Count debtors
	debtorsQuery := `
		SELECT COUNT(DISTINCT s.id)
		FROM students s
		WHERE s.branch_id = $1 AND s.status = 'active'
		AND NOT EXISTS (
			SELECT 1 FROM payments p
			WHERE p.student_id = s.id AND p.month = $2 AND p.year = $3 AND p.status = 'paid'
		)
	`
	var debtorsCount int
	err = s.db.GetConn().QueryRowContext(ctx, debtorsQuery, branchID, monthStr, year).Scan(&debtorsCount)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	// Count unpaid salaries
	unpaidSalariesQuery := `
		SELECT COUNT(DISTINCT t.id)
		FROM teachers t
		WHERE t.branch_id = $1
		AND NOT EXISTS (
			SELECT 1 FROM salaries s
			WHERE s.teacher_id = t.id AND s.month = $2 AND s.year = $3 AND s.status = 'paid'
		)
	`
	var unpaidSalariesCount int
	err = s.db.GetConn().QueryRowContext(ctx, unpaidSalariesQuery, branchID, monthStr, year).Scan(&unpaidSalariesCount)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	
	// Get payments list
	paymentsData, _, err := s.GetPaymentReport(ctx, branchID, 
		time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC),
		time.Date(year, time.Month(month)+1, 0, 23, 59, 59, 0, time.UTC),
		"", "", 1, 10000)
	if err != nil {
		return nil, err
	}
	
	// Get salaries list
	salariesData, err := s.GetSalaryReport(ctx, branchID,
		time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC),
		time.Date(year, time.Month(month)+1, 0, 23, 59, 59, 0, time.UTC),
		"")
	if err != nil {
		return nil, err
	}
	
	// Get expenses list
	expensesData, err := s.GetExpensesReport(ctx, branchID,
		time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC),
		time.Date(year, time.Month(month)+1, 0, 23, 59, 59, 0, time.UTC),
		"")
	if err != nil {
		return nil, err
	}
	
	return &DashboardData{
		Students:            totalStudents,
		ActiveStudents:      activeStudents,
		Teachers:            totalTeachers,
		TotalIncome:         income,
		TotalExpenses:       totalExpenses,
		Profit:              profit,
		DebtorsCount:        debtorsCount,
		UnpaidSalariesCount: unpaidSalariesCount,
		CashIncome:          cashIncome,
		CashExpenses:        cashExpenses,
		CashProfit:          cashProfit,
		CardIncome:          cardIncome,
		CardExpenses:        cardExpenses,
		CardProfit:          cardProfit,
		BankIncome:          bankIncome,
		BankExpenses:        bankExpenses,
		BankProfit:          bankProfit,
		Payments:            paymentsData,
		Salaries:            salariesData,
		Expenses:            expensesData,
	}, nil
}
