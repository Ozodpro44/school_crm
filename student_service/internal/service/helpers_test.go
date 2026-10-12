package service

import (
	"database/sql"
	"errors"
	"strings"
	"testing"
)

func TestLimitExceeded(t *testing.T) {
	cases := []struct {
		name    string
		current int
		max     sql.NullInt64
		want    bool
	}{
		{"unlimited", 1000, sql.NullInt64{}, false},
		{"below", 4, sql.NullInt64{Int64: 5, Valid: true}, false},
		{"at limit blocks", 5, sql.NullInt64{Int64: 5, Valid: true}, true},
		{"above", 9, sql.NullInt64{Int64: 5, Valid: true}, true},
		{"zero max blocks", 0, sql.NullInt64{Int64: 0, Valid: true}, true},
	}
	for _, c := range cases {
		if got := limitExceeded(c.current, c.max); got != c.want {
			t.Errorf("%s: got %v want %v", c.name, got, c.want)
		}
	}
}

func TestLimitErrorWrapsSentinel(t *testing.T) {
	err := limitError("students", 5, 5)
	if !errors.Is(err, ErrLimitReached) {
		t.Fatal("limitError must wrap ErrLimitReached")
	}
	if !strings.Contains(err.Error(), "students limit is 5") {
		t.Fatalf("detail missing: %v", err)
	}
	if ErrLimitReached.Error() != "subscription_limit_reached" {
		t.Fatal("sentinel text must match monolith's error code")
	}
}

func TestEscapeLike(t *testing.T) {
	cases := map[string]string{
		"abc":      "abc",
		"100%":     `100\%`,
		"a_b":      `a\_b`,
		`back\sl`:  `back\\sl`,
		`%_\`:      `\%\_\\`,
		"":         "",
		"Алишер_1": `Алишер\_1`,
	}
	for in, want := range cases {
		if got := escapeLike(in); got != want {
			t.Errorf("escapeLike(%q) = %q want %q", in, got, want)
		}
	}
	if got := likeContains("a%"); got != `%a\%%` {
		t.Errorf("likeContains = %q", got)
	}
}

func TestCursorRoundTrip(t *testing.T) {
	for _, name := range []string{"Ali", "Ali Valiyev", "Қодир Ӯ", "has\x01ctrl", "", "a\x00b"} {
		id := "0b6f6a0e-6c0e-4a39-9a4b-0b5f5a3f9d11"
		tok := encodeCursor(name, id)
		n, i, ok := decodeCursor(tok)
		if !ok || i != id || n != name {
			t.Errorf("round trip %q: got (%q,%q,%v)", name, n, i, ok)
		}
	}
}

func TestDecodeCursorRejectsGarbage(t *testing.T) {
	for _, tok := range []string{"Ali Valiyev", "!!!", "", "bm9udWxsc2VwYXJhdG9y"} {
		if _, _, ok := decodeCursor(tok); ok {
			t.Errorf("decodeCursor(%q) should be rejected", tok)
		}
	}
}

func TestCursorDistinguishesEqualNames(t *testing.T) {
	a := encodeCursor("Ali", "id-1")
	b := encodeCursor("Ali", "id-2")
	if a == b {
		t.Fatal("equal names must yield different cursors via id tiebreak")
	}
}

func TestParseDateYMD(t *testing.T) {
	if d, err := parseDateYMD("2026-02-28"); err != nil || d != "2026-02-28" {
		t.Fatalf("valid date rejected: %v %v", d, err)
	}
	for _, bad := range []string{"", "2026-2-8", "2026-02-30", "28/02/2026", "2026-02-28T10:00:00Z", "tomorrow"} {
		_, err := parseDateYMD(bad)
		if !errors.Is(err, ErrInvalidInput) {
			t.Errorf("parseDateYMD(%q) err = %v, want ErrInvalidInput", bad, err)
		}
	}
}

func TestValidateAttendanceStatus(t *testing.T) {
	for _, ok := range []string{"present", "absent", "late"} {
		if err := validateAttendanceStatus(ok); err != nil {
			t.Errorf("%s rejected: %v", ok, err)
		}
	}
	for _, bad := range []string{"", "Present", "excused", "x'; DROP"} {
		if err := validateAttendanceStatus(bad); !errors.Is(err, ErrInvalidInput) {
			t.Errorf("%q should be ErrInvalidInput, got %v", bad, err)
		}
	}
}

func TestInBranchRejectsUnknownTable(t *testing.T) {
	if _, err := inBranch(nil, nil, "users; DROP TABLE x", "1", "2"); err == nil {
		t.Fatal("non-whitelisted table must be rejected")
	}
}
