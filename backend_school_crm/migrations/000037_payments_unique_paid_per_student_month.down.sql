-- Demoted duplicate rows (see up migration) are intentionally NOT reverted.
DROP INDEX IF EXISTS uq_payments_student_month_year_paid;
