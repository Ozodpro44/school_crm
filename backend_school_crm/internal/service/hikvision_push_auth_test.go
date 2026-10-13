package service

import (
	"strings"
	"testing"
	"time"
)

// Known answers computed with an independent implementation (Python hashlib's
// pbkdf2_hmac / sha256) from the OTAP HTTPS PUSH spec's example values, so the
// Go code is checked against something other than itself.
const (
	kaUser      = "admin"
	kaPassword  = "aksj13579"
	kaSalt      = "e43edaeac631e5db1c331046294a3aee6787bea7d0a72b36ff405b83e4e6f9f3"
	kaChallenge = "15f1739e9a465cc048575b7d39a312fd54364399739e9a465cc048575b798753"
	kaRolling   = "20678a373b5bc316149a7027422d1e8820678a373b5bc316149a7027422d1e88"
	kaIter      = 500

	kaLogin256 = "1f689da66392e9c33d53074a2ea06aad59a13064a50bb71683a04527a4d1ec198512f83a74b025f49a51464f504cea965bd449fb93f531316fdc12103bfefa12"
	kaLogin1   = "a9aed7f0ecf621c7fdf4adf79523ac59f305f2d36a22d3aaca6add7aa8437dd55b238c3247b33aab70274d0a85279532f0d06b6f8638642b11827aa867830c59"
	kaCustom   = "08b2889589f753866ad66016fd664f1506c0882b08935a9f5d8e74dcf796c72b"
)

func TestPushKnownAnswers(t *testing.T) {
	s256, s1 := ExpectedPushLoginPasswords(kaUser, kaSalt, kaPassword, kaChallenge, kaIter)
	if s256 != kaLogin256 {
		t.Errorf("SHA256 loginPassword = %s, want %s", s256, kaLogin256)
	}
	if s1 != kaLogin1 {
		t.Errorf("SHA1 loginPassword = %s, want %s", s1, kaLogin1)
	}
	if got := ExpectedPushCustomAuth(kaUser, kaSalt, kaPassword, kaRolling); got != kaCustom {
		t.Errorf("My-Custom-Auth = %s, want %s", got, kaCustom)
	}
}

func TestPushRandomShapes(t *testing.T) {
	if c := newPushChallenge(); len(c) != 64 {
		t.Errorf("challenge length %d", len(c))
	}
	if s := newPushSalt(); len(s) != 64 {
		t.Errorf("salt length %d", len(s))
	}
	if m := newMyCustomChallenge(); len(m) != 64 || strings.Trim(m, lowerHex) != "" {
		t.Errorf("My-Custom-Challenge must be 64 chars of [0-9a-f], got %q", m)
	}
	for i := 0; i < 200; i++ {
		if it := newPushIterations(); it < pushIterationsMin || it > pushIterationsMax {
			t.Fatalf("iterations %d out of [%d,%d]", it, pushIterationsMin, pushIterationsMax)
		}
	}
	if a, b := NewPushPassword(), NewPushPassword(); len(a) != 24 || a == b {
		t.Errorf("passwords should be 24 chars and unique, got %q %q", a, b)
	}
}

func TestPushSessionFlow(t *testing.T) {
	for _, variant := range []string{"SHA256", "SHA1"} {
		t.Run(variant, func(t *testing.T) {
			s, challenge, salt, iters := NewPushSession("dev-uuid", "admin", "secret-pass")
			a256, a1 := ExpectedPushLoginPasswords("admin", salt, "secret-pass", challenge, iters)
			login := a256
			if variant == "SHA1" {
				login = a1
			}

			if _, ok := s.Login("admin", "wrong"); ok {
				t.Fatal("wrong password must not log in")
			}
			if _, ok := s.Login("someone", login); ok {
				t.Fatal("wrong username must not log in")
			}
			rolling, ok := s.Login("admin", login)
			if !ok {
				t.Fatal("correct login rejected")
			}
			if s.AuthType() != variant {
				t.Errorf("AuthType = %s, want %s", s.AuthType(), variant)
			}

			// Each request must prove knowledge of the *latest* challenge.
			auth1 := ExpectedPushCustomAuth("admin", salt, "secret-pass", rolling)
			next, ok := s.Verify(auth1)
			if !ok {
				t.Fatal("valid My-Custom-Auth rejected")
			}
			if next == rolling {
				t.Error("challenge must rotate after every request")
			}
			if _, ok := s.Verify(auth1); ok {
				t.Error("replaying a used My-Custom-Auth must fail")
			}
			if _, ok := s.Verify(ExpectedPushCustomAuth("admin", salt, "secret-pass", next)); !ok {
				t.Error("auth built from the rotated challenge should pass")
			}

			s.Logout()
			if _, ok := s.Verify("anything"); ok || s.Online() {
				t.Error("a logged-out session must reject requests")
			}
		})
	}
}

