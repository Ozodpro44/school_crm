package service

// White-box tests for payment method utility functions.
// These use `package service` (not service_test) because the functions are unexported.

import "testing"

func TestNormalizeStudentPaymentMethod(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"cash", "cash"},
		{"CASH", "cash"},
		{"  cash  ", "cash"},
		{"bank", "bank"},
		{"BANK", "bank"},
		{"card", "click"},   // card normalises to click
		{"click", "click"},
		{"CLICK", "click"},
		{"terminal", "terminal"},
		{"TERMINAL", "terminal"},
		{"unknown_method", "unknown_method"},
		{"", ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := normalizeStudentPaymentMethod(tt.input)
			if got != tt.want {
				t.Errorf("normalizeStudentPaymentMethod(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestStudentPaymentMethodFilterValues(t *testing.T) {
	tests := []struct {
		method string
		want   []string
	}{
		{"cash", []string{"cash"}},
		{"bank", []string{"bank"}},
		{"terminal", []string{"terminal"}},
		// card and click both map to click group
		{"card", []string{"click", "card"}},
		{"click", []string{"click", "card"}},
		// empty returns nil
		{"", nil},
	}

	for _, tt := range tests {
		t.Run(tt.method, func(t *testing.T) {
			got := studentPaymentMethodFilterValues(tt.method)
			if len(got) != len(tt.want) {
				t.Errorf("studentPaymentMethodFilterValues(%q) = %v, want %v", tt.method, got, tt.want)
				return
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("studentPaymentMethodFilterValues(%q)[%d] = %q, want %q", tt.method, i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestNewStudentPaymentMethodTotals(t *testing.T) {
	totals := newStudentPaymentMethodTotals()
	if totals == nil {
		t.Fatal("totals map must not be nil")
	}
	keys := []string{"click", "cash", "bank", "terminal"}
	for _, k := range keys {
		if _, ok := totals[k]; !ok {
			t.Errorf("expected key %q in totals", k)
		}
		if totals[k] != 0 {
			t.Errorf("initial value for %q should be 0, got %v", k, totals[k])
		}
	}
}

func TestAddStudentPaymentAmountByMethod(t *testing.T) {
	totals := newStudentPaymentMethodTotals()

	addStudentPaymentAmountByMethod(totals, "cash", 100000)
	addStudentPaymentAmountByMethod(totals, "cash", 50000)
	addStudentPaymentAmountByMethod(totals, "bank", 200000)
	addStudentPaymentAmountByMethod(totals, "card", 75000) // normalises to click

	if totals["cash"] != 150000 {
		t.Errorf("cash total = %v, want 150000", totals["cash"])
	}
	if totals["bank"] != 200000 {
		t.Errorf("bank total = %v, want 200000", totals["bank"])
	}
	if totals["click"] != 75000 {
		t.Errorf("click total = %v, want 75000 (card normalised to click)", totals["click"])
	}
}

func TestAddStudentPaymentAmountByMethod_EmptyMethodIgnored(t *testing.T) {
	totals := newStudentPaymentMethodTotals()
	// empty method should not panic and should not change totals
	addStudentPaymentAmountByMethod(totals, "", 999)
	for k, v := range totals {
		if v != 0 {
			t.Errorf("key %q should be 0, got %v", k, v)
		}
	}
}
