package service

import (
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBlockedDeviceIP(t *testing.T) {
	cases := []struct {
		ip      string
		blocked bool
	}{
		{"127.0.0.1", true},
		{"::1", true},
		{"169.254.169.254", true}, // cloud metadata (link-local)
		{"0.0.0.0", true},
		{"224.0.0.1", true},
		{"10.0.0.5", true},
		{"172.16.3.4", true},
		{"192.168.0.115", true},
		{"100.64.1.1", true},      // CGNAT, not covered by IsPrivate
		{"fd12:3456::1", true},    // Railway private network (ULA)
		{"87.237.234.127", false}, // a real public terminal address
		{"185.213.230.149", false},
		{"2001:4860:4860::8888", false},
	}
	for _, tc := range cases {
		ip := net.ParseIP(tc.ip)
		if ip == nil {
			t.Fatalf("bad test ip %q", tc.ip)
		}
		if got := blockedDeviceIP(ip); got != tc.blocked {
			t.Errorf("blockedDeviceIP(%s) = %v, want %v", tc.ip, got, tc.blocked)
		}
	}
}

func TestBlockedDeviceIPAllowPrivateOptIn(t *testing.T) {
	t.Setenv("HIKVISION_ALLOW_PRIVATE_HOSTS", "true")
	if blockedDeviceIP(net.ParseIP("192.168.0.115")) {
		t.Error("private LAN address should be allowed with HIKVISION_ALLOW_PRIVATE_HOSTS=true")
	}
	// The opt-in must never re-open loopback or link-local (metadata).
	for _, ip := range []string{"127.0.0.1", "169.254.169.254", "::1"} {
		if !blockedDeviceIP(net.ParseIP(ip)) {
			t.Errorf("%s must stay blocked even with the private-hosts opt-in", ip)
		}
	}
}

// The guard has to hold at connect time, not just in a string check: point a
// client at a live loopback server and confirm the request never lands.
func TestClientRefusesLoopbackHost(t *testing.T) {
	hit := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hit = true
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := NewHikvisionClient(srv.URL, "admin", "pw") // http://127.0.0.1:<port>
	_, err := c.GetDeviceInfo()
	if err == nil {
		t.Fatal("expected an error connecting to a loopback host, got nil")
	}
	if !strings.Contains(err.Error(), "not allowed") {
		t.Errorf("error should come from the dial guard, got: %v", err)
	}
	if hit {
		t.Error("loopback server received a request despite the guard")
	}
}

// A public-looking host must not be able to bounce the client to an internal
// one via a redirect.
func TestClientDoesNotFollowRedirects(t *testing.T) {
	c := newDeviceHTTPClient(0)
	if c.CheckRedirect == nil {
		t.Fatal("device client must set CheckRedirect")
	}
	if err := c.CheckRedirect(nil, nil); err != http.ErrUseLastResponse {
		t.Errorf("CheckRedirect = %v, want http.ErrUseLastResponse", err)
	}
}
