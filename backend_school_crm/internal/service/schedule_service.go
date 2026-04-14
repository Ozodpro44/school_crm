package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type ScheduleService struct {
	db *db.Database
}

func NewScheduleService(database *db.Database) *ScheduleService {
	return &ScheduleService{db: database}
}

func (s *ScheduleService) GetByClass(ctx context.Context, classID string) ([]models.ScheduleSlot, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT cs.id, cs.branch_id, cs.class_id, cs.teacher_id, cs.day_of_week,
		       cs.start_time, cs.end_time, cs.room, cs.subject, cs.created_at, cs.updated_at,
		       COALESCE(t.full_name, '') AS teacher_name
		FROM class_schedule cs
		LEFT JOIN teachers t ON t.id = cs.teacher_id
		WHERE cs.class_id = $1
		ORDER BY cs.day_of_week, cs.start_time
	`, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var slots []models.ScheduleSlot
	for rows.Next() {
		var slot models.ScheduleSlot
		if err := rows.Scan(
			&slot.ID, &slot.BranchID, &slot.ClassID, &slot.TeacherID, &slot.DayOfWeek,
			&slot.StartTime, &slot.EndTime, &slot.Room, &slot.Subject,
			&slot.CreatedAt, &slot.UpdatedAt, &slot.TeacherName,
		); err != nil {
			return nil, err
		}
		slots = append(slots, slot)
	}
	if slots == nil {
		slots = []models.ScheduleSlot{}
	}
	return slots, rows.Err()
}

func (s *ScheduleService) GetByBranch(ctx context.Context, branchID string) ([]models.ScheduleSlot, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT cs.id, cs.branch_id, cs.class_id, cs.teacher_id, cs.day_of_week,
		       cs.start_time, cs.end_time, cs.room, cs.subject, cs.created_at, cs.updated_at,
		       COALESCE(t.full_name, '') AS teacher_name
		FROM class_schedule cs
		LEFT JOIN teachers t ON t.id = cs.teacher_id
		WHERE cs.branch_id = $1
		ORDER BY cs.day_of_week, cs.start_time
	`, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var slots []models.ScheduleSlot
	for rows.Next() {
		var slot models.ScheduleSlot
		if err := rows.Scan(
			&slot.ID, &slot.BranchID, &slot.ClassID, &slot.TeacherID, &slot.DayOfWeek,
			&slot.StartTime, &slot.EndTime, &slot.Room, &slot.Subject,
			&slot.CreatedAt, &slot.UpdatedAt, &slot.TeacherName,
		); err != nil {
			return nil, err
		}
		slots = append(slots, slot)
	}
	if slots == nil {
		slots = []models.ScheduleSlot{}
	}
	return slots, rows.Err()
}

func (s *ScheduleService) Upsert(ctx context.Context, req *models.UpsertScheduleSlotRequest) (*models.ScheduleSlot, error) {
	now := time.Now()
	id := uuid.New().String()

	var slot models.ScheduleSlot
	err := s.db.GetConn().QueryRowContext(ctx, `
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
	).Scan(
		&slot.ID, &slot.BranchID, &slot.ClassID, &slot.TeacherID, &slot.DayOfWeek,
		&slot.StartTime, &slot.EndTime, &slot.Room, &slot.Subject, &slot.CreatedAt, &slot.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("upsert schedule: %w", err)
	}
	return &slot, nil
}

func (s *ScheduleService) Delete(ctx context.Context, id, branchID string) error {
	result, err := s.db.GetConn().ExecContext(ctx,
		`DELETE FROM class_schedule WHERE id = $1 AND branch_id = $2`, id, branchID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("slot not found")
	}
	return nil
}
