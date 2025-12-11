package service

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/utils"
)

type TeacherService struct {
	db *db.Database
}

func NewTeacherService(database *db.Database) *TeacherService {
	return &TeacherService{db: database}
}

type CreateTeacherRequest struct {
	FullName      string   `json:"fullName" binding:"required"`
	Subjects      []string `json:"subjects" binding:"required"`
	MonthlySalary float64  `json:"monthlySalary" binding:"required,gt=0"`
	Phone         string   `json:"phone" binding:"required"`
	Email         string   `json:"email" binding:"required,email"`
	BranchID      string   `json:"branchId" binding:"required"`
	JoinedDate    *time.Time `json:"joinedDate"`
}

func (s *TeacherService) Create(ctx context.Context, req *CreateTeacherRequest) (*models.Teacher, error) {
	teacher := &models.Teacher{
		ID:            uuid.New().String(),
		FullName:      req.FullName,
		Subjects:      req.Subjects,
		MonthlySalary: req.MonthlySalary,
		Phone:         req.Phone,
		Email:         req.Email,
		BranchID:      req.BranchID,
		JoinedDate:    req.JoinedDate,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	query := `INSERT INTO teachers (id, full_name, subjects, monthly_salary, phone, email, branch_id, joined_date, created_at, updated_at)
	         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

	_, err := s.db.GetConn().ExecContext(ctx, query, teacher.ID, teacher.FullName, pq.Array(teacher.Subjects), teacher.MonthlySalary,
		teacher.Phone, teacher.Email, teacher.BranchID, teacher.JoinedDate, teacher.CreatedAt, teacher.UpdatedAt)

	return teacher, err
}

func (s *TeacherService) GetByID(ctx context.Context, id string) (*models.Teacher, error) {
	teacher := &models.Teacher{}

	query := `SELECT id, full_name, subjects, monthly_salary, phone, email, branch_id, joined_date, created_at, updated_at FROM teachers WHERE id = $1`

	err := s.db.GetConn().QueryRowContext(ctx, query, id).Scan(
		&teacher.ID, &teacher.FullName, pq.Array(&teacher.Subjects), &teacher.MonthlySalary, &teacher.Phone, &teacher.Email, &teacher.BranchID, &teacher.JoinedDate, &teacher.CreatedAt, &teacher.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("teacher not found")
	}
	if err != nil {
		return nil, err
	}

	return teacher, nil
}

func (s *TeacherService) GetByBranchID(ctx context.Context, branchID string) ([]models.Teacher, error) {
	query := `SELECT id, full_name, subjects, monthly_salary, phone, email, branch_id, joined_date, created_at, updated_at FROM teachers WHERE branch_id = $1 ORDER BY full_name`

	rows, err := s.db.GetConn().QueryContext(ctx, query, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teachers []models.Teacher
	for rows.Next() {
		var teacher models.Teacher
		if err := rows.Scan(&teacher.ID, &teacher.FullName, pq.Array(&teacher.Subjects), &teacher.MonthlySalary, &teacher.Phone, &teacher.Email, &teacher.BranchID, &teacher.JoinedDate, &teacher.CreatedAt, &teacher.UpdatedAt); err != nil {
			return nil, err
		}
		teachers = append(teachers, teacher)
	}

	return teachers, rows.Err()
}

func (s *TeacherService) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.Teacher, error) {
	updates = utils.ConvertKeysToSnakeCase(updates)
	query := `UPDATE teachers SET `
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

func (s *TeacherService) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM teachers WHERE id = $1`
	_, err := s.db.GetConn().ExecContext(ctx, query, id)
	return err
}
