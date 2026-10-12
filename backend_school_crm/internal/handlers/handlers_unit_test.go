// White-box unit tests for unexported helpers in the handlers package.
// These run without a DB and are safe in -short mode.
package handlers

import (
	"fmt"
	"testing"
)

// ---- formatPaymentNotifMsg ----

func TestFormatPaymentNotifMsg_Statuses(t *testing.T) {
	tests := []struct {
		amount float64
		month  string
		year   int
		status string
		want   string
	}{
		{500000, "January", 2024, "paid", "Payment of 500000 for January/2024 confirmed as paid"},
		{250000, "February", 2024, "partial", "Payment of 250000 for February/2024 partial payment recorded"},
		{100000, "March", 2024, "not_paid", "Payment of 100000 for March/2024 recorded"},
		{0, "April", 2024, "paid", "Payment of 0 for April/2024 confirmed as paid"},
		{999999, "December", 2025, "", "Payment of 999999 for December/2025 recorded"},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%s/%d/%s", tt.month, tt.year, tt.status), func(t *testing.T) {
			got := formatPaymentNotifMsg(tt.amount, tt.month, tt.year, tt.status)
			if got != tt.want {
				t.Errorf("formatPaymentNotifMsg(%v, %q, %d, %q) = %q, want %q",
					tt.amount, tt.month, tt.year, tt.status, got, tt.want)
			}
		})
	}
}

// ---- convertPermissionKeys ----

func TestConvertPermissionKeys_CamelToSnake(t *testing.T) {
	input := map[string]interface{}{
		"canDeleteTeachers": true,
		"canViewStudents":   false,
		"canEditSettings":   true,
	}

	got := convertPermissionKeys(input)

	cases := map[string]interface{}{
		"can_delete_teachers": true,
		"can_view_students":   false,
		"can_edit_settings":   true,
	}
	for k, want := range cases {
		if v, ok := got[k]; !ok {
			t.Errorf("key %q not found in result", k)
		} else if v != want {
			t.Errorf("key %q = %v, want %v", k, v, want)
		}
	}
}

func TestConvertPermissionKeys_Empty(t *testing.T) {
	got := convertPermissionKeys(map[string]interface{}{})
	if len(got) != 0 {
		t.Errorf("expected empty map, got %v", got)
	}
}

func TestConvertPermissionKeys_AlreadySnake(t *testing.T) {
	input := map[string]interface{}{"can_view_reports": true}
	got := convertPermissionKeys(input)
	if v, ok := got["can_view_reports"]; !ok || v != true {
		t.Errorf("already-snake key should pass through unchanged, got %v", got)
	}
}
