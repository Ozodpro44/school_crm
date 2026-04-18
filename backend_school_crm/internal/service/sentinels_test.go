// Tests for service-layer sentinel errors, constants, and constructors that
// do not require a database connection. Safe to run in -short mode.
package service_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/school-crm/backend/internal/service"
)

// ---- Sentinel errors ----

func TestErrFinancialMonthLocked_NotNil(t *testing.T) {
	if service.ErrFinancialMonthLocked == nil {
		t.Fatal("ErrFinancialMonthLocked must not be nil")
	}
}

func TestErrFinancialMonthLocked_MessageContainsKey(t *testing.T) {
	if !strings.Contains(service.ErrFinancialMonthLocked.Error(), "financial_month_locked") {
		t.Errorf("ErrFinancialMonthLocked message should contain 'financial_month_locked', got: %q",
			service.ErrFinancialMonthLocked.Error())
	}
}

func TestErrSubscriptionLimitReached_NotNil(t *testing.T) {
	if service.ErrSubscriptionLimitReached == nil {
		t.Fatal("ErrSubscriptionLimitReached must not be nil")
	}
}

func TestErrSubscriptionLimitReached_MessageContainsKey(t *testing.T) {
	if !strings.Contains(service.ErrSubscriptionLimitReached.Error(), "subscription_limit_reached") {
		t.Errorf("ErrSubscriptionLimitReached message should contain 'subscription_limit_reached', got: %q",
			service.ErrSubscriptionLimitReached.Error())
	}
}

func TestErrFinancialMonthLocked_IsIdentity(t *testing.T) {
	// errors.Is must match on the exact sentinel.
	if !errors.Is(service.ErrFinancialMonthLocked, service.ErrFinancialMonthLocked) {
		t.Error("errors.Is(ErrFinancialMonthLocked, ErrFinancialMonthLocked) should be true")
	}
}

func TestErrSubscriptionLimitReached_IsIdentity(t *testing.T) {
	if !errors.Is(service.ErrSubscriptionLimitReached, service.ErrSubscriptionLimitReached) {
		t.Error("errors.Is(ErrSubscriptionLimitReached, ErrSubscriptionLimitReached) should be true")
	}
}

// ---- NotifType constants ----

func TestNotifTypeConstants_NotEmpty(t *testing.T) {
	consts := []struct {
		name  string
		value string
	}{
		{"NotifTypePayment", service.NotifTypePayment},
		{"NotifTypeStudent", service.NotifTypeStudent},
		{"NotifTypeSystem", service.NotifTypeSystem},
	}
	for _, c := range consts {
		if c.value == "" {
			t.Errorf("%s must not be empty", c.name)
		}
	}
}

func TestNotifTypeConstants_Distinct(t *testing.T) {
	seen := map[string]bool{}
	for _, v := range []string{
		service.NotifTypePayment,
		service.NotifTypeStudent,
		service.NotifTypeSystem,
	} {
		if seen[v] {
			t.Errorf("duplicate NotifType value: %q", v)
		}
		seen[v] = true
	}
}
