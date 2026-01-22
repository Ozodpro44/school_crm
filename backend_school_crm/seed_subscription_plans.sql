-- Seed default subscription plans
-- This script populates the subscription_plans table with default plans

INSERT INTO subscription_plans (id, name, description, price, billing_period, max_branches, max_students, max_classes, features, status, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'Starter', 'Perfect for small schools starting their digital journey', 29.99, 'monthly', 1, 100, 5, '{"analytics": false, "api_access": false, "priority_support": false}', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Professional', 'Designed for growing schools with multiple classes', 79.99, 'monthly', 3, 500, 20, '{"analytics": true, "api_access": false, "priority_support": true}', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Enterprise', 'Complete solution for large educational institutions', 199.99, 'monthly', 10, 5000, 100, '{"analytics": true, "api_access": true, "priority_support": true}', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
