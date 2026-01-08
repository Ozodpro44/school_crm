package service

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/utils"
)

type StudentService struct {
	db *db.Database
}

func NewStudentService(database *db.Database) *StudentService {
	return &StudentService{db: database}
}

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

func (s *StudentService) Create(ctx context.Context, req *CreateStudentRequest) (*models.Student, error) {
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

func (s *StudentService) GetByBranchID(ctx context.Context, branchID string) ([]models.Student, error) {
	query := `SELECT id, full_name, class_id, phone, parent_phone, monthly_payment, status, branch_id, enrollment_date, left_date, class_signed_date, class_confirmed, created_at, updated_at
	         FROM students WHERE branch_id = $1 ORDER BY full_name`

	rows, err := s.db.GetConn().QueryContext(ctx, query, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var students []models.Student
	for rows.Next() {
		var student models.Student
		var classID *string // Handle NULL class_id
		if err := rows.Scan(&student.ID, &student.FullName, &classID, &student.Phone, &student.ParentPhone, &student.MonthlyPayment,
			&student.Status, &student.BranchID, &student.EnrollmentDate, &student.LeftDate, &student.ClassSignedDate, &student.ClassConfirmed, &student.CreatedAt, &student.UpdatedAt); err != nil {
			return nil, err
		}
		if classID != nil {
			student.ClassID = *classID
		}
		students = append(students, student)
	}

	return students, rows.Err()
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

	return s.GetByID(ctx, id)
}

func (s *StudentService) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM students WHERE id = $1`
	_, err := s.db.GetConn().ExecContext(ctx, query, id)
	return err
}
