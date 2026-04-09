package middleware_test

import (
	"testing"

	"github.com/school-crm/backend/internal/middleware"
	"github.com/school-crm/backend/internal/models"
)

// TestGetDefaultPermissionsByRole verifies that role-based defaults are
// correct (Admin → all true; unknown role → all false).
func TestGetDefaultPermissionsByRole(t *testing.T) {
	adminPerms := middleware.GetDefaultPermissionsForRole(models.RoleAdmin)
	if adminPerms == nil {
		t.Fatal("admin permissions should not be nil")
	}
	if !adminPerms.CanViewStudents {
		t.Error("admin should have CanViewStudents")
	}
	if !adminPerms.CanDeleteStudents {
		t.Error("admin should have CanDeleteStudents")
	}
	if !adminPerms.CanEditSettings {
		t.Error("admin should have CanEditSettings")
	}

	unknownPerms := middleware.GetDefaultPermissionsForRole(models.UserRole("ghost"))
	if unknownPerms == nil {
		t.Fatal("unknown role should return empty (non-nil) permissions")
	}
	if unknownPerms.CanViewStudents {
		t.Error("unknown role should not have CanViewStudents")
	}
}
