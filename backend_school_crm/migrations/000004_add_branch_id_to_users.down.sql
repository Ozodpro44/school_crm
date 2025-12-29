-- Remove branch_id column from users table
ALTER TABLE users DROP COLUMN IF EXISTS branch_id;

-- Drop index if exists
DROP INDEX IF EXISTS idx_users_branch_id;
