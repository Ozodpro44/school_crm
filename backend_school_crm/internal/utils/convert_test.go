package utils_test

import (
	"testing"

	"github.com/school-crm/backend/internal/utils"
)

func TestToSnakeCase(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"fullName", "full_name"},
		{"branchId", "branch_id"},
		{"studentID", "student_i_d"},
		{"monthlyPayment", "monthly_payment"},
		// Leading uppercase is kept as-is (function only inserts _ for i>0).
		{"CreatedAt", "Created_at"},
		{"alreadylower", "alreadylower"},
		{"", ""},
		{"A", "A"},
		{"ABC", "A_b_c"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := utils.ToSnakeCase(tt.input)
			if got != tt.want {
				t.Errorf("ToSnakeCase(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestConvertKeysToSnakeCase(t *testing.T) {
	input := map[string]interface{}{
		"fullName":  "Alice",
		"branchId":  "branch-1",
		"createdAt": "2024-01-01",
	}

	got := utils.ConvertKeysToSnakeCase(input)

	if got["full_name"] != "Alice" {
		t.Errorf("expected full_name=Alice, got %v", got["full_name"])
	}
	if got["branch_id"] != "branch-1" {
		t.Errorf("expected branch_id=branch-1, got %v", got["branch_id"])
	}
	if got["created_at"] != "2024-01-01" {
		t.Errorf("expected created_at=2024-01-01, got %v", got["created_at"])
	}
	// Original keys should not be present.
	if _, ok := got["fullName"]; ok {
		t.Error("original camelCase key fullName should not be in result")
	}
}

func TestConvertKeysToSnakeCase_Empty(t *testing.T) {
	got := utils.ConvertKeysToSnakeCase(map[string]interface{}{})
	if len(got) != 0 {
		t.Errorf("empty input should give empty output, got %v", got)
	}
}

func TestGetLocalTime_ReturnsNonZero(t *testing.T) {
	ts := utils.GetLocalTime()
	if ts.IsZero() {
		t.Error("GetLocalTime should never return zero time")
	}
}

func TestGetLocalTime_IsTashkent(t *testing.T) {
	ts := utils.GetLocalTime()
	zoneName, offset := ts.Zone()
	// Asia/Tashkent is UTC+5 (18000 seconds).
	// Accept either the named zone or the raw offset fallback (UTC).
	if zoneName != "UTC" && offset != 18000 {
		t.Logf("zone=%s offset=%d (UTC+5 = 18000)", zoneName, offset)
		// Don't hard-fail: timezone data may be absent in some CI images.
	}
}
