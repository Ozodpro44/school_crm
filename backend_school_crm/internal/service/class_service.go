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

type ClassService struct {
	db *db.Database
}

func NewClassService(database *db.Database) *ClassService {
	return &ClassService{db: database}
}

type CreateClassRequest struct {
	Name      string  `json:"name" binding:"required"`
	TeacherID *string `json:"teacherId"`
	BranchID  string  `json:"branchId" binding:"required"`
}

func (s *ClassService) Create(ctx context.Context, req *CreateClassRequest) (*models.Class, error) {
	class := &models.Class{
		ID:        uuid.New().String(),
		Name:      req.Name,
		TeacherID: req.TeacherID,
		BranchID:  req.BranchID,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}

	query := `INSERT INTO classes (id, name, teacher_id, branch_id, created_at, updated_at)
	         VALUES ($1, $2, $3, $4, $5, $6)`

	_, err := s.db.GetConn().ExecContext(ctx, query, class.ID, class.Name, class.TeacherID, class.BranchID, class.CreatedAt, class.UpdatedAt)

	return class, err
}

func (s *ClassService) GetByID(ctx context.Context, id string) (*models.Class, error) {
	class := &models.Class{}
	query := `SELECT id, name, teacher_id, branch_id, created_at, updated_at FROM classes WHERE id = $1`

	err := s.db.GetConn().QueryRowContext(ctx, query, id).Scan(
		&class.ID, &class.Name, &class.TeacherID, &class.BranchID, &class.CreatedAt, &class.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("class not found")
	}
	if err != nil {
		return nil, err
	}

	// Load student IDs for this class
	s.loadStudentIDs(ctx, class)

	return class, nil
}

func (s *ClassService) GetByBranchID(ctx context.Context, branchID string) ([]models.Class, error) {
	query := `SELECT id, name, teacher_id, branch_id, created_at, updated_at FROM classes WHERE branch_id = $1 ORDER BY name`

	rows, err := s.db.GetConn().QueryContext(ctx, query, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var classes []models.Class
	for rows.Next() {
		var class models.Class
		if err := rows.Scan(&class.ID, &class.Name, &class.TeacherID, &class.BranchID, &class.CreatedAt, &class.UpdatedAt); err != nil {
			return nil, err
		}
		// Load student IDs for each class
		s.loadStudentIDs(ctx, &class)
		classes = append(classes, class)
	}

	return classes, rows.Err()
}

func (s *ClassService) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.Class, error) {
	updates = utils.ConvertKeysToSnakeCase(updates)
	query := `UPDATE classes SET `
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

func (s *ClassService) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM classes WHERE id = $1`
	_, err := s.db.GetConn().ExecContext(ctx, query, id)
	return err
}

// loadStudentIDs loads all student IDs for a given class
func (s *ClassService) loadStudentIDs(ctx context.Context, class *models.Class) error {
	query := `SELECT id FROM students WHERE class_id = $1 AND status = $2`
	rows, err := s.db.GetConn().QueryContext(ctx, query, class.ID, "active")
	if err != nil {
		return err
	}
	defer rows.Close()

	var studentIDs []string
	for rows.Next() {
		var studentID string
		if err := rows.Scan(&studentID); err != nil {
			return err
		}
		studentIDs = append(studentIDs, studentID)
	}

	class.StudentID = studentIDs
	return rows.Err()
}
