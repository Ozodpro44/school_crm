package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/models"
)

// ErrHCTNotConfigured is returned when HCT_API_KEY / HCT_API_SECRET are not set.
var ErrHCTNotConfigured = errors.New("the Hik-Connect integration is not configured on this server")

var (
	hctSerialPattern     = regexp.MustCompile(`^[A-Za-z0-9]{4,30}$`)
	hctEmployeeNoPattern = regexp.MustCompile(`^[A-Za-z0-9]{1,16}$`)
)

// hctMsgFaceGranted is the message type "Access Granted by Face" (Msg110013).
const (
	hctMsgFaceGranted  = "Msg110013"
	hctEventFaceGrant  = 110013
	hctSignatureSkew   = 2 * time.Minute
	hctSourceTag       = "hct"
	hctUnknownPersonNo = 32 // employee_no column width
)

// SetHCT enables the Hik-Connect integration (nil disables it).
func (s *HikvisionService) SetHCT(c *HCTClient) { s.hct = c }

// HCTWebhookSecret is the key pushed messages are signed with ("" when disabled).
func (s *HikvisionService) HCTWebhookSecret() string {
	if s.hct == nil {
		return ""
	}
	return s.hct.WebhookSecret()
}

// armHCTVerification opens a short window in which the platform's
// URL-verification GET is answered. Outside it the endpoint must refuse:
// answering anyone's GET would sign arbitrary (timestamp, batchId) pairs for
// them — a signing oracle that lets an attacker forge pushed events.
func (s *HikvisionService) armHCTVerification() {
	s.hctMu.Lock()
	s.hctVerifyUntil = time.Now().Add(90 * time.Second)
	s.hctMu.Unlock()
}

// HCTVerificationArmed reports whether a verification GET is currently expected.
func (s *HikvisionService) HCTVerificationArmed() bool {
	s.hctMu.Lock()
	defer s.hctMu.Unlock()
	return time.Now().Before(s.hctVerifyUntil)
}

// HCTEnabled reports whether credentials are configured.
func (s *HikvisionService) HCTEnabled() bool { return s.hct != nil }

// ------------------------------------------------------------- devices ----

type CreateHCTDeviceRequest struct {
	BranchID   string `json:"branchId" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Serial     string `json:"serial" binding:"required"`
	VerifyCode string `json:"verifyCode" binding:"required"`
}

// CreateHCTDevice puts a terminal into our Hik-Connect Team account and
// registers it for the branch. Hikvision validates the verification code, which
// is what proves the caller holds the device — without it any school admin who
// guessed another school's serial could claim its attendance feed.
func (s *HikvisionService) CreateHCTDevice(ctx context.Context, req *CreateHCTDeviceRequest) (*models.HikvisionDevice, error) {
	if s.hct == nil {
		return nil, ErrHCTNotConfigured
	}
	serial := strings.TrimSpace(req.Serial)
	if !hctSerialPattern.MatchString(serial) {
		return nil, errors.New("serial must be 4-30 letters/digits (the short serial printed on the device, e.g. FF7999936)")
	}
	code := strings.TrimSpace(req.VerifyCode)
	if code == "" || len(code) > 30 {
		return nil, errors.New("verification code is required")
	}

	var taken bool
	if err := s.db.GetConn().QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM hikvision_devices WHERE upper(hct_serial) = upper($1))`, serial).Scan(&taken); err != nil {
		return nil, err
	}
	if taken {
		return nil, errors.New("a device with this serial is already registered")
	}

	if err := s.hct.AddDevice(ctx, req.Name, serial, code); err != nil {
		return nil, fmt.Errorf("could not add the device to Hik-Connect: %w", err)
	}
	found, err := s.hct.FindDeviceBySerial(ctx, serial)
	if err != nil {
		return nil, err
	}
	if found == nil {
		return nil, errors.New("the device was not found in the Hik-Connect account after adding it")
	}

	levelID := ""
	if levels, err := s.hct.ListAccessLevels(ctx); err == nil && len(levels) == 1 {
		levelID = levels[0].ID
	}

	now := time.Now().UTC()
	device := &models.HikvisionDevice{
		ID:               uuid.New().String(),
		BranchID:         req.BranchID,
		Name:             req.Name,
		WebhookToken:     randomHex(24),
		IsActive:         true,
		CreatedAt:        now,
		UpdatedAt:        now,
		Protocol:         "hct",
		HCTSerial:        &serial,
		HCTAccessLevelID: levelID,
	}
	_, err = s.db.GetConn().ExecContext(ctx, `
		INSERT INTO hikvision_devices
			(id, branch_id, name, host, username, password, webhook_token, is_active, created_at, updated_at,
			 protocol, hct_serial, hct_access_level_id)
		VALUES ($1,$2,$3,'','','',$4,true,$5,$5,'hct',$6,NULLIF($7,''))`,
		device.ID, device.BranchID, device.Name, device.WebhookToken, now, serial, levelID)
	if err != nil {
		if strings.Contains(err.Error(), "idx_hikvision_devices_hct_serial") {
			return nil, errors.New("a device with this serial is already registered")
		}
		return nil, err
	}
	return device, nil
}

