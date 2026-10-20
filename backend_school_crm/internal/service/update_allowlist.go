package service

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/school-crm/backend/internal/utils"
)

// ErrInvalidUpdate marks update payloads rejected by an allowlist (unknown or
// forbidden field, empty update, invalid value). Handlers map it to HTTP 400.
var ErrInvalidUpdate = errors.New("invalid update")

// updateRule describes which JSON keys (snake_case after conversion) a generic
// PUT endpoint may write to a table.
type updateRule struct {
	allowed   map[string]bool // writable by every caller
	adminOnly map[string]bool // writable only when isAdmin
	positive  map[string]bool // must be a number > 0
}

func setOf(keys ...string) map[string]bool {
	m := make(map[string]bool, len(keys))
	for _, k := range keys {
		m[k] = true
	}
	return m
}

// buildUpdateSet converts keys to snake_case, validates them against rule and
// returns a deterministic "col = $1, col2 = $2" clause plus its args. Column
// names come exclusively from the allowlist (or the server-controlled extra
// map), never from client input. The WHERE placeholder is len(args)+1.
func buildUpdateSet(raw map[string]interface{}, rule updateRule, isAdmin bool, extra map[string]interface{}) (string, []interface{}, error) {
	if len(raw) == 0 {
		return "", nil, fmt.Errorf("%w: no fields to update", ErrInvalidUpdate)
	}
	updates := utils.ConvertKeysToSnakeCase(raw)

	keys := make([]string, 0, len(updates)+len(extra))
	for k, v := range updates {
		switch {
		case rule.allowed[k]:
		case rule.adminOnly[k]:
			if !isAdmin {
				return "", nil, fmt.Errorf("%w: field %q can only be changed by an admin", ErrInvalidUpdate, k)
			}
		default:
			return "", nil, fmt.Errorf("%w: field %q cannot be updated", ErrInvalidUpdate, k)
		}
		if rule.positive[k] {
			n, ok := toFloat(v)
			if !ok || n <= 0 {
				return "", nil, fmt.Errorf("%w: %s must be greater than 0", ErrInvalidUpdate, k)
			}
		}
		keys = append(keys, k)
	}
	// Server-controlled extras (e.g. updated_at); never from the client.
	for k, v := range extra {
		updates[k] = v
		keys = append(keys, k)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	args := make([]interface{}, 0, len(keys)+1)
	for i, k := range keys {
		parts = append(parts, k+" = $"+strconv.Itoa(i+1))
		args = append(args, updates[k])
	}
	return strings.Join(parts, ", "), args, nil
}

func toFloat(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	}
	return 0, false
}

var (
	paymentUpdateRule = updateRule{
		allowed:   setOf("amount", "payment_method", "status", "notes", "paid_date"),
		adminOnly: setOf("month", "year", "financial_month_id"),
		positive:  setOf("amount"),
	}
	salaryUpdateRule = updateRule{
		allowed:   setOf("amount", "payment_method", "status", "notes", "paid_date"),
		adminOnly: setOf("month", "year", "financial_month_id"),
		positive:  setOf("amount"),
	}
	branchUpdateRule = updateRule{
		allowed:   setOf("name", "address", "phone", "monthly_payment", "currency"),
		adminOnly: setOf("current_financial_month_id", "admin_id"),
	}
	studentUpdateRule = updateRule{
		allowed: setOf("full_name", "class_id", "phone", "parent_phone", "monthly_payment", "status",
			"enrollment_date", "left_date", "class_signed_date", "class_confirmed"),
	}
	classUpdateRule = updateRule{
		allowed: setOf("name", "teacher_id"),
	}
	teacherUpdateRule = updateRule{
		allowed: setOf("full_name", "monthly_salary", "phone", "email", "joined_date"),
	}
	permissionUpdateRule = updateRule{
		allowed: setOf(
			"can_view_students", "can_create_students", "can_edit_students", "can_delete_students",
			"can_view_teachers", "can_create_teachers", "can_edit_teachers", "can_delete_teachers",
			"can_view_classes", "can_create_classes", "can_edit_classes", "can_delete_classes",
			"can_view_payments", "can_create_payments", "can_edit_payments",
			"can_view_salaries", "can_create_salaries", "can_edit_salaries",
			"can_view_expenses", "can_create_expenses", "can_edit_expenses", "can_delete_expenses",
			"can_view_reports", "can_view_settings", "can_edit_settings",
			"can_view_subscriptions", "can_manage_subscriptions",
			"can_view_attendance", "can_view_assignments", "can_send_messages"),
	}
)
