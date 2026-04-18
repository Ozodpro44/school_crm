package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/cache"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/utils"
)

type StudentService struct {
	db     *db.Database
	subSvc *SubscriptionService
	cache  *cache.Client
}

func NewStudentService(database *db.Database, subSvc *SubscriptionService) *StudentService {
	return &StudentService{db: database, subSvc: subSvc}
}

// SetCache wires in the optional Redis cache client.
func (s *StudentService) SetCache(c *cache.Client) { s.cache = c }

const studentCacheTTL = 60 * time.Second

type CreateStudentRequest struct {
	FullName       string     `json:"fullName" binding:"required"`
	ClassID        *string    `json:"classId"`
	Phone          *string    `json:"phone"`
	ParentPhone    *string    `json:"parentPhone"`
	MonthlyPayment float64    `json:"monthlyPayment" binding:"required,gt=0"`
	Status         string     `json:"status" binding:"required"`
	BranchID       string     `json:"branchId" binding:"required"`
	EnrollmentDate *time.Time `json:"enrollmentDate"`
}

// StudentFilterInput replaces the long parameter list of GetByBranchIDWithFilters.
type StudentFilterInput struct {
	BranchID      string
	Page          string
	Limit         string
	// Cursor is the full_name of the last item from the previous page (keyset pagination).
	// When set, Page/offset is ignored and results start after this cursor value.
	Cursor        string
	Search        string
	Status        string
	ClassID       string
	PaymentStatus string
	Month         string
	Year          string
}

func (s *StudentService) Create(ctx context.Context, req *CreateStudentRequest) (*models.Student, error) {
	// Guard: subscription student limit.
	if s.subSvc != nil && req.BranchID != "" {
		ownerID, err := s.subSvc.GetOwnerIDFromBranch(ctx, req.BranchID)
		if err == nil && ownerID != "" {
			if limitErr := s.subSvc.CheckResourceLimit(ctx, ownerID, "students"); limitErr != nil {
				return nil, limitErr
			}
		}
	}

	var classID *string
	if req.ClassID != nil && *req.ClassID != "" {
		classID = req.ClassID
	}

	var phone, parentPhone string
	if req.Phone != nil {
		phone = *req.Phone
	}
	if req.ParentPhone != nil {
		parentPhone = *req.ParentPhone
	}

	student := &models.Student{
		ID:             uuid.New().String(),
		FullName:       req.FullName,
		ClassID:        "",
		Phone:          phone,
		ParentPhone:    parentPhone,
		MonthlyPayment: req.MonthlyPayment,
		Status:         models.StudentStatus(req.Status),
		BranchID:       req.BranchID,
		EnrollmentDate: req.EnrollmentDate,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}

	if classID != nil {
		student.ClassID = *classID
	}

	query := `INSERT INTO students (id, full_name, class_id, phone, parent_phone, monthly_payment, status, branch_id, enrollment_date, created_at, updated_at)
	         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`

	_, err := s.db.GetConn().ExecContext(ctx, query, student.ID, student.FullName, classID, phone, parentPhone,
		student.MonthlyPayment, student.Status, student.BranchID, student.EnrollmentDate, student.CreatedAt, student.UpdatedAt)
	if err == nil && s.cache != nil {
		_ = s.cache.DeleteByPrefix(ctx, fmt.Sprintf("crm:students:%s:", req.BranchID))
	}

	return student, err
}

func (s *StudentService) GetByID(ctx context.Context, id string) (*models.Student, error) {
	student := &models.Student{}
	query := `SELECT id, full_name, class_id, phone, parent_phone, monthly_payment, status, branch_id, enrollment_date, left_date, class_signed_date, class_confirmed, created_at, updated_at
	         FROM students WHERE id = $1`

	var classID *string // Handle NULL class_id
	err := s.db.GetConn().QueryRowContext(ctx, query, id).Scan(
		&student.ID, &student.FullName, &classID, &student.Phone, &student.ParentPhone, &student.MonthlyPayment,
		&student.Status, &student.BranchID, &student.EnrollmentDate, &student.LeftDate, &student.ClassSignedDate, &student.ClassConfirmed, &student.CreatedAt, &student.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("student not found")
	}
	if err != nil {
		return nil, err
	}

	if classID != nil {
		student.ClassID = *classID
	}
	return student, nil
}

