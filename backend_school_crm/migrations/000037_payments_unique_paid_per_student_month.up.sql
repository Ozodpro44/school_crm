-- At most one live "paid" payment per student/month/year.
--
-- The application serialises Create/Update/Restore with an advisory lock, but
-- nothing at the database level stopped two paid rows from existing (e.g. via
-- a restore of a soft-deleted paid row, or a direct write). This adds the
-- backstop.
--
-- Dedupe strategy (non-destructive, idempotent): for every student/month/year
-- with more than one live paid row, the EARLIEST one (created_at, then id)
-- stays 'paid'; the later ones are demoted to 'partial'. No row is deleted and
-- no amount changes - income and per-student "amount paid" aggregates sum
-- paid + partial, so totals are unchanged. A note is appended so the demotion
-- is visible and can be reviewed/merged manually by an operator.

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY student_id, month, year
               ORDER BY created_at ASC NULLS LAST, id ASC
           ) AS rn
    FROM payments
    WHERE status = 'paid' AND deleted_at IS NULL
)
UPDATE payments p
SET status = 'partial',
    notes = CASE
        WHEN p.notes IS NULL OR p.notes = '' THEN '[migration 000037: duplicate paid payment demoted to partial]'
        ELSE p.notes || E'\n[migration 000037: duplicate paid payment demoted to partial]'
    END,
    updated_at = CURRENT_TIMESTAMP
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_student_month_year_paid
    ON payments (student_id, month, year)
    WHERE status = 'paid' AND deleted_at IS NULL;
