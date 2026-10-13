package handlers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

type fakePushBackend struct {
	mu      sync.Mutex
	devices map[string]*service.PushDevice
	touches int
	events  [][]byte
	outcome string
}

func (f *fakePushBackend) GetPushDevice(_ context.Context, devID string) (*service.PushDevice, error) {
	if d, ok := f.devices[devID]; ok {
		return d, nil
	}
	return nil, service.ErrPushDeviceNotFound
}
func (f *fakePushBackend) TouchPushDevice(context.Context, string) error {
	f.mu.Lock()
	f.touches++
	f.mu.Unlock()
	return nil
}
func (f *fakePushBackend) ProcessPushEvent(_ context.Context, _ string, raw []byte) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.events = append(f.events, raw)
	if f.outcome != "" {
		return f.outcome, nil
	}
	return "recorded", nil
}

// fakeDevice plays the terminal's side of the protocol, computing everything
// from what the server tells it, the way real firmware does.
type fakeDevice struct {
	t        *testing.T
	srv      http.Handler
	devID    string
	user     string
	password string
	svcName  string

	salt     string
	rolling  string // last My-Custom-Challenge
	remoteIP string
}

func newTestServer(b PushBackend) http.Handler {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	RegisterHikvisionPushRoutes(r, b)
	return r
}

func (d *fakeDevice) post(action, body string, headers map[string]string, query string) *httptest.ResponseRecorder {
	url := fmt.Sprintf("/iot/%s/global/0-global/model/service/operate/%s/%s%s", d.devID, d.svcName, action, query)
	req := httptest.NewRequest(http.MethodPost, url, strings.NewReader(body))
	req.RemoteAddr = d.remoteIP + ":50000"
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	d.srv.ServeHTTP(w, req)
	return w
}

