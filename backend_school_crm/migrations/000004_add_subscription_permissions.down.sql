-- Remove subscription permission columns from permissions table
ALTER TABLE permissions
DROP COLUMN IF EXISTS can_view_subscriptions,
DROP COLUMN IF EXISTS can_manage_subscriptions;
