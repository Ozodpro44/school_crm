-- Add subscription permission columns to permissions table
ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS can_view_subscriptions BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_manage_subscriptions BOOLEAN DEFAULT false;
