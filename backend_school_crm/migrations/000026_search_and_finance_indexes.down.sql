DROP INDEX IF EXISTS idx_students_full_name_trgm;
DROP INDEX IF EXISTS idx_expenses_title_trgm;
DROP INDEX IF EXISTS idx_expenses_branch_year_month;
-- pg_trgm is left installed — other indexes/extensions may depend on it,
-- and dropping an extension is not something a down-migration should do
-- speculatively.
