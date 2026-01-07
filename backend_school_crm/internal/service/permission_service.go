package service

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	// "time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

type PermissionService struct {
	db *db.Database
}

func NewPermissionService(database *db.Database) *PermissionService {
	return &PermissionService{db: database}
}

// GetByUserID retrieves permissions for a specific user
func (s *PermissionService) GetByUserID(ctx context.Context, userID string) (*models.Permission, error) {
	permission := &models.Permission{}
	query := `
		SELECT id, user_id, can_view_students, can_create_students, can_edit_students, can_delete_students,
		       can_view_teachers, can_create_teachers, can_edit_teachers, can_delete_teachers,
		       can_view_classes, can_create_classes, can_edit_classes, can_delete_classes,
		       can_view_payments, can_create_payments, can_edit_payments,
		       can_view_salaries, can_create_salaries, can_edit_salaries,
		       can_view_expenses, can_create_expenses, can_edit_expenses, can_delete_expenses,
		       can_view_reports, can_view_settings, can_edit_settings
		FROM permissions WHERE user_id = $1
	`

	err := s.db.GetConn().QueryRowContext(ctx, query, userID).Scan(
		&permission.ID, &permission.UserID,
		&permission.CanViewStudents, &permission.CanCreateStudents, &permission.CanEditStudents, &permission.CanDeleteStudents,
		&permission.CanViewTeachers, &permission.CanCreateTeachers, &permission.CanEditTeachers, &permission.CanDeleteTeachers,
		&permission.CanViewClasses, &permission.CanCreateClasses, &permission.CanEditClasses, &permission.CanDeleteClasses,
		&permission.CanViewPayments, &permission.CanCreatePayments, &permission.CanEditPayments,
		&permission.CanViewSalaries, &permission.CanCreateSalaries, &permission.CanEditSalaries,
		&permission.CanViewExpenses, &permission.CanCreateExpenses, &permission.CanEditExpenses, &permission.CanDeleteExpenses,
		&permission.CanViewReports, &permission.CanViewSettings, &permission.CanEditSettings,
	)

	if err == sql.ErrNoRows {
		log.Printf("[PermissionService.GetByUserID] No permissions found for user: %s", userID)
		return nil, nil
	}
	if err != nil {
		log.Printf("[PermissionService.GetByUserID] Database error for user %s: %v", userID, err)
		return nil, err
	}

	return permission, nil
}

// CreateForUser creates default permissions for a new user
func (s *PermissionService) CreateForUser(ctx context.Context, userID string) (*models.Permission, error) {
	// Get user to determine role-based defaults
	userRole, roleErr := s.getUserRole(ctx, userID)
	if roleErr != nil {
		userRole = "manager" // Default to manager if lookup fails
	}

	// Set role-based defaults
	permission := s.getDefaultPermissions(userRole)
	permission.ID = uuid.New().String()
	permission.UserID = userID

	query := `
		INSERT INTO permissions (id, user_id, can_view_students, can_edit_students, can_delete_students,
		       can_view_teachers, can_edit_teachers, can_delete_teachers,
		       can_view_classes, can_edit_classes, can_delete_classes,
		       can_view_payments, can_edit_payments,
		       can_view_salaries, can_edit_salaries,
		       can_view_expenses, can_edit_expenses, can_delete_expenses,
		       can_view_reports, can_view_settings, can_edit_settings)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
	`

	_, err := s.db.GetConn().ExecContext(ctx, query,
		permission.ID, permission.UserID,
		permission.CanViewStudents, permission.CanEditStudents, permission.CanDeleteStudents,
		permission.CanViewTeachers, permission.CanEditTeachers, permission.CanDeleteTeachers,
		permission.CanViewClasses, permission.CanEditClasses, permission.CanDeleteClasses,
		permission.CanViewPayments, permission.CanEditPayments,
		permission.CanViewSalaries, permission.CanEditSalaries,
		permission.CanViewExpenses, permission.CanEditExpenses, permission.CanDeleteExpenses,
		permission.CanViewReports, permission.CanViewSettings, permission.CanEditSettings,
	)

	if err != nil {
		log.Printf("[PermissionService.CreateForUser] Failed to create permissions for user %s: %v", userID, err)
		return nil, err
	}

	return permission, nil
}

// Update updates permissions for a user, creating them if they don't exist
func (s *PermissionService) Update(ctx context.Context, userID string, updates map[string]interface{}) (*models.Permission, error) {
	log.Printf("[PermissionService.Update] Updating permissions for user %s with updates: %v", userID, updates)

	// First check if permissions exist
	_, err := s.GetByUserID(ctx, userID)
	if err != nil && err.Error() == "permissions not found" {
		// Create default permissions if they don't exist
		log.Printf("[PermissionService.Update] Permissions not found for user %s, creating defaults", userID)
		_, createErr := s.CreateForUser(ctx, userID)
		if createErr != nil {
			log.Printf("[PermissionService.Update] Failed to create default permissions for user %s: %v", userID, createErr)
			return nil, createErr
		}
	} else if err != nil {
		return nil, err
	}

	// Now update the permissions
	query := `UPDATE permissions SET `
	args := []interface{}{}
	argCount := 1

	for key, value := range updates {
		if argCount > 1 {
			query += ", "
		}
		query += key + " = $" + fmt.Sprintf("%d", argCount)
		args = append(args, value)
		argCount++
	}

	query += fmt.Sprintf(" WHERE user_id = $%d", argCount)
	args = append(args, userID)

	_, err = s.db.GetConn().ExecContext(ctx, query, args...)
	if err != nil {
		log.Printf("[PermissionService.Update] Failed to update permissions for user %s: %v", userID, err)
		return nil, err
	}

	return s.GetByUserID(ctx, userID)
}

