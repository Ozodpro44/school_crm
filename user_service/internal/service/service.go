// Package service contains the user-domain logic extracted from the monolith.
// Owns: users (profile), branches, permissions, settings, financial_months.
// During the Strangler Fig migration these methods read/write the shared
// public schema; once the monolith is decommissioned the search_path is
// switched to the "user" schema (P5.5).
package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/school-crm/user-service/internal/db"
)

// ── Models ─────────────────────────────────────────────────────────────────────

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	FullName  string    `json:"fullName"`
	Role      string    `json:"role"`
	BranchID  *string   `json:"branchId,omitempty"`
	Phone     *string   `json:"phone,omitempty"`
	AvatarURL *string   `json:"avatarUrl,omitempty"`
	Language  string    `json:"language"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type FinancialMonth struct {
	Month int `json:"month"`
	Year  int `json:"year"`
}

type Branch struct {
	ID                    string          `json:"id"`
	Name                  string          `json:"name"`
	Address               string          `json:"address"`
	Phone                 string          `json:"phone"`
	MonthlyPayment        float64         `json:"monthlyPayment"`
	Currency              string          `json:"currency"`
	AdminID               *string         `json:"adminId,omitempty"`
	CurrentFinancialMonth *FinancialMonth `json:"currentFinancialMonth,omitempty"`
	CreatedAt             time.Time       `json:"createdAt"`
	UpdatedAt             time.Time       `json:"updatedAt"`
}

type Permission struct {
	ID                     string `json:"id"`
	UserID                 string `json:"userId"`
	CanViewStudents        bool   `json:"canViewStudents"`
	CanCreateStudents      bool   `json:"canCreateStudents"`
	CanEditStudents        bool   `json:"canEditStudents"`
	CanDeleteStudents      bool   `json:"canDeleteStudents"`
	CanViewTeachers        bool   `json:"canViewTeachers"`
	CanCreateTeachers      bool   `json:"canCreateTeachers"`
	CanEditTeachers        bool   `json:"canEditTeachers"`
	CanDeleteTeachers      bool   `json:"canDeleteTeachers"`
	CanViewClasses         bool   `json:"canViewClasses"`
	CanCreateClasses       bool   `json:"canCreateClasses"`
	CanEditClasses         bool   `json:"canEditClasses"`
	CanViewPayments        bool   `json:"canViewPayments"`
	CanCreatePayments      bool   `json:"canCreatePayments"`
	CanEditPayments        bool   `json:"canEditPayments"`
	CanViewSalaries        bool   `json:"canViewSalaries"`
	CanCreateSalaries      bool   `json:"canCreateSalaries"`
	CanEditSalaries        bool   `json:"canEditSalaries"`
	CanViewExpenses        bool   `json:"canViewExpenses"`
	CanCreateExpenses      bool   `json:"canCreateExpenses"`
	CanEditExpenses        bool   `json:"canEditExpenses"`
	CanDeleteExpenses      bool   `json:"canDeleteExpenses"`
	CanViewReports         bool   `json:"canViewReports"`
	CanViewSettings        bool   `json:"canViewSettings"`
	CanEditSettings        bool   `json:"canEditSettings"`
	CanViewSubscriptions   bool   `json:"canViewSubscriptions"`
	CanManageSubscriptions bool   `json:"canManageSubscriptions"`
}

// ── Errors ────────────────────────────────────────────────────────────────────

var (
	ErrNotFound      = errors.New("not found")
	ErrAlreadyExists = errors.New("already exists")
)

// ── UserService ───────────────────────────────────────────────────────────────

type UserService struct {
	db *db.DB
}

func NewUserService(database *db.DB) *UserService {
	return &UserService{db: database}
}

func (s *UserService) GetByID(ctx context.Context, id string) (*User, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var u User
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT id, email, full_name, role, branch_id, phone, avatar_url,
		        COALESCE(language, 'en'), created_at, updated_at
		 FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.BranchID,
		&u.Phone, &u.AvatarURL, &u.Language, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *UserService) GetAll(ctx context.Context, branchID string) ([]User, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	// When filtering by branch: return users whose branch_id matches
	// OR managers linked via the branch_managers junction table.
	var query string
	var args []interface{}
	if branchID != "" {
		query = `
			SELECT DISTINCT u.id, u.email, u.full_name, u.role, u.branch_id, u.phone, u.avatar_url,
			       COALESCE(u.language, 'en'), u.created_at, u.updated_at
			FROM users u
			LEFT JOIN branch_managers bm ON bm.manager_id = u.id
			WHERE u.branch_id = $1 OR bm.branch_id = $1
			ORDER BY u.full_name`
		args = []interface{}{branchID}
	} else {
		query = `SELECT id, email, full_name, role, branch_id, phone, avatar_url,
			        COALESCE(language, 'en'), created_at, updated_at
			 FROM users ORDER BY full_name`
	}

	rows, err := s.db.Conn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.BranchID,
			&u.Phone, &u.AvatarURL, &u.Language, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

// Update applies self-service profile fields only. role and branch_id are
// deliberately excluded — they control authorization and tenant scoping, so
// reassigning them goes through UpdateRoleBranch, which the handler gates to
// admin-level callers. Without this split, any caller hitting this generic
// map-driven update could PUT {"role":"super_admin"} on themselves.
func (s *UserService) Update(ctx context.Context, id string, fields map[string]interface{}) (*User, error) {
	allowed := map[string]bool{
		"full_name": true, "phone": true, "avatar_url": true, "language": true,
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
	parts = append(parts, fmt.Sprintf("updated_at = $%d", n))
	args = append(args, time.Now().UTC())
	n++
	args = append(args, id)

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	_, err := s.db.Conn().ExecContext(ctx,
		"UPDATE users SET "+strings.Join(parts, ", ")+" WHERE id = $"+fmt.Sprintf("%d", n), args...)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

// validRoles are the roles reassignable via UpdateRoleBranch. "developer" and
// "super_admin" are platform-level roles granted out-of-band, not through
// this endpoint.
var validRoles = map[string]bool{
	"admin": true, "branch_admin": true, "manager": true, "accountant": true, "teacher": true,
}

// UpdateRoleBranch reassigns a user's role and/or branch_id. This is
// deliberately separate from Update: the caller (handler.UpdateUser) must
// verify the requester holds an admin-level role before invoking it — this
// method itself only validates that a requested role is one of the known
// values, it does not re-check authorization.
func (s *UserService) UpdateRoleBranch(ctx context.Context, id string, role, branchID *string) (*User, error) {
	parts := []string{}
	args := []interface{}{}
	n := 1

	if role != nil {
		if !validRoles[*role] {
			return nil, fmt.Errorf("invalid role: %s", *role)
		}
		parts = append(parts, fmt.Sprintf("role = $%d", n))
		args = append(args, *role)
		n++
	}
	if branchID != nil {
		parts = append(parts, fmt.Sprintf("branch_id = $%d", n))
		args = append(args, *branchID)
		n++
	}
	if len(parts) == 0 {
		return s.GetByID(ctx, id)
	}
	parts = append(parts, fmt.Sprintf("updated_at = $%d", n))
	args = append(args, time.Now().UTC())
	n++
	args = append(args, id)

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	_, err := s.db.Conn().ExecContext(ctx,
		"UPDATE users SET "+strings.Join(parts, ", ")+" WHERE id = $"+fmt.Sprintf("%d", n), args...)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *UserService) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	res, err := s.db.Conn().ExecContext(ctx, "DELETE FROM users WHERE id = $1", id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ── BranchService ─────────────────────────────────────────────────────────────

type BranchService struct {
	db *db.DB
}

// HasBranchAccess reports whether userID (JWT-verified, with role) may
// access branchID. developer/super_admin bypass entirely (platform-level
// roles). Otherwise granted if the user's own branch matches, they're
// linked to it via branch_managers, or they're its admin.
//
// This exists because branch switching in the frontend does not reissue a
// JWT — the token's own branch_id stays fixed to the user's home branch,
// while a manager/admin who legitimately administers several branches picks
// among them client-side and sends that choice as a plain branchId query
// param. UpdateSettings previously trusted that value with no check at
// all, letting any authenticated caller overwrite another branch's name/
// monthly payment/currency by editing the query string.
func (s *BranchService) HasBranchAccess(ctx context.Context, userID, role, branchID string) (bool, error) {
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

func NewBranchService(database *db.DB) *BranchService {
	return &BranchService{db: database}
}

// ErrBranchLimitReached is returned when the branch's owning admin has
// already reached their subscription plan's max_branches quota.
var ErrBranchLimitReached = errors.New("your subscription plan does not allow any more branches")

func (s *BranchService) Create(ctx context.Context, name, address, phone string, monthlyPayment float64, adminID *string, requesterID string) (*Branch, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	// The new branch's admin_id is who its quota counts against — usually the
	// caller themselves, but a developer/super_admin creating a branch on
	// behalf of a tenant admin passes adminID explicitly (see CreateBranch).
	ownerID := requesterID
	if adminID != nil && *adminID != "" {
		ownerID = *adminID
	}
	if ownerID != "" {
		if err := s.checkBranchLimit(ctx, ownerID); err != nil {
			return nil, err
		}
	}

	b := &Branch{
		ID:             uuid.New().String(),
		Name:           name,
		Address:        address,
		Phone:          phone,
		MonthlyPayment: monthlyPayment,
		Currency:       "UZS",
		AdminID:        adminID,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
	_, err := s.db.Conn().ExecContext(ctx,
		`INSERT INTO branches (id, name, address, phone, monthly_payment, currency, admin_id, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		b.ID, b.Name, b.Address, b.Phone, b.MonthlyPayment, b.Currency, b.AdminID, b.CreatedAt, b.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return b, nil
}