// ----------------------------------------------------------- employees ----

func (s *HikvisionService) hctGroupID(ctx context.Context) (string, error) {
	if id := strings.TrimSpace(os.Getenv("HCT_PERSON_GROUP_ID")); id != "" {
		return id, nil
	}
	s.hctMu.Lock()
	defer s.hctMu.Unlock()
	if s.hctGroup != "" {
		return s.hctGroup, nil
	}
	id, err := s.hct.RootPersonGroupID(ctx)
	if err != nil {
		return "", err
	}
	s.hctGroup = id
	return id, nil
}

// hctAccessLevels picks the access level(s) a new person is given: the
// device's own, else HCT_ACCESS_LEVEL_ID, else the only one that exists.
func (s *HikvisionService) hctAccessLevels(ctx context.Context, d *models.HikvisionDevice) ([]string, error) {
	if d.HCTAccessLevelID != "" {
		return []string{d.HCTAccessLevelID}, nil
	}
	if id := strings.TrimSpace(os.Getenv("HCT_ACCESS_LEVEL_ID")); id != "" {
		return []string{id}, nil
	}
	levels, err := s.hct.ListAccessLevels(ctx)
	if err != nil {
		return nil, err
	}
	switch len(levels) {
	case 1:
		return []string{levels[0].ID}, nil
	case 0:
		return nil, errors.New("no access level exists — create one in the Hik-Connect portal (Access Control → Access Level) and add this door to it")
	default:
		return nil, errors.New("several access levels exist — set HCT_ACCESS_LEVEL_ID so we know which one new staff get")
	}
}

func (s *HikvisionService) addEmployeeHCT(ctx context.Context, device *models.HikvisionDevice, req *AddEmployeeRequest) (*models.HikvisionEmployee, error) {
	if s.hct == nil {
		return nil, ErrHCTNotConfigured
	}
	if !hctEmployeeNoPattern.MatchString(req.EmployeeNo) {
		return nil, errors.New("employee number must be 1-16 letters/digits for Hik-Connect devices")
	}
	groupID, err := s.hctGroupID(ctx)
	if err != nil {
		return nil, err
	}
	levels, err := s.hctAccessLevels(ctx, device)
	if err != nil {
		return nil, err
	}

	personID, err := s.hct.AddPerson(ctx, groupID, req.EmployeeNo, req.FullName)
	if err != nil {
		return nil, fmt.Errorf("Hik-Connect rejected the new employee: %w", err)
	}
	if err := s.hct.AssignAccessLevels(ctx, personID, levels); err != nil {
		_ = s.hct.DeletePerson(ctx, personID) // don't leave a person nobody can open the door with
		return nil, fmt.Errorf("could not give the employee door access: %w", err)
	}

	now := time.Now().UTC()
	emp := &models.HikvisionEmployee{
		ID: uuid.New().String(), DeviceID: device.ID, EmployeeNo: req.EmployeeNo, FullName: req.FullName,
		TeacherID: req.TeacherID, HCTPersonID: &personID, IsActive: true, CreatedAt: now, UpdatedAt: now,
	}
	_, err = s.db.GetConn().ExecContext(ctx, `
		INSERT INTO hikvision_employees (id, device_id, employee_no, full_name, teacher_id, hct_person_id, is_active, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,true,$7,$7)`,
		emp.ID, emp.DeviceID, emp.EmployeeNo, emp.FullName, emp.TeacherID, personID, now)
	if err != nil {
		_ = s.hct.DeletePerson(ctx, personID)
		return nil, err
	}
	return emp, nil
}

