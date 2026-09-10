// Package service contains notification logic.
// Owns: notifications table (in-app), with Redis pub/sub for real-time delivery.
// Async events (payment.created, subscription.expired) are consumed from a
// Redis list key `events:{type}` — pushed by other services, popped here.
package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/school-crm/notification-service/internal/db"
)

// ── Models ─────────────────────────────────────────────────────────────────────

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

var ErrNotFound = errors.New("not found")

// ── NotificationService ───────────────────────────────────────────────────────

type NotificationService struct {
	db    *db.DB
	redis *redis.Client
}

// HasBranchAccess reports whether userID (JWT-verified, with role) may
// access branchID. developer/super_admin bypass entirely (platform-level
// roles). Otherwise granted if the user's own branch matches, they're
// linked to it via branch_managers, or they're its admin.
//
// This exists because branch switching in the frontend does not reissue a
// JWT — the token's own branch_id stays fixed to the user's home branch,
// while a manager/admin who legitimately administers several branches picks
// among them client-side and sends that choice as a plain branchId query
// param/body field. Blindly trusting that value let ANY authenticated
// caller — including a teacher — read or spam another branch's
// notifications by editing the request.
func (s *NotificationService) HasBranchAccess(ctx context.Context, userID, role, branchID string) (bool, error) {
	if role == "developer" || role == "super_admin" {
		return true, nil
	}
	if userID == "" || branchID == "" {
		return false, nil
	}
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()
	var exists bool
	err := s.db.Conn().QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM users WHERE id = $1 AND branch_id = $2
			UNION ALL
			SELECT 1 FROM branch_managers WHERE manager_id = $1 AND branch_id = $2
			UNION ALL
			SELECT 1 FROM branches WHERE id = $2 AND admin_id = $1
		)`, userID, branchID).Scan(&exists)
	return exists, err
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

	// Non-blocking publish to Redis channel for WebSocket fan-out. The row is
	// already committed at this point, so a publish failure only costs
	// real-time delivery — connected clients miss the push and fall back to
	// polling — it must not fail the request, but it must be visible.
	if s.redis != nil {
		if err := s.redis.Publish(context.Background(), "notif:"+branchID, id).Err(); err != nil {
			slog.Warn("notification pub/sub publish failed", "branch_id", branchID, "notification_id", id, "error", err)
		}
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
// MarkRead marks a notification read, scoped to branchID so a caller can't
// touch another branch's notification by guessing its UUID.
func (s *NotificationService) MarkRead(ctx context.Context, id, branchID string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	res, err := s.db.Conn().ExecContext(ctx,
		"UPDATE notifications SET is_read = true WHERE id = $1 AND branch_id = $2", id, branchID)
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

// Delete removes a notification by ID, scoped to branchID so a caller can't
// delete another branch's notification by guessing its UUID.
func (s *NotificationService) Delete(ctx context.Context, id, branchID string) error {
	ctx, cancel := context.WithTimeout(ctx, db.QueryTimeout)
	defer cancel()

	res, err := s.db.Conn().ExecContext(ctx,
		"DELETE FROM notifications WHERE id = $1 AND branch_id = $2", id, branchID)
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
// PurgeOld deletes read notifications older than readOlderThan, and unread
// notifications older than unreadOlderThan. Previously only read
// notifications were ever purged, so an ignored/unread notification stayed
// in the table forever regardless of age — a branch that never clears its
// bell icon would accumulate rows without bound. unreadOlderThan should be
// generous (the caller loses the notification permanently), but it must
// exist.
func (s *NotificationService) PurgeOld(ctx context.Context, readOlderThan, unreadOlderThan time.Duration) (int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	res, err := s.db.Conn().ExecContext(ctx,
		`DELETE FROM notifications
		 WHERE (is_read = true  AND created_at < $1)
		    OR (is_read = false AND created_at < $2)`,
		time.Now().Add(-readOlderThan), time.Now().Add(-unreadOlderThan),
	)
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
		// BLPOP already removed this item from the Redis list — it cannot be
		// re-read or retried past this point, so a processing error here is a
		// permanent loss of that event. It must be logged, never discarded.
		if err := s.handleEvent(ctx, eventType, payload); err != nil {
			slog.Error("notification event dropped", "event_type", eventType, "error", err, "payload", payload)
		}
	}
}

// eventEnvelope is the expected shape of a domain-event payload pushed onto
// an `events:*` Redis list by another service. branch_id is required — a
// notification cannot be targeted without it. resource_type/resource_id are
// optional, used to deep-link the notification in the UI.
type eventEnvelope struct {
	BranchID     string `json:"branch_id"`
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`
	Message      string `json:"message"`
}

// handleEvent converts a raw domain event payload into a persisted, deliverable
// notification. The payload is JSON — see eventEnvelope for the expected shape.
func (s *NotificationService) handleEvent(ctx context.Context, eventType, payload string) error {
	var title, notifType string

	switch eventType {
	case "events:payment.created":
		title, notifType = "New payment recorded", "payment"
	case "events:payment.status_changed":
		title, notifType = "Payment status changed", "payment"
	case "events:subscription.expired":
		title, notifType = "Subscription expired", "system"
	case "events:subscription.renewed":
		title, notifType = "Subscription renewed", "system"
	case "events:user.registered":
		title, notifType = "New user registered", "system"
	default:
		return nil
	}

	var env eventEnvelope
	if err := json.Unmarshal([]byte(payload), &env); err != nil {
		return fmt.Errorf("unmarshal event payload: %w", err)
	}
	if env.BranchID == "" {
		return fmt.Errorf("event payload missing branch_id, cannot target notification")
	}

	message := env.Message
	if message == "" {
		message = payload
	}

	return s.Create(ctx, env.BranchID, title, message, notifType, env.ResourceType, env.ResourceID)
}

// Sentinel for sql.ErrNoRows compatibility
var _ = sql.ErrNoRows