func (d *fakeDevice) authInfo() (challenge string, iterations int) {
	w := d.post("AuthInfo", `{"data":{"securityVersion":[3,4]}}`, nil, "")
	if w.Code != 200 {
		d.t.Fatalf("AuthInfo status %d: %s", w.Code, w.Body.String())
	}
	var resp struct {
		Data struct {
			Challenge     string `json:"challenge"`
			Salt          string `json:"salt"`
			Iterations    int    `json:"iterations"`
			IsDataEncrypt bool   `json:"isDataEncrypt"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		d.t.Fatal(err)
	}
	if len(resp.Data.Challenge) != 64 || len(resp.Data.Salt) != 64 ||
		resp.Data.Iterations < 500 || resp.Data.Iterations > 5000 {
		d.t.Fatalf("AuthInfo response out of spec: %+v", resp.Data)
	}
	if resp.Data.IsDataEncrypt {
		d.t.Fatal("server must not demand payload encryption")
	}
	d.salt = resp.Data.Salt
	return resp.Data.Challenge, resp.Data.Iterations
}

func (d *fakeDevice) login(challenge string, iterations int, useSHA1 bool) *httptest.ResponseRecorder {
	s256, s1 := service.ExpectedPushLoginPasswords(d.user, d.salt, d.password, challenge, iterations)
	lp := s256
	if useSHA1 {
		lp = s1
	}
	body := fmt.Sprintf(`{"data":{"username":%q,"loginPassword":%q}}`, d.user, lp)
	w := d.post("Login", body, nil, "")
	if w.Code == 200 {
		d.rolling = w.Header().Get("My-Custom-Challenge")
	}
	return w
}

// call sends an authenticated request and rolls the challenge forward.
func (d *fakeDevice) call(action, body string) *httptest.ResponseRecorder {
	auth := service.ExpectedPushCustomAuth(d.user, d.salt, d.password, d.rolling)
	w := d.post(action, body, map[string]string{"My-Custom-Auth": auth}, "")
	if next := w.Header().Get("My-Custom-Challenge"); next != "" {
		d.rolling = next
	}
	return w
}

func setup(t *testing.T, svcName string) (*fakeDevice, *fakePushBackend) {
	b := &fakePushBackend{devices: map[string]*service.PushDevice{
		"FF7999936": {ID: "uuid-1", BranchID: "branch-1", DevID: "FF7999936", Username: "admin", Password: "s3cretPass"},
	}}
	return &fakeDevice{t: t, srv: newTestServer(b), devID: "FF7999936", user: "admin",
		password: "s3cretPass", svcName: svcName, remoteIP: "203.0.113.7"}, b
}

func TestPushFullFlow(t *testing.T) {
	for _, svcName := range []string{"PUSH", "PUSHSDK"} {
		for _, sha1 := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/sha1=%v", svcName, sha1), func(t *testing.T) {
				d, backend := setup(t, svcName)

				ch, it := d.authInfo()
				w := d.login(ch, it, sha1)
				if w.Code != 200 {
					t.Fatalf("login status %d: %s", w.Code, w.Body.String())
				}
				if len(d.rolling) != 64 {
					t.Fatalf("login must return a 64-char My-Custom-Challenge, got %q", d.rolling)
				}
				var lr struct {
					Status int `json:"status"`
					Data   struct {
						CommandInterval int `json:"commandInterval"`
						ErrorDelay      int `json:"errorDelay"`
					} `json:"data"`
				}
				json.Unmarshal(w.Body.Bytes(), &lr)
				if lr.Status != 200 || lr.Data.CommandInterval < 1 || lr.Data.ErrorDelay < 30 {
					t.Errorf("login body out of spec: %s", w.Body.String())
				}

				// Heartbeat, twice: the challenge must have rolled between them.
				first := d.rolling
				w = d.call("CommandRequest", "")
				if w.Code != 200 || !strings.Contains(w.Body.String(), `"commandNum":0`) {
					t.Fatalf("heartbeat: %d %s", w.Code, w.Body.String())
				}
				if d.rolling == first {
					t.Error("server must send a fresh My-Custom-Challenge with every response")
				}
				if w = d.call("CommandRequest", ""); w.Code != 200 {
					t.Fatalf("second heartbeat failed: %d", w.Code)
				}

				// Event upload: Base64 JSON, as the spec describes.
				evJSON := `{"dateTime":"2026-10-08T09:00:00+05:00","eventType":"AccessControllerEvent","AccessControllerEvent":{"employeeNoString":"12","majorEventType":5,"subEventType":75}}`
				body := fmt.Sprintf(`{"eventNum":1,"eventList":[{"UUID":"u-1","dataFormat":"jsonData","data":%q}]}`,
					base64.StdEncoding.EncodeToString([]byte(evJSON)))
				w = d.call("Event", body)
				if w.Code != 200 {
					t.Fatalf("event: %d %s", w.Code, w.Body.String())
				}
				var acks []struct {
					UUID   string `json:"UUID"`
					Status int    `json:"status"`
				}
				if err := json.Unmarshal(w.Body.Bytes(), &acks); err != nil || len(acks) != 1 || acks[0].UUID != "u-1" || acks[0].Status != 200 {
					t.Fatalf("event ack out of spec: %s", w.Body.String())
				}
				if len(backend.events) != 1 || string(backend.events[0]) != evJSON {
					t.Errorf("backend should receive the decoded JSON, got %q", backend.events)
				}

				if w = d.call("Logout", ""); w.Code != 200 {
					t.Fatalf("logout: %d", w.Code)
				}
				if w = d.call("CommandRequest", ""); w.Code != 401 {
					t.Errorf("after logout the session must be rejected, got %d", w.Code)
				}
				if backend.touches == 0 {
					t.Error("login should record the device as seen")
				}
			})
		}
	}
}

func TestPushRejections(t *testing.T) {
	t.Run("unknown device", func(t *testing.T) {
		d, _ := setup(t, "PUSH")
		d.devID = "NOPE0001"
		if w := d.post("AuthInfo", "", nil, ""); w.Code != 404 {
			t.Errorf("unknown DEVID should 404, got %d", w.Code)
		}
	})
	t.Run("wrong password then lockout", func(t *testing.T) {
		d, _ := setup(t, "PUSH")
		d.password = "not-the-password"
		for i := 1; i <= 5; i++ {
			ch, it := d.authInfo()
			w := d.login(ch, it, false)
			if w.Code != 401 {
				t.Fatalf("attempt %d: status %d", i, w.Code)
			}
			var r struct {
				Data struct {
					LockStatus     string `json:"lockStatus"`
					RetryLoginTime int    `json:"retryLoginTime"`
				} `json:"data"`
			}
			json.Unmarshal(w.Body.Bytes(), &r)
			if i < 5 && (r.Data.LockStatus != "unlock" || r.Data.RetryLoginTime != 5-i) {
				t.Errorf("attempt %d: %+v", i, r.Data)
			}
			if i == 5 && r.Data.LockStatus != "lock" {
				t.Errorf("5th failure should lock, got %+v", r.Data)
			}
		}
		// Locked even with the right password...
		d.password = "s3cretPass"
		ch, it := d.authInfo()
		if w := d.login(ch, it, false); w.Code != 401 || !strings.Contains(w.Body.String(), `"lock"`) {
			t.Errorf("locked source must stay locked, got %d %s", w.Code, w.Body.String())
		}
		// ...but a different source address can still log in.
		d.remoteIP = "198.51.100.9"
		ch, it = d.authInfo()
		if w := d.login(ch, it, false); w.Code != 200 {
			t.Errorf("lockout must be per source IP, got %d", w.Code)
		}
	})
	t.Run("login without authinfo", func(t *testing.T) {
		d, _ := setup(t, "PUSH")
		if w := d.post("Login", `{"data":{"username":"admin","loginPassword":"x"}}`, nil, ""); w.Code != 400 {
			t.Errorf("got %d", w.Code)
		}
	})
	t.Run("missing and forged My-Custom-Auth", func(t *testing.T) {
		d, _ := setup(t, "PUSH")
		ch, it := d.authInfo()
		d.login(ch, it, false)
		if w := d.post("CommandRequest", "", nil, ""); w.Code != 400 {
			t.Errorf("missing header: got %d", w.Code)
		}
		if w := d.post("CommandRequest", "", map[string]string{"My-Custom-Auth": strings.Repeat("0", 64)}, ""); w.Code != 401 {
			t.Errorf("forged header: got %d", w.Code)
		}
		// A failed attempt must not have burned the real challenge.
		if w := d.call("CommandRequest", ""); w.Code != 200 {
			t.Errorf("legit request after a forged one failed: %d", w.Code)
		}
	})
	t.Run("encrypted payload is refused loudly", func(t *testing.T) {
		d, _ := setup(t, "PUSH")
		ch, it := d.authInfo()
		d.login(ch, it, false)
		auth := service.ExpectedPushCustomAuth(d.user, d.salt, d.password, d.rolling)
		w := d.post("Event", "garbage", map[string]string{"My-Custom-Auth": auth}, "?security=3&iv=00&random=1")
		if w.Code != 400 || !strings.Contains(w.Body.String(), "not supported") {
			t.Errorf("got %d %s", w.Code, w.Body.String())
		}
	})
	t.Run("unknown service or action", func(t *testing.T) {
		d, _ := setup(t, "NOTPUSH")
		if w := d.post("AuthInfo", "", nil, ""); w.Code != 404 {
			t.Errorf("unknown service: %d", w.Code)
		}
		d.svcName = "PUSH"
		if w := d.post("Bogus", "", nil, ""); w.Code != 404 {
			t.Errorf("unknown action: %d", w.Code)
		}
	})
}

func TestPushEventDatabaseFailureIsRetryable(t *testing.T) {
	d, backend := setup(t, "PUSH")
	ch, it := d.authInfo()
	d.login(ch, it, false)

	backend.outcome = "db-error"
	w := d.call("Event", `{"eventNum":1,"eventList":[{"UUID":"u-9","dataFormat":"jsonData","data":"{}"}]}`)
	var acks []struct {
		Status int `json:"status"`
	}
	json.Unmarshal(w.Body.Bytes(), &acks)
	if len(acks) != 1 || acks[0].Status != 500 {
		t.Errorf("a transient DB failure must NOT be acknowledged as success (device would drop the event), got %s", w.Body.String())
	}

	backend.outcome = "ignored(type=heartbeat minor=0)"
	w = d.call("Event", `{"eventNum":1,"eventList":[{"UUID":"u-10","dataFormat":"jsonData","data":"{}"}]}`)
	json.Unmarshal(w.Body.Bytes(), &acks)
	if len(acks) != 1 || acks[0].Status != 200 {
		t.Errorf("irrelevant events must be acknowledged, got %s", w.Body.String())
	}
}

func TestPushMultipartEvent(t *testing.T) {
	d, backend := setup(t, "PUSH")
	ch, it := d.authInfo()
	d.login(ch, it, false)

	mp := "--MIME_boundary\r\nContent-Type: application/json\r\n\r\n" + `{"eventType":"AccessControllerEvent"}` +
		"\r\n--MIME_boundary\r\nContent-Type: image/jpeg\r\n\r\n\xff\xd8\xff\r\n--MIME_boundary--\r\n"
	var buf bytes.Buffer
	json.NewEncoder(&buf).Encode(map[string]any{"eventNum": 1, "eventList": []map[string]string{
		{"UUID": "m-1", "dataFormat": "boundaryData", "data": base64.StdEncoding.EncodeToString([]byte(mp))},
	}})
	if w := d.call("Event", buf.String()); w.Code != 200 {
		t.Fatalf("status %d", w.Code)
	}
	if len(backend.events) != 1 || string(backend.events[0]) != `{"eventType":"AccessControllerEvent"}` {
		t.Errorf("only the JSON part of a boundary event should reach the backend, got %q", backend.events)
	}
}
