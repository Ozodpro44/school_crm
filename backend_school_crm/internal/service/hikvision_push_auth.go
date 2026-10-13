package service

import (
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"math/big"
	"sync"
	"time"

	"golang.org/x/crypto/pbkdf2"
)

// OTAP HTTPS PUSH authentication (Hikvision "Push SDK" for access control
// terminals). The device is the HTTP client: it asks for AuthInfo, logs in
// with a PBKDF2-derived password, then proves itself on every later request
// with a rolling My-Custom-Auth header derived from the last
// My-Custom-Challenge we handed back. The formulas below follow the spec and
// the reference platform that ships with the SDK demo:
//
//	inner        = hex(SHA256(username + salt + password))
//	loginPassword= hex(PBKDF2(inner + challenge, salt, iterations, 64, SHA256))
//	               (older "customized" firmware uses SHA1 as the PBKDF2 digest,
//	                so both are accepted)
//	My-Custom-Auth = hex(SHA256(inner + My-Custom-Challenge))
//
// Note the salt enters PBKDF2 as the UTF-8 bytes of its 64-character string,
// not as decoded hex.

const (
	pushChallengeLen = 64
	pushSaltLen      = 64

	pushIterationsMin = 500
	pushIterationsMax = 5000

	// pushLockoutAttempts failed logins from the same IP+device lock that pair
	// out for pushLockoutDuration, as the spec asks the platform to do.
	pushLockoutAttempts = 5
	pushLockoutDuration = 60 * time.Second
)

const alnum = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
const lowerHex = "0123456789abcdef"

func randomFrom(alphabet string, n int) string {
	out := make([]byte, n)
	max := big.NewInt(int64(len(alphabet)))
	for i := range out {
		v, err := rand.Int(rand.Reader, max)
		if err != nil {
			panic("crypto/rand unavailable: " + err.Error())
		}
		out[i] = alphabet[v.Int64()]
	}
	return string(out)
}

// newPushChallenge / newPushSalt: random 64-char alphanumeric strings.
func newPushChallenge() string { return randomFrom(alnum, pushChallengeLen) }
func newPushSalt() string      { return randomFrom(alnum, pushSaltLen) }

// NewPushPassword generates the per-device credential an admin enters into the
// terminal's PUSH configuration.
func NewPushPassword() string { return randomFrom(alnum, 24) }

// newMyCustomChallenge is the rolling value returned in the My-Custom-Challenge
// response header: 64 characters from [0-9a-f].
func newMyCustomChallenge() string { return randomFrom(lowerHex, 64) }

func newPushIterations() int {
	n, err := rand.Int(rand.Reader, big.NewInt(int64(pushIterationsMax-pushIterationsMin)))
	if err != nil {
		panic("crypto/rand unavailable: " + err.Error())
	}
	return pushIterationsMin + int(n.Int64())
}

func pushInner(username, salt, password string) string {
	sum := sha256.Sum256([]byte(username + salt + password))
	return hex.EncodeToString(sum[:])
}

// ExpectedPushLoginPasswords returns the two acceptable loginPassword values
// (SHA256 variant first, then the SHA1 variant used by older customized
// firmware).
func ExpectedPushLoginPasswords(username, salt, password, challenge string, iterations int) (sha256Hex, sha1Hex string) {
	input := []byte(pushInner(username, salt, password) + challenge)
	sha256Hex = hex.EncodeToString(pbkdf2.Key(input, []byte(salt), iterations, 64, sha256.New))
	sha1Hex = hex.EncodeToString(pbkdf2.Key(input, []byte(salt), iterations, 64, sha1.New))
	return sha256Hex, sha1Hex
}

// ExpectedPushCustomAuth is the value a device must send in My-Custom-Auth
// given the challenge we returned in the previous response.
func ExpectedPushCustomAuth(username, salt, password, challenge string) string {
	sum := sha256.Sum256([]byte(pushInner(username, salt, password) + challenge))
	return hex.EncodeToString(sum[:])
}

func constantTimeEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// PushSession is one device's authentication state. It lives in memory: a
// device that loses it simply re-runs AuthInfo/Login, which is exactly what
// the protocol expects after any interruption.
type PushSession struct {
	mu sync.Mutex

	DeviceUUID string // hikvision_devices.id
	Username   string
	Password   string

	salt       string
	challenge  string // login challenge, then the rolling My-Custom-Challenge
	iterations int
	online     bool
	authType   string // "SHA256" | "SHA1"
	lastSeen   time.Time
}

// NewPushSession starts authentication for a device and returns the values for
// the AuthInfo response.
func NewPushSession(deviceUUID, username, password string) (*PushSession, string, string, int) {
	s := &PushSession{
		DeviceUUID: deviceUUID,
		Username:   username,
		Password:   password,
		salt:       newPushSalt(),
		challenge:  newPushChallenge(),
		iterations: newPushIterations(),
		lastSeen:   time.Now(),
	}
	return s, s.challenge, s.salt, s.iterations
}

// Login checks a device's loginPassword. On success the session goes online and
// the first rolling challenge is returned for the response header.
func (s *PushSession) Login(username, loginPassword string) (challenge string, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !constantTimeEqual(username, s.Username) {
		return "", false
	}
	want256, want1 := ExpectedPushLoginPasswords(s.Username, s.salt, s.Password, s.challenge, s.iterations)
	switch {
	case constantTimeEqual(loginPassword, want256):
		s.authType = "SHA256"
	case constantTimeEqual(loginPassword, want1):
		s.authType = "SHA1"
	default:
		return "", false
	}
	s.online = true
	s.challenge = newMyCustomChallenge()
	s.lastSeen = time.Now()
	return s.challenge, true
}

// Verify checks the My-Custom-Auth header of a post-login request and, on
// success, rotates the challenge: every response must carry a fresh one.
func (s *PushSession) Verify(customAuth string) (nextChallenge string, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.online {
		return "", false
	}
	if !constantTimeEqual(customAuth, ExpectedPushCustomAuth(s.Username, s.salt, s.Password, s.challenge)) {
		return "", false
	}
	s.challenge = newMyCustomChallenge()
	s.lastSeen = time.Now()
	return s.challenge, true
}

// Logout marks the session offline.
func (s *PushSession) Logout() {
	s.mu.Lock()
	s.online = false
	s.mu.Unlock()
}

// Online reports whether the device completed login and hasn't logged out.
func (s *PushSession) Online() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.online
}

// AuthType reports which PBKDF2 digest the device used at login.
func (s *PushSession) AuthType() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.authType
}

// PushLockout tracks failed logins per (client IP, device) so one noisy
// source can't brute-force a device credential, without letting an attacker
// lock out the real device from a different address.
type PushLockout struct {
	mu       sync.Mutex
	failures map[string]*lockEntry
	now      func() time.Time
}

type lockEntry struct {
	count       int
	lockedUntil time.Time
}

func NewPushLockout() *PushLockout {
	return &PushLockout{failures: map[string]*lockEntry{}, now: time.Now}
}

// Locked reports whether key is locked and for how many more seconds.
func (l *PushLockout) Locked(key string) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	e := l.failures[key]
	if e == nil || !e.lockedUntil.After(l.now()) {
		return false, 0
	}
	return true, int(e.lockedUntil.Sub(l.now()).Seconds()) + 1
}

// Fail records a failed login and returns whether this one tripped the lock,
// plus how many attempts remain.
func (l *PushLockout) Fail(key string) (justLocked bool, remaining int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	e := l.failures[key]
	if e == nil {
		e = &lockEntry{}
		l.failures[key] = e
	}
	if e.lockedUntil.Before(l.now()) && e.count >= pushLockoutAttempts {
		e.count = 0 // previous lock expired
	}
	e.count++
	if e.count >= pushLockoutAttempts {
		e.lockedUntil = l.now().Add(pushLockoutDuration)
		return true, 0
	}
	return false, pushLockoutAttempts - e.count
}

// Reset clears the failure count after a successful login.
func (l *PushLockout) Reset(key string) {
	l.mu.Lock()
	delete(l.failures, key)
	l.mu.Unlock()
}
