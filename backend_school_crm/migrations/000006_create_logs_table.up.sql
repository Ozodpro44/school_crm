-- Create logs table for developer dashboard log storage
CREATE TABLE IF NOT EXISTS logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    level       VARCHAR(10) NOT NULL DEFAULT 'INFO',
    module      VARCHAR(100),
    message     TEXT NOT NULL,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level     ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_module    ON logs(module);
