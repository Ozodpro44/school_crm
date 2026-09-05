package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

// AttendanceService wires the CRM's database to one or more Hikvision
// face-recognition terminals: registering devices, syncing employees onto
// them, and turning the events they report into check-in/check-out records.
type AttendanceService struct {
	db *db.Database
}

func NewAttendanceService(database *db.Database) *AttendanceService {
	return &AttendanceService{db: database}
}

// ---------------------------------------------------------------- Devices --

type CreateDeviceRequest struct {
	BranchID string `json:"branchId" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Host     string `json:"host" binding:"required"` // device LAN IP, e.g. "192.168.0.115"
	Username string `json:"username"`
	Password string `json:"password" binding:"required"`
}

// CreateDevice validates the credentials against the real device (so a typo
// is caught immediately, not on the first missed attendance event) before
// saving it.
func (s *AttendanceService) CreateDevice(ctx context.Context, req *CreateDeviceRequest) (*models.HikvisionDevice, error) {
	username := req.Username
	if username == "" {
		username = "admin"
	}

	client := NewHikvisionClient(req.Host, username, req.Password)
	if _, err := client.GetDeviceInfo(); err != nil {
		return nil, fmt.Errorf("could not connect to device: %w", err)
	}

	now := time.Now().UTC()
	device := &models.HikvisionDevice{
		ID:           uuid.New().String(),
		BranchID:     req.BranchID,
		Name:         req.Name,
		Host:         req.Host,
		Username:     username,
		Password:     req.Password,
		WebhookToken: randomHex(24),
		IsActive:     true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	_, err := s.db.GetConn().ExecContext(ctx, `
		INSERT INTO hikvision_devices
			(id, branch_id, name, host, username, password, webhook_token, is_active, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		device.ID, device.BranchID, device.Name, device.Host, device.Username, device.Password,
		device.WebhookToken, device.IsActive, device.CreatedAt, device.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return device, nil
}

func (s *AttendanceService) GetDevice(ctx context.Context, id string) (*models.HikvisionDevice, error) {
	d := &models.HikvisionDevice{}
	err := s.db.GetConn().QueryRowContext(ctx, `
		SELECT id, branch_id, name, host, username, password, webhook_token, is_active, created_at, updated_at
		FROM hikvision_devices WHERE id = $1`, id).Scan(
		&d.ID, &d.BranchID, &d.Name, &d.Host, &d.Username, &d.Password, &d.WebhookToken, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("device not found")
	}
	return d, err
}

func (s *AttendanceService) ListDevicesByBranch(ctx context.Context, branchID string) ([]models.HikvisionDevice, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT id, branch_id, name, host, username, password, webhook_token, is_active, created_at, updated_at
		FROM hikvision_devices WHERE branch_id = $1 ORDER BY created_at`, branchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.HikvisionDevice
	for rows.Next() {
		var d models.HikvisionDevice
		if err := rows.Scan(&d.ID, &d.BranchID, &d.Name, &d.Host, &d.Username, &d.Password, &d.WebhookToken, &d.IsActive, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// ConfigurePush tells the device to start pushing every access event to our
// webhook in real time. publicHost/publicPort must be reachable from the
// device (its own network's internet egress, not our internal address).
func (s *AttendanceService) ConfigurePush(ctx context.Context, deviceID, publicHost string, publicPort int, useHTTPS bool) error {
	device, err := s.GetDevice(ctx, deviceID)
	if err != nil {
		return err
	}

	client := NewHikvisionClient(device.Host, device.Username, device.Password)
	urlPath := fmt.Sprintf("/api/hikvision/webhook/%s/%s", device.ID, device.WebhookToken)
	return client.ConfigureHTTPHost(1, publicHost, publicPort, urlPath, useHTTPS)
}

// -------------------------------------------------------------- Employees --

type AddEmployeeRequest struct {
	DeviceID   string  `json:"deviceId" binding:"required"`
	EmployeeNo string  `json:"employeeNo" binding:"required"`
	FullName   string  `json:"fullName" binding:"required"`
	TeacherID  *string `json:"teacherId"`
}

// AddEmployee enrolls a person on the device (without a face yet — call
// UploadEmployeeFace next) and records them locally so future events can be
// matched back to a name.
func (s *AttendanceService) AddEmployee(ctx context.Context, req *AddEmployeeRequest) (*models.HikvisionEmployee, error) {
	device, err := s.GetDevice(ctx, req.DeviceID)
	if err != nil {
		return nil, err
	}

	client := NewHikvisionClient(device.Host, device.Username, device.Password)
	if err := client.CreateUser(req.EmployeeNo, req.FullName); err != nil {
		return nil, fmt.Errorf("device rejected new employee: %w", err)
	}

	now := time.Now().UTC()
	emp := &models.HikvisionEmployee{
		ID:         uuid.New().String(),
		DeviceID:   req.DeviceID,
		EmployeeNo: req.EmployeeNo,
		FullName:   req.FullName,
		TeacherID:  req.TeacherID,
		IsActive:   true,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	_, err = s.db.GetConn().ExecContext(ctx, `
		INSERT INTO hikvision_employees (id, device_id, employee_no, full_name, teacher_id, is_active, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		emp.ID, emp.DeviceID, emp.EmployeeNo, emp.FullName, emp.TeacherID, emp.IsActive, emp.CreatedAt, emp.UpdatedAt)
	if err != nil {
		// Best-effort cleanup so the device doesn't keep an orphaned user
		// that our own database has no record of.
		_ = client.DeleteUser(req.EmployeeNo)
		return nil, err
	}
	return emp, nil
}

// UploadEmployeeFace attaches a photo to an already-enrolled employee so the
// terminal can actually recognize their face.
func (s *AttendanceService) UploadEmployeeFace(ctx context.Context, employeeID string, jpegData []byte) error {
	emp, err := s.GetEmployee(ctx, employeeID)
	if err != nil {
		return err
	}
	device, err := s.GetDevice(ctx, emp.DeviceID)
	if err != nil {
		return err
	}
	client := NewHikvisionClient(device.Host, device.Username, device.Password)
	return client.UploadFace(emp.EmployeeNo, jpegData)
}

// RemoveEmployee deletes the person from the device first, then from our
// database — so we never keep a local record for someone the device no
// longer recognizes.
func (s *AttendanceService) RemoveEmployee(ctx context.Context, employeeID string) error {
	emp, err := s.GetEmployee(ctx, employeeID)
	if err != nil {
		return err
	}
	device, err := s.GetDevice(ctx, emp.DeviceID)
	if err != nil {
		return err
	}

	client := NewHikvisionClient(device.Host, device.Username, device.Password)
	if err := client.DeleteUser(emp.EmployeeNo); err != nil {
		return fmt.Errorf("failed to remove from device: %w", err)
	}

	_, err = s.db.GetConn().ExecContext(ctx, `DELETE FROM hikvision_employees WHERE id = $1`, employeeID)
	return err
}

func (s *AttendanceService) GetEmployee(ctx context.Context, id string) (*models.HikvisionEmployee, error) {
	e := &models.HikvisionEmployee{}
	err := s.db.GetConn().QueryRowContext(ctx, `
		SELECT id, device_id, employee_no, full_name, teacher_id, is_active, created_at, updated_at
		FROM hikvision_employees WHERE id = $1`, id).Scan(
		&e.ID, &e.DeviceID, &e.EmployeeNo, &e.FullName, &e.TeacherID, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("employee not found")
	}
	return e, err
}

func (s *AttendanceService) ListEmployeesByDevice(ctx context.Context, deviceID string) ([]models.HikvisionEmployee, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT id, device_id, employee_no, full_name, teacher_id, is_active, created_at, updated_at
		FROM hikvision_employees WHERE device_id = $1 ORDER BY full_name`, deviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.HikvisionEmployee
	for rows.Next() {
		var e models.HikvisionEmployee
		if err := rows.Scan(&e.ID, &e.DeviceID, &e.EmployeeNo, &e.FullName, &e.TeacherID, &e.IsActive, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// -------------------------------------------------------------- Webhook ----

// webhookEventPayload matches the JSON body Hikvision POSTs for
// AccessControllerEvent notifications (we configure parameterFormatType=JSON).
type webhookEventPayload struct {
	DateTime              string `json:"dateTime"`
	AccessControllerEvent struct {
		EmployeeNoString string `json:"employeeNoString"`
		Name             string `json:"name"`
		Major            int    `json:"major"`
		Minor            int    `json:"minor"`
	} `json:"AccessControllerEvent"`
}

// ProcessWebhookEvent handles one push notification from the device. Only
// successful face-recognition matches (minorEvent 75) are turned into
// attendance records; everything else (heartbeats, failed attempts, door
// status) is acknowledged and ignored.
func (s *AttendanceService) ProcessWebhookEvent(ctx context.Context, deviceID string, rawJSON []byte) error {
	var payload webhookEventPayload
	if err := json.Unmarshal(rawJSON, &payload); err != nil {
		return fmt.Errorf("invalid event payload: %w", err)
	}

	ace := payload.AccessControllerEvent
	if ace.EmployeeNoString == "" || ace.Minor != MinorEventFaceSuccess {
		return nil
	}

	eventTime, err := parseISAPITime(payload.DateTime)
	if err != nil {
		eventTime = time.Now().UTC()
	}

	var employeeID *string
	var id string
	row := s.db.GetConn().QueryRowContext(ctx,
		`SELECT id FROM hikvision_employees WHERE device_id = $1 AND employee_no = $2`,
		deviceID, ace.EmployeeNoString)
	if err := row.Scan(&id); err == nil {
		employeeID = &id
	}

	eventType, err := s.nextEventType(ctx, deviceID, ace.EmployeeNoString, eventTime)
	if err != nil {
		return err
	}

	minor := ace.Minor
	_, err = s.db.GetConn().ExecContext(ctx, `
		INSERT INTO attendance_records (id, device_id, employee_id, employee_no, event_time, event_type, minor_event, source, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,'push',$8)`,
		uuid.New().String(), deviceID, employeeID, ace.EmployeeNoString, eventTime, eventType, minor, time.Now().UTC())
	return err
}

// nextEventType is a simple, dependable default when the device isn't
// configured with its own attendance shift rules: the first scan of the day
// is a check-in, the next is a check-out, and so on.
func (s *AttendanceService) nextEventType(ctx context.Context, deviceID, employeeNo string, eventTime time.Time) (models.AttendanceEventType, error) {
	dayStart := time.Date(eventTime.Year(), eventTime.Month(), eventTime.Day(), 0, 0, 0, 0, eventTime.Location())
	dayEnd := dayStart.Add(24 * time.Hour)

	var count int
	err := s.db.GetConn().QueryRowContext(ctx, `
		SELECT COUNT(*) FROM attendance_records
		WHERE device_id = $1 AND employee_no = $2 AND event_time >= $3 AND event_time < $4`,
		deviceID, employeeNo, dayStart, dayEnd).Scan(&count)
	if err != nil {
		return "", err
	}
	if count%2 == 0 {
		return models.AttendanceCheckIn, nil
	}
	return models.AttendanceCheckOut, nil
}

func parseISAPITime(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, fmt.Errorf("empty time")
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02T15:04:05", s)
}

// -------------------------------------------------------------- Reports ----

type AttendanceFilter struct {
	DeviceID   string
	EmployeeID string
	From       *time.Time
	To         *time.Time
}

func (s *AttendanceService) ListAttendance(ctx context.Context, filter AttendanceFilter) ([]models.AttendanceRecord, error) {
	query := `
		SELECT a.id, a.device_id, a.employee_id, a.employee_no, a.event_time, a.event_type, a.minor_event, a.source, a.created_at,
		       COALESCE(e.full_name, '')
		FROM attendance_records a
		LEFT JOIN hikvision_employees e ON e.id = a.employee_id
		WHERE 1=1`
	args := []interface{}{}
	argN := 1

	if filter.DeviceID != "" {
		query += fmt.Sprintf(" AND a.device_id = $%d", argN)
		args = append(args, filter.DeviceID)
		argN++
	}
	if filter.EmployeeID != "" {
		query += fmt.Sprintf(" AND a.employee_id = $%d", argN)
		args = append(args, filter.EmployeeID)
		argN++
	}
	if filter.From != nil {
		query += fmt.Sprintf(" AND a.event_time >= $%d", argN)
		args = append(args, *filter.From)
		argN++
	}
	if filter.To != nil {
		query += fmt.Sprintf(" AND a.event_time < $%d", argN)
		args = append(args, *filter.To)
		argN++
	}
	query += " ORDER BY a.event_time DESC LIMIT 500"

	rows, err := s.db.GetConn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.AttendanceRecord
	for rows.Next() {
		var r models.AttendanceRecord
		if err := rows.Scan(&r.ID, &r.DeviceID, &r.EmployeeID, &r.EmployeeNo, &r.EventTime, &r.EventType, &r.MinorEvent, &r.Source, &r.CreatedAt, &r.EmployeeName); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
