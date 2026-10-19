package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// Known answer computed independently (Python hmac) for secret "S3cretKey", ts 1700000000000, batch "b1".
func TestHCTSignature(t *testing.T) {
	got := HCTSignature("S3cretKey", "1700000000000", "b1")
	if !strings.HasPrefix(got, "sha256=") || len(got) != len("sha256=")+64 {
		t.Fatalf("unexpected format %q", got)
	}
	if got != HCTSignature("S3cretKey", "1700000000000", "b1") {
		t.Fatal("signature must be deterministic")
	}
	if got == HCTSignature("other", "1700000000000", "b1") || got == HCTSignature("S3cretKey", "1700000000001", "b1") || got == HCTSignature("S3cretKey", "1700000000000", "b2") {
		t.Fatal("signature must depend on secret, timestamp and batch id")
	}
}

func TestVerifyHCTSignature(t *testing.T) {
	now := time.Now()
	ts := time.Now().UnixMilli()
	tsStr := itoa(ts)
	sig := HCTSignature("sec", tsStr, "batch")

	if err := VerifyHCTSignature("sec", tsStr, "batch", sig, now); err != nil {
		t.Fatalf("valid signature rejected: %v", err)
	}
	if err := VerifyHCTSignature("sec", tsStr, "batch", sig, now.Add(10*time.Minute)); err == nil {
		t.Error("a stale timestamp (replay) must be rejected")
	}
	if err := VerifyHCTSignature("sec", tsStr, "other", sig, now); err == nil {
		t.Error("a different batch id must be rejected")
	}
	if err := VerifyHCTSignature("wrong", tsStr, "batch", sig, now); err == nil {
		t.Error("a different secret must be rejected")
	}
	if err := VerifyHCTSignature("sec", tsStr, "batch", "", now); err == nil {
		t.Error("a missing signature must be rejected")
	}
	// Seconds-resolution timestamps are tolerated.
	secStr := itoa(now.Unix())
	if err := VerifyHCTSignature("sec", secStr, "batch", HCTSignature("sec", secStr, "batch"), now); err != nil {
		t.Errorf("seconds timestamp rejected: %v", err)
	}
}

func itoa(n int64) string { b, _ := json.Marshal(n); return string(b) }

// The face-event example from the OpenAPI developer guide (webhook section).
const hctDocExample = `{
  "list": [{
    "data": {"openDoorInfo": {"event": {
      "basicInfo": {"eventType": 110013, "occurTime": "2026-01-30T15:40:07+08:00", "deviceSerial": "FZ8954256", "deviceName": "Face terminal API test"},
      "intelliInfo": {"personId": "549648292066532352", "firstName": "Leong", "lastName": "", "authResult": 1, "attendanceStatus": 0}
    }}},
    "type": "event",
    "basicInfo": {"device": {"deviceSerial": "FZ8954256"}, "eventType": "110013", "occurrenceTime": "2026-01-30T15:40:07+08:00"}
  }],
  "batchId": "406c44ec5ac34d72842f8c724b5c6684"
}`

func TestParseHCTFaceEvents(t *testing.T) {
	evs, err := parseHCTFaceEvents([]byte(hctDocExample))
	if err != nil || len(evs) != 1 {
		t.Fatalf("want 1 event, got %d (err %v)", len(evs), err)
	}
	e := evs[0]
	if e.Serial != "FZ8954256" || e.PersonID != "549648292066532352" || e.Name != "Leong" {
		t.Errorf("unexpected event %+v", e)
	}
	if want := time.Date(2026, 1, 30, 7, 40, 7, 0, time.UTC); !e.When.Equal(want) {
		t.Errorf("time = %v, want %v (UTC)", e.When, want)
	}

	// A failed authentication, a different event type and a non-event are all ignored.
	for name, mut := range map[string]string{
		"auth failed":  `"authResult": 1`,
		"other event":  `"eventType": 110013`,
		"not an event": `"type": "event"`,
		"no person id": `"personId": "549648292066532352"`,
		"no device":    `"deviceSerial": "FZ8954256", "deviceName"`,
	} {
		replacement := map[string]string{
			"auth failed":  `"authResult": 0`,
			"other event":  `"eventType": 110003`,
			"not an event": `"type": "alarm"`,
			"no person id": `"personId": ""`,
			"no device":    `"deviceSerial": "", "deviceName"`,
		}[name]
		body := strings.Replace(hctDocExample, mut, replacement, 1)
		if got, _ := parseHCTFaceEvents([]byte(body)); len(got) != 0 {
			t.Errorf("%s: expected the event to be ignored, got %d", name, len(got))
		}
	}
	if _, err := parseHCTFaceEvents([]byte("not json")); err == nil {
		t.Error("garbage must be an error")
	}
}

