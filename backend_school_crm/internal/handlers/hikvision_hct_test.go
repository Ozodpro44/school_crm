package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/service"
)

type fakeHCTBackend struct {
	secret string
	armed  bool
	err    error
	bodies []string
}

func (f *fakeHCTBackend) ProcessHCTWebhook(_ context.Context, body []byte) (int, error) {
	f.bodies = append(f.bodies, string(body))
	return 1, f.err
}
func (f *fakeHCTBackend) HCTWebhookSecret() string   { return f.secret }
func (f *fakeHCTBackend) HCTVerificationArmed() bool { return f.armed }

func hctRouter(b *fakeHCTBackend) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	RegisterHikvisionHCTWebhookRoutes(r.Group("/api"), b)
	return r
}

func doHCT(r *gin.Engine, method string, headers map[string]string, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, "/api/hikvision/hct/webhook", strings.NewReader(body))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func nowMS() string { return strconv.FormatInt(time.Now().UnixMilli(), 10) }

func TestHCTWebhookVerificationOnlyWhileArmed(t *testing.T) {
	b := &fakeHCTBackend{secret: "S3cretKey"}
	r := hctRouter(b)
	hdr := map[string]string{"X-Hook-Timestamp": nowMS(), "X-Hook-Batch-Id": "abc"}

	// Not armed: refuse, otherwise the endpoint would sign anything an attacker asks.
	if w := doHCT(r, http.MethodGet, hdr, ""); w.Code != http.StatusNotFound || w.Header().Get("X-Hook-Signature") != "" {
		t.Fatalf("unarmed verification must be refused without a signature, got %d", w.Code)
	}

	b.armed = true
	w := doHCT(r, http.MethodGet, hdr, "")
	want := service.HCTSignature("S3cretKey", hdr["X-Hook-Timestamp"], "abc")
	if w.Code != http.StatusOK || w.Header().Get("X-Hook-Signature") != want {
		t.Fatalf("armed verification: code=%d sig=%q want %q", w.Code, w.Header().Get("X-Hook-Signature"), want)
	}
}

func TestHCTWebhookReceive(t *testing.T) {
	b := &fakeHCTBackend{secret: "S3cretKey"}
	r := hctRouter(b)
	body := `{"batchId":"batch-1","list":[]}`
	ts := nowMS()
	good := map[string]string{
		"X-Hook-Timestamp": ts, "X-Hook-Batch-Id": "batch-1",
		"X-Hook-Signature": service.HCTSignature("S3cretKey", ts, "batch-1"),
	}

	if w := doHCT(r, http.MethodPost, good, body); w.Code != http.StatusOK || len(b.bodies) != 1 {
		t.Fatalf("valid push: code=%d processed=%d", w.Code, len(b.bodies))
	}

	// Forged / unsigned / tampered pushes never reach the processor.
	cases := map[string]struct {
		hdr  map[string]string
		body string
		code int
	}{
		"no signature":                      {map[string]string{"X-Hook-Timestamp": ts, "X-Hook-Batch-Id": "batch-1"}, body, http.StatusUnauthorized},
		"wrong secret":                      {map[string]string{"X-Hook-Timestamp": ts, "X-Hook-Batch-Id": "batch-1", "X-Hook-Signature": service.HCTSignature("nope", ts, "batch-1")}, body, http.StatusUnauthorized},
		"stale (replay)":                    {map[string]string{"X-Hook-Timestamp": "1700000000000", "X-Hook-Batch-Id": "batch-1", "X-Hook-Signature": service.HCTSignature("S3cretKey", "1700000000000", "batch-1")}, body, http.StatusUnauthorized},
		"body batch differs from signed id": {good, `{"batchId":"another","list":[]}`, http.StatusBadRequest},
		"body without batch id":             {good, `{"list":[]}`, http.StatusBadRequest},
	}
	for name, c := range cases {
		before := len(b.bodies)
		if w := doHCT(r, http.MethodPost, c.hdr, c.body); w.Code != c.code || len(b.bodies) != before {
			t.Errorf("%s: code=%d (want %d), processed=%v", name, w.Code, c.code, len(b.bodies) != before)
		}
	}
}

func TestHCTWebhookTemporaryFailureAsksForRetry(t *testing.T) {
	b := &fakeHCTBackend{secret: "S3cretKey", err: errors.New("db down")}
	r := hctRouter(b)
	ts := nowMS()
	h := map[string]string{"X-Hook-Timestamp": ts, "X-Hook-Batch-Id": "b", "X-Hook-Signature": service.HCTSignature("S3cretKey", ts, "b")}
	if w := doHCT(r, http.MethodPost, h, `{"batchId":"b","list":[]}`); w.Code != http.StatusInternalServerError {
		t.Fatalf("a processing failure must be non-2xx so the cloud retries, got %d", w.Code)
	}
}

func TestHCTWebhookDisabledWithoutSecret(t *testing.T) {
	r := hctRouter(&fakeHCTBackend{})
	if w := doHCT(r, http.MethodPost, map[string]string{"X-Hook-Signature": "x"}, "{}"); w.Code != http.StatusNotFound {
		t.Fatalf("with no secret configured the endpoint should not exist, got %d", w.Code)
	}
}
