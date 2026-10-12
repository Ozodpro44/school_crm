package service

import (
	"errors"
	"strings"
	"testing"
)

func TestBuildUpdateSet_DeterministicSnakeCase(t *testing.T) {
	raw := map[string]interface{}{"paymentMethod": "cash", "amount": float64(10), "notes": "x"}
	for i := 0; i < 20; i++ {
		clause, args, err := buildUpdateSet(raw, paymentUpdateRule, false, nil)
		if err != nil {
			t.Fatal(err)
		}
		if clause != "amount = $1, notes = $2, payment_method = $3" {
			t.Fatalf("unexpected clause %q", clause)
		}
		if len(args) != 3 {
			t.Fatalf("args = %v", args)
		}
	}
}

func TestBuildUpdateSet_Rejections(t *testing.T) {
	cases := []struct {
		name  string
		rule  updateRule
		raw   map[string]interface{}
		admin bool
	}{
		{"empty", paymentUpdateRule, map[string]interface{}{}, true},
		{"nil", paymentUpdateRule, nil, true},
		{"unknown", paymentUpdateRule, map[string]interface{}{"evil = 1; --": 1}, true},
		{"branch_id", paymentUpdateRule, map[string]interface{}{"branchId": "x"}, true},
		{"created_by", salaryUpdateRule, map[string]interface{}{"createdBy": "x"}, true},
		{"student_id", paymentUpdateRule, map[string]interface{}{"studentId": "x"}, true},
		{"zero amount", paymentUpdateRule, map[string]interface{}{"amount": float64(0)}, true},
		{"negative amount", salaryUpdateRule, map[string]interface{}{"amount": float64(-5)}, true},
		{"string amount", salaryUpdateRule, map[string]interface{}{"amount": "5"}, true},
		{"month non-admin", paymentUpdateRule, map[string]interface{}{"month": "01"}, false},
		{"fm non-admin", salaryUpdateRule, map[string]interface{}{"financialMonthId": "x"}, false},
		{"branch admin_id non-admin", branchUpdateRule, map[string]interface{}{"adminId": "x"}, false},
		{"branch fm non-admin", branchUpdateRule, map[string]interface{}{"currentFinancialMonthId": "x"}, false},
		{"permission user_id", permissionUpdateRule, map[string]interface{}{"userId": "x"}, true},
		{"permission id", permissionUpdateRule, map[string]interface{}{"id": "x"}, true},
	}
	for _, c := range cases {
		_, _, err := buildUpdateSet(c.raw, c.rule, c.admin, nil)
		if !errors.Is(err, ErrInvalidUpdate) {
			t.Errorf("%s: expected ErrInvalidUpdate, got %v", c.name, err)
		}
	}
}

func TestBuildUpdateSet_AdminOnlyAllowedForAdmin(t *testing.T) {
	clause, _, err := buildUpdateSet(map[string]interface{}{"month": "03", "year": float64(2026)}, paymentUpdateRule, true, nil)
	if err != nil {
		t.Fatal(err)
	}
	if clause != "month = $1, year = $2" {
		t.Fatalf("clause = %q", clause)
	}
}

func TestBuildUpdateSet_ExtraAndPermissions(t *testing.T) {
	clause, args, err := buildUpdateSet(map[string]interface{}{"canViewStudents": true}, permissionUpdateRule, true, map[string]interface{}{"updated_at": 1})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(clause, "can_view_students = $1") || !strings.HasSuffix(clause, "updated_at = $2") || len(args) != 2 {
		t.Fatalf("clause=%q args=%v", clause, args)
	}
}
