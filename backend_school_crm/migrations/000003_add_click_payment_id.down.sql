-- Remove click_payment_id column from subscription_payments table
DROP INDEX IF EXISTS idx_subscription_payments_click_payment_id;
ALTER TABLE subscription_payments
DROP COLUMN IF EXISTS click_payment_id;
