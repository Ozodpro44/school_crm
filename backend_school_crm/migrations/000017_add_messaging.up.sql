-- Telegram chat ID for parent messaging
ALTER TABLE students ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50) NOT NULL DEFAULT '';

-- Message send log
CREATE TABLE IF NOT EXISTS message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    template_key VARCHAR(100) NOT NULL DEFAULT '',
    recipients_count INT NOT NULL DEFAULT 0,
    delivered_count INT NOT NULL DEFAULT 0,
    filters JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_log_branch_id ON message_log(branch_id);
