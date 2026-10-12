package service

import (
	"context"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"
)

// ── Plan limits ───────────────────────────────────────────────────────────────

// ErrLimitReached is returned when creating/restoring a resource would exceed
// the owner's subscription plan. Handlers translate it to HTTP 402 with the
// body {error:"subscription_limit_reached", detail:<err.Error()>}, the same
// shape the monolith's ErrSubscriptionLimitReached produces.
var ErrLimitReached = errors.New("subscription_limit_reached")

// limitExceeded reports whether adding one more resource would break the
// plan: a NULL max means unlimited, otherwise current must be < max.
func limitExceeded(current int, max sql.NullInt64) bool {
	return max.Valid && int64(current) >= max.Int64
}

func limitError(metric string, max int64, current int) error {
	return fmt.Errorf("%w: %s limit is %d (currently %d)", ErrLimitReached, metric, max, current)
}

// planLimitSQL maps a metric to (plan column, live-count SQL). Both take the
// owner's user id as $1. Soft-deleted rows never count (the monolith used to
// count them, so deleting a student never freed a slot).
var planLimitSQL = map[string][2]string{
	"students": {"max_students", `SELECT COUNT(*) FROM students
		WHERE branch_id IN (SELECT id FROM branches WHERE admin_id = $1)
		  AND status != 'left' AND deleted_at IS NULL`},
	"classes": {"max_classes", `SELECT COUNT(*) FROM classes
		WHERE branch_id IN (SELECT id FROM branches WHERE admin_id = $1)
		  AND is_active = true AND deleted_at IS NULL`},
	"teachers": {"max_teachers", `SELECT COUNT(*) FROM teachers
		WHERE branch_id IN (SELECT id FROM branches WHERE admin_id = $1)
		  AND is_active = true AND deleted_at IS NULL`},
}

// checkPlanLimit must run inside the same transaction as the INSERT/UPDATE it
// guards. It takes a transaction-scoped advisory lock keyed by the branch
// owner so two concurrent creates cannot both read "count = max-1".
// No owner / no subscription / NULL limit all mean "allowed" (the separate
// SubscriptionGate blocks lapsed subscriptions).
func checkPlanLimit(ctx context.Context, tx *sql.Tx, branchID, metric string) error {
	spec, ok := planLimitSQL[metric]
	if !ok {
		return fmt.Errorf("check plan limit: unknown metric %q", metric)
	}
	var owner sql.NullString
	err := tx.QueryRowContext(ctx, `SELECT admin_id::text FROM branches WHERE id = $1`, branchID).Scan(&owner)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && (!owner.Valid || owner.String == "")) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("check plan limit: resolve owner: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, "plan-limit:"+owner.String); err != nil {
		return fmt.Errorf("check plan limit: lock: %w", err)
	}
	var max sql.NullInt64
	err = tx.QueryRowContext(ctx, `
		SELECT sp.`+spec[0]+`
		FROM subscriptions sub
		JOIN subscription_plans sp ON sub.plan_id = sp.id
		WHERE sub.user_id = $1
		  AND sub.status IN ('active','trial','paused','pending_payment','past_due')
		ORDER BY sub.created_at DESC
		LIMIT 1`, owner.String).Scan(&max)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("check plan limit: plan: %w", err)
	}
	if !max.Valid {
		return nil
	}
	var current int
	if err := tx.QueryRowContext(ctx, spec[1], owner.String).Scan(&current); err != nil {
		return fmt.Errorf("check plan limit: count %s: %w", metric, err)
	}
	if limitExceeded(current, max) {
		return limitError(metric, max.Int64, current)
	}
	return nil
}

// ── Tenant membership of child ids ────────────────────────────────────────────

type rowQuerier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// childTables is a whitelist: table names are interpolated into SQL.
var childTables = map[string]bool{"students": true, "classes": true, "teachers": true, "assignments": true}

// inBranch reports whether a live (not soft-deleted) row of table with the
// given id belongs to branchID. Ids are compared as text so a malformed
// (non-UUID) id yields false instead of a Postgres cast error.
func inBranch(ctx context.Context, q rowQuerier, table, id, branchID string) (bool, error) {
	if !childTables[table] {
		return false, fmt.Errorf("inBranch: table %q not allowed", table)
	}
	if id == "" || branchID == "" {
		return false, nil
	}
	var ok bool
	err := q.QueryRowContext(ctx,
		`SELECT EXISTS (SELECT 1 FROM `+table+` WHERE id::text = $1 AND branch_id::text = $2 AND deleted_at IS NULL)`,
		id, branchID).Scan(&ok)
	return ok, err
}

// requireInBranch returns an ErrInvalidInput-wrapped error (HTTP 400) when
// the id is not a live row of this branch. The message deliberately does not
// distinguish "other tenant" from "does not exist".
func requireInBranch(ctx context.Context, q rowQuerier, table, label, id, branchID string) error {
	ok, err := inBranch(ctx, q, table, id, branchID)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("%w: %s not found in this branch", ErrInvalidInput, label)
	}
	return nil
}

// ── Attendance input validation ───────────────────────────────────────────────

var validAttendanceStatus = map[string]bool{"present": true, "absent": true, "late": true}

// parseDateYMD strictly parses YYYY-MM-DD and returns the canonical form.
func parseDateYMD(s string) (string, error) {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return "", fmt.Errorf("%w: date must be YYYY-MM-DD", ErrInvalidInput)
	}
	return t.Format("2006-01-02"), nil
}

func validateAttendanceStatus(s string) error {
	if !validAttendanceStatus[s] {
		return fmt.Errorf("%w: status must be one of present, absent, late", ErrInvalidInput)
	}
	return nil
}

// ── LIKE escaping ─────────────────────────────────────────────────────────────

// escapeLike escapes %, _ and \ so user input matches literally. Queries must
// use it with an explicit ESCAPE '\' clause.
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// likeContains builds the "%term%" pattern for a literal substring search.
func likeContains(s string) string { return "%" + escapeLike(s) + "%" }

// ── Keyset cursor on (full_name, id) ──────────────────────────────────────────

// encodeCursor packs the last row's (full_name, id) into an opaque token.
func encodeCursor(fullName, id string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(id + "\x00" + fullName))
}

// decodeCursor reverses encodeCursor. ok=false means the token is not a
// valid keyset cursor (callers answer 400 via ErrInvalidInput).
func decodeCursor(tok string) (fullName, id string, ok bool) {
	b, err := base64.RawURLEncoding.DecodeString(tok)
	if err != nil {
		return "", "", false
	}
	i := strings.IndexByte(string(b), 0)
	if i <= 0 {
		return "", "", false
	}
	return string(b[i+1:]), string(b[:i]), true
}
