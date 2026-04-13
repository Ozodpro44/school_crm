package service

import (
	"context"
	"fmt"
	"time"

	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type StudentNotesService struct {
	db *db.Database
}

func NewStudentNotesService(database *db.Database) *StudentNotesService {
	return &StudentNotesService{db: database}
}

// ─── Notes ────────────────────────────────────────────────────────────────────

func (s *StudentNotesService) ListNotes(ctx context.Context, branchID, studentID string) ([]models.StudentNote, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT id, branch_id, student_id, content,
		       created_by, created_by_name, created_at, updated_at
		FROM student_notes
		WHERE branch_id = $1 AND student_id = $2
		ORDER BY created_at DESC
	`, branchID, studentID)
	if err != nil {
		return nil, fmt.Errorf("list notes: %w", err)
	}
	defer rows.Close()

	var notes []models.StudentNote
	for rows.Next() {
		var n models.StudentNote
		if err := rows.Scan(
			&n.ID, &n.BranchID, &n.StudentID, &n.Content,
			&n.CreatedBy, &n.CreatedByName, &n.CreatedAt, &n.UpdatedAt,
		); err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	if notes == nil {
		notes = []models.StudentNote{}
	}
	return notes, rows.Err()
}

func (s *StudentNotesService) AddNote(ctx context.Context, branchID, studentID, content, createdByID, createdByName string) (*models.StudentNote, error) {
	var note models.StudentNote
	err := s.db.GetConn().QueryRowContext(ctx, `
		INSERT INTO student_notes (branch_id, student_id, content, created_by, created_by_name)
		VALUES ($1, $2, $3, $4, $5)
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
	result, err := s.db.GetConn().ExecContext(ctx,
		`DELETE FROM student_notes WHERE id = $1 AND branch_id = $2`,
		noteID, branchID,
	)
	if err != nil {
		return fmt.Errorf("delete note: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("note not found")
	}
	return nil
}

// ─── Contact Log ──────────────────────────────────────────────────────────────

func (s *StudentNotesService) ListContactLog(ctx context.Context, branchID, studentID string) ([]models.ContactLogEntry, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT id, branch_id, student_id, contact_type, outcome, note,
		       contacted_at, created_by, created_by_name, created_at
		FROM contact_log
		WHERE branch_id = $1 AND student_id = $2
		ORDER BY contacted_at DESC
	`, branchID, studentID)
	if err != nil {
		return nil, fmt.Errorf("list contact log: %w", err)
	}
	defer rows.Close()

	var entries []models.ContactLogEntry
	for rows.Next() {
		var e models.ContactLogEntry
		if err := rows.Scan(
			&e.ID, &e.BranchID, &e.StudentID, &e.ContactType, &e.Outcome, &e.Note,
			&e.ContactedAt, &e.CreatedBy, &e.CreatedByName, &e.CreatedAt,
		); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []models.ContactLogEntry{}
	}
	return entries, rows.Err()
}

func (s *StudentNotesService) AddContactLog(ctx context.Context, branchID, studentID string, req *models.CreateContactLogRequest, createdByID, createdByName string) (*models.ContactLogEntry, error) {
	contactType := req.ContactType
	if contactType == "" {
		contactType = "call"
	}
	outcome := req.Outcome
	if outcome == "" {
		outcome = "no_answer"
	}

	contactedAt := time.Now()
	if req.ContactedAt != "" {
		parsed, err := time.Parse(time.RFC3339, req.ContactedAt)
		if err != nil {
			// try "2006-01-02T15:04"
			parsed, err = time.Parse("2006-01-02T15:04", req.ContactedAt)
			if err != nil {
				parsed, _ = time.Parse("2006-01-02", req.ContactedAt)
			}
		}
		if !parsed.IsZero() {
			contactedAt = parsed
		}
	}

	var entry models.ContactLogEntry
	err := s.db.GetConn().QueryRowContext(ctx, `
		INSERT INTO contact_log (branch_id, student_id, contact_type, outcome, note, contacted_at, created_by, created_by_name)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
	result, err := s.db.GetConn().ExecContext(ctx,
		`DELETE FROM contact_log WHERE id = $1 AND branch_id = $2`,
		entryID, branchID,
	)
	if err != nil {
		return fmt.Errorf("delete contact log: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("contact log entry not found")
	}
	return nil
}
