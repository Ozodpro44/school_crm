// Package service contains the student-domain logic extracted from the monolith.
// Owns: students, classes, attendance, student_notes.
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
	"github.com/school-crm/student-service/internal/db"
)

// ── Models ─────────────────────────────────────────────────────────────────────

type Student struct {
	ID             string     `json:"id"`
	FullName       string     `json:"fullName"`
	Phone          string     `json:"phone"`
	ParentPhone    string     `json:"parentPhone"`
	ClassID        *string    `json:"classId,omitempty"`
	ClassName      string     `json:"className,omitempty"`
	MonthlyPayment float64    `json:"monthlyPayment"`
	Status         string     `json:"status"`
	BranchID       string     `json:"branchId"`
	EnrollmentDate *time.Time `json:"enrollmentDate,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type StudentListResponse struct {
	Items      []Student `json:"items"`
	Total      int       `json:"total"`
	Page       int       `json:"page"`
	Limit      int       `json:"limit"`
	NextCursor string    `json:"nextCursor,omitempty"`
}

type Class struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	TeacherID *string    `json:"teacherId,omitempty"`
	BranchID  string     `json:"branchId"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

type Attendance struct {
	ID        string    `json:"id"`
	BranchID  string    `json:"branchId"`
	ClassID   string    `json:"classId"`
	StudentID string    `json:"studentId"`
	Date      string    `json:"date"`
	Status    string    `json:"status"`
	Note      string    `json:"note,omitempty"`
	CreatedBy *string   `json:"createdBy,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// ── Errors ────────────────────────────────────────────────────────────────────

var ErrNotFound = errors.New("not found")

// ── StudentService ────────────────────────────────────────────────────────────

type StudentService struct {
	db *db.DB
}

func NewStudentService(database *db.DB) *StudentService {
	return &StudentService{db: database}
}

type ListFilter struct {
	BranchID      string
	Search        string
	Status        string
	ClassID       string
	Page          string
	Limit         string
	Cursor        string // keyset cursor on full_name
}

func (s *StudentService) List(ctx context.Context, f ListFilter) (*StudentListResponse, error) {
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
	useCursor := f.Cursor != ""
	offset := (page - 1) * limit

	where := "WHERE s.branch_id = $1"
	args := []interface{}{f.BranchID}
	n := 2

	if f.Status != "" {
		where += fmt.Sprintf(" AND s.status = $%d", n); args = append(args, f.Status); n++
	}
	if f.ClassID != "" {
		where += fmt.Sprintf(" AND s.class_id = $%d", n); args = append(args, f.ClassID); n++
	}
	if f.Search != "" {
		where += fmt.Sprintf(" AND (LOWER(s.full_name) LIKE LOWER($%d) OR s.phone LIKE $%d)", n, n)
		args = append(args, "%"+f.Search+"%"); n++
	}
	if useCursor {
		where += fmt.Sprintf(" AND s.full_name > $%d", n); args = append(args, f.Cursor); n++
	}

	var total int
	if err := s.db.Conn().QueryRowContext(ctx,
		"SELECT COUNT(*) FROM students s "+where, args...).Scan(&total); err != nil {
		return nil, err
	}

	dataArgs := append([]interface{}{}, args...)
	var paging string
	if useCursor {
		paging = fmt.Sprintf(" LIMIT $%d", n)
		dataArgs = append(dataArgs, limit)
	} else {
		paging = fmt.Sprintf(" LIMIT $%d OFFSET $%d", n, n+1)
		dataArgs = append(dataArgs, limit, offset)
	}

	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT s.id, s.full_name,
		       COALESCE(s.phone,''), COALESCE(s.parent_phone,''),
		       s.class_id, COALESCE(c.name,''),
		       s.monthly_payment, s.status, s.branch_id,
		       s.enrollment_date, s.created_at, s.updated_at
		FROM students s
		LEFT JOIN classes c ON c.id = s.class_id
		`+where+` ORDER BY s.full_name`+paging, dataArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var students []Student
	for rows.Next() {
		var st Student
		var className string
		if err := rows.Scan(
			&st.ID, &st.FullName, &st.Phone, &st.ParentPhone,
			&st.ClassID, &className,
			&st.MonthlyPayment, &st.Status, &st.BranchID,
			&st.EnrollmentDate, &st.CreatedAt, &st.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if className != "" {
			st.ClassName = className
		}
		students = append(students, st)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var nextCursor string
	if len(students) == limit {
		nextCursor = students[len(students)-1].FullName
	}

	return &StudentListResponse{
		Items: students, Total: total, Page: page, Limit: limit, NextCursor: nextCursor,
	}, nil
}

func (s *StudentService) GetByID(ctx context.Context, id string) (*Student, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var st Student
	var className string
	err := s.db.Conn().QueryRowContext(ctx, `
		SELECT s.id, s.full_name,
		       COALESCE(s.phone,''), COALESCE(s.parent_phone,''),
		       s.class_id, COALESCE(c.name,''),
		       s.monthly_payment, s.status, s.branch_id,
		       s.enrollment_date, s.created_at, s.updated_at
		FROM students s
		LEFT JOIN classes c ON c.id = s.class_id
		WHERE s.id = $1`, id,
	).Scan(
		&st.ID, &st.FullName, &st.Phone, &st.ParentPhone,
		&st.ClassID, &className,
		&st.MonthlyPayment, &st.Status, &st.BranchID,
		&st.EnrollmentDate, &st.CreatedAt, &st.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if className != "" {
		st.ClassName = className
	}
	return &st, nil
}

func (s *StudentService) Create(ctx context.Context, st *Student) (*Student, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	st.ID = uuid.New().String()
	st.CreatedAt = time.Now().UTC()
	st.UpdatedAt = st.CreatedAt

	_, err := s.db.Conn().ExecContext(ctx, `
		INSERT INTO students
		  (id, full_name, phone, parent_phone, class_id, monthly_payment,
		   status, branch_id, enrollment_date, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		st.ID, st.FullName, st.Phone, st.ParentPhone, st.ClassID, st.MonthlyPayment,
		st.Status, st.BranchID, st.EnrollmentDate, st.CreatedAt, st.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return st, nil
}

func (s *StudentService) Update(ctx context.Context, id string, fields map[string]interface{}) (*Student, error) {
	allowed := map[string]bool{
		"full_name": true, "phone": true, "parent_phone": true, "class_id": true,
		"monthly_payment": true, "status": true, "enrollment_date": true,
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
		"UPDATE students SET "+strings.Join(parts, ", ")+" WHERE id = $"+strconv.Itoa(n), args...)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *StudentService) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	_, err := s.db.Conn().ExecContext(ctx, "DELETE FROM students WHERE id = $1", id)
	return err
}

// ── ClassService ──────────────────────────────────────────────────────────────

type ClassService struct {
	db *db.DB
}

func NewClassService(database *db.DB) *ClassService {
	return &ClassService{db: database}
}

func (s *ClassService) GetAll(ctx context.Context, branchID string) ([]Class, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	rows, err := s.db.Conn().QueryContext(ctx,
		`SELECT id, name, teacher_id, branch_id, created_at, updated_at
		 FROM classes WHERE branch_id = $1 ORDER BY name`, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var classes []Class
	for rows.Next() {
		var c Class
		if err := rows.Scan(&c.ID, &c.Name, &c.TeacherID, &c.BranchID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		classes = append(classes, c)
	}
	return classes, rows.Err()
}

func (s *ClassService) GetByID(ctx context.Context, id string) (*Class, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var c Class
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT id, name, teacher_id, branch_id, created_at, updated_at FROM classes WHERE id = $1`, id,
	).Scan(&c.ID, &c.Name, &c.TeacherID, &c.BranchID, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &c, err
}

func (s *ClassService) Create(ctx context.Context, name, branchID string, teacherID *string) (*Class, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	// Duplicate name guard
	var count int
	_ = s.db.Conn().QueryRowContext(ctx,
		`SELECT COUNT(*) FROM classes WHERE name=$1 AND branch_id=$2`, name, branchID).Scan(&count)
	if count > 0 {
		return nil, fmt.Errorf("a class named %q already exists in this branch", name)
	}

	c := &Class{
		ID:        uuid.New().String(),
		Name:      name,
		TeacherID: teacherID,
		BranchID:  branchID,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	_, err := s.db.Conn().ExecContext(ctx,
		`INSERT INTO classes (id, name, teacher_id, branch_id, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		c.ID, c.Name, c.TeacherID, c.BranchID, c.CreatedAt, c.UpdatedAt,
	)
	return c, err
}

func (s *ClassService) Update(ctx context.Context, id string, fields map[string]interface{}) (*Class, error) {
	allowed := map[string]bool{"name": true, "teacher_id": true}
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
		"UPDATE classes SET "+strings.Join(parts, ", ")+" WHERE id = $"+strconv.Itoa(n), args...)
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *ClassService) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	_, err := s.db.Conn().ExecContext(ctx, "DELETE FROM classes WHERE id = $1", id)
	return err
}

// ── ConsolidatedData ──────────────────────────────────────────────────────────

type StudentClassInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type StudentPaymentInfo struct {
	Status string  `json:"status"`
	Amount float64 `json:"amount"`
}

type StudentListItem struct {
	ID             string             `json:"id"`
	FullName       string             `json:"fullName"`
	Phone          string             `json:"phone"`
	ParentPhone    string             `json:"parentPhone"`
	MonthlyPayment float64            `json:"monthlyPayment"`
	Status         string             `json:"status"`
	BranchID       string             `json:"branchId"`
	ClassID        string             `json:"classId,omitempty"`
	Class          *StudentClassInfo  `json:"class,omitempty"`
	Payment        *StudentPaymentInfo `json:"payment,omitempty"`
	CreatedAt      time.Time          `json:"createdAt"`
	UpdatedAt      time.Time          `json:"updatedAt"`
}

type ClassItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ConsolidatedResponse struct {
	Items      []StudentListItem `json:"items"`
	Classes    []ClassItem       `json:"classes"`
	Total      int               `json:"total"`
	Page       int               `json:"page"`
	Limit      int               `json:"limit"`
	NextCursor string            `json:"nextCursor,omitempty"`
}

type ConsolidatedFilter struct {
	BranchID      string
	Page          string
	Limit         string
	Cursor        string
	Search        string
	Status        string
	ClassID       string
	PaymentStatus string
	Month         string
	Year          string
}

func (s *StudentService) ConsolidatedData(ctx context.Context, f ConsolidatedFilter) (*ConsolidatedResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, db.ReportTimeout)
	defer cancel()

	page, _ := strconv.Atoi(f.Page)
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(f.Limit)
	if limit < 1 || limit > 500 {
		limit = 10
	}

	now := time.Now()
	month := f.Month
	if month == "" {
		month = now.Format("01")
	}
	year := now.Year()
	if y, err := strconv.Atoi(f.Year); err == nil && y > 0 {
		year = y
	}

	useCursor := f.Cursor != ""
	offset := (page - 1) * limit

	where := "WHERE s.branch_id = $1"
	args := []interface{}{f.BranchID}
	n := 2

	if f.Search != "" {
		where += fmt.Sprintf(" AND (LOWER(s.full_name) LIKE LOWER($%d) OR s.phone LIKE $%d)", n, n)
		args = append(args, "%"+f.Search+"%")
		n++
	}
	if useCursor {
		where += fmt.Sprintf(" AND s.full_name > $%d", n)
		args = append(args, f.Cursor)
		n++
	}
	if f.Status != "" {
		where += fmt.Sprintf(" AND s.status = $%d", n)
		args = append(args, f.Status)
		n++
	}
	if f.ClassID != "" {
		where += fmt.Sprintf(" AND s.class_id = $%d", n)
		args = append(args, f.ClassID)
		n++
	}
	if f.PaymentStatus != "" {
		where += fmt.Sprintf(" AND COALESCE(p.status, 'unpaid') = $%d", n)
		args = append(args, f.PaymentStatus)
		n++
	}

	lateralJoin := `LEFT JOIN LATERAL (
		SELECT COALESCE(SUM(amount), 0) AS total_amount,
		       CASE
		           WHEN COALESCE(SUM(amount), 0) >= s.monthly_payment THEN 'paid'
		           WHEN COALESCE(SUM(amount), 0) > 0 THEN 'partial'
		           ELSE 'unpaid'
		       END AS status
		FROM payments
		WHERE student_id = s.id
		  AND month = $` + strconv.Itoa(n) + `
		  AND year = $` + strconv.Itoa(n+1) + `
		  AND status IN ('paid', 'partial')
	) p ON true`

	countArgs := append([]interface{}{}, args...)
	countArgs = append(countArgs, month, year)

	var total int
	if err := s.db.Conn().QueryRowContext(ctx,
		`SELECT COUNT(*) FROM students s LEFT JOIN classes c ON c.id = s.class_id `+
			lateralJoin+` `+where, countArgs...).Scan(&total); err != nil {
		return nil, err
	}

	var pagingClause string
	dataArgs := append([]interface{}{}, args...)
	dataArgs = append(dataArgs, month, year)
	if useCursor {
		pagingClause = ` LIMIT $` + strconv.Itoa(n+2)
		dataArgs = append(dataArgs, limit)
	} else {
		pagingClause = ` LIMIT $` + strconv.Itoa(n+2) + ` OFFSET $` + strconv.Itoa(n+3)
		dataArgs = append(dataArgs, limit, offset)
	}

	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT s.id, s.full_name,
		       COALESCE(s.phone,''), COALESCE(s.parent_phone,''),
		       s.monthly_payment, s.status, s.branch_id,
		       s.created_at, s.updated_at,
		       s.class_id, COALESCE(c.name,''),
		       COALESCE(p.status,'unpaid'), COALESCE(p.total_amount,0)
		FROM students s
		LEFT JOIN classes c ON c.id = s.class_id
		`+lateralJoin+`
		`+where+`
		ORDER BY s.full_name ASC`+pagingClause, dataArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]StudentListItem, 0)
	for rows.Next() {
		var it StudentListItem
		var classID sql.NullString
		var className string
		var paymentStatus string
		var paymentAmount float64
		if err := rows.Scan(
			&it.ID, &it.FullName, &it.Phone, &it.ParentPhone,
			&it.MonthlyPayment, &it.Status, &it.BranchID,
			&it.CreatedAt, &it.UpdatedAt,
			&classID, &className,
			&paymentStatus, &paymentAmount,
		); err != nil {
			return nil, err
		}
		if classID.Valid && classID.String != "" {
			it.ClassID = classID.String
			it.Class = &StudentClassInfo{ID: classID.String, Name: className}
		}
		it.Payment = &StudentPaymentInfo{Status: paymentStatus, Amount: paymentAmount}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	classRows, err := s.db.Conn().QueryContext(ctx,
		`SELECT id, name FROM classes WHERE branch_id = $1 ORDER BY name`, f.BranchID)
	if err != nil {
		return nil, err
	}
	defer classRows.Close()

	classes := make([]ClassItem, 0)
	for classRows.Next() {
		var ci ClassItem
		if err := classRows.Scan(&ci.ID, &ci.Name); err != nil {
			return nil, err
		}
		classes = append(classes, ci)
	}

	var nextCursor string
	if len(items) == limit {
		nextCursor = items[len(items)-1].FullName
	}

	return &ConsolidatedResponse{
		Items:      items,
		Classes:    classes,
		Total:      total,
		Page:       page,
		Limit:      limit,
		NextCursor: nextCursor,
	}, nil
}

// ── SearchWithPayments ─────────────────────────────────────────────────────────

type StudentWithPayment struct {
	ID             string  `json:"id"`
	FullName       string  `json:"fullName"`
	Phone          string  `json:"phone"`
	ClassID        string  `json:"classId"`
	ClassName      string  `json:"className"`
	MonthlyPayment float64 `json:"monthlyPayment"`
	PaidAmount     float64 `json:"paidAmount"`
	PaymentStatus  string  `json:"paymentStatus"` // paid | partial | none
	BranchID       string  `json:"branchId"`
}

func (s *StudentService) SearchWithPayments(ctx context.Context, branchID, search, month string, year int) ([]StudentWithPayment, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	args := []interface{}{branchID}
	n := 2
	where := "WHERE s.branch_id = $1 AND s.status = 'active'"
	if search != "" {
		where += fmt.Sprintf(" AND (LOWER(s.full_name) LIKE LOWER($%d) OR s.phone LIKE $%d)", n, n)
		args = append(args, "%"+search+"%")
		n++
	}
	args = append(args, month, year)
	monthN, yearN := n, n+1

	query := fmt.Sprintf(`
		SELECT s.id, s.full_name, COALESCE(s.phone,''), s.class_id,
		       COALESCE(c.name,''), s.monthly_payment, s.branch_id,
		       COALESCE(SUM(pay.amount) FILTER (WHERE pay.month=$%d AND pay.year=$%d AND pay.status IN ('paid','partial')), 0)
		FROM students s
		LEFT JOIN classes c ON c.id = s.class_id
		LEFT JOIN payments pay ON pay.student_id = s.id
		%s
		GROUP BY s.id, s.full_name, s.phone, s.class_id, c.name, s.monthly_payment, s.branch_id
		ORDER BY s.full_name LIMIT 100`, monthN, yearN, where)

	rows, err := s.db.Conn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]StudentWithPayment, 0)
	for rows.Next() {
		var sw StudentWithPayment
		var classID sql.NullString
		if err := rows.Scan(&sw.ID, &sw.FullName, &sw.Phone, &classID,
			&sw.ClassName, &sw.MonthlyPayment, &sw.BranchID, &sw.PaidAmount); err != nil {
			return nil, err
		}
		if classID.Valid {
			sw.ClassID = classID.String
		}
		if sw.PaidAmount >= sw.MonthlyPayment && sw.PaidAmount > 0 {
			sw.PaymentStatus = "paid"
		} else if sw.PaidAmount > 0 {
			sw.PaymentStatus = "partial"
		} else {
			sw.PaymentStatus = "none"
		}
		result = append(result, sw)
	}
	return result, rows.Err()
}

// GetByTeacherID returns all classes assigned to a specific teacher.
// Used by the gRPC GetTeacherClasses method (called by teacher_service).
func (s *ClassService) GetByTeacherID(ctx context.Context, teacherID string) ([]Class, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	rows, err := s.db.Conn().QueryContext(ctx,
		`SELECT id, name, teacher_id, branch_id, created_at, updated_at
		 FROM classes WHERE teacher_id = $1 ORDER BY name`, teacherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var classes []Class
	for rows.Next() {
		var c Class
		if err := rows.Scan(&c.ID, &c.Name, &c.TeacherID, &c.BranchID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		classes = append(classes, c)
	}
	return classes, rows.Err()
}

// ── AttendanceService ─────────────────────────────────────────────────────────

type AttendanceService struct {
	db *db.DB
}

func NewAttendanceService(database *db.DB) *AttendanceService {
	return &AttendanceService{db: database}
}

type BulkAttendanceRecord struct {
	StudentID string `json:"studentId" binding:"required"`
	Status    string `json:"status"    binding:"required"`
	Note      string `json:"note"`
}

type BulkAttendanceRequest struct {
	BranchID string                 `json:"branchId" binding:"required"`
	ClassID  string                 `json:"classId"  binding:"required"`
	Date     string                 `json:"date"     binding:"required"`
	Records  []BulkAttendanceRecord `json:"records"  binding:"required,min=1"`
}

func (s *AttendanceService) Save(ctx context.Context, req *BulkAttendanceRequest, createdBy string) ([]Attendance, error) {
	tx, err := s.db.Conn().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("attendance save: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	now := time.Now().UTC()
	var result []Attendance

	for _, rec := range req.Records {
		var a Attendance
		err := tx.QueryRowContext(ctx, `
			INSERT INTO attendance
			  (id, branch_id, class_id, student_id, date, status, note, created_by, created_at, updated_at)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
			ON CONFLICT (class_id, student_id, date) DO UPDATE
			  SET status=EXCLUDED.status, note=EXCLUDED.note, updated_at=EXCLUDED.updated_at
			RETURNING id, branch_id, class_id, student_id, date::text, status, note, created_by, created_at`,
			uuid.New().String(), req.BranchID, req.ClassID, rec.StudentID,
			req.Date, rec.Status, rec.Note, createdBy, now,
		).Scan(&a.ID, &a.BranchID, &a.ClassID, &a.StudentID, &a.Date,
			&a.Status, &a.Note, &a.CreatedBy, &a.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("attendance upsert: %w", err)
		}
		result = append(result, a)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("attendance save: commit: %w", err)
	}
	return result, nil
}

func (s *AttendanceService) GetByClassDate(ctx context.Context, classID, date string) ([]Attendance, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT a.id, a.branch_id, a.class_id, a.student_id, a.date::text,
		       a.status, COALESCE(a.note,''), a.created_by, a.created_at
		FROM attendance a
		WHERE a.class_id=$1 AND a.date=$2
		ORDER BY a.student_id`, classID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Attendance
	for rows.Next() {
		var a Attendance
		if err := rows.Scan(&a.ID, &a.BranchID, &a.ClassID, &a.StudentID, &a.Date,
			&a.Status, &a.Note, &a.CreatedBy, &a.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, a)
	}
	return records, rows.Err()
}

func (s *AttendanceService) GetByStudentMonth(ctx context.Context, studentID, month string, year int) ([]Attendance, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var rows *sql.Rows
	var err error

	if month == "" || year == 0 {
		// No filter: return all attendance for this student
		rows, err = s.db.Conn().QueryContext(ctx, `
			SELECT id, branch_id, class_id, student_id, date::text,
			       status, COALESCE(note,''), created_by, created_at
			FROM attendance
			WHERE student_id=$1
			ORDER BY date`, studentID)
	} else {
		rows, err = s.db.Conn().QueryContext(ctx, `
			SELECT id, branch_id, class_id, student_id, date::text,
			       status, COALESCE(note,''), created_by, created_at
			FROM attendance
			WHERE student_id=$1
			  AND EXTRACT(month FROM date)=$2::int
			  AND EXTRACT(year  FROM date)=$3
			ORDER BY date`, studentID, month, year)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Attendance
	for rows.Next() {
		var a Attendance
		if err := rows.Scan(&a.ID, &a.BranchID, &a.ClassID, &a.StudentID, &a.Date,
			&a.Status, &a.Note, &a.CreatedBy, &a.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, a)
	}
	return records, rows.Err()
}

// ── ScheduleSlot ───────────────────────────────────────────────────────────────

type ScheduleSlot struct {
	ID          string    `json:"id"`
	BranchID    string    `json:"branchId"`
	ClassID     string    `json:"classId"`
	TeacherID   *string   `json:"teacherId"`
	TeacherName string    `json:"teacherName,omitempty"`
	DayOfWeek   int       `json:"dayOfWeek"`
	StartTime   string    `json:"startTime"`
	EndTime     string    `json:"endTime"`
	Room        string    `json:"room"`
	Subject     string    `json:"subject"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type UpsertScheduleRequest struct {
	BranchID  string  `json:"branchId"  binding:"required"`
	ClassID   string  `json:"classId"   binding:"required"`
	TeacherID *string `json:"teacherId"`
	DayOfWeek int     `json:"dayOfWeek" binding:"required,min=1,max=6"`
	StartTime string  `json:"startTime" binding:"required"`
	EndTime   string  `json:"endTime"   binding:"required"`
	Room      string  `json:"room"`
	Subject   string  `json:"subject"`
}

type ScheduleService struct {
	db *db.DB
}

func NewScheduleService(database *db.DB) *ScheduleService {
	return &ScheduleService{db: database}
}

const scheduleSelectSQL = `
	SELECT cs.id, cs.branch_id, cs.class_id, cs.teacher_id, cs.day_of_week,
	       cs.start_time, cs.end_time, cs.room, cs.subject, cs.created_at, cs.updated_at,
	       COALESCE(t.full_name, '') AS teacher_name
	FROM class_schedule cs
	LEFT JOIN teachers t ON t.id = cs.teacher_id`

func scanScheduleSlots(rows *sql.Rows) ([]ScheduleSlot, error) {
	var slots []ScheduleSlot
	for rows.Next() {
		var slot ScheduleSlot
		if err := rows.Scan(&slot.ID, &slot.BranchID, &slot.ClassID, &slot.TeacherID,
			&slot.DayOfWeek, &slot.StartTime, &slot.EndTime, &slot.Room, &slot.Subject,
			&slot.CreatedAt, &slot.UpdatedAt, &slot.TeacherName); err != nil {
			return nil, err
		}
		slots = append(slots, slot)
	}
	if slots == nil {
		slots = []ScheduleSlot{}
	}
	return slots, rows.Err()
}

func (s *ScheduleService) GetByClass(ctx context.Context, classID string) ([]ScheduleSlot, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	rows, err := s.db.Conn().QueryContext(ctx,
		scheduleSelectSQL+` WHERE cs.class_id=$1 ORDER BY cs.day_of_week, cs.start_time`, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanScheduleSlots(rows)
}

func (s *ScheduleService) GetByBranch(ctx context.Context, branchID string) ([]ScheduleSlot, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	rows, err := s.db.Conn().QueryContext(ctx,
		scheduleSelectSQL+` WHERE cs.branch_id=$1 ORDER BY cs.day_of_week, cs.start_time`, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanScheduleSlots(rows)
}

func (s *ScheduleService) Upsert(ctx context.Context, req *UpsertScheduleRequest) (*ScheduleSlot, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	now := time.Now()
	id := uuid.New().String()
	var slot ScheduleSlot
	err := s.db.Conn().QueryRowContext(ctx, `
		INSERT INTO class_schedule (id, branch_id, class_id, teacher_id, day_of_week, start_time, end_time, room, subject, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
		ON CONFLICT (class_id, day_of_week, start_time) DO UPDATE SET
			teacher_id = EXCLUDED.teacher_id,
			end_time   = EXCLUDED.end_time,
			room       = EXCLUDED.room,
			subject    = EXCLUDED.subject,
			updated_at = EXCLUDED.updated_at
		RETURNING id, branch_id, class_id, teacher_id, day_of_week, start_time, end_time, room, subject, created_at, updated_at
	`, id, req.BranchID, req.ClassID, req.TeacherID, req.DayOfWeek, req.StartTime, req.EndTime, req.Room, req.Subject, now,
	).Scan(&slot.ID, &slot.BranchID, &slot.ClassID, &slot.TeacherID, &slot.DayOfWeek,
		&slot.StartTime, &slot.EndTime, &slot.Room, &slot.Subject, &slot.CreatedAt, &slot.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("upsert schedule: %w", err)
	}
	return &slot, nil
}

func (s *ScheduleService) Delete(ctx context.Context, id, branchID string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	res, err := s.db.Conn().ExecContext(ctx, `DELETE FROM class_schedule WHERE id=$1 AND branch_id=$2`, id, branchID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("slot not found")
	}
	return nil
}

// ── Assignment ─────────────────────────────────────────────────────────────────

type Assignment struct {
	ID             string    `json:"id"`
	BranchID       string    `json:"branchId"`
	ClassID        string    `json:"classId"`
	ClassName      string    `json:"className,omitempty"`
	TeacherID      *string   `json:"teacherId"`
	Subject        string    `json:"subject"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	DueDate        string    `json:"dueDate"`
	CreatedBy      *string   `json:"createdBy"`
	TotalStudents  int       `json:"totalStudents,omitempty"`
	SubmittedCount int       `json:"submittedCount,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type CreateAssignmentRequest struct {
	BranchID    string  `json:"branchId"   binding:"required"`
	ClassID     string  `json:"classId"    binding:"required"`
	TeacherID   *string `json:"teacherId"`
	Subject     string  `json:"subject"`
	Title       string  `json:"title"      binding:"required"`
	Description string  `json:"description"`
	DueDate     string  `json:"dueDate"    binding:"required"`
}

type AssignmentSubmission struct {
	ID           string     `json:"id"`
	AssignmentID string     `json:"assignmentId"`
	StudentID    string     `json:"studentId"`
	StudentName  string     `json:"studentName,omitempty"`
	Status       string     `json:"status"`
	Grade        *float64   `json:"grade"`
	Feedback     string     `json:"feedback"`
	SubmittedAt  *time.Time `json:"submittedAt"`
	GradedAt     *time.Time `json:"gradedAt"`
	GradedBy     *string    `json:"gradedBy"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

type UpdateSubmissionRequest struct {
	Status   string   `json:"status"`
	Grade    *float64 `json:"grade"`
	Feedback string   `json:"feedback"`
}

type AssignmentService struct {
	db *db.DB
}

func NewAssignmentService(database *db.DB) *AssignmentService {
	return &AssignmentService{db: database}
}

func (s *AssignmentService) ListByBranch(ctx context.Context, branchID, classID string) ([]Assignment, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	query := `
		SELECT a.id, a.branch_id, a.class_id, COALESCE(c.name,'') AS class_name, a.teacher_id,
		       a.subject, a.title, a.description, a.due_date::text, a.created_by,
		       COUNT(s.id) AS total_students,
		       COUNT(sub.id) FILTER (WHERE sub.status IN ('submitted','late')) AS submitted_count,
		       a.created_at, a.updated_at
		FROM assignments a
		LEFT JOIN classes c ON c.id = a.class_id
		LEFT JOIN students s ON s.class_id = a.class_id AND s.status = 'active'
		LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id
		WHERE a.branch_id = $1`
	args := []interface{}{branchID}
	if classID != "" {
		args = append(args, classID)
		query += fmt.Sprintf(" AND a.class_id = $%d", len(args))
	}
	query += " GROUP BY a.id, c.name ORDER BY a.due_date DESC"
	rows, err := s.db.Conn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Assignment
	for rows.Next() {
		var a Assignment
		if err := rows.Scan(&a.ID, &a.BranchID, &a.ClassID, &a.ClassName, &a.TeacherID,
			&a.Subject, &a.Title, &a.Description, &a.DueDate, &a.CreatedBy,
			&a.TotalStudents, &a.SubmittedCount, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	if list == nil {
		list = []Assignment{}
	}
	return list, rows.Err()
}

func (s *AssignmentService) Create(ctx context.Context, req *CreateAssignmentRequest, createdByID string) (*Assignment, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	id := uuid.New().String()
	now := time.Now()
	var a Assignment
	err := s.db.Conn().QueryRowContext(ctx, `
		INSERT INTO assignments (id, branch_id, class_id, teacher_id, subject, title, description, due_date, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$10)
		RETURNING id, branch_id, class_id, teacher_id, subject, title, description, due_date::text, created_by, created_at, updated_at
	`, id, req.BranchID, req.ClassID, req.TeacherID, req.Subject, req.Title, req.Description, req.DueDate, createdByID, now,
	).Scan(&a.ID, &a.BranchID, &a.ClassID, &a.TeacherID, &a.Subject, &a.Title,
		&a.Description, &a.DueDate, &a.CreatedBy, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	_, err = s.db.Conn().ExecContext(ctx, `
		INSERT INTO assignment_submissions (id, assignment_id, student_id)
		SELECT gen_random_uuid(), $1, s.id
		FROM students s WHERE s.class_id=$2 AND s.status='active'
		ON CONFLICT DO NOTHING
	`, id, req.ClassID)
	if err != nil {
		return nil, fmt.Errorf("create submissions: %w", err)
	}
	return &a, nil
}

func (s *AssignmentService) Delete(ctx context.Context, id, branchID string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	res, err := s.db.Conn().ExecContext(ctx, `DELETE FROM assignments WHERE id=$1 AND branch_id=$2`, id, branchID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("assignment not found")
	}
	return nil
}

func (s *AssignmentService) GetSubmissions(ctx context.Context, assignmentID string) ([]AssignmentSubmission, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT sub.id, sub.assignment_id, sub.student_id, s.full_name,
		       sub.status, sub.grade, sub.feedback, sub.submitted_at, sub.graded_at, sub.graded_by,
		       sub.created_at, sub.updated_at
		FROM assignment_submissions sub
		JOIN students s ON s.id = sub.student_id
		WHERE sub.assignment_id=$1 ORDER BY s.full_name
	`, assignmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var subs []AssignmentSubmission
	for rows.Next() {
		var sub AssignmentSubmission
		if err := rows.Scan(&sub.ID, &sub.AssignmentID, &sub.StudentID, &sub.StudentName,
			&sub.Status, &sub.Grade, &sub.Feedback, &sub.SubmittedAt, &sub.GradedAt, &sub.GradedBy,
			&sub.CreatedAt, &sub.UpdatedAt); err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	if subs == nil {
		subs = []AssignmentSubmission{}
	}
	return subs, rows.Err()
}

func (s *AssignmentService) UpdateSubmission(ctx context.Context, subID string, req *UpdateSubmissionRequest, gradedByID string) (*AssignmentSubmission, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	now := time.Now()
	var gradedAt *time.Time
	if req.Grade != nil {
		gradedAt = &now
	}
	var submittedAt *time.Time
	if req.Status == "submitted" || req.Status == "late" {
		submittedAt = &now
	}
	var sub AssignmentSubmission
	err := s.db.Conn().QueryRowContext(ctx, `
		UPDATE assignment_submissions SET
			status=$1, grade=$2, feedback=$3,
			submitted_at=COALESCE(submitted_at,$4),
			graded_at=$5, graded_by=$6, updated_at=$7
		WHERE id=$8
		RETURNING id, assignment_id, student_id, status, grade, feedback, submitted_at, graded_at, graded_by, created_at, updated_at
	`, req.Status, req.Grade, req.Feedback, submittedAt, gradedAt, gradedByID, now, subID,
	).Scan(&sub.ID, &sub.AssignmentID, &sub.StudentID,
		&sub.Status, &sub.Grade, &sub.Feedback,
		&sub.SubmittedAt, &sub.GradedAt, &sub.GradedBy,
		&sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func (s *AssignmentService) GetStudentProgress(ctx context.Context, studentID, branchID string) ([]AssignmentSubmission, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT sub.id, sub.assignment_id, sub.student_id, ''::text AS student_name,
		       sub.status, sub.grade, sub.feedback, sub.submitted_at, sub.graded_at, sub.graded_by,
		       sub.created_at, sub.updated_at
		FROM assignment_submissions sub
		JOIN assignments a ON a.id = sub.assignment_id
		WHERE sub.student_id=$1 AND a.branch_id=$2
		ORDER BY a.due_date DESC
	`, studentID, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var subs []AssignmentSubmission
	for rows.Next() {
		var sub AssignmentSubmission
		if err := rows.Scan(&sub.ID, &sub.AssignmentID, &sub.StudentID, &sub.StudentName,
			&sub.Status, &sub.Grade, &sub.Feedback, &sub.SubmittedAt, &sub.GradedAt, &sub.GradedBy,
			&sub.CreatedAt, &sub.UpdatedAt); err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	if subs == nil {
		subs = []AssignmentSubmission{}
	}
	return subs, rows.Err()
}

// ── StudentNote + ContactLog ───────────────────────────────────────────────────

type StudentNote struct {
	ID            string    `json:"id"`
	BranchID      string    `json:"branchId"`
	StudentID     string    `json:"studentId"`
	Content       string    `json:"content"`
	CreatedBy     *string   `json:"createdBy"`
	CreatedByName string    `json:"createdByName"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type ContactLogEntry struct {
	ID            string    `json:"id"`
	BranchID      string    `json:"branchId"`
	StudentID     string    `json:"studentId"`
	ContactType   string    `json:"contactType"`
	Outcome       string    `json:"outcome"`
	Note          string    `json:"note"`
	ContactedAt   time.Time `json:"contactedAt"`
	CreatedBy     *string   `json:"createdBy"`
	CreatedByName string    `json:"createdByName"`
	CreatedAt     time.Time `json:"createdAt"`
}

type CreateContactLogRequest struct {
	ContactType string `json:"contactType"`
	Outcome     string `json:"outcome"`
	Note        string `json:"note"`
	ContactedAt string `json:"contactedAt"`
}

type StudentNotesService struct {
	db *db.DB
}

func NewStudentNotesService(database *db.DB) *StudentNotesService {
	return &StudentNotesService{db: database}
}

func (s *StudentNotesService) ListNotes(ctx context.Context, branchID, studentID string) ([]StudentNote, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT id, branch_id, student_id, content, created_by, created_by_name, created_at, updated_at
		FROM student_notes WHERE branch_id=$1 AND student_id=$2 ORDER BY created_at DESC
	`, branchID, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var notes []StudentNote
	for rows.Next() {
		var n StudentNote
		if err := rows.Scan(&n.ID, &n.BranchID, &n.StudentID, &n.Content,
			&n.CreatedBy, &n.CreatedByName, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	if notes == nil {
		notes = []StudentNote{}
	}
	return notes, rows.Err()
}

func (s *StudentNotesService) AddNote(ctx context.Context, branchID, studentID, content, createdByID, createdByName string) (*StudentNote, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	var note StudentNote
	err := s.db.Conn().QueryRowContext(ctx, `
		INSERT INTO student_notes (branch_id, student_id, content, created_by, created_by_name)
		VALUES ($1,$2,$3,$4,$5)
		RETURNING id, branch_id, student_id, content, created_by, created_by_name, created_at, updated_at
	`, branchID, studentID, content, createdByID, createdByName).Scan(
		&note.ID, &note.BranchID, &note.StudentID, &note.Content,
		&note.CreatedBy, &note.CreatedByName, &note.CreatedAt, &note.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("add note: %w", err)
	}
	return &note, nil
}

func (s *StudentNotesService) DeleteNote(ctx context.Context, branchID, noteID string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	res, err := s.db.Conn().ExecContext(ctx, `DELETE FROM student_notes WHERE id=$1 AND branch_id=$2`, noteID, branchID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("note not found")
	}
	return nil
}

func (s *StudentNotesService) ListContactLog(ctx context.Context, branchID, studentID string) ([]ContactLogEntry, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	rows, err := s.db.Conn().QueryContext(ctx, `
		SELECT id, branch_id, student_id, contact_type, outcome, note,
		       contacted_at, created_by, created_by_name, created_at
		FROM contact_log WHERE branch_id=$1 AND student_id=$2 ORDER BY contacted_at DESC
	`, branchID, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var entries []ContactLogEntry
	for rows.Next() {
		var e ContactLogEntry
		if err := rows.Scan(&e.ID, &e.BranchID, &e.StudentID, &e.ContactType, &e.Outcome,
			&e.Note, &e.ContactedAt, &e.CreatedBy, &e.CreatedByName, &e.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []ContactLogEntry{}
	}
	return entries, rows.Err()
}

func (s *StudentNotesService) AddContactLog(ctx context.Context, branchID, studentID string, req *CreateContactLogRequest, createdByID, createdByName string) (*ContactLogEntry, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	contactType := req.ContactType
	if contactType == "" {
		contactType = "call"
	}
	outcome := req.Outcome
	if outcome == "" {
		outcome = "no_answer"
	}
	contactedAt := time.Now()
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04", "2006-01-02"} {
		if t, err := time.Parse(layout, req.ContactedAt); err == nil && req.ContactedAt != "" {
			contactedAt = t
			break
		}
	}
	var entry ContactLogEntry
	err := s.db.Conn().QueryRowContext(ctx, `
		INSERT INTO contact_log (branch_id, student_id, contact_type, outcome, note, contacted_at, created_by, created_by_name)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING id, branch_id, student_id, contact_type, outcome, note, contacted_at, created_by, created_by_name, created_at
	`, branchID, studentID, contactType, outcome, req.Note, contactedAt, createdByID, createdByName).Scan(
		&entry.ID, &entry.BranchID, &entry.StudentID, &entry.ContactType, &entry.Outcome,
		&entry.Note, &entry.ContactedAt, &entry.CreatedBy, &entry.CreatedByName, &entry.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("add contact log: %w", err)
	}
	return &entry, nil
}

func (s *StudentNotesService) DeleteContactLog(ctx context.Context, branchID, entryID string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	res, err := s.db.Conn().ExecContext(ctx, `DELETE FROM contact_log WHERE id=$1 AND branch_id=$2`, entryID, branchID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("contact log entry not found")
	}
	return nil
}
