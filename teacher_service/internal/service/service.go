// Package service contains the teacher-domain logic extracted from the monolith.
// Owns: teachers, salaries.
// During Strangler Fig migration reads/writes go to the shared public schema.
package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/school-crm/teacher-service/internal/audit"
	"github.com/school-crm/teacher-service/internal/db"
	"golang.org/x/crypto/bcrypt"
)

// ── Models ─────────────────────────────────────────────────────────────────────

type Teacher struct {
	ID            string     `json:"id"`
	FullName      string     `json:"fullName"`
	Subjects      []string   `json:"subjects"`
	MonthlySalary float64    `json:"monthlySalary"`
	Phone         string     `json:"phone"`
	Email         string     `json:"email"`
	BranchID      string     `json:"branchId"`
	UserID        *string    `json:"userId,omitempty"`
	JoinedDate    *time.Time `json:"joinedDate,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type Salary struct {
	ID            string     `json:"id"`
	TeacherID     string     `json:"teacherId"`
	TeacherName   string     `json:"teacherName,omitempty"`
	Amount        float64    `json:"amount"`
	Month         string     `json:"month"`
	Year          int        `json:"year"`
	PaymentMethod string     `json:"paymentMethod"`
	Status        string     `json:"status"`
	Notes         *string    `json:"notes,omitempty"`
	PaidDate      *time.Time `json:"paidDate,omitempty"`
	BranchID      string     `json:"branchId"`
	CreatedBy     *string    `json:"createdBy,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
}

var ErrNotFound = errors.New("not found")

// ── TeacherService ─────────────────────────────────────────────────────────────

type TeacherService struct {
	db *db.DB
}

func NewTeacherService(database *db.DB) *TeacherService {
	return &TeacherService{db: database}
}

