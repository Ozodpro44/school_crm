package service

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Financial-period rules shared (by copy) with teacher_service and
// finance_service. Keep the three period.go files in sync.
//
//   - month is normalised to a zero-padded "01".."12" string; year must be sane.
//   - a period AFTER the branch's current financial month is rejected (future).
//   - a CLOSED period is locked for everyone except admins.
//   - a non-admin may only write the branch's current financial month.
//   - an admin may touch past periods (but never future ones).

// ErrInvalidPeriod is returned for an unparsable month or out-of-range year.
var ErrInvalidPeriod = errors.New("invalid month/year")

// ErrFuturePeriod is returned when the period is after the current financial month.
var ErrFuturePeriod = errors.New("financial_month_future: cannot write to a future financial month")

// NormalizeMonth accepts "9", "09", " 9 " and returns "09". Anything outside
// 1-12 (e.g. "13", "0", "abc") is rejected.
func NormalizeMonth(month string) (string, error) {
	n, err := strconv.Atoi(strings.TrimSpace(month))
	if err != nil || n < 1 || n > 12 {
		return "", fmt.Errorf("%w: month must be 01-12, got %q", ErrInvalidPeriod, month)
	}
	return fmt.Sprintf("%02d", n), nil
}

// ValidateYear rejects years outside [2000, now.Year()+1].
func ValidateYear(year int, now time.Time) error {
	if year < 2000 || year > now.Year()+1 {
		return fmt.Errorf("%w: year %d is out of range", ErrInvalidPeriod, year)
	}
	return nil
}

// IsAdminRole reports whether role may write to past financial months. It
// mirrors the monolith salary handler (admin only) plus the platform roles.
func IsAdminRole(role string) bool {
	switch role {
	case "admin", "developer", "super_admin":
		return true
	default:
		return false
	}
}

// CheckPeriodWritable applies the rule above. month must already be
// normalised. curMonth/curYear is the branch's current financial month and
// closed says whether the target period's financial_months row is CLOSED.
func CheckPeriodWritable(month string, year int, curMonth string, curYear int, closed, isAdmin bool) error {
	m, _ := strconv.Atoi(month)
	cm, _ := strconv.Atoi(curMonth)
	target, current := year*12+m, curYear*12+cm
	if target > current {
		return ErrFuturePeriod
	}
	if closed && !isAdmin {
		return ErrMonthLocked
	}
	if target < current && !isAdmin {
		return ErrMonthLocked
	}
	return nil
}
