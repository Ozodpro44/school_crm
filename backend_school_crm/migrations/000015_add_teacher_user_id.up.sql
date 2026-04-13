-- Link a teachers record to its login user account
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id);
