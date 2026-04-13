package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/school-crm/backend/internal/cache"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/utils"
)

type TeacherService struct {
	db    *db.Database
	cache *cache.Client
}

func NewTeacherService(database *db.Database) *TeacherService {
	return &TeacherService{db: database}
}

// SetCache wires in the optional Redis cache client.
func (s *TeacherService) SetCache(c *cache.Client) { s.cache = c }

const teacherCacheTTL = 2 * time.Minute

type CreateTeacherRequest struct {
	FullName      string     `json:"fullName" binding:"required"`
	Subjects      []string   `json:"subjects"`
	MonthlySalary float64    `json:"monthlySalary" binding:"required,gt=0"`
	Phone         string     `json:"phone" binding:"required"`
	Email         string     `json:"email" binding:"required,email"`
	BranchID      string     `json:"branchId" binding:"required"`
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
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}

	query := `INSERT INTO teachers (id, full_name, monthly_salary, phone, email, branch_id, joined_date, created_at, updated_at)
	         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	_, err := s.db.GetConn().ExecContext(ctx, query,
		teacher.ID, teacher.FullName, teacher.MonthlySalary,
		teacher.Phone, teacher.Email, teacher.BranchID,
		teacher.JoinedDate, teacher.CreatedAt, teacher.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Insert subjects into teacher_subjects
	if err := s.replaceSubjects(ctx, teacher.ID, req.Subjects); err != nil {
		return nil, err
	}

	if s.cache != nil {
		_ = s.cache.Delete(ctx, fmt.Sprintf("crm:teachers:%s", teacher.BranchID))
	}
	return teacher, nil
}

func (s *TeacherService) GetByID(ctx context.Context, id string) (*models.Teacher, error) {
	teacher := &models.Teacher{}

	query := `SELECT id, full_name, monthly_salary, phone, email, user_id, branch_id, joined_date, created_at, updated_at
	          FROM teachers WHERE id = $1`

	err := s.db.GetConn().QueryRowContext(ctx, query, id).Scan(
		&teacher.ID, &teacher.FullName, &teacher.MonthlySalary,
		&teacher.Phone, &teacher.Email, &teacher.UserID, &teacher.BranchID,
		&teacher.JoinedDate, &teacher.CreatedAt, &teacher.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("teacher not found")
	}
	if err != nil {
		return nil, err
	}

	teacher.Subjects, err = s.getSubjects(ctx, id)
	if err != nil {
		return nil, err
	}

	teacher.AssignedClasses, err = s.getTeacherClasses(ctx, id)
	if err != nil {
		return nil, err
	}

	return teacher, nil
}

func (s *TeacherService) GetByBranchID(ctx context.Context, branchID string) ([]models.Teacher, error) {
	if s.cache != nil {
		cacheKey := fmt.Sprintf("crm:teachers:%s", branchID)
		var cached []models.Teacher
		if hit, _ := s.cache.Get(ctx, cacheKey, &cached); hit {
			return cached, nil
		}
		result, err := s.getByBranchIDDB(ctx, branchID)
		if err == nil {
			_ = s.cache.Set(ctx, cacheKey, result, teacherCacheTTL)
		}
		return result, err
	}
	return s.getByBranchIDDB(ctx, branchID)
}

func (s *TeacherService) GetByUserID(ctx context.Context, userID string) (*models.Teacher, error) {
	teacher := &models.Teacher{}
	err := s.db.GetConn().QueryRowContext(ctx,
		`SELECT id, full_name, monthly_salary, phone, email, user_id, branch_id, joined_date, created_at, updated_at
		 FROM teachers WHERE user_id = $1 LIMIT 1`, userID,
	).Scan(
		&teacher.ID, &teacher.FullName, &teacher.MonthlySalary,
		&teacher.Phone, &teacher.Email, &teacher.UserID, &teacher.BranchID,
		&teacher.JoinedDate, &teacher.CreatedAt, &teacher.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return teacher, nil
}

func (s *TeacherService) getByBranchIDDB(ctx context.Context, branchID string) ([]models.Teacher, error) {
	// Fetch all teachers in one query
	rows, err := s.db.GetConn().QueryContext(ctx,
		`SELECT id, full_name, monthly_salary, phone, email, user_id, branch_id, joined_date, created_at, updated_at
		 FROM teachers WHERE branch_id = $1 ORDER BY full_name`, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teachers []models.Teacher
	var teacherIDs []string
	for rows.Next() {
		var t models.Teacher
		if err := rows.Scan(&t.ID, &t.FullName, &t.MonthlySalary, &t.Phone, &t.Email,
			&t.UserID, &t.BranchID, &t.JoinedDate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		teachers = append(teachers, t)
		teacherIDs = append(teacherIDs, t.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(teacherIDs) == 0 {
		return teachers, nil
	}

	// Batch-load all subjects for every teacher in one query (eliminates N+1)
	subjectRows, err := s.db.GetConn().QueryContext(ctx,
		`SELECT teacher_id, subject FROM teacher_subjects
		 WHERE teacher_id = ANY($1) ORDER BY subject`, pq.Array(teacherIDs))
	if err == nil {
		defer subjectRows.Close()
		subjectMap := make(map[string][]string, len(teacherIDs))
		for subjectRows.Next() {
			var teacherID, subject string
			if err := subjectRows.Scan(&teacherID, &subject); err != nil {
				continue
			}
			subjectMap[teacherID] = append(subjectMap[teacherID], subject)
		}
		for i := range teachers {
			teachers[i].Subjects = subjectMap[teachers[i].ID]
		}
	}

	// Batch-load all assigned class IDs for every teacher in one query (eliminates N+1)
	classRows, err := s.db.GetConn().QueryContext(ctx,
		`SELECT teacher_id, id FROM classes
		 WHERE teacher_id = ANY($1) ORDER BY name`, pq.Array(teacherIDs))
	if err == nil {
		defer classRows.Close()
		classMap := make(map[string][]string, len(teacherIDs))
		for classRows.Next() {
			var teacherID, classID string
			if err := classRows.Scan(&teacherID, &classID); err != nil {
				continue
			}
			classMap[teacherID] = append(classMap[teacherID], classID)
		}
		for i := range teachers {
			teachers[i].AssignedClasses = classMap[teachers[i].ID]
		}
	}

	return teachers, nil
}

func (s *TeacherService) Update(ctx context.Context, id string, updates map[string]interface{}) (*models.Teacher, error) {
	// Extract subjects before snake_case conversion — they're not a column
	var newSubjects []string
	if rawSubjects, ok := updates["subjects"]; ok {
		if sl, ok := rawSubjects.([]interface{}); ok {
			for _, v := range sl {
				if str, ok := v.(string); ok {
					newSubjects = append(newSubjects, str)
				}
			}
		}
		delete(updates, "subjects")
	}

	updates = utils.ConvertKeysToSnakeCase(updates)

	if len(updates) > 0 {
		updates["updated_at"] = time.Now().UTC()
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

		if _, err := s.db.GetConn().ExecContext(ctx, query, args...); err != nil {
			return nil, err
		}
	}

	// Replace subjects if provided
	if newSubjects != nil {
		if err := s.replaceSubjects(ctx, id, newSubjects); err != nil {
			return nil, err
		}
	}

	updated, err := s.GetByID(ctx, id)
	if err == nil && s.cache != nil {
		_ = s.cache.Delete(ctx, fmt.Sprintf("crm:teachers:%s", updated.BranchID))
	}
	return updated, err
}

func (s *TeacherService) Delete(ctx context.Context, id string) error {
	var branchID string
	_ = s.db.GetConn().QueryRowContext(ctx, `SELECT branch_id FROM teachers WHERE id = $1`, id).Scan(&branchID)

	// teacher_subjects rows cascade-delete via FK
	query := `DELETE FROM teachers WHERE id = $1`
	_, err := s.db.GetConn().ExecContext(ctx, query, id)
	if err == nil && s.cache != nil && branchID != "" {
		_ = s.cache.Delete(ctx, fmt.Sprintf("crm:teachers:%s", branchID))
	}
	return err
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func (s *TeacherService) getSubjects(ctx context.Context, teacherID string) ([]string, error) {
	rows, err := s.db.GetConn().QueryContext(ctx,
		`SELECT subject FROM teacher_subjects WHERE teacher_id = $1 ORDER BY subject`, teacherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subjects []string
	for rows.Next() {
		var sub string
		if err := rows.Scan(&sub); err != nil {
			return nil, err
		}
		subjects = append(subjects, sub)
	}
	return subjects, rows.Err()
}

func (s *TeacherService) replaceSubjects(ctx context.Context, teacherID string, subjects []string) error {
	_, err := s.db.GetConn().ExecContext(ctx,
		`DELETE FROM teacher_subjects WHERE teacher_id = $1`, teacherID)
	if err != nil {
		return err
	}
	for _, sub := range subjects {
		if sub == "" {
			continue
		}
		_, err = s.db.GetConn().ExecContext(ctx,
			`INSERT INTO teacher_subjects (id, teacher_id, subject) VALUES ($1, $2, $3)`,
			uuid.New().String(), teacherID, sub)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *TeacherService) getTeacherClasses(ctx context.Context, teacherID string) ([]string, error) {
	rows, err := s.db.GetConn().QueryContext(ctx,
		`SELECT id FROM classes WHERE teacher_id = $1 ORDER BY name`, teacherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var classIDs []string
	for rows.Next() {
		var classID string
		if err := rows.Scan(&classID); err != nil {
			return nil, err
		}
		classIDs = append(classIDs, classID)
	}
	return classIDs, rows.Err()
}