// GetAll retrieves all permissions
func (s *PermissionService) GetAll(ctx context.Context) ([]models.Permission, error) {
	query := `
		SELECT id, user_id, can_view_students, can_edit_students, can_delete_students,
		       can_view_teachers, can_edit_teachers, can_delete_teachers,
		       can_view_classes, can_edit_classes, can_delete_classes,
		       can_view_payments, can_edit_payments,
		       can_view_salaries, can_edit_salaries,
		       can_view_expenses, can_edit_expenses, can_delete_expenses,
		       can_view_reports, can_view_settings, can_edit_settings
		FROM permissions
	`

	rows, err := s.db.GetConn().QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var permissions []models.Permission
	for rows.Next() {
		permission := models.Permission{}
		if err := rows.Scan(
			&permission.ID, &permission.UserID,
			&permission.CanViewStudents, &permission.CanEditStudents, &permission.CanDeleteStudents,
			&permission.CanViewTeachers, &permission.CanEditTeachers, &permission.CanDeleteTeachers,
			&permission.CanViewClasses, &permission.CanEditClasses, &permission.CanDeleteClasses,
			&permission.CanViewPayments, &permission.CanEditPayments,
			&permission.CanViewSalaries, &permission.CanEditSalaries,
			&permission.CanViewExpenses, &permission.CanEditExpenses, &permission.CanDeleteExpenses,
			&permission.CanViewReports, &permission.CanViewSettings, &permission.CanEditSettings,
		); err != nil {
			return nil, err
		}
		permissions = append(permissions, permission)
	}

	return permissions, rows.Err()
}

// getUserRole gets the user's role
func (s *PermissionService) getUserRole(ctx context.Context, userID string) (string, error) {
	var role string
	query := `SELECT role FROM users WHERE id = $1`
	err := s.db.GetConn().QueryRowContext(ctx, query, userID).Scan(&role)
	if err != nil {
		return "", err
	}
	return role, nil
}

// getDefaultPermissions returns role-based default permissions
func (s *PermissionService) getDefaultPermissions(role string) *models.Permission {
	switch role {
	case "admin":
		return &models.Permission{
			CanViewStudents:   true,
			CanEditStudents:   true,
			CanDeleteStudents: true,
			CanViewTeachers:   true,
			CanEditTeachers:   true,
			CanDeleteTeachers: true,
			CanViewClasses:    true,
			CanEditClasses:    true,
			CanDeleteClasses:  true,
			CanViewPayments:   true,
			CanEditPayments:   true,
			CanViewSalaries:   true,
			CanEditSalaries:   true,
			CanViewExpenses:   true,
			CanEditExpenses:   true,
			CanDeleteExpenses: true,
			CanViewReports:    true,
			CanViewSettings:   true,
			CanEditSettings:   true,
		}
	case "branch_admin":
		return &models.Permission{
			CanViewStudents:   true,
			CanEditStudents:   true,
			CanDeleteStudents: true,
			CanViewTeachers:   true,
			CanEditTeachers:   true,
			CanDeleteTeachers: true,
			CanViewClasses:    true,
			CanEditClasses:    true,
			CanDeleteClasses:  true,
			CanViewPayments:   true,
			CanEditPayments:   true,
			CanViewSalaries:   true,
			CanEditSalaries:   true,
			CanViewExpenses:   true,
			CanEditExpenses:   true,
			CanDeleteExpenses: true,
			CanViewReports:    true,
			CanViewSettings:   false,
			CanEditSettings:   false,
		}
	case "manager":
		return &models.Permission{
			CanViewStudents:   true,
			CanEditStudents:   true,
			CanDeleteStudents: false,
			CanViewTeachers:   true,
			CanEditTeachers:   true,
			CanDeleteTeachers: false,
			CanViewClasses:    true,
			CanEditClasses:    true,
			CanDeleteClasses:  false,
			CanViewPayments:   true,
			CanEditPayments:   true,
			CanViewSalaries:   true,
			CanEditSalaries:   true,
			CanViewExpenses:   true,
			CanEditExpenses:   true,
			CanDeleteExpenses: false,
			CanViewReports:    true,
			CanViewSettings:   false,
			CanEditSettings:   false,
		}
	case "accountant":
		return &models.Permission{
			CanViewStudents:   true,
			CanEditStudents:   false,
			CanDeleteStudents: false,
			CanViewTeachers:   true,
			CanEditTeachers:   false,
			CanDeleteTeachers: false,
			CanViewClasses:    true,
			CanEditClasses:    false,
			CanDeleteClasses:  false,
			CanViewPayments:   true,
			CanEditPayments:   true,
			CanViewSalaries:   true,
			CanEditSalaries:   true,
			CanViewExpenses:   true,
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
