-- Found via live dev-portal testing: GET /api/v1/payment-types (and payment_type
-- getAll internally) failed with `pq: relation "payment_types" does not exist`.
-- Migration 000007_add_payment_types_and_trial_fixes defines this table but,
-- like 000008 (see 000030), its DDL never actually landed on this database
-- even though schema_migrations reports the chain as fully applied through
-- version 30. Re-applying 000007's contents here verbatim (idempotent:
-- IF NOT EXISTS / ON CONFLICT DO NOTHING / IS NULL guards throughout).

CREATE TABLE IF NOT EXISTS payment_types (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    code         VARCHAR(50)  UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description  TEXT,
    is_active    BOOLEAN      NOT NULL DEFAULT true,
    is_system    BOOLEAN      NOT NULL DEFAULT false,
    sort_order   INTEGER      NOT NULL DEFAULT 0,
    config       JSONB        NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO payment_types (code, display_name, description, is_active, is_system, sort_order) VALUES
    ('click',      'Click.uz',       'Pay via Click.uz online payment gateway', true,  true,  1),
    ('telegram',   'Telegram',       'Pay via Telegram payment bot',            true,  true,  2),
    ('manual',     'Bank Transfer',  'Manual bank-transfer (contact admin)',     true,  true,  3),
    ('free_trial', 'Free Trial',     'Internal free-trial grant',               false, true,  99)
ON CONFLICT (code) DO NOTHING;

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

UPDATE subscriptions
SET status = 'trial'
WHERE payment_method = 'free_trial'
  AND status = 'active';

UPDATE subscriptions
SET end_date = renewal_date
WHERE end_date IS NULL
  AND renewal_date IS NOT NULL
  AND payment_method = 'free_trial';
