package service

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/models"
)

// ErrPushDeviceNotFound is returned for an unknown, inactive, or trashed-branch
// push device. Callers answer 404 so serials can't be probed.
var ErrPushDeviceNotFound = errors.New("push device not found")

// ErrPushDeviceUnsupported marks operations that need a direct (ISAPI)
// connection to the device and so can't run against a push device.
var ErrPushDeviceUnsupported = errors.New("this operation is not available for push devices yet")

var pushDeviceIDPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{4,64}$`)

// PushDevice is what the PUSH endpoints need to authenticate and attribute a
// device: its row id, branch, and the credential we issued for it.
type PushDevice struct {
	ID       string
	BranchID string
	DevID    string
	Username string
	Password string
}

// GetPushDevice resolves the DEVID from the request URL to an active push
// device whose branch isn't in the trash.
func (s *HikvisionService) GetPushDevice(ctx context.Context, devID string) (*PushDevice, error) {
	d := &PushDevice{DevID: devID}
	err := s.db.GetConn().QueryRowContext(ctx, `
		SELECT d.id, d.branch_id, COALESCE(d.push_username, ''), COALESCE(d.push_password, '')
		FROM hikvision_devices d
		JOIN branches b ON b.id = d.branch_id AND b.deleted_at IS NULL
		WHERE d.push_device_id = $1 AND d.protocol = 'push' AND d.is_active = true`, devID).
		Scan(&d.ID, &d.BranchID, &d.Username, &d.Password)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrPushDeviceNotFound
	}
	if err != nil {
		return nil, err
	}
	if d.Username == "" || d.Password == "" {
		return nil, ErrPushDeviceNotFound
	}
	return d, nil
}

// PushDeviceCredentials is returned once at creation and again on demand so
// an admin can enter it into the terminal.
type PushDeviceCredentials struct {
	DeviceID string `json:"deviceId"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// CreatePushDevice registers a terminal that will connect to us. The serial
// (DEVID) is whatever the terminal puts in its /iot/{DEVID}/ URLs.
func (s *HikvisionService) CreatePushDevice(ctx context.Context, branchID, name, devID string) (*models.HikvisionDevice, *PushDeviceCredentials, error) {
	devID = strings.TrimSpace(devID)
	if !pushDeviceIDPattern.MatchString(devID) {
		return nil, nil, errors.New("deviceId must be 4-64 characters: letters, digits, '.', '_' or '-'")
	}

	creds := &PushDeviceCredentials{DeviceID: devID, Username: "admin", Password: NewPushPassword()}
	now := time.Now().UTC()
	device := &models.HikvisionDevice{
		ID:           uuid.New().String(),
		BranchID:     branchID,
		Name:         name,
		Username:     "",
		WebhookToken: randomHex(24),
		IsActive:     true,
		CreatedAt:    now,
		UpdatedAt:    now,
		Protocol:     "push",
		PushDeviceID: &devID,
	}

	_, err := s.db.GetConn().ExecContext(ctx, `
		INSERT INTO hikvision_devices
			(id, branch_id, name, host, username, password, webhook_token, is_active, created_at, updated_at,
			 protocol, push_device_id, push_username, push_password)
		VALUES ($1,$2,$3,'','','',$4,true,$5,$5,'push',$6,$7,$8)`,
		device.ID, branchID, name, device.WebhookToken, now, devID, creds.Username, creds.Password)
	if err != nil {
		if strings.Contains(err.Error(), "idx_hikvision_devices_push_device_id") {
			return nil, nil, errors.New("a device with this serial is already registered")
		}
		return nil, nil, err
	}
	return device, creds, nil
}

// GetPushCredentials returns the credential for a push device so an admin can
// re-read it. The handler must have verified branch ownership first.
func (s *HikvisionService) GetPushCredentials(ctx context.Context, deviceID string) (*PushDeviceCredentials, error) {
	c := &PushDeviceCredentials{}
	err := s.db.GetConn().QueryRowContext(ctx, `
		SELECT COALESCE(push_device_id,''), COALESCE(push_username,''), COALESCE(push_password,'')
		FROM hikvision_devices WHERE id = $1 AND protocol = 'push'`, deviceID).
		Scan(&c.DeviceID, &c.Username, &c.Password)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrPushDeviceNotFound
	}
	return c, err
}

