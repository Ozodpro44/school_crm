-- Remove current_month and current_year columns from branches table
-- These are now tracked in the financial_months table via current_financial_month_id
ALTER TABLE branches DROP COLUMN IF EXISTS current_month;
ALTER TABLE branches DROP COLUMN IF EXISTS current_year;
