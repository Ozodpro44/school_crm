package service

import (
	"context"
	"fmt"
	"time"

	"github.com/school-crm/backend/internal/db"
)

// BudgetService manages monthly expense budgets per category.
type BudgetService struct {
	db *db.Database
}

func NewBudgetService(database *db.Database) *BudgetService {
	return &BudgetService{db: database}
}

// BudgetEntry is a single category budget row.
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

// BudgetWithActual pairs a budget limit with the actual spending for that category/period.
type BudgetWithActual struct {
	BudgetEntry
	Actual      float64 `json:"actual"`       // sum of expenses for this category/period
	UsedPct     float64 `json:"usedPct"`      // actual / amount * 100 (capped at 999)
	IsExceeded  bool    `json:"isExceeded"`   // actual > amount
	IsNearLimit bool    `json:"isNearLimit"`  // usedPct >= 90
}

// UpsertRequest is the payload for creating or updating a budget.
type UpsertBudgetRequest struct {
	BranchID string  `json:"branchId" binding:"required"`
	Category string  `json:"category" binding:"required"`
	Month    string  `json:"month"    binding:"required"` // "01".."12"
	Year     int     `json:"year"     binding:"required"`
	Amount   float64 `json:"amount"   binding:"required,gte=0"`
}

// Upsert inserts or updates a budget row.
func (s *BudgetService) Upsert(ctx context.Context, req *UpsertBudgetRequest) (*BudgetEntry, error) {
	now := time.Now().UTC()
	var entry BudgetEntry
	err := s.db.GetConn().QueryRowContext(ctx, `
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

// GetByBranch returns all budgets for a branch/period with actual spending attached.
func (s *BudgetService) GetByBranch(ctx context.Context, branchID, month string, year int) ([]BudgetWithActual, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
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
	return result, nil
}

// Delete removes a budget entry for a specific category/period.
func (s *BudgetService) Delete(ctx context.Context, branchID, category, month string, year int) error {
	res, err := s.db.GetConn().ExecContext(ctx,
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
