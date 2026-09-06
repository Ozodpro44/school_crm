package service

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

// photoURLTTL is how long a generated employee-photo link stays valid. It's
// regenerated fresh on every list/get call, so this only needs to outlive
// one page load, not the photo's actual lifetime.
const photoURLTTL = 24 * time.Hour

// AttendanceService wires the CRM's database to one or more Hikvision
// face-recognition terminals: registering devices, syncing employees onto
// them, and turning the events they report into check-in/check-out records.
type AttendanceService struct {
	db      *db.Database
	storage *StorageService // nil when no bucket is configured — photos then only live on the device
}

func NewAttendanceService(database *db.Database, storage *StorageService) *AttendanceService {
	return &AttendanceService{db: database, storage: storage}
}

// resolvePhotoURL fills in e.PhotoURL from e.PhotoKey when a bucket is
// configured. Failures are logged, not returned — a broken photo link should
// never take down the employee list.
func (s *AttendanceService) resolvePhotoURL(e *models.HikvisionEmployee) {
	if s.storage == nil || e.PhotoKey == nil || *e.PhotoKey == "" {
		return
	}
	url, err := s.storage.PresignedGetURL(*e.PhotoKey, photoURLTTL)
	if err != nil {
		log.Printf("warning: failed to build photo URL for employee %s: %v", e.ID, err)
		return
	}
	e.PhotoURL = &url
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

// UpdateDeviceHost changes a device's registered host/IP:port. Needed when a
// terminal behind a home/school router with a dynamic public IP gets a new
// one after a power cycle or the ISP reassigning it — confirmed happening to
// Wonder Kids' terminal (moved from 87.237.234.127:8081 to
// 185.213.230.149:8081 after a restart, with the port-forward rule itself
// unchanged). Re-validates the new address against the device with its
// existing credentials before saving, so a typo or wrong IP is caught
// immediately rather than quietly breaking every subsequent request.
func (s *AttendanceService) UpdateDeviceHost(ctx context.Context, deviceID, newHost string) error {
	device, err := s.GetDevice(ctx, deviceID)
	if err != nil {
		return err
	}

	client := NewHikvisionClient(newHost, device.Username, device.Password)
	if _, err := client.GetDeviceInfo(); err != nil {
		return fmt.Errorf("could not connect to device at new host: %w", err)
	}

	_, err = s.db.GetConn().ExecContext(ctx,
		`UPDATE hikvision_devices SET host = $1, updated_at = $2 WHERE id = $3`,
		newHost, time.Now().UTC(), deviceID)
	return err
}

// UpdateDeviceCredentials changes a device's stored admin username/password.
// Needed when the device's actual live credentials no longer match what's
// saved in the database — confirmed happening to Wonder Kids' terminal:
// after the same disruption that changed its public IP, the device came
// back up answering to an OLDER password than the one on file (the device
// itself was reachable the whole time — CreateUser/UploadFace/UpdateDeviceHost
// all failed with 401, not a connection error, once the new host/DDNS domain
// was reachable). Deliberately does NOT reuse the device's currently-stored
// host for validation — it's called with an explicit host precisely because
// the stored one may also be stale, and validating a new password against a
// wrong host would misreport a credentials problem as a connectivity one (or
// vice versa). Re-validates host+username+password together against the
// device before saving anything, so a typo in either is caught immediately.
func (s *AttendanceService) UpdateDeviceCredentials(ctx context.Context, deviceID, host, username, password string) error {
	device, err := s.GetDevice(ctx, deviceID)
	if err != nil {
		return err
	}
	if host == "" {
		host = device.Host
	}

	client := NewHikvisionClient(host, username, password)
	if _, err := client.GetDeviceInfo(); err != nil {
		return fmt.Errorf("could not authenticate at %s with the given username/password: %w", host, err)
	}

	_, err = s.db.GetConn().ExecContext(ctx,
		`UPDATE hikvision_devices SET host = $1, username = $2, password = $3, updated_at = $4 WHERE id = $5`,
		host, username, password, time.Now().UTC(), deviceID)
	return err
}

// ListActiveDevices returns every active device across all branches — used
// by the background attendance poller in cmd/main.go, which polls every
// device's own event log on a timer regardless of which branch it belongs
// to (see runAttendancePoller and PollAndRecordEvents below for why polling
// exists at all: some terminals can't push events to us, but since we can
// already reach them directly for CreateUser/UploadFace/ConfigurePush,
// polling from right here works just as well and needs no local machine).
func (s *AttendanceService) ListActiveDevices(ctx context.Context) ([]models.HikvisionDevice, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT id, branch_id, name, host, username, password, webhook_token, is_active, created_at, updated_at
		FROM hikvision_devices WHERE is_active = true`)
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
	// Slot 1 on this device family is commonly the factory EHome/Hik-Connect
	// cloud registration (used by the Hikvision mobile app for remote
	// access) — overwriting it could silently break that. Slot 2 is free to
	// use for our own webhook.
	return client.ConfigureHTTPHost(2, publicHost, publicPort, urlPath, useHTTPS)
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
// terminal can actually recognize their face, and — when a storage bucket is
// configured — also keeps a permanent copy there so the CRM can display it
// even if the device is later reset or replaced.
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
	if err := client.UploadFace(emp.EmployeeNo, jpegData); err != nil {
		return err
	}

	// Storing the photo in the bucket is best-effort: the face is already
	// enrolled on the device (the part that matters for attendance), so a
	// bucket hiccup here shouldn't fail the whole request.
	if s.storage != nil {
		key := fmt.Sprintf("employee-photos/%s/%s.jpg", emp.ID, uuid.New().String())
		if err := s.storage.UploadObject(ctx, key, "image/jpeg", jpegData); err != nil {
			log.Printf("warning: failed to store employee photo in bucket: %v", err)
		} else if _, err := s.db.GetConn().ExecContext(ctx,
			`UPDATE hikvision_employees SET photo_key = $1, updated_at = $2 WHERE id = $3`,
			key, time.Now().UTC(), emp.ID); err != nil {
			log.Printf("warning: failed to save employee photo key: %v", err)
		}
	}
	return nil
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
		SELECT id, device_id, employee_no, full_name, teacher_id, photo_key, is_active, created_at, updated_at
		FROM hikvision_employees WHERE id = $1`, id).Scan(
		&e.ID, &e.DeviceID, &e.EmployeeNo, &e.FullName, &e.TeacherID, &e.PhotoKey, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("employee not found")
	}
	if err != nil {
		return nil, err
	}
	s.resolvePhotoURL(e)
	return e, nil
}

