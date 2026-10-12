package handler

import (
	"net/http"
	"testing"

	"github.com/school-crm/user-service/internal/service"
)

func TestCanResetOthersPassword(t *testing.T) {
	for role, want := range map[string]bool{
		"admin": true, "branch_admin": true, "super_admin": true, "developer": true,
		"manager": false, "teacher": false, "accountant": false, "": false,
	} {
		if got := canResetOthersPassword(role); got != want {
			t.Errorf("role %q: got %v want %v", role, got, want)
		}
	}
}

func TestPasswordChangeStatus(t *testing.T) {
	cases := map[error]int{
		service.ErrPasswordTooShort:    http.StatusBadRequest,
		service.ErrCurrentPassRequired: http.StatusBadRequest,
		service.ErrInvalidCurrentPass:  http.StatusForbidden,
		service.ErrNotFound:            http.StatusNotFound,
	}
	for err, want := range cases {
		if got, _ := passwordChangeStatus(err); got != want {
			t.Errorf("%v: got %d want %d", err, got, want)
		}
	}
}
