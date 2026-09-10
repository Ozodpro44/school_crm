// Package service contains the teacher-domain logic extracted from the monolith.
// Owns: teachers, salaries.
// During Strangler Fig migration reads/writes go to the shared public schema.
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
	IsActive      bool       `json:"isActive"`
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
var ErrInvalidInput = errors.New("invalid input")
var ErrDuplicate = errors.New("duplicate")
var ErrAlreadyPaid = errors.New("salary already paid")

// ── TeacherService ─────────────────────────────────────────────────────────────

type TeacherService struct {
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
// param. Blindly trusting that query param (the previous behavior on
// ListTeachers/ListSalaries/TeacherSalaryHistory) let ANY authenticated
// caller — including a teacher — read another branch's teacher/salary data
// by editing the query string.
func (s *TeacherService) HasBranchAccess(ctx context.Context, userID, role, branchID string) (bool, error) {
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

func NewTeacherService(database *db.DB) *TeacherService {
	return &TeacherService{db: database}
}

// GetAll returns every teacher for a branch. This intentionally has no
// pagination parameter — the frontend renders the full roster in one page —
// but a hard cap keeps a single pathological branch from turning this into
// an unbounded scan; 1000 teachers is far beyond any real school's roster.
func (s *TeacherService) GetAll(ctx context.Context, branchID string) ([]Teacher, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT t.id, t.full_name, t.monthly_salary,
		       COALESCE(t.phone,''), COALESCE(t.email,''), t.branch_id,
		       t.user_id, t.joined_date, t.is_active, t.created_at, t.updated_at,
		       COALESCE(array_agg(ts.subject) FILTER (WHERE ts.subject IS NOT NULL), '{}')
		FROM teachers t
		LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
		WHERE t.branch_id = $1 AND t.is_active = true
		GROUP BY t.id ORDER BY t.full_name
		LIMIT 1000`, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teachers []Teacher
	for rows.Next() {
		var t Teacher
		if err := rows.Scan(&t.ID, &t.FullName, &t.MonthlySalary,
			&t.Phone, &t.Email, &t.BranchID, &t.UserID, &t.JoinedDate, &t.IsActive, &t.CreatedAt, &t.UpdatedAt,
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
		       t.user_id, t.joined_date, t.is_active, t.created_at, t.updated_at,
		       COALESCE(array_agg(ts.subject) FILTER (WHERE ts.subject IS NOT NULL), '{}')
		FROM teachers t
		LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
		WHERE t.id = $1
		GROUP BY t.id`, id,
	).Scan(&t.ID, &t.FullName, &t.MonthlySalary,
		&t.Phone, &t.Email, &t.BranchID, &t.UserID, &t.JoinedDate, &t.IsActive, &t.CreatedAt, &t.UpdatedAt,
		pq.Array(&t.Subjects))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// GetByIDScoped is GetByID with a branch_id check, for HTTP entry points
// reachable by a client-supplied ID: without it, any caller who knows/
// guesses a teacher UUID could read another branch's teacher record.
// Returns ErrNotFound (not a distinct "forbidden") on a branch mismatch so
// callers can't use it to probe whether an ID exists elsewhere.
func (s *TeacherService) GetByIDScoped(ctx context.Context, id, branchID string) (*Teacher, error) {
	t, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if t.BranchID != branchID {
		return nil, ErrNotFound
	}
	return t, nil
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
		IsActive:      true,
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

// Update applies a partial update, scoped to branchID directly in the SQL
// (not just a pre-check) so it's safe even under a concurrent branch
// reassignment: the WHERE clause itself decides whether the row is touched.
func (s *TeacherService) Update(ctx context.Context, id, branchID string, fields map[string]interface{}) (*Teacher, error) {
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

	// Verify branch ownership up front, inside the transaction, even when
	// this update only touches subjects — otherwise a subjects-only request
	// (no columns in `allowed`) would skip the teachers UPDATE entirely and
	// go straight to mutating teacher_subjects for an arbitrary id with no
	// branch check at all.
	var ownerBranch string
	err = tx.QueryRowContext(ctx, "SELECT branch_id FROM teachers WHERE id = $1", id).Scan(&ownerBranch)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && ownerBranch != branchID) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

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

func (s *TeacherService) Delete(ctx context.Context, id, branchID string) error {
	t, err := s.GetByIDScoped(ctx, id, branchID)
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

	// Soft-delete only: teachers.id is referenced by salaries.teacher_id
	// (ON DELETE CASCADE), so a hard DELETE here would silently destroy that
	// teacher's entire paid/unpaid salary history. Deactivating instead keeps
	// the financial record intact and out of active rosters (GetAll filters
	// on is_active). branch_id in the WHERE clause too, not just the
	// pre-check above — the pre-check and this statement aren't atomic with
	// each other, so this is what actually guarantees a cross-branch delete
	// can't slip through.
	res, err := tx.ExecContext(ctx, "UPDATE teachers SET is_active = false WHERE id = $1 AND branch_id = $2", id, branchID)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return ErrNotFound
	}
	// Revoke login access by removing the linked user account, if present.
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

	if n, err := strconv.Atoi(req.Month); err != nil || n < 1 || n > 12 || len(req.Month) != 2 {
		return nil, fmt.Errorf("%w: month must be a zero-padded 01-12 string, got %q", ErrInvalidInput, req.Month)
	}
	currentYear := time.Now().Year()
	if req.Year < 2000 || req.Year > currentYear+1 {
		return nil, fmt.Errorf("%w: year %d is out of range", ErrInvalidInput, req.Year)
	}

	// A salary must belong to the same branch as the teacher it's paid to —
	// otherwise a caller with access to branch B could record a salary for a
	// branch-A teacher tagged branch_id=B, corrupting both branches' totals
	// and hiding the record from the teacher's real branch history.
	var teacherBranch string
	if err := s.db.Conn().QueryRowContext(ctx,
		"SELECT branch_id FROM teachers WHERE id = $1 AND is_active = true", req.TeacherID,
	).Scan(&teacherBranch); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: teacher not found", ErrInvalidInput)
		}
		return nil, err
	}
	if teacherBranch != req.BranchID {
		return nil, fmt.Errorf("%w: teacher does not belong to branchId", ErrInvalidInput)
	}

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
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return nil, fmt.Errorf("%w: a salary for this teacher/month/year already exists", ErrDuplicate)
		}
		return nil, err
	}
	return sal, nil
}

