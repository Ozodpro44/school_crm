-- Remove current_month and current_year columns from branches table
ALTER TABLE branches DROP COLUMN IF EXISTS current_month;
ALTER TABLE branches DROP COLUMN IF EXISTS current_year;
