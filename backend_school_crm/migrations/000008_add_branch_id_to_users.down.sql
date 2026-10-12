DROP INDEX IF EXISTS idx_users_branch_id;
ALTER TABLE users DROP COLUMN IF EXISTS branch_id;
