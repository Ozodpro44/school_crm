package middleware

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/school-crm/backend/internal/models"
	"github.com/school-crm/backend/internal/service"
)

// PermissionChecker checks if user has required permission
func PermissionChecker(userService *service.UserService, requiredPermission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := GetUserID(c)
		if err != nil {
			log.Printf("[PermissionChecker] Failed to get user ID: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		user, err := userService.GetByID(c.Request.Context(), userID)
		if err != nil {
			log.Printf("[PermissionChecker] Failed to fetch user %s: %v", userID, err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found - please log in again"})
			c.Abort()
			return
		}
		
		if user == nil {
			log.Printf("[PermissionChecker] User %s is nil", userID)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found - please log in again"})
			c.Abort()
			return
		}

		log.Printf("[PermissionChecker] User %s (role: %s) checking permission: %s", user.ID, user.Role, requiredPermission)

		// Admin has all permissions
		if user.Role == models.RoleAdmin {
			log.Printf("[PermissionChecker] User %s is admin, allowing all permissions", user.ID)
			c.Next()
			return
		}

		// Branch admin also gets full access for now
		if user.Role == models.RoleBranchAdmin {
			log.Printf("[PermissionChecker] User %s is branch_admin, allowing all permissions", user.ID)
			c.Next()
			return
		}

		// Check if user has permissions - if not, try to create defaults
		if user.Permissions == nil {
			log.Printf("[PermissionChecker] User %s has no permissions, creating defaults for role: %s", user.ID, user.Role)
			permissionService := service.NewPermissionService(userService.GetDB())
			perms, err := permissionService.CreateForUser(c.Request.Context(), userID)
			if err != nil {
				log.Printf("[PermissionChecker] Failed to create permissions for user %s: %v - using role-based defaults", user.ID, err)
				// Use role-based defaults instead of blocking
				user.Permissions = getDefaultPermissionsByRole(user.Role)
			} else {
				log.Printf("[PermissionChecker] Created permissions for user %s", user.ID)
				user.Permissions = perms
			}
		}
		
		// Ensure permissions are not nil (fallback to defaults)
		if user.Permissions == nil {
			log.Printf("[PermissionChecker] User %s permissions still nil, using role defaults", user.ID)
			user.Permissions = getDefaultPermissionsByRole(user.Role)
		}

		// Check the specific permission
		hasPermission := checkPermission(user.Permissions, requiredPermission)
		log.Printf("[PermissionChecker] User %s permission check for %s: %v", user.ID, requiredPermission, hasPermission)
		
		if !hasPermission {
			log.Printf("[PermissionChecker] User %s denied - insufficient permissions for %s (permissions: %+v)", user.ID, requiredPermission, user.Permissions)
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			c.Abort()
			return
		}

		log.Printf("[PermissionChecker] User %s allowed access - has permission %s", user.ID, requiredPermission)
		c.Next()
	}
}

// checkPermission checks if permission is true
func checkPermission(perms *models.Permission, permission string) bool {
	if perms == nil {
		return false
	}

	switch permission {
	case "canViewStudents":
		return perms.CanViewStudents
	case "canCreateStudents":
		return perms.CanCreateStudents
	case "canEditStudents":
		return perms.CanEditStudents
	case "canDeleteStudents":
		return perms.CanDeleteStudents
	case "canViewTeachers":
		return perms.CanViewTeachers
	case "canCreateTeachers":
		return perms.CanCreateTeachers
	case "canEditTeachers":
		return perms.CanEditTeachers
	case "canDeleteTeachers":
		return perms.CanDeleteTeachers
	case "canViewClasses":
		return perms.CanViewClasses
	case "canCreateClasses":
		return perms.CanCreateClasses
	case "canEditClasses":
		return perms.CanEditClasses
	case "canDeleteClasses":
		return perms.CanDeleteClasses
	case "canViewPayments":
		return perms.CanViewPayments
	case "canCreatePayments":
		return perms.CanCreatePayments
	case "canEditPayments":
		return perms.CanEditPayments
	case "canViewSalaries":
		return perms.CanViewSalaries
	case "canCreateSalaries":
		return perms.CanCreateSalaries
	case "canEditSalaries":
		return perms.CanEditSalaries
	case "canViewExpenses":
		return perms.CanViewExpenses
	case "canCreateExpenses":
		return perms.CanCreateExpenses
	case "canEditExpenses":
		return perms.CanEditExpenses
	case "canDeleteExpenses":
		return perms.CanDeleteExpenses
	case "canViewReports":
		return perms.CanViewReports
	case "canViewSettings":
		return perms.CanViewSettings
	case "canEditSettings":
		return perms.CanEditSettings
	default:
		return false
	}
}

// RoleChecker checks if user has the required role (Admin only typically)
func RoleChecker(userService *service.UserService, requiredRoles ...models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, err := GetUserID(c)
		if err != nil {
			log.Printf("[RoleChecker] Failed to get user ID: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		user, err := userService.GetByID(c.Request.Context(), userID)
		if err != nil || user == nil {
			log.Printf("[RoleChecker] Failed to fetch user %s: %v", userID, err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found - please log in again"})
			c.Abort()
			return
		}

		// Check if user has any of the required roles
		hasRole := false
		for _, role := range requiredRoles {
			if user.Role == role {
				hasRole = true
				break
			}
		}

		if !hasRole {
			log.Printf("[RoleChecker] User %s (role: %s) denied - requires role: %v", user.ID, user.Role, requiredRoles)
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient role permissions"})
			c.Abort()
			return
		}

		log.Printf("[RoleChecker] User %s has role %s, access granted", user.ID, user.Role)
		c.Next()
	}
}

// GetUserRole returns the user's role from the context
func GetUserRole(c *gin.Context, userService *service.UserService) (models.UserRole, error) {
	userID, err := GetUserID(c)
	if err != nil {
		return "", err
	}
	user, err := userService.GetByID(c.Request.Context(), userID)
	if err != nil || user == nil {
		return "", err
	}
	return user.Role, nil
}

// getDefaultPermissionsByRole returns role-based permissions as fallback
func getDefaultPermissionsByRole(role models.UserRole) *models.Permission {
	switch role {
	case models.RoleAdmin:
		return &models.Permission{
			CanViewStudents:   true,
			CanCreateStudents: true,
			CanEditStudents:   true,
			CanDeleteStudents: true,
			CanViewTeachers:   true,
			CanCreateTeachers: true,
			CanEditTeachers:   true,
			CanDeleteTeachers: true,
			CanViewClasses:    true,
			CanCreateClasses:  true,
			CanEditClasses:    true,
			CanDeleteClasses:  true,
			CanViewPayments:   true,
			CanCreatePayments: true,
			CanEditPayments:   true,
			CanViewSalaries:   true,
			CanCreateSalaries: true,
			CanEditSalaries:   true,
			CanViewExpenses:   true,
			CanCreateExpenses: true,
			CanEditExpenses:   true,
			CanDeleteExpenses: true,
			CanViewReports:    true,
			CanViewSettings:   true,
			CanEditSettings:   true,
		}
	case models.RoleBranchAdmin, models.RoleManager:
		return &models.Permission{
			CanViewStudents:   true,
			CanCreateStudents: true,
			CanEditStudents:   true,
			CanDeleteStudents: false,
			CanViewTeachers:   true,
			CanCreateTeachers: true,
			CanEditTeachers:   true,
			CanDeleteTeachers: false,
			CanViewClasses:    true,
			CanCreateClasses:  true,
			CanEditClasses:    true,
			CanDeleteClasses:  false,
			CanViewPayments:   true,
			CanCreatePayments: false,
			CanEditPayments:   false,
			CanViewSalaries:   true,
			CanCreateSalaries: false,
			CanEditSalaries:   false,
			CanViewExpenses:   true,
			CanCreateExpenses: false,
			CanEditExpenses:   false,
			CanDeleteExpenses: false,
			CanViewReports:    true,
			CanViewSettings:   false,
			CanEditSettings:   false,
		}
	case models.RoleAccountant:
		return &models.Permission{
			CanViewStudents:   true,
			CanCreateStudents: false,
			CanEditStudents:   false,
			CanDeleteStudents: false,
			CanViewTeachers:   true,
			CanCreateTeachers: false,
			CanEditTeachers:   false,
			CanDeleteTeachers: false,
			CanViewClasses:    true,
			CanCreateClasses:  false,
			CanEditClasses:    false,
			CanDeleteClasses:  false,
			CanViewPayments:   true,
			CanCreatePayments: true,
			CanEditPayments:   true,
			CanViewSalaries:   true,
			CanCreateSalaries: true,
			CanEditSalaries:   true,
			CanViewExpenses:   true,
			CanCreateExpenses: true,
			CanEditExpenses:   true,
			CanDeleteExpenses: false,
			CanViewReports:    true,
			CanViewSettings:   false,
			CanEditSettings:   false,
		}
	default:
		// Default to minimal permissions
		return &models.Permission{}
	}
}