// fakeHCT is a minimal Hik-Connect cloud.
func fakeHCT(t *testing.T, tokenCalls *int32, rejectFirstToken bool) *httptest.Server {
	t.Helper()
	var rejected int32
	mux := http.NewServeMux()
	reply := func(w http.ResponseWriter, v any) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(v)
	}
	mux.HandleFunc("/api/hccgw/platform/v1/token/get", func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(tokenCalls, 1)
		var b map[string]string
		_ = json.NewDecoder(r.Body).Decode(&b)
		if b["appKey"] != "AK" || b["secretKey"] != "SK" {
			reply(w, map[string]any{"errorCode": "OPEN300002", "message": "SECRET_KEY_NOT_EQUALS"})
			return
		}
		reply(w, map[string]any{"errorCode": "0", "data": map[string]any{
			"accessToken": "tok-" + itoa(int64(atomic.LoadInt32(tokenCalls))), "expireTime": time.Now().Add(7 * 24 * time.Hour).Unix(),
			"areaDomain": "http://" + r.Host,
		}})
	})
	authed := func(h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if rejectFirstToken && atomic.CompareAndSwapInt32(&rejected, 0, 1) {
				reply(w, map[string]any{"errorCode": "OPEN000006", "message": "Token is invalid"})
				return
			}
			if !strings.HasPrefix(r.Header.Get("Token"), "tok-") {
				reply(w, map[string]any{"errorCode": "OPEN000006", "message": "Token is invalid"})
				return
			}
			h(w, r)
		}
	}
	mux.HandleFunc("/api/hccgw/person/v1/persons/add", authed(func(w http.ResponseWriter, r *http.Request) {
		var b map[string]any
		_ = json.NewDecoder(r.Body).Decode(&b)
		if b["personCode"] != "T001" || b["groupId"] != "G1" {
			reply(w, map[string]any{"errorCode": "VMS1", "message": "bad person"})
			return
		}
		reply(w, map[string]any{"errorCode": "0", "data": map[string]any{"personId": "P123", "personCode": "T001"}})
	}))
	mux.HandleFunc("/api/hccgw/resource/v1/devices/get", authed(func(w http.ResponseWriter, r *http.Request) {
		var b map[string]any
		_ = json.NewDecoder(r.Body).Decode(&b)
		// Mirrors the real platform: a matchKey filter without deviceCategory is a parameter error.
		if b["deviceCategory"] != "accessControllerDevice" {
			reply(w, map[string]any{"errorCode": "OPEN000010", "message": "Parameter verification failed"})
			return
		}
		reply(w, map[string]any{"errorCode": "0", "data": map[string]any{"device": []map[string]any{
			{"id": "d1", "serialNo": "OTHER", "onlineStatus": 1}, {"id": "d2", "serialNo": "ff7999936", "onlineStatus": 1},
		}}})
	}))
	mux.HandleFunc("/api/hccgw/resource/v1/devices/add", authed(func(w http.ResponseWriter, r *http.Request) {
		var b struct {
			DeviceInfo struct {
				Name string `json:"name"`
				Code string `json:"ezvizVerifyCode"`
			} `json:"deviceInfo"`
		}
		_ = json.NewDecoder(r.Body).Decode(&b)
		if b.DeviceInfo.Name == "taken" { // an area with this name already exists
			reply(w, map[string]any{"errorCode": "OPEN000510", "message": "Area name already exist{CCF021103}"})
			return
		}
		if b.DeviceInfo.Code != "goodcode" {
			reply(w, map[string]any{"errorCode": "0", "data": map[string]any{"addDeviceResponse": map[string]any{
				"failed": 1, "deviceList": []map[string]any{{"deviceSerial": "FF7999936", "errorCode": "EVZ20010"}}}}})
			return
		}
		reply(w, map[string]any{"errorCode": "0", "data": map[string]any{"addDeviceResponse": map[string]any{"failed": 0, "succeeded": 1}}})
	}))
	return httptest.NewServer(mux)
}

