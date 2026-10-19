package service

import (
	"reflect"
	"strings"
	"testing"
)

// UserService.Update (profile edits) once ended up with the permission-flag
// logic - "must be a boolean" on every string field - because a find/replace
// hit the wrong loop. These tests pin both callers' behaviour.

var profileAllowed = map[string]bool{
	"full_name": true, "phone": true, "avatar_url": true, "language": true, "organization_name": true,
}

func TestBuildSetClauses_ProfileAcceptsStrings(t *testing.T) {
	parts, args, err := buildSetClauses(map[string]interface{}{
		"full_name": "Ali Valiyev",
		"phone":     "+998901234567",
		"role":      "super_admin", // not allowed: must be ignored
		"id":        "x",
	}, profileAllowed, nil, false)
	if err != nil {
		t.Fatalf("string profile fields must be accepted: %v", err)
	}
	if want := []string{"full_name = $1", "phone = $2"}; !reflect.DeepEqual(parts, want) {
		t.Errorf("parts = %v, want %v", parts, want)
	}
	if want := []interface{}{"Ali Valiyev", "+998901234567"}; !reflect.DeepEqual(args, want) {
		t.Errorf("args = %v, want %v", args, want)
	}
}

func TestBuildSetClauses_PermissionsCamelCaseBoolOnly(t *testing.T) {
	allowed := map[string]bool{"can_view_reports": true, "can_delete_students": true}
	parts, args, err := buildSetClauses(map[string]interface{}{
		"canViewReports":    false,
		"canDeleteStudents": true,
		"id":                "uuid",    // ignored
		"userId":            "user-id", // ignored
		"canHackTheDB; --":  true,      // not in the allowlist
	}, allowed, permissionColumn, true)
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"can_delete_students = $1", "can_view_reports = $2"}; !reflect.DeepEqual(parts, want) {
		t.Errorf("parts = %v, want %v", parts, want)
	}
	if want := []interface{}{true, false}; !reflect.DeepEqual(args, want) {
		t.Errorf("args = %v, want %v", args, want)
	}
	for _, p := range parts {
		if strings.ContainsAny(p, ";-") {
			t.Errorf("unsafe fragment %q", p)
		}
	}
}

func TestBuildSetClauses_PermissionsRejectNonBool(t *testing.T) {
	allowed := map[string]bool{"can_view_reports": true}
	if _, _, err := buildSetClauses(map[string]interface{}{"canViewReports": "yes"}, allowed, permissionColumn, true); err == nil {
		t.Error("non-boolean permission value must be rejected")
	}
}

func TestBuildSetClauses_Empty(t *testing.T) {
	parts, args, err := buildSetClauses(map[string]interface{}{"unknown": 1}, profileAllowed, nil, false)
	if err != nil || len(parts) != 0 || len(args) != 0 {
		t.Errorf("unknown keys only: parts=%v args=%v err=%v", parts, args, err)
	}
}
