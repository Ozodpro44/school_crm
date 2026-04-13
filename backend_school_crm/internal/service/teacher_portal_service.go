package service

import (
	"context"
	"fmt"
	"time"

	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type TeacherPortalService struct {
	db         *db.Database
	teacherSvc *TeacherService
}

func NewTeacherPortalService(database *db.Database, teacherSvc *TeacherService) *TeacherPortalService {
	return &TeacherPortalService{db: database, teacherSvc: teacherSvc}
}

// GetPortalData returns all data needed for the teacher portal in one call.
// If the user has no linked teacher record it returns a response with nil Teacher.
func (s *TeacherPortalService) GetPortalData(ctx context.Context, userID string) (*models.TeacherPortalResponse, error) {
	teacher, err := s.teacherSvc.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("lookup teacher: %w", err)
	}

	resp := &models.TeacherPortalResponse{
		Teacher:  teacher,
		Classes:  []models.TeacherPortalClass{},
		Students: []models.TeacherPortalStudent{},
		Salary:   nil,
	}

	if teacher == nil {
		return resp, nil
	}

	// ── My classes ───────────────────────────────────────────────────────────
	classRows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT c.id, c.name, c.branch_id,
		       COUNT(s.id) FILTER (WHERE s.status = 'active') AS student_count
		FROM classes c
		LEFT JOIN students s ON s.class_id = c.id
		WHERE c.teacher_id = $1
		GROUP BY c.id, c.name, c.branch_id
		ORDER BY c.name
	`, teacher.ID)
	if err != nil {
		return nil, fmt.Errorf("get classes: %w", err)
	}
	defer classRows.Close()

	var classIDs []string
	classMap := map[string]string{} // id → name
	for classRows.Next() {
		var pc models.TeacherPortalClass
		if err := classRows.Scan(&pc.ID, &pc.Name, &pc.BranchID, &pc.StudentCount); err != nil {
			return nil, err
		}
		resp.Classes = append(resp.Classes, pc)
		classIDs = append(classIDs, pc.ID)
		classMap[pc.ID] = pc.Name
	}
	if err := classRows.Err(); err != nil {
		return nil, err
	}

	// ── Students I teach (with current-month payment status) ─────────────────
	if len(classIDs) > 0 {
		now := time.Now()
		monthName := now.Format("January")
		year := now.Year()

		// Build IN clause manually (Go's database/sql doesn't support array expansion)
		inClause := ""
		args := []interface{}{monthName, year}
		for i, id := range classIDs {
			if i > 0 {
				inClause += ","
			}
			args = append(args, id)
			inClause += fmt.Sprintf("$%d", len(args))
		}

		query := fmt.Sprintf(`
			SELECT
				s.id, s.full_name, s.phone, s.class_id,
				s.monthly_payment,
				COALESCE(SUM(p.amount), 0) AS paid_amount
			FROM students s
			LEFT JOIN payments p ON p.student_id = s.id
				AND p.month = $1
				AND p.year  = $2
			WHERE s.class_id IN (%s)
			  AND s.status = 'active'
			GROUP BY s.id, s.full_name, s.phone, s.class_id, s.monthly_payment
			ORDER BY s.full_name
		`, inClause)

		studentRows, err := s.db.GetConn().QueryContext(ctx, query, args...)
		if err != nil {
			return nil, fmt.Errorf("get students: %w", err)
		}
		defer studentRows.Close()

		for studentRows.Next() {
			var st models.TeacherPortalStudent
			if err := studentRows.Scan(
				&st.ID, &st.FullName, &st.Phone, &st.ClassID,
				&st.MonthlyPayment, &st.PaidAmount,
			); err != nil {
				return nil, err
			}
			st.ClassName = classMap[st.ClassID]

			switch {
			case st.PaidAmount >= st.MonthlyPayment && st.MonthlyPayment > 0:
				st.PaymentStatus = "paid"
			case st.PaidAmount > 0:
				st.PaymentStatus = "partial"
			default:
				st.PaymentStatus = "unpaid"
			}
			resp.Students = append(resp.Students, st)
		}
		if err := studentRows.Err(); err != nil {
			return nil, err
		}
	}

	// ── My salary (current month) ─────────────────────────────────────────────
	now := time.Now()
	monthName := now.Format("January")
	year := now.Year()

	var sal models.TeacherPortalSalary
	sal.MonthlySalary = teacher.MonthlySalary
	sal.Month = monthName
	sal.Year = year

	err = s.db.GetConn().QueryRowContext(ctx, `
		SELECT id, amount, month, year, status
		FROM salaries
		WHERE teacher_id = $1 AND month = $2 AND year = $3
		LIMIT 1
	`, teacher.ID, monthName, year).Scan(
		&sal.ID, &sal.Amount, &sal.Month, &sal.Year, &sal.Status,
	)
	if err == nil {
		resp.Salary = &sal
	} else {
		// No salary record yet for this month — still surface the expected amount
		sal.Status = "pending"
		resp.Salary = &sal
	}

	return resp, nil
}

// LinkUserToTeacher sets user_id on a teacher record.
func (s *TeacherPortalService) LinkUserToTeacher(ctx context.Context, teacherID, userID string) error {
	_, err := s.db.GetConn().ExecContext(ctx,
		`UPDATE teachers SET user_id = $1, updated_at = NOW() WHERE id = $2`,
		userID, teacherID,
	)
	return err
}
