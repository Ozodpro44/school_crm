-- Closes two performance findings from the microservices audit:
--
-- 1. student_service and finance_service both search with
--    `LOWER(col) LIKE LOWER('%term%')` — a leading wildcard, which a plain
--    btree index cannot use at all, forcing a sequential scan that gets
--    slower as the table grows. A trigram GIN index on the lowercased
--    column lets Postgres use it.
--
-- 2. finance_service filters by `EXTRACT(year FROM date)` /
--    `EXTRACT(month FROM date)` instead of a plain date range, which also
--    can't use a plain index on `date`. A matching expression index lets
--    Postgres use it directly.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_students_full_name_trgm
    ON students USING gin (lower(full_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_expenses_title_trgm
    ON expenses USING gin (lower(title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_expenses_branch_year_month
    ON expenses (branch_id, EXTRACT(year FROM date), EXTRACT(month FROM date));