func (s *AttendanceService) ListEmployeesByDevice(ctx context.Context, deviceID string) ([]models.HikvisionEmployee, error) {
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT id, device_id, employee_no, full_name, teacher_id, photo_key, is_active, created_at, updated_at
		FROM hikvision_employees WHERE device_id = $1 ORDER BY full_name`, deviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.HikvisionEmployee
	for rows.Next() {
		var e models.HikvisionEmployee
		if err := rows.Scan(&e.ID, &e.DeviceID, &e.EmployeeNo, &e.FullName, &e.TeacherID, &e.PhotoKey, &e.IsActive, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		s.resolvePhotoURL(&e)
		out = append(out, e)
	}
	return out, rows.Err()
}

// -------------------------------------------------------------- Webhook ----

// webhookEventPayload matches the push body Hikvision POSTs for
// AccessControllerEvent notifications. We configure parameterFormatType=XML
// (this device's capabilities don't advertise JSON support at all, matching
// its API always answering in XML — see hikvision_client.go), so the tags
// that matter are the xml ones; the json tags are kept as a fallback for any
// other device model that might genuinely support parameterFormatType=JSON,
// where the field names differ (major/minor vs. majorEventType/subEventType).
type webhookEventPayload struct {
	XMLName               xml.Name `xml:"EventNotificationAlert" json:"-"`
	DateTime              string   `xml:"dateTime" json:"dateTime"`
	AccessControllerEvent struct {
		EmployeeNoString string `xml:"employeeNoString" json:"employeeNoString"`
		Name             string `xml:"name" json:"name"`
		Major            int    `xml:"majorEventType" json:"major"`
		Minor            int    `xml:"subEventType" json:"minor"`
	} `xml:"AccessControllerEvent" json:"AccessControllerEvent"`
}

// ProcessWebhookEvent handles one push notification from the device. Only
// successful face-recognition matches (minorEvent 75) are turned into
// attendance records; everything else (heartbeats, failed attempts, door
// status) is acknowledged and ignored.
func (s *AttendanceService) ProcessWebhookEvent(ctx context.Context, deviceID string, raw []byte) error {
	var payload webhookEventPayload
	trimmed := bytes.TrimSpace(raw)

	var err error
	if bytes.HasPrefix(trimmed, []byte("<")) {
		err = xml.Unmarshal(trimmed, &payload)
	} else {
		err = json.Unmarshal(trimmed, &payload)
	}
	if err != nil {
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

	_, err = s.recordFaceEvent(ctx, deviceID, ace.EmployeeNoString, ace.Minor, eventTime, "push")
	return err
}

// recordFaceEvent inserts one successful face-recognition scan into
// attendance_records, deduped by (device, employeeNo, eventTime) so the same
// physical scan is never recorded twice — which matters once events can
// arrive by two different paths (push webhook and PollAndRecordEvents below)
// that could otherwise both see it. Returns whether a new row was inserted.
func (s *AttendanceService) recordFaceEvent(ctx context.Context, deviceID, employeeNoString string, minor int, eventTime time.Time, source string) (bool, error) {
	var dupCount int
	if err := s.db.GetConn().QueryRowContext(ctx,
		`SELECT COUNT(*) FROM attendance_records WHERE device_id = $1 AND employee_no = $2 AND event_time = $3`,
		deviceID, employeeNoString, eventTime).Scan(&dupCount); err != nil {
		return false, err
	}
	if dupCount > 0 {
		return false, nil
	}

	var employeeID *string
	var id string
	row := s.db.GetConn().QueryRowContext(ctx,
		`SELECT id FROM hikvision_employees WHERE device_id = $1 AND employee_no = $2`,
		deviceID, employeeNoString)
	if err := row.Scan(&id); err == nil {
		employeeID = &id
	}

	eventType, err := s.nextEventType(ctx, deviceID, employeeNoString, eventTime)
	if err != nil {
		return false, err
	}

	_, err = s.db.GetConn().ExecContext(ctx, `
		INSERT INTO attendance_records (id, device_id, employee_id, employee_no, event_time, event_type, minor_event, source, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		uuid.New().String(), deviceID, employeeID, employeeNoString, eventTime, eventType, minor, source, time.Now().UTC())
	if err != nil {
		return false, err
	}
	return true, nil
}

