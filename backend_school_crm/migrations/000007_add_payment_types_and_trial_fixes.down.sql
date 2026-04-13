-- Rollback 000007
ALTER TABLE users DROP COLUMN IF EXISTS trial_used_at;
DROP TABLE IF EXISTS payment_types;
