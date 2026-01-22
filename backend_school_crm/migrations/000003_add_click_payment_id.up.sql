-- Add click_payment_id column to subscription_payments table
ALTER TABLE subscription_payments
ADD COLUMN click_payment_id VARCHAR(255) NULL;

-- Create index for faster lookups
CREATE INDEX idx_subscription_payments_click_payment_id ON subscription_payments(click_payment_id);
