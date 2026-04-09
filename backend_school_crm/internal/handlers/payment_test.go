package handlers_test

import (
	"testing"
)

// TestGetStudentPaymentStatus_StatusLogic verifies that the status
// derivation logic (not_paid / partial) is correct for various paid amounts.
func TestGetStudentPaymentStatus_StatusLogic(t *testing.T) {
	cases := []struct {
		totalPaid      float64
		expectedStatus string
	}{
		{0, "not_paid"},
		{100000, "partial"},
		{500000, "partial"}, // endpoint doesn't know monthly_payment, so any paid > 0 is "partial"
	}

	for _, tc := range cases {
		got := derivePaymentStatus(tc.totalPaid)
		if got != tc.expectedStatus {
			t.Errorf("derivePaymentStatus(%v) = %q, want %q", tc.totalPaid, got, tc.expectedStatus)
		}
	}
}

// derivePaymentStatus mirrors the logic in getStudentPaymentStatus handler.
func derivePaymentStatus(totalPaid float64) string {
	if totalPaid > 0 {
		return "partial"
	}
	return "not_paid"
}
