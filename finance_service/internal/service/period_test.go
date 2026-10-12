package service

import (
	"errors"
	"testing"
	"time"
)

func TestNormalizeMonth(t *testing.T) {
	for in, want := range map[string]string{"9": "09", "09": "09", " 12 ": "12", "1": "01"} {
		got, err := NormalizeMonth(in)
		if err != nil || got != want {
			t.Errorf("NormalizeMonth(%q)=%q,%v want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"", "0", "13", "abc", "-1"} {
		if _, err := NormalizeMonth(in); !errors.Is(err, ErrInvalidPeriod) {
			t.Errorf("NormalizeMonth(%q) want ErrInvalidPeriod, got %v", in, err)
		}
	}
}

func TestValidateYear(t *testing.T) {
	now := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	if ValidateYear(2026, now) != nil || ValidateYear(2027, now) != nil {
		t.Error("expected 2026/2027 valid")
	}
	if ValidateYear(1999, now) == nil || ValidateYear(2028, now) == nil {
		t.Error("expected 1999/2028 invalid")
	}
}

func TestCheckPeriodWritable(t *testing.T) {
	cases := []struct {
		name          string
		month         string
		year          int
		closed, admin bool
		want          error
	}{
		{"current non-admin", "10", 2026, false, false, nil},
		{"current closed non-admin", "10", 2026, true, false, ErrMonthLocked},
		{"current closed admin", "10", 2026, true, true, nil},
		{"past non-admin", "09", 2026, false, false, ErrMonthLocked},
		{"past admin", "09", 2026, false, true, nil},
		{"past year non-admin", "12", 2025, false, false, ErrMonthLocked},
		{"future admin", "11", 2026, false, true, ErrFuturePeriod},
		{"future non-admin", "01", 2027, false, false, ErrFuturePeriod},
	}
	for _, c := range cases {
		got := CheckPeriodWritable(c.month, c.year, "10", 2026, c.closed, c.admin)
		if !errors.Is(got, c.want) {
			t.Errorf("%s: got %v want %v", c.name, got, c.want)
		}
	}
}

func TestIsAdminRole(t *testing.T) {
	if !IsAdminRole("admin") || IsAdminRole("manager") || IsAdminRole("") {
		t.Error("unexpected IsAdminRole result")
	}
}
