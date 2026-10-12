CREATE TABLE IF NOT EXISTS notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    message      TEXT NOT NULL,
    type         VARCHAR(50) NOT NULL DEFAULT 'info',   -- payment | student | system
    resource_type VARCHAR(50),                           -- payment | student
    resource_id  UUID,
    is_read      BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_branch_id    ON notifications(branch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_branch_unread ON notifications(branch_id, is_read);
