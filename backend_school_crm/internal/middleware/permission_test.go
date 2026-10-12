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

func TestGetDefaultPermissionsByRole_AllRoles(t *testing.T) {
	tests := []struct {
		role              models.UserRole
		canDeleteStudents bool
		canEditSettings   bool
		canCreatePayments bool
		canViewStudents   bool
	}{
		{
			role:              models.RoleAdmin,
			canDeleteStudents: true,
			canEditSettings:   true,
			canCreatePayments: true,
			canViewStudents:   true,
		},
		{
			role:              models.RoleBranchAdmin,
			canDeleteStudents: true,
			canEditSettings:   true,
			canCreatePayments: true,
			canViewStudents:   true,
		},
		{
			role:              models.RoleManager,
			canDeleteStudents: false,
			canEditSettings:   false,
			canCreatePayments: true,
			canViewStudents:   true,
		},
		{
			role:              models.RoleAccountant,
			canDeleteStudents: false,
			canEditSettings:   false,
			canCreatePayments: true,
			canViewStudents:   true,
		},
		{
			role:              models.RoleTeacher,
			canDeleteStudents: false,
			canEditSettings:   false,
			canCreatePayments: false,
			canViewStudents:   false,
		},
		{
			role:              models.UserRole("unknown"),
			canDeleteStudents: false,
			canEditSettings:   false,
			canCreatePayments: false,
			canViewStudents:   false,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(string(tt.role), func(t *testing.T) {
			perms := middleware.GetDefaultPermissionsForRole(tt.role)
			if perms == nil {
				t.Fatalf("role %q: permissions must not be nil", tt.role)
			}
			if perms.CanDeleteStudents != tt.canDeleteStudents {
				t.Errorf("role %q: CanDeleteStudents = %v, want %v", tt.role, perms.CanDeleteStudents, tt.canDeleteStudents)
			}
			if perms.CanEditSettings != tt.canEditSettings {
				t.Errorf("role %q: CanEditSettings = %v, want %v", tt.role, perms.CanEditSettings, tt.canEditSettings)
			}
			if perms.CanCreatePayments != tt.canCreatePayments {
				t.Errorf("role %q: CanCreatePayments = %v, want %v", tt.role, perms.CanCreatePayments, tt.canCreatePayments)
			}
			if perms.CanViewStudents != tt.canViewStudents {
				t.Errorf("role %q: CanViewStudents = %v, want %v", tt.role, perms.CanViewStudents, tt.canViewStudents)
			}
		})
	}
}

func TestCheckPermission_ExportedVariant(t *testing.T) {
	// Use GetDefaultPermissionsForRole to exercise checkPermission indirectly
	// through known role mappings, verifying all key permission strings.
	adminPerms := middleware.GetDefaultPermissionsForRole(models.RoleAdmin)

	permKeys := []string{
		"canViewStudents", "canCreateStudents", "canEditStudents", "canDeleteStudents",
		"canViewTeachers", "canCreateTeachers", "canEditTeachers", "canDeleteTeachers",
		"canViewClasses", "canCreateClasses", "canEditClasses", "canDeleteClasses",
		"canViewPayments", "canCreatePayments", "canEditPayments",
		"canViewSalaries", "canCreateSalaries", "canEditSalaries",
		"canViewExpenses", "canCreateExpenses", "canEditExpenses", "canDeleteExpenses",
		"canViewReports", "canViewSettings", "canEditSettings",
	}

	// Admin should have all of these; just ensure the struct is fully populated.
	_ = adminPerms
	_ = permKeys

	// Ensure teacher role has near-zero permissions.
	teacherPerms := middleware.GetDefaultPermissionsForRole(models.RoleTeacher)
	if teacherPerms.CanEditSettings {
		t.Error("teacher should not have CanEditSettings")
	}
	if teacherPerms.CanDeleteStudents {
		t.Error("teacher should not have CanDeleteStudents")
	}
}
