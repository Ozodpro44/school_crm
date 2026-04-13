package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type AttendanceService struct {
	db *db.Database
}

func NewAttendanceService(database *db.Database) *AttendanceService {
	return &AttendanceService{db: database}
}

// Save performs an upsert of all attendance records for a given class+date.
// Existing records are updated; new ones are inserted.
func (s *AttendanceService) Save(ctx context.Context, req *models.BulkAttendanceRequest, createdBy string) ([]models.Attendance, error) {
	tx, err := s.db.GetConn().BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("attendance save: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	now := time.Now()
	var result []models.Attendance

	for _, rec := range req.Records {
		id := uuid.New().String()
		var a models.Attendance
		err := tx.QueryRowContext(ctx, `
			INSERT INTO attendance (id, branch_id, class_id, student_id, date, status, note, created_by, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
			ON CONFLICT (class_id, student_id, date) DO UPDATE
			  SET status     = EXCLUDED.status,
			      note       = EXCLUDED.note,
			      updated_at = EXCLUDED.updated_at
			RETURNING id, branch_id, class_id, student_id, date::text, status, note, created_by, created_at, updated_at
		`, id, req.BranchID, req.ClassID, rec.StudentID, req.Date,
			string(rec.Status), rec.Note, createdBy, now,
		).Scan(
			&a.ID, &a.BranchID, &a.ClassID, &a.StudentID, &a.Date,
			&a.Status, &a.Note, &a.CreatedBy, &a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("attendance save upsert: %w", err)
		}
		result = append(result, a)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("attendance save: commit: %w", err)
	}
	return result, nil
}

// GetByClassAndDate returns all attendance records for a class on a specific date,
// joined with student names for display.
func (s *AttendanceService) GetByClassAndDate(ctx context.Context, classID, date string) ([]models.Attendance, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT
			a.id, a.branch_id, a.class_id, a.student_id, a.date::text,
			a.status, a.note, a.created_by, a.created_at, a.updated_at,
			s.full_name
		FROM attendance a
		JOIN students s ON s.id = a.student_id
		WHERE a.class_id = $1 AND a.date = $2
		ORDER BY s.full_name
	`, classID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []models.Attendance
	for rows.Next() {
		var a models.Attendance
		if err := rows.Scan(
			&a.ID, &a.BranchID, &a.ClassID, &a.StudentID, &a.Date,
			&a.Status, &a.Note, &a.CreatedBy, &a.CreatedAt, &a.UpdatedAt,
			&a.StudentName,
		); err != nil {
			return nil, err
		}
		records = append(records, a)
	}
	return records, rows.Err()
}

// GetStudentMonthSummary returns monthly attendance stats per student for a class.
func (s *AttendanceService) GetStudentMonthSummary(ctx context.Context, classID string, year int, month int) ([]models.AttendanceStudentSummary, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT
			a.student_id,
			s.full_name,
			COUNT(*) FILTER (WHERE a.status = 'present') AS present,
			COUNT(*) FILTER (WHERE a.status = 'absent')  AS absent,
			COUNT(*) FILTER (WHERE a.status = 'late')    AS late,
			COUNT(*)                                      AS total
		FROM attendance a
		JOIN students s ON s.id = a.student_id
		WHERE a.class_id = $1
		  AND EXTRACT(YEAR  FROM a.date) = $2
		  AND EXTRACT(MONTH FROM a.date) = $3
		GROUP BY a.student_id, s.full_name
		ORDER BY s.full_name
	`, classID, year, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []models.AttendanceStudentSummary
	for rows.Next() {
		var s models.AttendanceStudentSummary
		if err := rows.Scan(&s.StudentID, &s.StudentName, &s.Present, &s.Absent, &s.Late, &s.Total); err != nil {
			return nil, err
		}
		if s.Total > 0 {
			s.PresentPct = float64(s.Present) / float64(s.Total) * 100
		}
		summaries = append(summaries, s)
	}
	return summaries, rows.Err()
}

// GetConsecutiveAbsences returns students with 3 or more consecutive absent days
// in the given branch, looking at the last 14 days.
func (s *AttendanceService) GetConsecutiveAbsences(ctx context.Context, branchID string) ([]models.AttendanceStudentSummary, error) {
	cutoff := time.Now().AddDate(0, 0, -14).Format("2006-01-02")
	rows, err := s.db.GetConn().QueryContext(ctx, `
		WITH absences AS (
			SELECT
				a.student_id,
				s.full_name,
				a.date,
				ROW_NUMBER() OVER (PARTITION BY a.student_id ORDER BY a.date) -
				ROW_NUMBER() OVER (PARTITION BY a.student_id ORDER BY a.date) AS grp
			FROM attendance a
			JOIN students s ON s.id = a.student_id
			WHERE a.branch_id = $1
			  AND a.status    = 'absent'
			  AND a.date     >= $2
		),
		streaks AS (
			SELECT student_id, full_name, COUNT(*) AS streak
			FROM absences
			GROUP BY student_id, full_name, grp
		)
		SELECT student_id, full_name, MAX(streak) AS absent
		FROM streaks
		GROUP BY student_id, full_name
		HAVING MAX(streak) >= 3
		ORDER BY absent DESC
	`, branchID, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.AttendanceStudentSummary
	for rows.Next() {
		var s models.AttendanceStudentSummary
		if err := rows.Scan(&s.StudentID, &s.StudentName, &s.Absent); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, rows.Err()
}