func (s *StudentService) GetByBranchID(ctx context.Context, branchID string, page, limit int) ([]models.Student, int64, error) {
	// Get total count first
	var total int64
	countQuery := `SELECT COUNT(*) FROM students WHERE branch_id = $1`
	err := s.db.GetConn().QueryRowContext(ctx, countQuery, branchID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get paginated data
	query := `SELECT id, full_name, class_id, phone, parent_phone, monthly_payment, status, branch_id, enrollment_date, left_date, class_signed_date, class_confirmed, created_at, updated_at
	         FROM students WHERE branch_id = $1 ORDER BY full_name
	         LIMIT $2 OFFSET $3`

	offset := (page - 1) * limit
	rows, err := s.db.GetConn().QueryContext(ctx, query, branchID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var students []models.Student
	for rows.Next() {
		var student models.Student
		var classID *string // Handle NULL class_id
		if err := rows.Scan(&student.ID, &student.FullName, &classID, &student.Phone, &student.ParentPhone, &student.MonthlyPayment,
			&student.Status, &student.BranchID, &student.EnrollmentDate, &student.LeftDate, &student.ClassSignedDate, &student.ClassConfirmed, &student.CreatedAt, &student.UpdatedAt); err != nil {
			return nil, 0, err
		}
		if classID != nil {
			student.ClassID = *classID
		}
		students = append(students, student)
	}

	return students, total, rows.Err()
}

func (s *StudentService) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.Student, error) {
	updates = utils.ConvertKeysToSnakeCase(updates)
	query := `UPDATE students SET `
	args := []interface{}{}
	argCount := 1

	for key, value := range updates {
		if argCount > 1 {
			query += ", "
		}
		query += key + " = $" + strconv.Itoa(argCount)
		args = append(args, value)
		argCount++
	}

	query += " WHERE id = $" + strconv.Itoa(argCount)
	args = append(args, id)

	_, err := s.db.GetConn().ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	updated, err := s.GetByID(ctx, id)
	if err == nil && s.cache != nil {
		_ = s.cache.DeleteByPrefix(ctx, fmt.Sprintf("crm:students:%s:", updated.BranchID))
	}
	return updated, err
}

func (s *StudentService) Delete(ctx context.Context, id string) error {
	var branchID string
	_ = s.db.GetConn().QueryRowContext(ctx, `SELECT branch_id FROM students WHERE id = $1`, id).Scan(&branchID)

	query := `DELETE FROM students WHERE id = $1`
	_, err := s.db.GetConn().ExecContext(ctx, query, id)
	if err == nil && s.cache != nil && branchID != "" {
		_ = s.cache.DeleteByPrefix(ctx, fmt.Sprintf("crm:students:%s:", branchID))
	}
	return err
}

func (s *StudentService) GetByBranchIDWithFilters(ctx context.Context, in StudentFilterInput) (*models.StudentListResponse, error) {
	// Cache read-through
	if s.cache != nil {
		cacheKey := fmt.Sprintf("crm:students:%s:%s:%s:%s:%s:%s:%s:%s:%s",
			in.BranchID, in.Page, in.Limit, in.Search, in.Status, in.ClassID, in.PaymentStatus, in.Month, in.Year)
		var cached models.StudentListResponse
		if hit, _ := s.cache.Get(ctx, cacheKey, &cached); hit {
			return &cached, nil
		}
		result, err := s.getByBranchIDWithFiltersDB(ctx, in)
		if err == nil && result != nil {
			_ = s.cache.Set(ctx, cacheKey, result, studentCacheTTL)
		}
		return result, err
	}
	return s.getByBranchIDWithFiltersDB(ctx, in)
}

func (s *StudentService) getByBranchIDWithFiltersDB(ctx context.Context, in StudentFilterInput) (*models.StudentListResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	intPage, err := strconv.Atoi(in.Page)
	if err != nil || intPage < 1 {
		intPage = 1
	}

	intLimit, err := strconv.Atoi(in.Limit)
	if err != nil || intLimit < 1 {
		intLimit = 10
	}

	// Cursor pagination: when a cursor is supplied, ignore page/offset entirely.
	// Cursor = full_name of the last item on the previous page (ordered ASC).
	useCursor := in.Cursor != ""
	offset := (intPage - 1) * intLimit

	currentTime := time.Now()
	currentMonth := currentTime.Format("01")
	currentYear := currentTime.Year()

	if in.Month != "" {
		currentMonth = in.Month
	}
	if in.Year != "" {
		if parsedYear, parseErr := strconv.Atoi(in.Year); parseErr == nil {
			currentYear = parsedYear
		}
	}

	branchID := in.BranchID
	search := in.Search
	status := in.Status
	classID := in.ClassID
	paymentStatus := in.PaymentStatus

	// -------------------------
	// dynamic filters
	// -------------------------
	where := `WHERE s.branch_id = $1`
	args := []interface{}{branchID}
	argID := 2

	if search != "" {
		where += fmt.Sprintf(
			" AND (LOWER(s.full_name) LIKE LOWER($%d) OR s.phone LIKE $%d)",
			argID, argID,
		)
		args = append(args, "%"+search+"%")
		argID++
	}

	// Cursor: return only students whose full_name > cursor (keyset)
	if useCursor {
		where += fmt.Sprintf(" AND s.full_name > $%d", argID)
		args = append(args, in.Cursor)
		argID++
	}

	if status != "" {
		where += fmt.Sprintf(" AND s.status = $%d", argID)
		args = append(args, status)
		argID++
	}

	if classID != "" {
		where += fmt.Sprintf(" AND s.class_id = $%d", argID)
		args = append(args, classID)
		argID++
	}

	if paymentStatus != "" {
		where += fmt.Sprintf(" AND COALESCE(p.status, 'unpaid') = $%d", argID)
		args = append(args, paymentStatus)
		argID++
	}

	// -------------------------
	// count query
	// -------------------------
	countQuery := `
		SELECT COUNT(*)
		FROM students s
		LEFT JOIN classes c ON c.id = s.class_id
		LEFT JOIN LATERAL (
			SELECT 
				COALESCE(SUM(amount), 0) AS total_amount,
				CASE 
					WHEN COALESCE(SUM(amount), 0) >= s.monthly_payment THEN 'paid'
					WHEN COALESCE(SUM(amount), 0) > 0 THEN 'partial'
					ELSE 'unpaid'
				END AS status
			FROM payments
			WHERE student_id = s.id
			AND month = $` + strconv.Itoa(argID) + `
			AND year = $` + strconv.Itoa(argID+1) + `
			AND status IN ('paid', 'partial')
		) p ON true
		` + where

	argsCount := make([]interface{}, len(args))
	copy(argsCount, args)
	argsCount = append(argsCount, currentMonth, currentYear)

	var total int
	if err := s.db.GetConn().QueryRowContext(ctx, countQuery, argsCount...).Scan(&total); err != nil {
		return nil, err
	}

	// -------------------------
	// main query
	// -------------------------
	query := `
		SELECT
			s.id,
			s.full_name,
			s.phone,
			s.parent_phone,
			s.monthly_payment,
			s.status,
			s.branch_id,
			s.created_at,
			s.updated_at,

			c.id   AS class_id,
			c.name AS class_name,

			COALESCE(p.status, 'unpaid') AS payment_status,
			COALESCE(p.total_amount, 0)  AS payment_amount
		FROM students s
		LEFT JOIN classes c ON c.id = s.class_id
		LEFT JOIN LATERAL (
			SELECT 
				COALESCE(SUM(amount), 0) AS total_amount,
				CASE 
					WHEN COALESCE(SUM(amount), 0) >= s.monthly_payment THEN 'paid'
					WHEN COALESCE(SUM(amount), 0) > 0 THEN 'partial'
					ELSE 'unpaid'
				END AS status
			FROM payments
			WHERE student_id = s.id
			AND month = $` + strconv.Itoa(argID) + `
			AND year = $` + strconv.Itoa(argID+1) + `
			AND status IN ('paid', 'partial')
		) p ON true
		` + where + `
		ORDER BY s.full_name ASC
		LIMIT $` + strconv.Itoa(argID+2) + func() string {
		if useCursor {
			return ""
		}
		return ` OFFSET $` + strconv.Itoa(argID+3)
	}()

	if useCursor {
		args = append(args, currentMonth, currentYear, intLimit)
	} else {
		args = append(args, currentMonth, currentYear, intLimit, offset)
	}

	// -------------------------
	// scan
	// -------------------------
	rows, err := s.db.GetConn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	students := make([]models.StudentList, 0)

	for rows.Next() {
		var sItem models.StudentList

		var classID, className sql.NullString
		var paymentStatus string
		var paymentAmount float64

		err := rows.Scan(
			&sItem.ID,
			&sItem.FullName,
			&sItem.Phone,
			&sItem.ParentPhone,
			&sItem.MonthlyPayment,
			&sItem.Status,
			&sItem.BranchID,
			&sItem.CreatedAt,
			&sItem.UpdatedAt,

			&classID,
			&className,

			&paymentStatus,
			&paymentAmount,
		)
		if err != nil {
			return nil, err
		}

		if classID.Valid {
			sItem.Class = models.ClassStudent{
				ID:   classID.String,
				Name: className.String,
			}
		} else {
			sItem.Class = models.ClassStudent{
				ID:   "",
				Name: "",
			}
		}

		sItem.Payment = models.PaymentStudent{
			Status: models.PaymentStatus(paymentStatus),
			Amount: paymentAmount,
		}

		students = append(students, sItem)
	}

	// Fetch all classes for this branch (not just ones with students).
	// This ensures empty/new classes appear in the add-student modal and filter.
	classQuery := `
		SELECT id, name
		FROM classes
		WHERE branch_id = $1
		ORDER BY name ASC
	`
	classRows, err := s.db.GetConn().QueryContext(ctx, classQuery, branchID)
	if err != nil {
		return nil, err
	}
	defer classRows.Close()

	classes := make([]models.ClassStudent, 0)
	for classRows.Next() {
		var classItem models.ClassStudent
		if err := classRows.Scan(&classItem.ID, &classItem.Name); err != nil {
			return nil, err
		}
		classes = append(classes, classItem)
	}

	// Build next cursor from the last item's full_name (keyset pagination)
	var nextCursor string
	if len(students) == intLimit {
		nextCursor = students[len(students)-1].FullName
	}

	return &models.StudentListResponse{
		Items:      students,
		Classes:    classes,
		Total:      total,
		Page:       intPage,
		Limit:      intLimit,
		NextCursor: nextCursor,
	}, nil
}

// SearchByBranchID searches active students by name or phone
func (s *StudentService) SearchByBranchID(ctx context.Context, branchID string, search string) ([]models.Student, error) {
	query := `
		SELECT id, full_name, phone, parent_phone, class_id, monthly_payment, status, branch_id, enrollment_date, created_at, updated_at
		FROM students
		WHERE branch_id = $1 AND status = 'active'
	`
	args := []interface{}{branchID}

	// Add search filter if provided
	if search != "" {
		query += ` AND (LOWER(full_name) LIKE LOWER($2) OR phone LIKE $2)`
		args = append(args, "%"+search+"%")
	}

	query += ` ORDER BY full_name ASC LIMIT 100`

	rows, err := s.db.GetConn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var students []models.Student
	for rows.Next() {
		var s models.Student
		if err := rows.Scan(
			&s.ID, &s.FullName, &s.Phone, &s.ParentPhone, &s.ClassID, &s.MonthlyPayment,
			&s.Status, &s.BranchID, &s.EnrollmentDate, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, err
		}
		students = append(students, s)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return students, nil
}
