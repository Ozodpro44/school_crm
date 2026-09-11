package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

var ErrDeveloperSessionNotFound = errors.New("developer session not found")

type DeveloperService struct {
	database *db.Database
}

func NewDeveloperService(database *db.Database) *DeveloperService {
	return &DeveloperService{database: database}
}

// DeveloperSession is one logged-in device/browser for a developer account.
type DeveloperSession struct {
	ID          string     `json:"id"`
	DeveloperID string     `json:"developerId"`
	IPAddress   string     `json:"ipAddress"`
	UserAgent   string     `json:"userAgent"`
	CreatedAt   time.Time  `json:"createdAt"`
	LastSeenAt  time.Time  `json:"lastSeenAt"`
	RevokedAt   *time.Time `json:"revokedAt,omitempty"`
}

// CreateSession records a new developer login and returns the session ID to
// embed in that login's JWT as the "sid" claim.
func (s *DeveloperService) CreateSession(ctx context.Context, developerID, ip, userAgent string) (string, error) {
	var id string
	err := s.database.GetConn().QueryRowContext(ctx,
		`INSERT INTO developer_sessions (developer_id, ip_address, user_agent) VALUES ($1, $2, $3) RETURNING id`,
		developerID, ip, userAgent,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("create developer session: %w", err)
	}
	return id, nil
}

// ListSessions returns a developer's active (non-revoked) sessions, most
// recently active first.
func (s *DeveloperService) ListSessions(ctx context.Context, developerID string) ([]DeveloperSession, error) {
	rows, err := s.database.GetConn().QueryContext(ctx,
		`SELECT id, developer_id, COALESCE(ip_address, ''), COALESCE(user_agent, ''), created_at, last_seen_at, revoked_at
		 FROM developer_sessions WHERE developer_id = $1 AND revoked_at IS NULL ORDER BY last_seen_at DESC`,
		developerID,
	)
	if err != nil {
		return nil, fmt.Errorf("list developer sessions: %w", err)
	}
	defer rows.Close()

	sessions := []DeveloperSession{}
	for rows.Next() {
		var sess DeveloperSession
		if err := rows.Scan(&sess.ID, &sess.DeveloperID, &sess.IPAddress, &sess.UserAgent, &sess.CreatedAt, &sess.LastSeenAt, &sess.RevokedAt); err != nil {
			continue
		}
		sessions = append(sessions, sess)
	}
	return sessions, rows.Err()
}

// RevokeSession marks a session revoked, scoped to the caller's own
// developerID so one developer can never sign another one out.
func (s *DeveloperService) RevokeSession(ctx context.Context, developerID, sessionID string) error {
	res, err := s.database.GetConn().ExecContext(ctx,
		`UPDATE developer_sessions SET revoked_at = NOW() WHERE id = $1 AND developer_id = $2 AND revoked_at IS NULL`,
		sessionID, developerID,
	)
	if err != nil {
		return fmt.Errorf("revoke developer session: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrDeveloperSessionNotFound
	}
	return nil
}

// TouchSession bumps last_seen_at — called best-effort on every authenticated
// dev request so ListSessions reflects actual recent activity per device.
func (s *DeveloperService) TouchSession(ctx context.Context, sessionID string) {
	_, _ = s.database.GetConn().ExecContext(ctx, `UPDATE developer_sessions SET last_seen_at = NOW() WHERE id = $1`, sessionID)
}

// IsSessionRevoked reports whether a session has been revoked or no longer
// exists (a missing row — e.g. deleted alongside its developer — is treated
// as revoked, since there's nothing valid left to authorize against).
func (s *DeveloperService) IsSessionRevoked(ctx context.Context, sessionID string) (bool, error) {
	var revokedAt sql.NullTime
	err := s.database.GetConn().QueryRowContext(ctx,
		`SELECT revoked_at FROM developer_sessions WHERE id = $1`, sessionID,
	).Scan(&revokedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return true, nil
	}
	if err != nil {
		return false, err
	}
	return revokedAt.Valid, nil
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
