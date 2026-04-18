DROP INDEX IF EXISTS idx_users_locked_until;
DROP INDEX IF EXISTS idx_users_reset_token;

ALTER TABLE users
    DROP COLUMN IF EXISTS language,
    DROP COLUMN IF EXISTS avatar_url,
    DROP COLUMN IF EXISTS phone,
    DROP COLUMN IF EXISTS locked_until,
    DROP COLUMN IF EXISTS failed_login_attempts,
    DROP COLUMN IF EXISTS password_reset_expires,
    DROP COLUMN IF EXISTS password_reset_token,
    DROP COLUMN IF EXISTS last_login_at;

ALTER TABLE users RENAME COLUMN password_hash TO password;
