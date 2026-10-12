package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type AssignmentService struct {
	db *db.Database
}

func NewAssignmentService(database *db.Database) *AssignmentService {
	return &AssignmentService{db: database}
}

func (s *AssignmentService) ListByBranch(ctx context.Context, branchID, classID string) ([]models.Assignment, error) {
	query := `
		SELECT a.id, a.branch_id, a.class_id, c.name AS class_name, a.teacher_id,
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

	rows, err := s.db.GetConn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Assignment
	for rows.Next() {
		var a models.Assignment
		if err := rows.Scan(
			&a.ID, &a.BranchID, &a.ClassID, &a.ClassName, &a.TeacherID,
			&a.Subject, &a.Title, &a.Description, &a.DueDate, &a.CreatedBy,
			&a.TotalStudents, &a.SubmittedCount, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	if list == nil {
		list = []models.Assignment{}
	}
	return list, rows.Err()
}

func (s *AssignmentService) Create(ctx context.Context, req *models.CreateAssignmentRequest, createdByID string) (*models.Assignment, error) {
	id := uuid.New().String()
	now := time.Now()

	var a models.Assignment
	err := s.db.GetConn().QueryRowContext(ctx, `
		INSERT INTO assignments (id, branch_id, class_id, teacher_id, subject, title, description, due_date, created_by, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$10)
		RETURNING id, branch_id, class_id, teacher_id, subject, title, description, due_date::text, created_by, created_at, updated_at
	`, id, req.BranchID, req.ClassID, req.TeacherID, req.Subject, req.Title, req.Description, req.DueDate, createdByID, now,
	).Scan(&a.ID, &a.BranchID, &a.ClassID, &a.TeacherID, &a.Subject, &a.Title,
		&a.Description, &a.DueDate, &a.CreatedBy, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Auto-create submission rows for active students in the class
	_, err = s.db.GetConn().ExecContext(ctx, `
		INSERT INTO assignment_submissions (id, assignment_id, student_id)
		SELECT gen_random_uuid(), $1, s.id
		FROM students s
		WHERE s.class_id = $2 AND s.status = 'active'
		ON CONFLICT DO NOTHING
	`, id, req.ClassID)
	if err != nil {
		return nil, fmt.Errorf("create submissions: %w", err)
	}
	return &a, nil
}

func (s *AssignmentService) Delete(ctx context.Context, id, branchID string) error {
	result, err := s.db.GetConn().ExecContext(ctx,
		`DELETE FROM assignments WHERE id = $1 AND branch_id = $2`, id, branchID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("assignment not found")
	}
	return nil
}

func (s *AssignmentService) GetSubmissions(ctx context.Context, assignmentID string) ([]models.AssignmentSubmission, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT sub.id, sub.assignment_id, sub.student_id, s.full_name,
		       sub.status, sub.grade, sub.feedback, sub.submitted_at, sub.graded_at, sub.graded_by,
		       sub.created_at, sub.updated_at
		FROM assignment_submissions sub
		JOIN students s ON s.id = sub.student_id
		WHERE sub.assignment_id = $1
		ORDER BY s.full_name
	`, assignmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []models.AssignmentSubmission
	for rows.Next() {
		var sub models.AssignmentSubmission
		if err := rows.Scan(
			&sub.ID, &sub.AssignmentID, &sub.StudentID, &sub.StudentName,
			&sub.Status, &sub.Grade, &sub.Feedback, &sub.SubmittedAt, &sub.GradedAt, &sub.GradedBy,
			&sub.CreatedAt, &sub.UpdatedAt,
		); err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	if subs == nil {
		subs = []models.AssignmentSubmission{}
	}
	return subs, rows.Err()
}

func (s *AssignmentService) UpdateSubmission(ctx context.Context, submissionID string, req *models.UpdateSubmissionRequest, gradedByID string) (*models.AssignmentSubmission, error) {
	now := time.Now()

	gradedAt := (*time.Time)(nil)
	if req.Grade != nil {
		gradedAt = &now
	}

	var submittedAt *time.Time
	if req.Status == "submitted" || req.Status == "late" {
		submittedAt = &now
	}

	var sub models.AssignmentSubmission
	err := s.db.GetConn().QueryRowContext(ctx, `
		UPDATE assignment_submissions SET
			status = $1, grade = $2, feedback = $3,
			submitted_at = COALESCE(submitted_at, $4),
			graded_at = $5, graded_by = $6, updated_at = $7
		WHERE id = $8
		RETURNING id, assignment_id, student_id, status, grade, feedback, submitted_at, graded_at, graded_by, created_at, updated_at
	`, req.Status, req.Grade, req.Feedback, submittedAt, gradedAt, gradedByID, now, submissionID,
	).Scan(&sub.ID, &sub.AssignmentID, &sub.StudentID,
		&sub.Status, &sub.Grade, &sub.Feedback,
		&sub.SubmittedAt, &sub.GradedAt, &sub.GradedBy,
		&sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

// GetStudentProgress returns all submissions for a student across all assignments in a branch.
func (s *AssignmentService) GetStudentProgress(ctx context.Context, studentID, branchID string) ([]models.AssignmentSubmission, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT sub.id, sub.assignment_id, sub.student_id, ''::text AS student_name,
		       sub.status, sub.grade, sub.feedback, sub.submitted_at, sub.graded_at, sub.graded_by,
		       sub.created_at, sub.updated_at
		FROM assignment_submissions sub
		JOIN assignments a ON a.id = sub.assignment_id
		WHERE sub.student_id = $1 AND a.branch_id = $2
		ORDER BY a.due_date DESC
	`, studentID, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []models.AssignmentSubmission
	for rows.Next() {
		var sub models.AssignmentSubmission
		if err := rows.Scan(
			&sub.ID, &sub.AssignmentID, &sub.StudentID, &sub.StudentName,
			&sub.Status, &sub.Grade, &sub.Feedback, &sub.SubmittedAt, &sub.GradedAt, &sub.GradedBy,
			&sub.CreatedAt, &sub.UpdatedAt,
		); err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	if subs == nil {
		subs = []models.AssignmentSubmission{}
	}
	return subs, rows.Err()
}
