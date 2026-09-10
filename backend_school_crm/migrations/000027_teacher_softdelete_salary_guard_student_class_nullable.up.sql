-- Closes three findings from the microservices business-logic audit:
--
-- 1. teachers had no soft-delete flag, so removing a teacher issued a hard
--    DELETE, which cascades (salaries.teacher_id ON DELETE CASCADE) and wipes
--    that teacher's entire paid/unpaid salary history. Adding is_active lets
--    teacher_service stop hard-deleting and just deactivate instead.
--
-- 2. salaries had no uniqueness guard, so double-submitting "create salary"
--    for the same teacher/month/year silently created two rows, both
--    counted in branch/teacher totals.
--
-- 3. students.class_id was NOT NULL despite its own FK declaring
--    ON DELETE SET NULL, and despite student_service's "unassigned class"
--    filter (WHERE class_id IS NULL) — the filter could never match a row.

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_teachers_branch_active ON teachers(branch_id, is_active);

ALTER TABLE salaries ADD CONSTRAINT salaries_teacher_month_year_unique UNIQUE (teacher_id, month, year);

ALTER TABLE students ALTER COLUMN class_id DROP NOT NULL;
