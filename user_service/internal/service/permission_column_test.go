package service

import "testing"

func TestPermissionColumn(t *testing.T) {
	cases := map[string]string{
		"canDeleteStudents":      "can_delete_students",
		"can_delete_students":    "can_delete_students",
		"canViewReports":         "can_view_reports",
		"canManageSubscriptions": "can_manage_subscriptions",
		"canDeleteClasses":       "can_delete_classes",
	}
	for in, want := range cases {
		if got := permissionColumn(in); got != want {
			t.Errorf("permissionColumn(%q) = %q, want %q", in, got, want)
		}
	}
}
