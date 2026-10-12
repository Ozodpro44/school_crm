DROP INDEX IF EXISTS uq_salaries_teacher_month_year_live;

-- Re-adding the table-wide constraint is only possible when no soft-deleted
-- row collides with a live one; otherwise keep the partial index's guarantee
-- (which is already in place until the DROP above) by skipping.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM salaries GROUP BY teacher_id, month, year HAVING COUNT(*) > 1
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'salaries_teacher_month_year_unique'
    ) THEN
        ALTER TABLE salaries ADD CONSTRAINT salaries_teacher_month_year_unique UNIQUE (teacher_id, month, year);
    ELSE
        RAISE NOTICE 'salaries_teacher_month_year_unique not restored (duplicates incl. soft-deleted rows exist)';
    END IF;
END $$;