func TestPushVerifyRequiresLogin(t *testing.T) {
	s, _, salt, _ := NewPushSession("d", "admin", "pw")
	if _, ok := s.Verify(ExpectedPushCustomAuth("admin", salt, "pw", "x")); ok {
		t.Error("an unauthenticated session must not verify")
	}
}

func TestPushLockout(t *testing.T) {
	l := NewPushLockout()
	now := time.Now()
	l.now = func() time.Time { return now }
	key := "1.2.3.4|DEV1"

	for i := 1; i < pushLockoutAttempts; i++ {
		locked, remaining := l.Fail(key)
		if locked || remaining != pushLockoutAttempts-i {
			t.Fatalf("attempt %d: locked=%v remaining=%d", i, locked, remaining)
		}
	}
	if locked, _ := l.Fail(key); !locked {
		t.Fatal("the 5th failure should lock")
	}
	if locked, secs := l.Locked(key); !locked || secs <= 0 {
		t.Fatalf("should report locked with time left, got %v %d", locked, secs)
	}
	// A different source address is unaffected.
	if locked, _ := l.Locked("9.9.9.9|DEV1"); locked {
		t.Error("another IP must not inherit the lock")
	}

	now = now.Add(pushLockoutDuration + time.Second)
	if locked, _ := l.Locked(key); locked {
		t.Error("lock should expire")
	}
	if locked, remaining := l.Fail(key); locked || remaining != pushLockoutAttempts-1 {
		t.Errorf("after expiry the counter should restart, got locked=%v remaining=%d", locked, remaining)
	}
	l.Reset(key)
	if _, remaining := l.Fail(key); remaining != pushLockoutAttempts-1 {
		t.Errorf("Reset should clear failures, remaining=%d", remaining)
	}
}

func TestDecodePushEventData(t *testing.T) {
	const j = `{"dateTime":"2026-10-08T09:00:00+05:00"}`
	// base64 of j
	b64 := "eyJkYXRlVGltZSI6IjIwMjYtMTAtMDhUMDk6MDA6MDArMDU6MDAifQ=="
	if got := string(DecodePushEventData(b64)); got != j {
		t.Errorf("base64 JSON: got %q", got)
	}
	if got := string(DecodePushEventData(j)); got != j {
		t.Errorf("raw JSON should pass through, got %q", got)
	}
	if got := string(DecodePushEventData("  <a/>  ")); got != "<a/>" {
		t.Errorf("raw XML should be trimmed, got %q", got)
	}
	if DecodePushEventData("   ") != nil {
		t.Error("blank data should decode to nil")
	}
}

func TestExtractPushEventPayload(t *testing.T) {
	multipartBody := "--MIME_boundary\r\n" +
		"Content-Disposition: form-data; name=\"AccessControllerEvent\";\r\n" +
		"Content-Type: application/json\r\n\r\n" +
		`{"x":1}` + "\r\n" +
		"--MIME_boundary\r\n" +
		"Content-Disposition: form-data; name=\"Picture\";\r\n" +
		"Content-Type: image/jpeg\r\n\r\n" +
		"\xff\xd8\xff\r\n" +
		"--MIME_boundary--\r\n"
	if got := string(ExtractPushEventPayload([]byte(multipartBody))); got != `{"x":1}` {
		t.Errorf("multipart: got %q", got)
	}
	if got := string(ExtractPushEventPayload([]byte(`{"plain":true}`))); got != `{"plain":true}` {
		t.Errorf("non-multipart payloads must be unchanged, got %q", got)
	}
}