// checkBranchLimit ports backend_school_crm's SubscriptionService.
// CheckResourceLimit ("branches" case) — user_service now owns branch
// creation and has no dependency on the monolith's subscription service, but
// reads the same shared subscriptions/subscription_plans/branches tables.
// A NULL max_branches (or no subscription row at all) means unlimited: the
// separate SubscriptionGate is what blocks a lapsed/missing subscription.
func (s *BranchService) checkBranchLimit(ctx context.Context, ownerUserID string) error {
	var maxBranches sql.NullInt64
	err := s.db.Conn().QueryRowContext(ctx, `
		SELECT sp.max_branches
		FROM subscriptions sub
		JOIN subscription_plans sp ON sub.plan_id = sp.id
		WHERE sub.user_id = $1
		  AND sub.status IN ('active','trial','paused','pending_payment','past_due')
		ORDER BY sub.created_at DESC
		LIMIT 1`, ownerUserID,
	).Scan(&maxBranches)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("check branch limit: %w", err)
	}
	if !maxBranches.Valid {
		return nil
	}

	var count int
	if err := s.db.Conn().QueryRowContext(ctx,
		`SELECT COUNT(*) FROM branches WHERE admin_id = $1`, ownerUserID,
	).Scan(&count); err != nil {
		return fmt.Errorf("check branch limit: count branches: %w", err)
	}
	if int64(count) >= maxBranches.Int64 {
		return fmt.Errorf("%w: plan allows %d, you already have %d", ErrBranchLimitReached, maxBranches.Int64, count)
	}
	return nil
}

