-- Add settings columns to branches table
ALTER TABLE branches ADD COLUMN monthly_payment DECIMAL(15,2) DEFAULT 0;
ALTER TABLE branches ADD COLUMN currency VARCHAR(10) DEFAULT 'UZS';
ALTER TABLE branches ADD COLUMN created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE branches ADD COLUMN updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Drop settings table
DROP TABLE IF EXISTS settings;
