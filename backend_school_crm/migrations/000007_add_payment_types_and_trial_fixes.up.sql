-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 000007: payment_types table + free-trial schema fixes
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Payment types registry -------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_types (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code         VARCHAR(50)  UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description  TEXT,
    is_active    BOOLEAN      NOT NULL DEFAULT true,
    is_system    BOOLEAN      NOT NULL DEFAULT false,  -- system types cannot be deleted
    sort_order   INTEGER      NOT NULL DEFAULT 0,
    config       JSONB        NOT NULL DEFAULT '{}',   -- gateway-specific metadata
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed the four canonical types; ON CONFLICT keeps existing rows intact
INSERT INTO payment_types (code, display_name, description, is_active, is_system, sort_order) VALUES
    ('click',      'Click.uz',       'Pay via Click.uz online payment gateway', true,  true,  1),
    ('telegram',   'Telegram',       'Pay via Telegram payment bot',            true,  true,  2),
    ('manual',     'Bank Transfer',  'Manual bank-transfer (contact admin)',     true,  true,  3),
    ('free_trial', 'Free Trial',     'Internal free-trial grant',               false, true,  99)
ON CONFLICT (code) DO NOTHING;

-- 2. Track whether an admin user has ever used a free trial -----------------
--    NULL  = never used
--    NOT NULL = timestamp the first trial subscription was created
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ;

-- Backfill: mark existing users who already have a free_trial subscription
UPDATE users u
SET trial_used_at = sub.created_at
FROM (
    SELECT user_id, MIN(created_at) AS created_at
    FROM subscriptions
    WHERE payment_method = 'free_trial'
    GROUP BY user_id
) sub
WHERE sub.user_id = u.id
  AND u.trial_used_at IS NULL;

-- 3. Fix existing trial subscriptions ----------------------------------------
--    Historical free-trial subs were created with status='active' instead of
--    'trial'.  Fix them so the gate and billing page see correct status.
UPDATE subscriptions
SET status = 'trial'
WHERE payment_method = 'free_trial'
  AND status = 'active';

--    Also ensure end_date is populated from renewal_date when missing
--    (the original Register code set renewal_date but not end_date).
UPDATE subscriptions
SET end_date = renewal_date
WHERE end_date IS NULL
  AND renewal_date IS NOT NULL
  AND payment_method = 'free_trial';
