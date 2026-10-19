package handler

import "testing"

func TestCanSeeOwnerActivity(t *testing.T) {
	for role, want := range map[string]bool{
		"admin": true, "branch_admin": true, "developer": true, "super_admin": true,
		"manager": false, "accountant": false, "teacher": false, "": false,
	} {
		if got := canSeeOwnerActivity(role); got != want {
			t.Errorf("canSeeOwnerActivity(%q) = %v, want %v", role, got, want)
		}
	}
}
