-- Add back current_month and current_year columns to branches table
ALTER TABLE branches ADD COLUMN current_month VARCHAR(2) DEFAULT '01';
ALTER TABLE branches ADD COLUMN current_year INTEGER DEFAULT 2025;
