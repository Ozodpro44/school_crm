ALTER TABLE students ALTER COLUMN class_id SET NOT NULL;

ALTER TABLE salaries DROP CONSTRAINT IF EXISTS salaries_teacher_month_year_unique;

DROP INDEX IF EXISTS idx_teachers_branch_active;
ALTER TABLE teachers DROP COLUMN IF EXISTS is_active;
