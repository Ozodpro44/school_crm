package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/school-crm/backend/internal/models"
)

// UpdateEmployeeRequest changes an enrolled person's display name and the
// teacher they are linked to. The employee number never changes (the device
// and the Hik-Connect platform key on it); the face photo has its own endpoint.
type UpdateEmployeeRequest struct {
	FullName  string  `json:"fullName"`
	TeacherID *string `json:"teacherId"` // nil / "" unlinks
}

// UpdateEmployee renames the person on the device first (so the terminal shows
// the new name) and then in our database, and re-links the teacher.
func (s *HikvisionService) UpdateEmployee(ctx context.Context, id string, req UpdateEmployeeRequest) (*models.HikvisionEmployee, error) {
	name := strings.TrimSpace(req.FullName)
	if name == "" {
		return nil, errors.New("full name is required")
	}
	emp, err := s.GetEmployee(ctx, id)
	if err != nil {
		return nil, err
	}
	device, err := s.GetDevice(ctx, emp.DeviceID)
	if err != nil {
		return nil, err
	}

	var teacherID *string
	if req.TeacherID != nil && strings.TrimSpace(*req.TeacherID) != "" && *req.TeacherID != "none" {
		t := strings.TrimSpace(*req.TeacherID)
		var ok bool
		if err := s.db.GetConn().QueryRowContext(ctx, `
			SELECT EXISTS (SELECT 1 FROM teachers t WHERE t.id = $1 AND t.branch_id = $2 AND t.deleted_at IS NULL)`,
			t, device.BranchID).Scan(&ok); err != nil {
			return nil, err
		}
		if !ok {
			return nil, errors.New("the selected teacher does not belong to this branch")
		}
		teacherID = &t
	}

	if name != emp.FullName {
		switch device.Protocol {
		case "hct":
			if s.hct == nil {
				return nil, ErrHCTNotConfigured
			}
			if emp.HCTPersonID == nil || *emp.HCTPersonID == "" {
				return nil, errors.New("this employee has no Hik-Connect person record")
			}
			groupID, err := s.hctGroupID(ctx)
			if err != nil {
				return nil, err
			}
			if err := s.hct.UpdatePerson(ctx, groupID, *emp.HCTPersonID, emp.EmployeeNo, name, emp.CreatedAt); err != nil {
				return nil, fmt.Errorf("Hik-Connect rejected the new name: %w", err)
			}
		case "push":
			return nil, ErrPushDeviceUnsupported
		default:
			if err := NewHikvisionClient(device.Host, device.Username, device.Password).ModifyUser(emp.EmployeeNo, name); err != nil {
				return nil, fmt.Errorf("the device rejected the new name: %w", err)
			}
		}
	}

	if _, err := s.db.GetConn().ExecContext(ctx,
		`UPDATE hikvision_employees SET full_name = $1, teacher_id = $2, updated_at = $3 WHERE id = $4`,
		name, teacherID, time.Now().UTC(), id); err != nil {
		return nil, err
	}
	return s.GetEmployee(ctx, id)
}
