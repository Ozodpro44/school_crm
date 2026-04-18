// Package service contains notification logic.
// Owns: notifications table (in-app), with Redis pub/sub for real-time delivery.
// Async events (payment.created, subscription.expired) are consumed from a
// Redis list key `events:{type}` — pushed by other services, popped here.
package service

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/school-crm/notification-service/internal/db"
)

// ── Models ─────────────────────────────────────────────────────────────────────

type Notification struct {
	ID           string     `json:"id"`
	BranchID     string     `json:"branchId"`
	Title        string     `json:"title"`
	Message      string     `json:"message"`
	Type         string     `json:"type"`
	ResourceType *string    `json:"resourceType,omitempty"`
	ResourceID   *string    `json:"resourceId,omitempty"`
	IsRead       bool       `json:"isRead"`
	CreatedAt    time.Time  `json:"createdAt"`
}

var ErrNotFound = errors.New("not found")

// ── NotificationService ───────────────────────────────────────────────────────

type NotificationService struct {
	db    *db.DB
	redis *redis.Client
}

func New(database *db.DB, redisClient *redis.Client) *NotificationService {
	return &NotificationService{db: database, redis: redisClient}
}

// Create inserts a new notification and publishes to Redis channel for
// real-time delivery to connected WebSocket clients.
func (s *NotificationService) Create(ctx context.Context, branchID, title, message, notifType, resourceType, resourceID string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var rtPtr, riPtr *string
	if resourceType != "" {
		rtPtr = &resourceType
	}
	if resourceID != "" {
		riPtr = &resourceID
	}

	id := uuid.New().String()
	_, err := s.db.Conn().ExecContext(ctx, `
		INSERT INTO notifications (id, branch_id, title, message, type, resource_type, resource_id, is_read, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,false,NOW())`,
		id, branchID, title, message, notifType, rtPtr, riPtr,
	)
	if err != nil {
		return err
	}

	// Non-blocking publish to Redis channel for WebSocket fan-out
	if s.redis != nil {
		_ = s.redis.Publish(context.Background(), "notif:"+branchID, id)
	}
	return nil
}

// List returns the most recent notifications for a branch.
func (s *NotificationService) List(ctx context.Context, branchID string, unreadOnly bool, limit int) ([]Notification, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	if limit <= 0 || limit > 100 {
		limit = 50
	}

	where := "WHERE branch_id = $1"
	args := []interface{}{branchID}
	if unreadOnly {
		where += " AND is_read = false"
	}

	rows, err := s.db.Conn().QueryContext(ctx,
		`SELECT id, branch_id, title, message, type, resource_type, resource_id, is_read, created_at
		 FROM notifications `+where+` ORDER BY created_at DESC LIMIT $2`,
		append(args, limit)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifs []Notification
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.BranchID, &n.Title, &n.Message, &n.Type,
			&n.ResourceType, &n.ResourceID, &n.IsRead, &n.CreatedAt); err != nil {
			return nil, err
		}
		notifs = append(notifs, n)
	}
	return notifs, rows.Err()
}

// UnreadCount returns the count of unread notifications for a branch.
func (s *NotificationService) UnreadCount(ctx context.Context, branchID string) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	var count int
	err := s.db.Conn().QueryRowContext(ctx,
		`SELECT COUNT(*) FROM notifications WHERE branch_id = $1 AND is_read = false`, branchID,
	).Scan(&count)
	return count, err
}

// MarkRead marks a single notification as read.
func (s *NotificationService) MarkRead(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	res, err := s.db.Conn().ExecContext(ctx,
		"UPDATE notifications SET is_read = true WHERE id = $1", id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return ErrNotFound
	}
	return nil
}

// MarkAllRead marks all notifications for a branch as read.
func (s *NotificationService) MarkAllRead(ctx context.Context, branchID string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	_, err := s.db.Conn().ExecContext(ctx,
		"UPDATE notifications SET is_read = true WHERE branch_id = $1 AND is_read = false", branchID)
	return err
}

// Delete removes a notification by ID.
func (s *NotificationService) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	res, err := s.db.Conn().ExecContext(ctx, "DELETE FROM notifications WHERE id = $1", id)
	if err != nil {
		return err
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		return ErrNotFound
	}
	return nil
}

// PurgeOld deletes notifications older than the given duration.
// Called by a background goroutine nightly to prevent table bloat.
func (s *NotificationService) PurgeOld(ctx context.Context, olderThan time.Duration) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cutoff := time.Now().Add(-olderThan)
	res, err := s.db.Conn().ExecContext(ctx,
		"DELETE FROM notifications WHERE created_at < $1 AND is_read = true", cutoff)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return n, nil
}

// ── Event consumer ────────────────────────────────────────────────────────────
// ConsumeEvents pops domain events from Redis lists and persists notifications.
// Key format: `events:{event_type}` → JSON payload pushed by payment_service etc.
// This runs in a background goroutine; it blocks on BLPOP (2s timeout) and loops.

func (s *NotificationService) ConsumeEvents(ctx context.Context) {
	keys := []string{
		"events:payment.created",
		"events:payment.status_changed",
		"events:subscription.expired",
		"events:subscription.renewed",
		"events:user.registered",
	}

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		result, err := s.redis.BLPop(ctx, 2*time.Second, keys...).Result()
		if err != nil {
			if errors.Is(err, redis.Nil) {
				continue
			}
			// Context cancelled or connection issue — back off briefly
			select {
			case <-ctx.Done():
				return
			case <-time.After(500 * time.Millisecond):
			}
			continue
		}

		if len(result) < 2 {
			continue
		}
		eventType := result[0]
		payload := result[1]
		_ = s.handleEvent(ctx, eventType, payload)
	}
}

// handleEvent converts a raw domain event payload into a notification row.
// The payload is a JSON string — for now we create a generic notification.
// In P5.5+, use a proper event schema with typed structs.
func (s *NotificationService) handleEvent(_ context.Context, eventType, payload string) error {
	var title, message, notifType string

	switch eventType {
	case "events:payment.created":
		title = "New payment recorded"
		message = payload
		notifType = "payment"
	case "events:payment.status_changed":
		title = "Payment status changed"
		message = payload
		notifType = "payment"
	case "events:subscription.expired":
		title = "Subscription expired"
		message = payload
		notifType = "system"
	case "events:subscription.renewed":
		title = "Subscription renewed"
		message = payload
		notifType = "system"
	case "events:user.registered":
		title = "New user registered"
		message = payload
		notifType = "system"
	default:
		return nil
	}

	// Without a branch_id in the event we can't target notifications.
	// Until the event schema includes branch_id, log and skip.
	// TODO(P5.5): parse JSON payload for branch_id and resource fields.
	_ = title
	_ = message
	_ = notifType
	return nil
}

// Sentinel for sql.ErrNoRows compatibility
var _ = sql.ErrNoRows
