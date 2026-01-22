package service

import (
	"context"
	"fmt"

	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

type DeveloperService struct {
	database *db.Database
}

func NewDeveloperService(database *db.Database) *DeveloperService {
	return &DeveloperService{database: database}
}

// GetDeveloperByEmail retrieves a developer by email
func (s *DeveloperService) GetDeveloperByEmail(ctx context.Context, email string) (*models.Developer, error) {
	query := `
		SELECT id, email, password, full_name, role, is_active, last_login, created_at, updated_at
		FROM developers
		WHERE email = $1
	`

	var dev models.Developer
	err := s.database.GetConn().QueryRowContext(ctx, query, email).Scan(
		&dev.ID, &dev.Email, &dev.Password, &dev.FullName, &dev.Role, &dev.IsActive, &dev.LastLogin, &dev.CreatedAt, &dev.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to fetch developer: %w", err)
	}

	return &dev, nil
}

// GetDeveloperByID retrieves a developer by ID
func (s *DeveloperService) GetDeveloperByID(ctx context.Context, id string) (*models.Developer, error) {
	query := `
		SELECT id, email, password, full_name, role, is_active, last_login, created_at, updated_at
		FROM developers
		WHERE id = $1
	`

	var dev models.Developer
	err := s.database.GetConn().QueryRowContext(ctx, query, id).Scan(
		&dev.ID, &dev.Email, &dev.Password, &dev.FullName, &dev.Role, &dev.IsActive, &dev.LastLogin, &dev.CreatedAt, &dev.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to fetch developer: %w", err)
	}

	return &dev, nil
}

// AuthenticateDeveloper authenticates a developer and returns the developer details
func (s *DeveloperService) AuthenticateDeveloper(ctx context.Context, email, password string) (*models.Developer, error) {
	dev, err := s.GetDeveloperByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("developer not found")
	}

	if !dev.IsActive {
		return nil, fmt.Errorf("developer account is inactive")
	}

	// Compare password
	err = bcrypt.CompareHashAndPassword([]byte(dev.Password), []byte(password))
	if err != nil {
		return nil, fmt.Errorf("invalid password")
	}

	// Update last login
	updateQuery := `UPDATE developers SET last_login = CURRENT_TIMESTAMP WHERE id = $1`
	s.database.GetConn().ExecContext(ctx, updateQuery, dev.ID)

	return dev, nil
}

// CreateDeveloper creates a new developer account
func (s *DeveloperService) CreateDeveloper(ctx context.Context, email, password, fullName string) (*models.Developer, error) {
	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	query := `
		INSERT INTO developers (id, email, password, full_name, role, is_active, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, email, password, full_name, role, is_active, last_login, created_at, updated_at
	`

	var dev models.Developer
	err = s.database.GetConn().QueryRowContext(ctx, query,
		email, string(hashedPassword), fullName, "developer",
	).Scan(
		&dev.ID, &dev.Email, &dev.Password, &dev.FullName, &dev.Role, &dev.IsActive, &dev.LastLogin, &dev.CreatedAt, &dev.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to create developer: %w", err)
	}

	return &dev, nil
}

// UpdateDeveloperLastLogin updates the last login time for a developer
func (s *DeveloperService) UpdateDeveloperLastLogin(ctx context.Context, developerID string) error {
	query := `UPDATE developers SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
	_, err := s.database.GetConn().ExecContext(ctx, query, developerID)
	return err
}

// ListDevelopers retrieves all developers
func (s *DeveloperService) ListDevelopers(ctx context.Context) ([]models.Developer, error) {
	query := `
		SELECT id, email, password, full_name, role, is_active, last_login, created_at, updated_at
		FROM developers
		ORDER BY created_at DESC
	`

	rows, err := s.database.GetConn().QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch developers: %w", err)
	}
	defer rows.Close()

	var developers []models.Developer
	for rows.Next() {
		var dev models.Developer
		err := rows.Scan(
			&dev.ID, &dev.Email, &dev.Password, &dev.FullName, &dev.Role, &dev.IsActive, &dev.LastLogin, &dev.CreatedAt, &dev.UpdatedAt,
		)
		if err != nil {
			continue
		}
		developers = append(developers, dev)
	}

	return developers, rows.Err()
}

// DeleteDeveloper deletes a developer account
func (s *DeveloperService) DeleteDeveloper(ctx context.Context, developerID string) error {
	query := `DELETE FROM developers WHERE id = $1`
	_, err := s.database.GetConn().ExecContext(ctx, query, developerID)
	if err != nil {
		return fmt.Errorf("failed to delete developer: %w", err)
	}
	return nil
}

// UpdateDeveloperPassword updates a developer's password
func (s *DeveloperService) UpdateDeveloperPassword(ctx context.Context, developerID, newPassword string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	query := `UPDATE developers SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err = s.database.GetConn().ExecContext(ctx, query, string(hashedPassword), developerID)
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}
	return nil
}