// PollAndRecordEvents fetches access-control events straight from the
// device's own log and records any new successful face scans. This exists
// for terminals that (unlike what ConfigurePush assumes) cannot reach our
// webhook over the internet at all — e.g. a terminal on a school LAN with no
// outbound route, only an inbound port-forward for the admin UI. In that
// case push notifications never arrive no matter how ConfigurePush is
// configured.
//
// This can be driven from two places, and which one applies depends on
// whether *we* can reach the device: cmd/hikvision-cli's watch-events
// command (a machine on the device's own LAN, for a device with no inbound
// port-forward at all — the backend can't dial it either); or, when the
// device DOES have some port forwarded and is reachable from the internet
// (confirmed for Wonder Kids' terminal, since CreateUser/UploadFace/
// ConfigurePush all already call it successfully from Railway), the
// in-process RunEventPoller below, which needs no separate machine at all.
//
// Each call picks up from the latest attendance_records.event_time already
// on file for this device (or 24h ago if there is none yet), so calling it
// repeatedly in a loop is safe and won't reprocess old events; recordFaceEvent
// also dedupes in case both paths ever end up covering the same device.
func (s *AttendanceService) PollAndRecordEvents(ctx context.Context, deviceID string) (int, error) {
	device, err := s.GetDevice(ctx, deviceID)
	if err != nil {
		return 0, err
	}

	since := time.Now().UTC().Add(-24 * time.Hour)
	var lastTime sql.NullTime
	if err := s.db.GetConn().QueryRowContext(ctx,
		`SELECT MAX(event_time) FROM attendance_records WHERE device_id = $1`, deviceID).Scan(&lastTime); err == nil && lastTime.Valid {
		since = lastTime.Time
	}

	client := NewHikvisionClient(device.Host, device.Username, device.Password)
	client.SetTimeout(60 * time.Second) // AcsEvent searches run measurably slower than this device's other endpoints — see SetTimeout's doc comment
	events, err := client.SearchAccessEvents(since, time.Now().UTC(), 200)
	if err != nil {
		return 0, err
	}

	recorded := 0
	for _, ev := range events {
		if ev.EmployeeNoString == "" || ev.Minor != MinorEventFaceSuccess {
			continue
		}
		inserted, err := s.recordFaceEvent(ctx, deviceID, ev.EmployeeNoString, ev.Minor, ev.Time, "poll")
		if err != nil {
			return recorded, err
		}
		if inserted {
			recorded++
		}
	}
	return recorded, nil
}

// RunEventPoller runs PollAndRecordEvents for every active device on a fixed
// interval, forever (or until ctx is cancelled). Meant to be started once at
// backend startup with `go attendanceService.RunEventPoller(ctx, 20*time.Second)`
// — see cmd/main.go. One device erroring (unreachable, wrong credentials,
// temporarily offline) is logged and skipped; it never stops the others from
// being polled on the next tick.
func (s *AttendanceService) RunEventPoller(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.pollAllDevicesOnce(ctx)
		}
	}
}

func (s *AttendanceService) pollAllDevicesOnce(ctx context.Context) {
	devices, err := s.ListActiveDevices(ctx)
	if err != nil {
		log.Printf("attendance poller: failed to list devices: %v", err)
		return
	}
	for _, d := range devices {
		n, err := s.PollAndRecordEvents(ctx, d.ID)
		if err != nil {
			log.Printf("attendance poller: device %q (%s): %v", d.Name, d.ID, err)
			continue
		}
		if n > 0 {
			log.Printf("attendance poller: device %q (%s): recorded %d new event(s)", d.Name, d.ID, n)
		}
	}
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