func (s *TeacherService) GetAll(ctx context.Context, branchID string) ([]Teacher, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT t.id, t.full_name, t.monthly_salary,
		       COALESCE(t.phone,''), COALESCE(t.email,''), t.branch_id,
		       t.user_id, t.joined_date, t.created_at, t.updated_at,
		       COALESCE(array_agg(ts.subject) FILTER (WHERE ts.subject IS NOT NULL), '{}')
		FROM teachers t
		LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
		WHERE t.branch_id = $1
		GROUP BY t.id ORDER BY t.full_name`, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teachers []Teacher
	for rows.Next() {
		var t Teacher
		if err := rows.Scan(&t.ID, &t.FullName, &t.MonthlySalary,
			&t.Phone, &t.Email, &t.BranchID, &t.UserID, &t.JoinedDate, &t.CreatedAt, &t.UpdatedAt,
			pq.Array(&t.Subjects)); err != nil {
			return nil, err
		}
		teachers = append(teachers, t)
	}
	return teachers, rows.Err()
}

func (s *TeacherService) GetByID(ctx context.Context, id string) (*Teacher, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var t Teacher
	err := s.db.Conn().QueryRowContext(ctx, `
		SELECT t.id, t.full_name, t.monthly_salary,
		       COALESCE(t.phone,''), COALESCE(t.email,''), t.branch_id,
		       t.user_id, t.joined_date, t.created_at, t.updated_at,
		       COALESCE(array_agg(ts.subject) FILTER (WHERE ts.subject IS NOT NULL), '{}')
		FROM teachers t
		LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
		WHERE t.id = $1
		GROUP BY t.id`, id,
	).Scan(&t.ID, &t.FullName, &t.MonthlySalary,
		&t.Phone, &t.Email, &t.BranchID, &t.UserID, &t.JoinedDate, &t.CreatedAt, &t.UpdatedAt,
		pq.Array(&t.Subjects))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &t, err
}

type CreateTeacherRequest struct {
	FullName      string     `json:"fullName"      binding:"required"`
	Subjects      []string   `json:"subjects"`
	MonthlySalary float64    `json:"monthlySalary" binding:"required,gt=0"`
	Phone         string     `json:"phone"         binding:"required"`
	Email         string     `json:"email"         binding:"required,email"`
	Password      string     `json:"password"`
	BranchID      string     `json:"branchId"      binding:"required"`
	JoinedDate    *time.Time `json:"joinedDate"`
}

func (s *TeacherService) Create(ctx context.Context, req *CreateTeacherRequest) (*Teacher, error) {
	now := time.Now().UTC()
	t := &Teacher{
		ID:            uuid.New().String(),
		FullName:      req.FullName,
		Subjects:      req.Subjects,
		MonthlySalary: req.MonthlySalary,
		Phone:         req.Phone,
		Email:         req.Email,
		BranchID:      req.BranchID,
		JoinedDate:    req.JoinedDate,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	tx, err := s.db.Conn().BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	// Optionally create a user account for the teacher
	if req.Password != "" {
		hashedPw, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		userID := uuid.New().String()
		_, err = tx.ExecContext(ctx,
			`INSERT INTO users (id, email, password_hash, role, full_name, branch_id, created_at, updated_at)
			 VALUES ($1, $2, $3, 'teacher', $4, $5, $6, $6)`,
			userID, req.Email, string(hashedPw), req.FullName, req.BranchID, now,
		)
		if err != nil {
			return nil, fmt.Errorf("create teacher user: %w", err)
		}
		t.UserID = &userID
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO teachers (id, full_name, monthly_salary, phone, email, branch_id, user_id, joined_date, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		t.ID, t.FullName, t.MonthlySalary, t.Phone, t.Email,
		t.BranchID, t.UserID, t.JoinedDate, t.CreatedAt, t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	for _, subj := range t.Subjects {
		if subj == "" {
			continue
		}
		_, err = tx.ExecContext(ctx,
			`INSERT INTO teacher_subjects (id, teacher_id, subject) VALUES (gen_random_uuid(), $1, $2)`,
			t.ID, subj)
		if err != nil {
			return nil, fmt.Errorf("insert subject: %w", err)
		}
	}

	return t, tx.Commit()
}

func (s *TeacherService) Update(ctx context.Context, id string, fields map[string]interface{}) (*Teacher, error) {
	allowed := map[string]bool{
		"full_name": true, "monthly_salary": true,
		"phone": true, "email": true, "joined_date": true,
	}

	// Extract subjects separately — stored in teacher_subjects, not a column.
	var newSubjects []string
	hasSubjects := false
	if rawSubjects, ok := fields["subjects"]; ok {
		hasSubjects = true
		switch v := rawSubjects.(type) {
		case []string:
			newSubjects = v
		case []interface{}:
			for _, s := range v {
				if sv, ok := s.(string); ok {
					newSubjects = append(newSubjects, sv)
				}
			}
		}
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

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	tx, err := s.db.Conn().BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	if len(parts) > 0 {
		parts = append(parts, fmt.Sprintf("updated_at = $%d", n))
		args = append(args, time.Now().UTC())
		n++
		args = append(args, id)
		_, err = tx.ExecContext(ctx,
			"UPDATE teachers SET "+strings.Join(parts, ", ")+" WHERE id = $"+fmt.Sprintf("%d", n), args...)
		if err != nil {
			return nil, err
		}
	}

	if hasSubjects {
		if _, err = tx.ExecContext(ctx, `DELETE FROM teacher_subjects WHERE teacher_id = $1`, id); err != nil {
			return nil, err
		}
		for _, subj := range newSubjects {
			if subj == "" {
				continue
			}
			if _, err = tx.ExecContext(ctx,
				`INSERT INTO teacher_subjects (id, teacher_id, subject) VALUES (gen_random_uuid(), $1, $2)`,
				id, subj); err != nil {
				return nil, err
			}
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetByID(ctx, id)
}

func (s *TeacherService) Delete(ctx context.Context, id string) error {
	t, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	tx, err := s.db.Conn().BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, "DELETE FROM teachers WHERE id = $1", id); err != nil {
		return err
	}
	// Remove linked user account if present
	if t.UserID != nil {
		if _, err := tx.ExecContext(ctx, "DELETE FROM users WHERE id = $1", *t.UserID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ── SalaryService ─────────────────────────────────────────────────────────────

type SalaryService struct {
	db *db.DB
}

func NewSalaryService(database *db.DB) *SalaryService {
	return &SalaryService{db: database}
}

type CreateSalaryRequest struct {
	TeacherID     string     `json:"teacherId"     binding:"required"`
	Amount        float64    `json:"amount"        binding:"required,gt=0"`
	Month         string     `json:"month"         binding:"required"`
	Year          int        `json:"year"          binding:"required"`
	PaymentMethod string     `json:"paymentMethod" binding:"required"`
	Status        string     `json:"status"        binding:"required"`
	Notes         *string    `json:"notes"`
	PaidDate      *time.Time `json:"paidDate"`
	BranchID      string     `json:"branchId"      binding:"required"`
}

func (s *SalaryService) Create(ctx context.Context, req *CreateSalaryRequest, createdBy string) (*Salary, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	sal := &Salary{
		ID:            uuid.New().String(),
		TeacherID:     req.TeacherID,
		Amount:        req.Amount,
		Month:         req.Month,
		Year:          req.Year,
		PaymentMethod: req.PaymentMethod,
		Status:        req.Status,
		Notes:         req.Notes,
		PaidDate:      req.PaidDate,
		BranchID:      req.BranchID,
		CreatedBy:     &createdBy,
		CreatedAt:     time.Now().UTC(),
	}

	_, err := s.db.Conn().ExecContext(ctx, `
		INSERT INTO salaries (id, teacher_id, amount, month, year, payment_method, status, notes, paid_date, branch_id, created_by, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		sal.ID, sal.TeacherID, sal.Amount, sal.Month, sal.Year, sal.PaymentMethod,
		sal.Status, sal.Notes, sal.PaidDate, sal.BranchID, sal.CreatedBy, sal.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return sal, nil
}

func (s *SalaryService) GetByTeacher(ctx context.Context, teacherID string) ([]Salary, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT s.id, s.teacher_id, COALESCE(t.full_name,''), s.amount, s.month, s.year,
		       s.payment_method, s.status, s.notes, s.paid_date, s.branch_id, s.created_by, s.created_at
		FROM salaries s
		LEFT JOIN teachers t ON t.id = s.teacher_id
		WHERE s.teacher_id = $1
		ORDER BY s.year DESC, s.month DESC`, teacherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSalaries(rows)
}

func (s *SalaryService) GetByBranch(ctx context.Context, branchID, month string, year int) ([]Salary, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	where := "WHERE s.branch_id = $1"
	args := []interface{}{branchID}
	n := 2
	if month != "" {
		where += fmt.Sprintf(" AND s.month = $%d", n); args = append(args, month); n++
	}
	if year > 0 {
		where += fmt.Sprintf(" AND s.year = $%d", n); args = append(args, year); n++
	}

	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT s.id, s.teacher_id, COALESCE(t.full_name,''), s.amount, s.month, s.year,
		       s.payment_method, s.status, s.notes, s.paid_date, s.branch_id, s.created_by, s.created_at
		FROM salaries s
		LEFT JOIN teachers t ON t.id = s.teacher_id
		`+where+` ORDER BY t.full_name, s.year DESC, s.month DESC`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSalaries(rows)
}

func (s *SalaryService) Update(ctx context.Context, id string, fields map[string]interface{}) (*Salary, error) {
	allowed := map[string]bool{
		"amount": true, "payment_method": true, "status": true, "notes": true, "paid_date": true,
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
		return s.getByID(ctx, id)
	}
	args = append(args, id)

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	_, err := s.db.Conn().ExecContext(ctx,
		"UPDATE salaries SET "+strings.Join(parts, ", ")+" WHERE id = $"+fmt.Sprintf("%d", n), args...)
	if err != nil {
		return nil, err
	}
	return s.getByID(ctx, id)
}

func (s *SalaryService) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	_, err := s.db.Conn().ExecContext(ctx, "DELETE FROM salaries WHERE id = $1", id)
	return err
}

