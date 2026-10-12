ALTER TABLE subscription_plans
    DROP COLUMN IF EXISTS max_teachers,
    DROP COLUMN IF EXISTS is_featured,
    DROP COLUMN IF EXISTS sort_order;