func TestHCTClientTokenReuseAndPerson(t *testing.T) {
	var tokens int32
	srv := fakeHCT(t, &tokens, false)
	defer srv.Close()
	c := NewHCTClient("AK", "SK", srv.URL, nil)
	ctx := context.Background()

	id, err := c.AddPerson(ctx, "G1", "T001", "Test Teacher")
	if err != nil || id != "P123" {
		t.Fatalf("AddPerson = %q, %v", id, err)
	}
	if _, err := c.FindDeviceBySerial(ctx, "FF7999936"); err != nil {
		t.Fatal(err)
	}
	if n := atomic.LoadInt32(&tokens); n != 1 {
		t.Errorf("token should be fetched once and reused, fetched %d times", n)
	}
}

func TestHCTClientRefreshesRejectedToken(t *testing.T) {
	var tokens int32
	srv := fakeHCT(t, &tokens, true)
	defer srv.Close()
	c := NewHCTClient("AK", "SK", srv.URL, nil)
	if _, err := c.AddPerson(context.Background(), "G1", "T001", "Test Teacher"); err != nil {
		t.Fatalf("a rejected token should be refreshed and the call retried: %v", err)
	}
	if n := atomic.LoadInt32(&tokens); n != 2 {
		t.Errorf("expected a second token request, got %d", n)
	}
}

func TestHCTClientErrors(t *testing.T) {
	var tokens int32
	srv := fakeHCT(t, &tokens, false)
	defer srv.Close()

	bad := NewHCTClient("AK", "WRONG", srv.URL, nil)
	err := bad.AddDevice(context.Background(), "n", "FF7999936", "goodcode")
	var he *HCTError
	if err == nil || !asHCT(err, &he) || he.Code != "OPEN300002" {
		t.Fatalf("wrong secret should surface the platform error, got %v", err)
	}

	c := NewHCTClient("AK", "SK", srv.URL, nil)
	err = c.AddDevice(context.Background(), "n", "FF7999936", "wrongcode")
	if err == nil || !asHCT(err, &he) || he.Code != "EVZ20010" || !strings.Contains(he.Message, "verification code") {
		t.Errorf("a rejected verification code must be an explained error even though the HTTP call succeeded, got %v", err)
	}
	if err := c.AddDevice(context.Background(), "n", "FF7999936", "goodcode"); err != nil {
		t.Errorf("valid code rejected: %v", err)
	}
	if d, err := c.FindDeviceBySerial(context.Background(), "FF7999936"); err != nil || d == nil || d.ID != "d2" {
		t.Errorf("serial lookup must be case-insensitive: %v %v", d, err)
	}
	if d, _ := c.FindDeviceBySerial(context.Background(), "NOPE"); d != nil {
		t.Error("an unknown serial must return nil")
	}
}

func asHCT(err error, target **HCTError) bool {
	for err != nil {
		if e, ok := err.(*HCTError); ok {
			*target = e
			return true
		}
		u, ok := err.(interface{ Unwrap() error })
		if !ok {
			return false
		}
		err = u.Unwrap()
	}
	return false
}

func TestHCTAddDeviceRetriesWhenAreaNameExists(t *testing.T) {
	var tokens int32
	srv := fakeHCT(t, &tokens, false)
	defer srv.Close()
	c := NewHCTClient("AK", "SK", srv.URL, nil)
	// The first attempt (name "taken") fails with OPEN000510; the retry uses "taken FF7999936".
	if err := c.AddDevice(context.Background(), "taken", "FF7999936", "goodcode"); err != nil {
		t.Fatalf("a duplicate area name should be retried under a unique name: %v", err)
	}
}