func (s *HikvisionService) uploadFaceHCT(ctx context.Context, emp *models.HikvisionEmployee, jpeg []byte) error {
	if s.hct == nil {
		return ErrHCTNotConfigured
	}
	if emp.HCTPersonID == nil || *emp.HCTPersonID == "" {
		return errors.New("this employee has no Hik-Connect person record (it was created before the device was linked)")
	}
	return s.hct.SetPersonPhoto(ctx, *emp.HCTPersonID, jpeg)
}

func (s *HikvisionService) removeEmployeeHCT(ctx context.Context, emp *models.HikvisionEmployee) error {
	if s.hct == nil {
		return ErrHCTNotConfigured
	}
	if emp.HCTPersonID != nil && *emp.HCTPersonID != "" {
		if err := s.hct.DeletePerson(ctx, *emp.HCTPersonID); err != nil {
			return fmt.Errorf("failed to remove from Hik-Connect: %w", err)
		}
	}
	_, err := s.db.GetConn().ExecContext(ctx, `DELETE FROM hikvision_employees WHERE id = $1`, emp.ID)
	return err
}

// -------------------------------------------------------------- webhook ----

// HCTSignature is the X-Hook-Signature value: "sha256=" + hex(HMAC-SHA256(secret, timestamp + "." + batchId)).
func HCTSignature(secret, timestamp, batchID string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "." + batchID))
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

// VerifyHCTSignature checks a pushed message's signature and that its
// timestamp (milliseconds since epoch, per the docs' demo) is fresh, so a
// captured request can't be replayed later.
func VerifyHCTSignature(secret, timestamp, batchID, signature string, now time.Time) error {
	if secret == "" || signature == "" || timestamp == "" {
		return errors.New("missing signature")
	}
	want := HCTSignature(secret, timestamp, batchID)
	if subtle.ConstantTimeCompare([]byte(want), []byte(signature)) != 1 {
		return errors.New("bad signature")
	}
	ms, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return errors.New("bad timestamp")
	}
	// The docs' demo signs System.currentTimeMillis(); tolerate seconds too.
	sent := time.UnixMilli(ms)
	if ms < 1_000_000_000_000 {
		sent = time.Unix(ms, 0)
	}
	if sent.Before(now.Add(-hctSignatureSkew)) || sent.After(now.Add(hctSignatureSkew)) {
		return errors.New("stale timestamp")
	}
	return nil
}

// flexText accepts a JSON string or number (the same field is "110013" in one
// place and 110013 in another).
type flexText string

func (f *flexText) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err == nil {
		*f = flexText(s)
		return nil
	}
	var n json.Number
	if err := json.Unmarshal(b, &n); err != nil {
		return err
	}
	*f = flexText(n.String())
	return nil
}

type hctPush struct {
	BatchID string `json:"batchId"`
	List    []struct {
		Type string `json:"type"`
		Data struct {
			OpenDoorInfo struct {
				Event struct {
					BasicInfo struct {
						EventType    flexText `json:"eventType"`
						OccurTime    string   `json:"occurTime"`
						DeviceSerial string   `json:"deviceSerial"`
					} `json:"basicInfo"`
					IntelliInfo struct {
						PersonID   string `json:"personId"`
						FirstName  string `json:"firstName"`
						LastName   string `json:"lastName"`
						AuthResult int    `json:"authResult"`
					} `json:"intelliInfo"`
				} `json:"event"`
			} `json:"openDoorInfo"`
		} `json:"data"`
	} `json:"list"`
}

// hctFaceEvent is one successful face recognition extracted from a push.
type hctFaceEvent struct {
	Serial   string
	PersonID string
	Name     string
	When     time.Time
}

// parseHCTFaceEvents returns only the successful face-recognition events
// (message 110013 with authResult 1); everything else in the batch is skipped.
func parseHCTFaceEvents(body []byte) ([]hctFaceEvent, error) {
	var push hctPush
	if err := json.Unmarshal(body, &push); err != nil {
		return nil, fmt.Errorf("invalid webhook body: %w", err)
	}
	var out []hctFaceEvent
	for _, item := range push.List {
		ev := item.Data.OpenDoorInfo.Event
		if item.Type != "event" || string(ev.BasicInfo.EventType) != strconv.Itoa(hctEventFaceGrant) || ev.IntelliInfo.AuthResult != 1 {
			continue
		}
		serial := strings.TrimSpace(ev.BasicInfo.DeviceSerial)
		if serial == "" || ev.IntelliInfo.PersonID == "" {
			continue
		}
		when, err := time.Parse(time.RFC3339, ev.BasicInfo.OccurTime)
		if err != nil {
			when = time.Now()
		}
		out = append(out, hctFaceEvent{
			Serial: serial, PersonID: ev.IntelliInfo.PersonID,
			Name: strings.TrimSpace(ev.IntelliInfo.FirstName + " " + ev.IntelliInfo.LastName), When: when.UTC(),
		})
	}
	return out, nil
}

