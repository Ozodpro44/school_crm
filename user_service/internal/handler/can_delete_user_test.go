package handler

import (
	"testing"

	"github.com/school-crm/user-service/internal/service"
)

func TestCanDeleteUser(t *testing.T) {
	user := func(id, role string) *service.User { return &service.User{ID: id, Role: role} }
	cases := []struct {
		name       string
		callerID   string
		callerRole string
		target     *service.User
		want       bool
	}{
		{"admin deletes manager", "a1", "admin", user("m1", "manager"), true},
		{"admin deletes branch_admin", "a1", "admin", user("b1", "branch_admin"), true},
		{"admin deletes accountant", "a1", "admin", user("c1", "accountant"), true},
		{"admin cannot delete another admin", "a1", "admin", user("a2", "admin"), false},
		{"admin cannot delete developer", "a1", "admin", user("d1", "developer"), false},
		{"admin cannot delete super_admin", "a1", "admin", user("s1", "super_admin"), false},
		{"admin cannot delete a teacher here", "a1", "admin", user("t1", "teacher"), false},
		{"nobody deletes themselves", "a1", "admin", user("a1", "manager"), false},
		{"branch_admin deletes manager", "b1", "branch_admin", user("m1", "manager"), true},
		{"branch_admin cannot delete branch_admin", "b1", "branch_admin", user("b2", "branch_admin"), false},
		{"branch_admin cannot delete accountant", "b1", "branch_admin", user("c1", "accountant"), false},
		{"manager cannot delete", "m1", "manager", user("m2", "manager"), false},
		{"teacher cannot delete", "t1", "teacher", user("m1", "manager"), false},
		{"developer deletes admin", "d1", "developer", user("a1", "admin"), true},
		{"developer cannot delete self", "d1", "developer", user("d1", "developer"), false},
		{"missing caller id", "", "admin", user("m1", "manager"), false},
	}
	for _, c := range cases {
		if got := canDeleteUser(c.callerID, c.callerRole, c.target); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}