func (s *SalaryService) getByID(ctx context.Context, id string) (*Salary, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var sal Salary
	err := s.db.Conn().QueryRowContext(ctx, `
		SELECT s.id, s.teacher_id, COALESCE(t.full_name,''), s.amount, s.month, s.year,
		       s.payment_method, s.status, s.notes, s.paid_date, s.branch_id, s.created_by, s.created_at
		FROM salaries s
		LEFT JOIN teachers t ON t.id = s.teacher_id
		WHERE s.id = $1`, id,
	).Scan(&sal.ID, &sal.TeacherID, &sal.TeacherName, &sal.Amount, &sal.Month, &sal.Year,
		&sal.PaymentMethod, &sal.Status, &sal.Notes, &sal.PaidDate,
		&sal.BranchID, &sal.CreatedBy, &sal.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &sal, err
}

func scanSalaries(rows *sql.Rows) ([]Salary, error) {
	var salaries []Salary
	for rows.Next() {
		var s Salary
		if err := rows.Scan(&s.ID, &s.TeacherID, &s.TeacherName, &s.Amount, &s.Month, &s.Year,
			&s.PaymentMethod, &s.Status, &s.Notes, &s.PaidDate,
			&s.BranchID, &s.CreatedBy, &s.CreatedAt); err != nil {
			return nil, err
		}
		salaries = append(salaries, s)
	}
	return salaries, rows.Err()
}

// Audit writes a best-effort audit log entry.
func (s *TeacherService) Audit(ctx context.Context, branchID, userID, action, resource, resourceID, description string) {
	audit.Log(ctx, s.db.Conn(), branchID, userID, action, resource, resourceID, description)
}
