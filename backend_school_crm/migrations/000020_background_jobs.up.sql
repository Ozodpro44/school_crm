CREATE TABLE IF NOT EXISTS background_jobs (
    id          TEXT        PRIMARY KEY,
    type        TEXT        NOT NULL,
    status      TEXT        NOT NULL DEFAULT 'pending',
    payload     JSONB       NOT NULL DEFAULT '{}',
    result      JSONB,
    error       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at  TIMESTAMPTZ,
    done_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_created ON background_jobs(created_at DESC);
