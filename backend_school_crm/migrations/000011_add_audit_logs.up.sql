CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID REFERENCES branches(id) ON DELETE SET NULL,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(20)  NOT NULL,  -- create | update | delete
    resource    VARCHAR(50)  NOT NULL,  -- payment | student | teacher | salary | expense | class | branch | user
    resource_id UUID,
    description TEXT         NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_created ON audit_logs(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id        ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource       ON audit_logs(branch_id, resource);
