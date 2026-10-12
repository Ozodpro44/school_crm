-- Grant subscription permissions to all users
UPDATE permissions 
SET can_view_subscriptions = true, 
    can_manage_subscriptions = true 
WHERE user_id IN (SELECT id FROM users WHERE role = 'admin');

-- Grant view permissions to all non-admin users
UPDATE permissions 
SET can_view_subscriptions = true 
WHERE user_id IN (SELECT id FROM users WHERE role != 'admin');

-- Ensure all users have permission records
INSERT INTO permissions (user_id, can_view_subscriptions, can_manage_subscriptions)
SELECT u.id, true, (u.role = 'admin')
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;
