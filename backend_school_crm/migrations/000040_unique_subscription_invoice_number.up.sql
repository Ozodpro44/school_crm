-- Invoice numbers identify payments in provider callbacks, so they must be unique.
-- Disambiguate existing duplicates first (keep the oldest row's number unchanged).
UPDATE subscription_payments sp
SET invoice_number = sp.invoice_number || '-dup-' || sp.id::text
FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY invoice_number ORDER BY created_at, id) AS rn
    FROM subscription_payments
    WHERE invoice_number IS NOT NULL AND invoice_number <> ''
) d
WHERE sp.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_payments_invoice_number
    ON subscription_payments (invoice_number)
    WHERE invoice_number IS NOT NULL AND invoice_number <> '';
