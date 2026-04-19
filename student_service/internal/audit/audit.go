package audit

import (
	"context"
	"database/sql"
	"log/slog"
)

// Log inserts a row into audit_logs. Errors are logged but never returned —
// a failed audit write must never break the main operation.
func Log(ctx context.Context, db *sql.DB, branchID, userID, action, resource, resourceID, description string) {
	_, err := db.ExecContext(ctx,
		`INSERT INTO audit_logs (branch_id, user_id, action, resource, resource_id, description)
		 VALUES (NULLIF($1,'')::uuid, NULLIF($2,'')::uuid, $3, $4, NULLIF($5,'')::uuid, $6)`,
		branchID, userID, action, resource, resourceID, description,
	)
	if err != nil {
		slog.Warn("audit log failed", "error", err, "action", action, "resource", resource)
	}
}
