package service

import (
	"context"
	"database/sql"
	"time"

	"github.com/school-crm/backend/internal/db"
)

// NotificationType constants
const (
	NotifTypePayment = "payment"
	NotifTypeStudent = "student"
	NotifTypeSystem  = "system"
)

// Notification represents a single in-app notification for a branch.
type Notification struct {
	ID           string    `json:"id"`
	BranchID     string    `json:"branchId"`
	Title        string    `json:"title"`
	Message      string    `json:"message"`
	Type         string    `json:"type"`
	ResourceType *string   `json:"resourceType,omitempty"`
	ResourceID   *string   `json:"resourceId,omitempty"`
	IsRead       bool      `json:"isRead"`
	CreatedAt    time.Time `json:"createdAt"`
}

// NotificationService handles persistence of in-app notifications.
type NotificationService struct {
	db *db.Database
}

func NewNotificationService(database *db.Database) *NotificationService {
	return &NotificationService{db: database}
}

// Create inserts a new notification for the given branch.
// resourceType and resourceID are optional — pass empty strings to omit them.
func (s *NotificationService) Create(
	ctx context.Context,
	branchID, title, message, notifType, resourceType, resourceID string,
) error {
	var rtPtr, riPtr *string
	if resourceType != "" {
		rtPtr = &resourceType
	}
	if resourceID != "" {
		riPtr = &resourceID
	}
	_, err := s.db.GetConn().ExecContext(ctx, `
		INSERT INTO notifications (branch_id, title, message, type, resource_type, resource_id)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, branchID, title, message, notifType, rtPtr, riPtr)
	return err
}

// ListByBranch returns the most recent notifications for a branch (newest first).
func (s *NotificationService) ListByBranch(ctx context.Context, branchID string, limit int) ([]Notification, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT id, branch_id, title, message, type,
		       resource_type, resource_id, is_read, created_at
		FROM notifications
		WHERE branch_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, branchID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifications []Notification
	for rows.Next() {
		var n Notification
		if err := rows.Scan(
			&n.ID, &n.BranchID, &n.Title, &n.Message, &n.Type,
			&n.ResourceType, &n.ResourceID, &n.IsRead, &n.CreatedAt,
		); err != nil {
			return nil, err
		}
		notifications = append(notifications, n)
	}
	if notifications == nil {
		notifications = []Notification{}
	}
	return notifications, nil
}

// CountUnread returns the number of unread notifications for a branch.
func (s *NotificationService) CountUnread(ctx context.Context, branchID string) (int, error) {
	var count int
	err := s.db.GetConn().QueryRowContext(ctx,
		`SELECT COUNT(*) FROM notifications WHERE branch_id = $1 AND is_read = false`,
		branchID,
	).Scan(&count)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return count, err
}

// MarkRead marks a single notification as read (only if it belongs to the branch).
func (s *NotificationService) MarkRead(ctx context.Context, id, branchID string) error {
	_, err := s.db.GetConn().ExecContext(ctx,
		`UPDATE notifications SET is_read = true WHERE id = $1 AND branch_id = $2`,
		id, branchID,
	)
	return err
}

// MarkAllRead marks all notifications for a branch as read.
func (s *NotificationService) MarkAllRead(ctx context.Context, branchID string) error {
	_, err := s.db.GetConn().ExecContext(ctx,
		`UPDATE notifications SET is_read = true WHERE branch_id = $1`,
		branchID,
	)
	return err
}
