DROP INDEX IF EXISTS idx_branches_admin_active;
DROP INDEX IF EXISTS idx_classes_branch_active;
ALTER TABLE branches DROP COLUMN IF EXISTS is_active;
ALTER TABLE classes DROP COLUMN IF EXISTS is_active;