func (s *BranchService) GetByID(ctx context.Context, id string) (*Branch, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var b Branch
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT id, name, address, phone, monthly_payment, currency, admin_id, created_at, updated_at
		 FROM branches WHERE id = $1`, id,
	).Scan(&b.ID, &b.Name, &b.Address, &b.Phone, &b.MonthlyPayment, &b.Currency, &b.AdminID, &b.CreatedAt, &b.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	// Attach current open financial month (best-effort — ignore if missing)
	var fm FinancialMonth
	if err := s.db.Conn().QueryRowContext(ctx,
		`SELECT month, year FROM financial_months
		 WHERE branch_id = $1 AND status = 'OPEN'
		 ORDER BY created_at DESC LIMIT 1`, id,
	).Scan(&fm.Month, &fm.Year); err == nil {
		b.CurrentFinancialMonth = &fm
	}

	return &b, nil
}

func (s *BranchService) GetAll(ctx context.Context) ([]Branch, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	rows, err := s.db.Conn().QueryContext(ctx,
		`SELECT id, name, address, phone, monthly_payment, currency, admin_id, created_at, updated_at
		 FROM branches ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var branches []Branch
	for rows.Next() {
		var b Branch
		if err := rows.Scan(&b.ID, &b.Name, &b.Address, &b.Phone, &b.MonthlyPayment, &b.Currency, &b.AdminID, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		branches = append(branches, b)
	}
	return branches, rows.Err()
}

// GetByAdminID returns every branch a user administers — as the branch's
// own admin_id, OR via a branch_managers row. It used to check admin_id
// only, so a manager granted a second branch purely through branch_managers
// (the mechanism this whole HasBranchAccess pattern exists for, since
// branch-switching never reissues the JWT) had no way to even see that
// branch in their branch list/switcher, despite HasBranchAccess correctly
// authorizing direct API calls to it.
func (s *BranchService) GetByAdminID(ctx context.Context, adminID string) ([]Branch, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	rows, err := s.db.Conn().QueryContext(ctx,
		`SELECT DISTINCT b.id, b.name, b.address, b.phone, b.monthly_payment, b.currency, b.admin_id, b.created_at, b.updated_at
		 FROM branches b
		 LEFT JOIN branch_managers bm ON bm.branch_id = b.id AND bm.manager_id = $1
		 WHERE b.admin_id = $1 OR bm.manager_id IS NOT NULL
		 ORDER BY b.name`, adminID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var branches []Branch
	for rows.Next() {
		var b Branch
		if err := rows.Scan(&b.ID, &b.Name, &b.Address, &b.Phone, &b.MonthlyPayment, &b.Currency, &b.AdminID, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		branches = append(branches, b)
	}
	return branches, rows.Err()
}

func (s *BranchService) Update(ctx context.Context, id string, fields map[string]interface{}) (*Branch, error) {
	allowed := map[string]bool{
		"name": true, "address": true, "phone": true, "monthly_payment": true,
		"currency": true, "admin_id": true,
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
	parts = append(parts, fmt.Sprintf("updated_at = $%d", n))
	args = append(args, time.Now().UTC())
	n++
	args = append(args, id)

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	_, err := s.db.Conn().ExecContext(ctx,
		"UPDATE branches SET "+strings.Join(parts, ", ")+" WHERE id = $"+fmt.Sprintf("%d", n), args...)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *BranchService) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	res, err := s.db.Conn().ExecContext(ctx, "DELETE FROM branches WHERE id = $1", id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// SwitchMonth closes the current open financial month and opens the next one.
// Mirrors the monolith's FinancialMonthService.CloseMonth logic.
func (s *BranchService) SwitchMonth(ctx context.Context, branchID string) (*Branch, error) {
	tx, err := s.db.Conn().BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	var currentID string
	var currentYear, currentMonth int
	if err := tx.QueryRowContext(ctx,
		`SELECT id, year, month FROM financial_months
		 WHERE branch_id = $1 AND status = 'OPEN'
		 ORDER BY opened_at DESC LIMIT 1`, branchID,
	).Scan(&currentID, &currentYear, &currentMonth); err != nil {
		return nil, fmt.Errorf("no open financial month for branch: %w", err)
	}

	now := time.Now().UTC()

	// Close current month
	if _, err := tx.ExecContext(ctx,
		`UPDATE financial_months SET status='CLOSED', closed_at=$1, updated_at=$1 WHERE id=$2`,
		now, currentID); err != nil {
		return nil, fmt.Errorf("close month: %w", err)
	}

	// Compute next month
	nextMonth, nextYear := currentMonth+1, currentYear
	if nextMonth > 12 {
		nextMonth, nextYear = 1, nextYear+1
	}

	// Get branch monthly_payment for the new row
	var paymentAmount float64
	_ = tx.QueryRowContext(ctx, `SELECT monthly_payment FROM branches WHERE id=$1`, branchID).Scan(&paymentAmount)

	nextID := uuid.New().String()
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO financial_months (id, branch_id, year, month, status, payment_amount, opened_at)
		 VALUES ($1,$2,$3,$4,'OPEN',$5,$6)`,
		nextID, branchID, nextYear, nextMonth, paymentAmount, now); err != nil {
		return nil, fmt.Errorf("open next month: %w", err)
	}

	// Update branch current_financial_month_id if the column exists
	_, _ = tx.ExecContext(ctx,
		`UPDATE branches SET current_financial_month_id=$1, updated_at=$2 WHERE id=$3`,
		nextID, now, branchID)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetByID(ctx, branchID)
}

// ── PermissionService ─────────────────────────────────────────────────────────

type PermissionService struct {
	db    *db.DB
	redis *redis.Client
}

func NewPermissionService(database *db.DB, redisClient *redis.Client) *PermissionService {
	return &PermissionService{db: database, redis: redisClient}
}

const permissionCacheTTL = 60 * time.Second

func permissionCacheKey(userID string) string { return "crm:permissions:" + userID }

// GetByUserID is called on every CheckPermission gRPC call (authorization
// checks from other services) plus the REST GetPermissions endpoint — a hot
// path doing a full DB round trip per check with Redis already provisioned
// and otherwise unused. A cache miss or Redis error falls through to the
// real query; caching here is an optimization, never a hard dependency.
func (s *PermissionService) GetByUserID(ctx context.Context, userID string) (*Permission, error) {
	if s.redis != nil {
		if cached, err := s.redis.Get(ctx, permissionCacheKey(userID)).Result(); err == nil {
			if cached == "null" {
				return nil, nil // cached "no permission row" result
			}
			var p Permission
			if jsonErr := json.Unmarshal([]byte(cached), &p); jsonErr == nil {
				return &p, nil
			}
			slog.Warn("permission cache entry unmarshal failed, falling through", "user_id", userID, "error", err)
		} else if err != redis.Nil {
			slog.Warn("permission cache read failed, falling through", "user_id", userID, "error", err)
		}
	}

	p, err := s.getByUserIDUncached(ctx, userID)
	if err != nil {
		return nil, err
	}

	if s.redis != nil {
		var toCache []byte
		if p == nil {
			toCache = []byte("null")
		} else if encoded, jsonErr := json.Marshal(p); jsonErr == nil {
			toCache = encoded
		}
		if toCache != nil {
			if setErr := s.redis.Set(ctx, permissionCacheKey(userID), toCache, permissionCacheTTL).Err(); setErr != nil {
				slog.Warn("permission cache write failed", "user_id", userID, "error", setErr)
			}
		}
	}
	return p, nil
}

func (s *PermissionService) getByUserIDUncached(ctx context.Context, userID string) (*Permission, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var p Permission
	err := s.db.Conn().QueryRowContext(ctx, `
		SELECT id, user_id,
		       can_view_students, can_create_students, can_edit_students, can_delete_students,
		       can_view_teachers, can_create_teachers, can_edit_teachers, can_delete_teachers,
		       can_view_classes, can_create_classes, can_edit_classes,
		       can_view_payments, can_create_payments, can_edit_payments,
		       can_view_salaries, can_create_salaries, can_edit_salaries,
		       can_view_expenses, can_create_expenses, can_edit_expenses, can_delete_expenses,
		       can_view_reports, can_view_settings, can_edit_settings,
		       COALESCE(can_view_subscriptions, true), COALESCE(can_manage_subscriptions, false)
		FROM permissions WHERE user_id = $1`, userID,
	).Scan(
		&p.ID, &p.UserID,
		&p.CanViewStudents, &p.CanCreateStudents, &p.CanEditStudents, &p.CanDeleteStudents,
		&p.CanViewTeachers, &p.CanCreateTeachers, &p.CanEditTeachers, &p.CanDeleteTeachers,
		&p.CanViewClasses, &p.CanCreateClasses, &p.CanEditClasses,
		&p.CanViewPayments, &p.CanCreatePayments, &p.CanEditPayments,
		&p.CanViewSalaries, &p.CanCreateSalaries, &p.CanEditSalaries,
		&p.CanViewExpenses, &p.CanCreateExpenses, &p.CanEditExpenses, &p.CanDeleteExpenses,
		&p.CanViewReports, &p.CanViewSettings, &p.CanEditSettings,
		&p.CanViewSubscriptions, &p.CanManageSubscriptions,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil // no row = no custom permissions (use defaults)
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *PermissionService) Upsert(ctx context.Context, userID string, fields map[string]interface{}) (*Permission, error) {
	// Check existence first
	existing, err := s.GetByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	ctx2, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	if existing == nil {
		// Create with defaults
		id := uuid.New().String()
		_, err = s.db.Conn().ExecContext(ctx2,
			`INSERT INTO permissions (id, user_id) VALUES ($1, $2)
			 ON CONFLICT (user_id) DO NOTHING`, id, userID)
		if err != nil {
			return nil, err
		}
	}

	// Build dynamic UPDATE
	allowed := map[string]bool{
		"can_view_students": true, "can_create_students": true, "can_edit_students": true, "can_delete_students": true,
		"can_view_teachers": true, "can_create_teachers": true, "can_edit_teachers": true, "can_delete_teachers": true,
		"can_view_classes": true, "can_create_classes": true, "can_edit_classes": true,
		"can_view_payments": true, "can_create_payments": true, "can_edit_payments": true,
		"can_view_salaries": true, "can_create_salaries": true, "can_edit_salaries": true,
		"can_view_expenses": true, "can_create_expenses": true, "can_edit_expenses": true, "can_delete_expenses": true,
		"can_view_reports": true, "can_view_settings": true, "can_edit_settings": true,
		"can_view_subscriptions": true, "can_manage_subscriptions": true,
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
		return s.GetByUserID(ctx, userID)
	}
	args = append(args, userID)

	ctx3, cancel3 := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel3()

	_, err = s.db.Conn().ExecContext(ctx3,
		"UPDATE permissions SET "+strings.Join(parts, ", ")+" WHERE user_id = $"+fmt.Sprintf("%d", n), args...)
	if err != nil {
		return nil, err
	}
	// Without this, the GetByUserID call above (at the top of Upsert, before
	// any write happened) already populated the cache with the pre-update
	// value, and the read below would return that stale entry for the rest
	// of its TTL instead of what was just written.
	if s.redis != nil {
		if err := s.redis.Del(ctx, permissionCacheKey(userID)).Err(); err != nil {
			slog.Warn("permission cache invalidation failed", "user_id", userID, "error", err)
		}
	}
	return s.GetByUserID(ctx, userID)
}
