DROP INDEX IF EXISTS idx_branches_deleted_at;
DROP INDEX IF EXISTS idx_users_deleted_at;
DROP INDEX IF EXISTS idx_teachers_deleted_at;
DROP INDEX IF EXISTS idx_salaries_deleted_at;
DROP INDEX IF EXISTS idx_students_deleted_at;
DROP INDEX IF EXISTS idx_classes_deleted_at;
DROP INDEX IF EXISTS idx_assignments_deleted_at;
DROP INDEX IF EXISTS idx_payments_deleted_at;
DROP INDEX IF EXISTS idx_expenses_deleted_at;

ALTER TABLE branches    DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE users       DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE teachers    DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE salaries    DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE students    DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE classes     DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE assignments DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE payments    DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE expenses    DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
