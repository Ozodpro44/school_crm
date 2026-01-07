-- Add current_month and current_year columns to branches table
ALTER TABLE branches ADD COLUMN IF NOT EXISTS current_month VARCHAR(2) DEFAULT '01';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS current_year INTEGER DEFAULT 2025;

-- Set current month/year to current date for existing branches
UPDATE branches 
SET current_month = TO_CHAR(CURRENT_DATE, 'MM'),
    current_year = EXTRACT(YEAR FROM CURRENT_DATE);