// TouchPushDevice records that the device just talked to us.
func (s *HikvisionService) TouchPushDevice(ctx context.Context, deviceID string) error {
	_, err := s.db.GetConn().ExecContext(ctx,
		`UPDATE hikvision_devices SET last_seen_at = now() WHERE id = $1`, deviceID)
	return err
}

// pushEventPayload covers both field spellings seen for access-control events
// in ISAPI-style JSON (majorEventType/subEventType and major/minor).
type pushEventPayload struct {
	DateTime              string `json:"dateTime"`
	EventType             string `json:"eventType"`
	AccessControllerEvent struct {
		EmployeeNoString string `json:"employeeNoString"`
		Major            int    `json:"majorEventType"`
		MajorAlt         int    `json:"major"`
		Minor            int    `json:"subEventType"`
		MinorAlt         int    `json:"minor"`
	} `json:"AccessControllerEvent"`
}

// ProcessPushEvent turns one uploaded event into an attendance record when it
// is a successful face match; everything else is acknowledged and ignored.
// It reports a short outcome string for logging.
func (s *HikvisionService) ProcessPushEvent(ctx context.Context, deviceID string, raw []byte) (string, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return "empty", nil
	}

	if trimmed[0] == '<' {
		if err := s.ProcessWebhookEvent(ctx, deviceID, trimmed); err != nil {
			return "xml-error", err
		}
		return "xml-processed", nil
	}

	var p pushEventPayload
	if err := json.Unmarshal(trimmed, &p); err != nil {
		return "bad-json", fmt.Errorf("invalid push event payload: %w", err)
	}
	ace := p.AccessControllerEvent
	minor := ace.Minor
	if minor == 0 {
		minor = ace.MinorAlt
	}
	if ace.EmployeeNoString == "" || minor != MinorEventFaceSuccess {
		return fmt.Sprintf("ignored(type=%s minor=%d)", p.EventType, minor), nil
	}

	eventTime, err := parseISAPITime(p.DateTime)
	if err != nil {
		eventTime = time.Now().UTC()
	}
	inserted, err := s.recordFaceEvent(ctx, deviceID, ace.EmployeeNoString, minor, eventTime, "push")
	if err != nil {
		return "db-error", err
	}
	if !inserted {
		return "duplicate", nil
	}
	return "recorded", nil
}

// DecodePushEventData normalises an uploaded event's "data" field. The spec
// calls for Base64, while the reference platform notes some firmware omits the
// encoding or the dataFormat, so: decode when the result looks like JSON, XML
// or multipart, otherwise use the field as sent.
func DecodePushEventData(data string) []byte {
	trimmed := strings.TrimSpace(data)
	if trimmed == "" {
		return nil
	}
	if dec, err := base64.StdEncoding.DecodeString(trimmed); err == nil && len(dec) > 0 {
		t := bytes.TrimSpace(dec)
		if len(t) > 0 && (t[0] == '{' || t[0] == '<' || bytes.HasPrefix(t, []byte("--"))) {
			return dec
		}
	}
	return []byte(trimmed)
}

// ExtractPushEventPayload returns the JSON/XML part of a multipart ("boundary")
// event, which also carries the captured face picture; other payloads are
// returned unchanged.
func ExtractPushEventPayload(raw []byte) []byte {
	t := bytes.TrimLeft(raw, " \r\n\t")
	if !bytes.HasPrefix(t, []byte("--")) {
		return raw
	}
	line := t
	if i := bytes.IndexAny(t, "\r\n"); i >= 0 {
		line = t[:i]
	}
	boundary := strings.TrimPrefix(string(line), "--")
	if boundary == "" {
		return raw
	}
	mr := multipart.NewReader(bytes.NewReader(t), boundary)
	for {
		part, err := mr.NextPart()
		if err != nil {
			return raw
		}
		ct := strings.ToLower(part.Header.Get("Content-Type"))
		if strings.Contains(ct, "json") || strings.Contains(ct, "xml") {
			body, err := io.ReadAll(io.LimitReader(part, 1<<20))
			if err == nil {
				return body
			}
		}
	}
}
