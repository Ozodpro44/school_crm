package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/school-crm/backend/internal/db"
	"github.com/school-crm/backend/internal/models"
)

// maxRecipientsPerRequest caps one mass-send so a single request cannot tie
// up the server (and the Telegram rate limit) indefinitely.
const maxRecipientsPerRequest = 500

// sendConcurrency bounds parallel Telegram calls within one request.
const sendConcurrency = 5

// telegramClient has a per-message timeout; http.Post used the default
// client, which never times out.
var telegramClient = &http.Client{Timeout: 10 * time.Second}

// ErrTooManyRecipients is returned when a request resolves to more than
// maxRecipientsPerRequest recipients; narrow the filters and retry.
var ErrTooManyRecipients = errors.New("too many recipients: narrow the filters (max 500 per request)")

// renderMessage substitutes {name} with the HTML-escaped student name:
// messages are sent with parse_mode HTML, so a name like "A<b" or "R&D"
// would otherwise break formatting or make Telegram reject the message.
// The template itself is admin-authored and may contain Telegram HTML.
func renderMessage(template, studentName string) string {
	return strings.ReplaceAll(template, "{name}", html.EscapeString(studentName))
}

// redactTelegramErr strips the request URL (which embeds the bot token) from
// transport errors before they are logged or returned.
func redactTelegramErr(err error) error {
	var ue *url.Error
	if errors.As(err, &ue) {
		return fmt.Errorf("telegram request %s failed: %w", ue.Op, ue.Err)
	}
	return err
}

type MessagingService struct {
	db       *db.Database
	botToken string
}

func NewMessagingService(database *db.Database, botToken string) *MessagingService {
	return &MessagingService{db: database, botToken: botToken}
}