// ProcessHCTWebhook turns a pushed batch into attendance records. Only
// successful face recognitions on a device registered in the CRM count;
// everything else is acknowledged and ignored. A returned error means a
// temporary failure (database): the cloud then retries the batch.
func (s *HikvisionService) ProcessHCTWebhook(ctx context.Context, body []byte) (recorded int, err error) {
	events, err := parseHCTFaceEvents(body)
	if err != nil {
		return 0, err
	}
	for _, ev := range events {
		var deviceID string
		qerr := s.db.GetConn().QueryRowContext(ctx, `
			SELECT d.id FROM hikvision_devices d
			JOIN branches b ON b.id = d.branch_id AND b.deleted_at IS NULL
			WHERE upper(d.hct_serial) = upper($1) AND d.protocol = 'hct' AND d.is_active = true`, ev.Serial).Scan(&deviceID)
		if errors.Is(qerr, sql.ErrNoRows) {
			continue // a device in our account that no school has claimed (yet)
		}
		if qerr != nil {
			return recorded, qerr
		}
		employeeNo, qerr := s.hctEmployeeNo(ctx, deviceID, ev.PersonID, ev.Name)
		if qerr != nil {
			return recorded, qerr
		}
		inserted, qerr := s.recordFaceEvent(ctx, deviceID, employeeNo, MinorEventFaceSuccess, ev.When, hctSourceTag)
		if qerr != nil {
			return recorded, qerr
		}
		if inserted {
			recorded++
		}
	}
	return recorded, nil
}

// hctEmployeeNo maps the platform person id to our employee number. Someone
// added directly in the Hik-Connect portal is unknown to the CRM: create a
// placeholder row (named from the event) so their scans still show up with a name.
func (s *HikvisionService) hctEmployeeNo(ctx context.Context, deviceID, personID, name string) (string, error) {
	var no string
	err := s.db.GetConn().QueryRowContext(ctx,
		`SELECT employee_no FROM hikvision_employees WHERE device_id = $1 AND hct_person_id = $2`, deviceID, personID).Scan(&no)
	if err == nil {
		return no, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	if len(personID) > hctUnknownPersonNo {
		personID = personID[:hctUnknownPersonNo]
	}
	if name == "" {
		name = personID
	}
	now := time.Now().UTC()
	if _, err := s.db.GetConn().ExecContext(ctx, `
		INSERT INTO hikvision_employees (id, device_id, employee_no, full_name, hct_person_id, is_active, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$3,true,$5,$5)
		ON CONFLICT (device_id, employee_no) DO NOTHING`,
		uuid.New().String(), deviceID, personID, name, now); err != nil {
		return "", err
	}
	return personID, nil
}

// ------------------------------------------------------------ bootstrap ----

// RunHCTBootstrap registers our webhook with the platform and subscribes to
// face events. It needs HCT_WEBHOOK_URL (public HTTPS address of
// /api/hikvision/hct/webhook). The cloud calls that URL to verify it, so it
// must run after the server is up — hence the delay and the retries.
func (s *HikvisionService) RunHCTBootstrap(ctx context.Context) {
	if s.hct == nil {
		return
	}
	url := strings.TrimSpace(os.Getenv("HCT_WEBHOOK_URL"))
	if url == "" {
		log.Println("hct: HCT_WEBHOOK_URL not set — webhook registration skipped")
		return
	}
	delay := 15 * time.Second
	for attempt := 1; ; attempt++ {
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
		s.armHCTVerification()
		err := s.hct.SaveWebhook(ctx, url, s.hct.WebhookSecret())
		if err == nil {
			err = s.hct.SubscribeEvents(ctx, []string{hctMsgFaceGranted})
		}
		if err == nil {
			log.Printf("hct: webhook registered and subscribed to %s", hctMsgFaceGranted)
			return
		}
		log.Printf("hct: webhook setup attempt %d failed: %v", attempt, err)
		if delay < 5*time.Minute {
			delay *= 2
		}
	}
}
