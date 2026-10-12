-- Replace the table-wide UNIQUE (teacher_id, month, year) from 000027 with a
-- partial unique index over LIVE rows only. The old constraint also counted
-- soft-deleted rows, so after deleting a salary the same teacher/month could
-- never be re-created (and a restore could silently collide).
--
-- Defensive dedupe first (idempotent, non-destructive): if more than one live
-- row exists for a teacher/month/year (possible only if 000027's constraint
-- was never applied), the earliest stays live and the others are soft-deleted
-- so they land in the trash instead of being lost.

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY teacher_id, month, year
               ORDER BY created_at ASC NULLS LAST, id ASC
           ) AS rn
    FROM salaries
    WHERE deleted_at IS NULL
)
UPDATE salaries s
SET deleted_at = now()
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;

ALTER TABLE salaries DROP CONSTRAINT IF EXISTS salaries_teacher_month_year_unique;

CREATE UNIQUE INDEX IF NOT EXISTS uq_salaries_teacher_month_year_live
    ON salaries (teacher_id, month, year)
    WHERE deleted_at IS NULL;
