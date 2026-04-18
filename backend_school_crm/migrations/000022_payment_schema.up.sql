-- P3.3: Create the `payment` schema boundary.
--
-- Strategy (Strangler Fig):
-- 1. Create the schema now — payment_service uses search_path=payment,public.
-- 2. Tables physically remain in `public` so the monolith continues to work.
-- 3. Create views in `payment` schema pointing to public tables.
--    payment_service reads via the `payment` schema; monolith reads `public`.
-- 4. When the monolith is decommissioned (P5.5), run the follow-up migration
--    that moves table storage to `payment` schema and drops the views.

CREATE SCHEMA IF NOT EXISTS payment;

-- Views that mirror the public tables under the payment schema.
-- payment_service sets search_path=payment,public so it resolves these first.
CREATE OR REPLACE VIEW payment.payments AS SELECT * FROM public.payments;
CREATE OR REPLACE VIEW payment.subscriptions AS SELECT * FROM public.subscriptions;
CREATE OR REPLACE VIEW payment.subscription_plans AS SELECT * FROM public.subscription_plans;
CREATE OR REPLACE VIEW payment.subscription_payments AS SELECT * FROM public.subscription_payments;
CREATE OR REPLACE VIEW payment.subscription_usage AS SELECT * FROM public.subscription_usage;

-- Grant the application role access to the payment schema
-- (replace school_user with your actual DB user if different)
GRANT USAGE ON SCHEMA payment TO school_user;
GRANT SELECT ON ALL TABLES IN SCHEMA payment TO school_user;