// ListHistory returns recent mass messages for a branch.
func (s *MessagingService) ListHistory(ctx context.Context, branchID string, limit int) ([]models.MessageLog, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.GetConn().QueryContext(ctx, `
		SELECT id, branch_id, sent_by, message, template_key, recipients_count, delivered_count, filters::text, created_at
		FROM message_log
		WHERE branch_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, branchID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.MessageLog
	for rows.Next() {
		var ml models.MessageLog
		if err := rows.Scan(&ml.ID, &ml.BranchID, &ml.SentBy, &ml.Message,
			&ml.TemplateKey, &ml.RecipientsCount, &ml.DeliveredCount, &ml.Filters, &ml.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, ml)
	}
	if logs == nil {
		logs = []models.MessageLog{}
	}
	return logs, rows.Err()
}

// Send resolves recipients from filters, sends each a Telegram message, and records the log entry.
// If botToken is empty, the send is simulated (still logs).
func (s *MessagingService) Send(ctx context.Context, req *models.SendMessageRequest, sentByID string) (*models.MessageLog, error) {
	// ── Resolve recipients ────────────────────────────────────────────────────
	var recipients []struct {
		StudentName    string
		ParentPhone    string
		TelegramChatID string
	}

	query, args := s.buildRecipientsQuery(req)
	rows, err := s.db.GetConn().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("resolve recipients: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var r struct {
			StudentName    string
			ParentPhone    string
			TelegramChatID string
		}
		if err := rows.Scan(&r.StudentName, &r.ParentPhone, &r.TelegramChatID); err != nil {
			return nil, err
		}
		recipients = append(recipients, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(recipients) > maxRecipientsPerRequest {
		return nil, ErrTooManyRecipients
	}

	// ── Send messages (bounded concurrency) ───────────────────────────────────
	var delivered int64
	var wg sync.WaitGroup
	sem := make(chan struct{}, sendConcurrency)
	for _, r := range recipients {
		if r.TelegramChatID == "" {
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(chatID, name string) {
			defer wg.Done()
			defer func() { <-sem }()
			if err := s.sendTelegram(ctx, chatID, renderMessage(req.Message, name)); err != nil {
				log.Printf("[Messaging] failed to send to %s: %v", chatID, err)
			} else {
				atomic.AddInt64(&delivered, 1)
			}
		}(r.TelegramChatID, r.StudentName)
	}
	wg.Wait()

	// ── Log the send ──────────────────────────────────────────────────────────
	filtersJSON, _ := json.Marshal(req.Filters)
	logID := uuid.New().String()
	var ml models.MessageLog
	err = s.db.GetConn().QueryRowContext(ctx, `
		INSERT INTO message_log (id, branch_id, sent_by, message, template_key, recipients_count, delivered_count, filters, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
		RETURNING id, branch_id, sent_by, message, template_key, recipients_count, delivered_count, filters::text, created_at
	`, logID, req.BranchID, sentByID, req.Message, req.TemplateKey,
		len(recipients), int(delivered), string(filtersJSON), time.Now(),
	).Scan(&ml.ID, &ml.BranchID, &ml.SentBy, &ml.Message,
		&ml.TemplateKey, &ml.RecipientsCount, &ml.DeliveredCount, &ml.Filters, &ml.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("log message: %w", err)
	}
	return &ml, nil
}

// UpdateStudentTelegramID sets the Telegram chat ID for a student.
func (s *MessagingService) UpdateStudentTelegramID(ctx context.Context, studentID, chatID string) error {
	_, err := s.db.GetConn().ExecContext(ctx,
		`UPDATE students SET telegram_chat_id = $1 WHERE id = $2`, chatID, studentID)
	return err
}

// buildRecipientsQuery constructs the SELECT to fetch recipients based on filters.
func (s *MessagingService) buildRecipientsQuery(req *models.SendMessageRequest) (string, []interface{}) {
	args := []interface{}{req.BranchID}
	conds := []string{"s.branch_id = $1", "s.status = 'active'", "s.deleted_at IS NULL"}

	if len(req.Filters.StudentIDs) > 0 {
		args = append(args, req.Filters.StudentIDs)
		conds = append(conds, fmt.Sprintf("s.id = ANY($%d)", len(args)))
	} else {
		if len(req.Filters.ClassIDs) > 0 {
			args = append(args, req.Filters.ClassIDs)
			conds = append(conds, fmt.Sprintf("s.class_id = ANY($%d)", len(args)))
		}
		if req.Filters.PaymentStatus != "" {
			// Join latest payment for this month
			now := time.Now()
			switch req.Filters.PaymentStatus {
			case "unpaid":
				conds = append(conds,
					fmt.Sprintf(`NOT EXISTS (
						SELECT 1 FROM payments p
						WHERE p.student_id = s.id AND p.month = '%s' AND p.year = %d
						  AND p.deleted_at IS NULL AND p.status IN ('paid','partial')
					)`, monthKey(now), now.Year()))
			case "paid":
				conds = append(conds,
					fmt.Sprintf(`EXISTS (
						SELECT 1 FROM payments p
						WHERE p.student_id = s.id AND p.month = '%s' AND p.year = %d
						  AND p.deleted_at IS NULL AND p.status IN ('paid','partial')
					)`, monthKey(now), now.Year()))
			}
		}
		if req.Filters.EnrolledAfter != "" {
			args = append(args, req.Filters.EnrolledAfter)
			conds = append(conds, fmt.Sprintf("s.enrollment_date >= $%d::date", len(args)))
		}
		if req.Filters.EnrolledBefore != "" {
			args = append(args, req.Filters.EnrolledBefore)
			conds = append(conds, fmt.Sprintf("s.enrollment_date <= $%d::date", len(args)))
		}
	}

	where := strings.Join(conds, " AND ")
	query := fmt.Sprintf(`
		SELECT s.full_name, s.parent_phone, s.telegram_chat_id
		FROM students s
		WHERE %s
		ORDER BY s.full_name
	`, where)
	return query, args
}

func (s *MessagingService) sendTelegram(ctx context.Context, chatID, text string) error {
	if s.botToken == "" {
		// Simulate success when no bot token configured
		log.Printf("[Messaging] (no bot token) would send to %s", chatID)
		return nil
	}
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", s.botToken)
	payload := map[string]string{"chat_id": chatID, "text": text, "parse_mode": "HTML"}
	body, _ := json.Marshal(payload)
	hreq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return redactTelegramErr(err)
	}
	hreq.Header.Set("Content-Type", "application/json")
	resp, err := telegramClient.Do(hreq)
	if err != nil {
		return redactTelegramErr(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("telegram API returned %d", resp.StatusCode)
	}
	return nil
}
