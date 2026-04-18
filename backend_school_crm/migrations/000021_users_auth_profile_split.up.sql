-- P1.5: Split users table into auth columns and profile columns.
-- The table stays as one physical table for now (no microservice split yet),
-- but columns are logically grouped so auth_service can own one set and
-- user_service can own the other when services are extracted in Phase 2/4.
--
-- Auth columns  : email, password_hash, last_login_at, password_reset_token,
--                 password_reset_expires_at, failed_login_attempts, locked_until
-- Profile columns: full_name, phone, avatar_url, language, role (kept here as
--                  it drives authorization in the monolith)

-- Rename password → password_hash to be explicit about what it stores
ALTER TABLE users RENAME COLUMN password TO password_hash;

-- Auth-domain additions
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS password_reset_token   TEXT,
    ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failed_login_attempts  SMALLINT    NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until           TIMESTAMPTZ;

-- Profile-domain additions
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS phone      VARCHAR(32),
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS language   VARCHAR(10) NOT NULL DEFAULT 'en';

-- Index on reset token for fast lookup during password-reset flow
CREATE INDEX IF NOT EXISTS idx_users_reset_token
    ON users(password_reset_token)
    WHERE password_reset_token IS NOT NULL;

-- Index on locked_until so the login query can skip lock check when null
CREATE INDEX IF NOT EXISTS idx_users_locked_until
    ON users(locked_until)
    WHERE locked_until IS NOT NULL;
