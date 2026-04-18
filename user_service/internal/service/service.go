// Package service contains the user-domain logic extracted from the monolith.
// Owns: users (profile), branches, permissions, settings, financial_months.
// During the Strangler Fig migration these methods read/write the shared
// public schema; once the monolith is decommissioned the search_path is
// switched to the "user" schema (P5.5).
package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/user-service/internal/db"
)

// ── Models ─────────────────────────────────────────────────────────────────────

type User struct {
	ID         string     `json:"id"`
	Email      string     `json:"email"`
	FullName   string     `json:"fullName"`
	Role       string     `json:"role"`
	BranchID   *string    `json:"branchId,omitempty"`
	Phone      *string    `json:"phone,omitempty"`
	AvatarURL  *string    `json:"avatarUrl,omitempty"`
	Language   string     `json:"language"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
}

type Branch struct {
	ID             string     `json:"id"`
	Name           string     `json:"name"`
	Address        string     `json:"address"`
	Phone          string     `json:"phone"`
	MonthlyPayment float64    `json:"monthlyPayment"`
	Currency       string     `json:"currency"`
	AdminID        *string    `json:"adminId,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type Permission struct {
	ID                      string `json:"id"`
	UserID                  string `json:"userId"`
	CanViewStudents         bool   `json:"canViewStudents"`
	CanCreateStudents       bool   `json:"canCreateStudents"`
	CanEditStudents         bool   `json:"canEditStudents"`
	CanDeleteStudents       bool   `json:"canDeleteStudents"`
	CanViewTeachers         bool   `json:"canViewTeachers"`
	CanCreateTeachers       bool   `json:"canCreateTeachers"`
	CanEditTeachers         bool   `json:"canEditTeachers"`
	CanDeleteTeachers       bool   `json:"canDeleteTeachers"`
	CanViewClasses          bool   `json:"canViewClasses"`
	CanCreateClasses        bool   `json:"canCreateClasses"`
	CanEditClasses          bool   `json:"canEditClasses"`
	CanViewPayments         bool   `json:"canViewPayments"`
	CanCreatePayments       bool   `json:"canCreatePayments"`
	CanEditPayments         bool   `json:"canEditPayments"`
	CanViewSalaries         bool   `json:"canViewSalaries"`
	CanCreateSalaries       bool   `json:"canCreateSalaries"`
	CanEditSalaries         bool   `json:"canEditSalaries"`
	CanViewExpenses         bool   `json:"canViewExpenses"`
	CanCreateExpenses       bool   `json:"canCreateExpenses"`
	CanEditExpenses         bool   `json:"canEditExpenses"`
	CanDeleteExpenses       bool   `json:"canDeleteExpenses"`
	CanViewReports          bool   `json:"canViewReports"`
	CanViewSettings         bool   `json:"canViewSettings"`
	CanEditSettings         bool   `json:"canEditSettings"`
	CanViewSubscriptions    bool   `json:"canViewSubscriptions"`
	CanManageSubscriptions  bool   `json:"canManageSubscriptions"`
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
	return &u, err
}

func (s *UserService) GetAll(ctx context.Context, branchID string) ([]User, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	where := ""
	args := []interface{}{}
	if branchID != "" {
		where = " WHERE branch_id = $1"
		args = append(args, branchID)
	}

	rows, err := s.db.Conn().QueryContext(ctx,
		`SELECT id, email, full_name, role, branch_id, phone, avatar_url,
		        COALESCE(language, 'en'), created_at, updated_at
		 FROM users`+where+` ORDER BY full_name`, args...)
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

func (s *UserService) Update(ctx context.Context, id string, fields map[string]interface{}) (*User, error) {
	allowed := map[string]bool{
		"full_name": true, "phone": true, "avatar_url": true, "language": true,
		"role": true, "branch_id": true,
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

func (s *UserService) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	_, err := s.db.Conn().ExecContext(ctx, "DELETE FROM users WHERE id = $1", id)
	return err
}

// ── BranchService ─────────────────────────────────────────────────────────────

type BranchService struct {
	db *db.DB
}

func NewBranchService(database *db.DB) *BranchService {
	return &BranchService{db: database}
}

func (s *BranchService) Create(ctx context.Context, name, address, phone string, monthlyPayment float64, adminID *string) (*Branch, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

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
	return &b, err
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

func (s *BranchService) GetByAdminID(ctx context.Context, adminID string) ([]Branch, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	rows, err := s.db.Conn().QueryContext(ctx,
		`SELECT id, name, address, phone, monthly_payment, currency, admin_id, created_at, updated_at
		 FROM branches WHERE admin_id = $1 ORDER BY name`, adminID)
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
	_, err := s.db.Conn().ExecContext(ctx, "DELETE FROM branches WHERE id = $1", id)
	return err
}

// ── PermissionService ─────────────────────────────────────────────────────────

type PermissionService struct {
	db *db.DB
}

func NewPermissionService(database *db.DB) *PermissionService {
	return &PermissionService{db: database}
}

func (s *PermissionService) GetByUserID(ctx context.Context, userID string) (*Permission, error) {
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
	return &p, err
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
	return s.GetByUserID(ctx, userID)
}