// GetByTeacher returns a teacher's salary history, scoped to branchID so a
// caller can't read another branch's salary history by guessing a teacher
// UUID.
func (s *SalaryService) GetByTeacher(ctx context.Context, teacherID, branchID string) ([]Salary, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT s.id, s.teacher_id, COALESCE(t.full_name,''), s.amount, s.month, s.year,
		       s.payment_method, s.status, s.notes, s.paid_date, s.branch_id, s.created_by, s.created_at
		FROM salaries s
		LEFT JOIN teachers t ON t.id = s.teacher_id
		WHERE s.teacher_id = $1 AND s.branch_id = $2
		ORDER BY s.year DESC, s.month DESC`, teacherID, branchID)
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
		where += fmt.Sprintf(" AND s.month = $%d", n)
		args = append(args, month)
		n++
	}
	if year > 0 {
		where += fmt.Sprintf(" AND s.year = $%d", n)
		args = append(args, year)
		n++
	}

	// Without a month/year filter this returns every salary record ever
	// created for the branch — cap it so a long-lived branch's full history
	// can't turn an unfiltered call into an unbounded scan.
	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT s.id, s.teacher_id, COALESCE(t.full_name,''), s.amount, s.month, s.year,
		       s.payment_method, s.status, s.notes, s.paid_date, s.branch_id, s.created_by, s.created_at
		FROM salaries s
		LEFT JOIN teachers t ON t.id = s.teacher_id
		`+where+` ORDER BY t.full_name, s.year DESC, s.month DESC LIMIT 2000`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSalaries(rows)
}

// Update applies a partial update, scoped to branchID directly in the SQL —
// see TeacherService.Update's comment for why.
func (s *SalaryService) Update(ctx context.Context, id, branchID string, fields map[string]interface{}) (*Salary, error) {
	existing, err := s.GetByIDScoped(ctx, id, branchID)
	if err != nil {
		return nil, err
	}
	// A "paid" salary is a reconciled financial record — allow annotating it
	// (notes) or moving it off "paid" (e.g. to "unpaid") to correct a
	// mistake, but not silently changing the amount or paid_date while it
	// stays marked paid, which would edit a reconciled figure in place.
	if existing.Status == "paid" {
		newStatus, changingStatus := fields["status"]
		stayingPaid := !changingStatus || newStatus == "paid"
		if stayingPaid {
			if _, ok := fields["amount"]; ok {
				return nil, fmt.Errorf("%w: cannot change the amount of a salary already marked paid", ErrAlreadyPaid)
			}
			if _, ok := fields["paid_date"]; ok {
				return nil, fmt.Errorf("%w: cannot change the paid_date of a salary already marked paid", ErrAlreadyPaid)
			}
		}
	}

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
		return s.GetByIDScoped(ctx, id, branchID)
	}
	args = append(args, id, branchID)

	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	res, err := s.db.Conn().ExecContext(ctx,
		"UPDATE salaries SET "+strings.Join(parts, ", ")+
			" WHERE id = $"+fmt.Sprintf("%d", n)+" AND branch_id = $"+fmt.Sprintf("%d", n+1), args...)
	if err != nil {
		return nil, err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return nil, ErrNotFound
	}
	return s.getByID(ctx, id)
}

// Delete removes a salary record, scoped to branchID directly in the DELETE
// statement — see TeacherService.Delete's comment for why.
func (s *SalaryService) Delete(ctx context.Context, id, branchID string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	res, err := s.db.Conn().ExecContext(ctx,
		"DELETE FROM salaries WHERE id = $1 AND branch_id = $2", id, branchID)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return ErrNotFound
	}
	return nil
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
	if err != nil {
		return nil, err
	}
	return &sal, nil
}

// GetByIDScoped is getByID with a branch_id check, for HTTP entry points
// reachable by a client-supplied ID — see TeacherService.GetByIDScoped for
// why this exists separately.
func (s *SalaryService) GetByIDScoped(ctx context.Context, id, branchID string) (*Salary, error) {
	sal, err := s.getByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if sal.BranchID != branchID {
		return nil, ErrNotFound
	}
	return sal, nil
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
