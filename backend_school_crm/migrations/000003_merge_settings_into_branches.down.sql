-- This migration cannot be safely reverted as it merges data into branches table
-- Recreate settings table if needed manually
ALTER TABLE branches DROP COLUMN IF EXISTS currency;
ALTER TABLE branches DROP COLUMN IF EXISTS created_date;
ALTER TABLE branches DROP COLUMN IF EXISTS updated_date;
