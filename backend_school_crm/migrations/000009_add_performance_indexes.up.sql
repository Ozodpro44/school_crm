-- Migration 000009: Add composite indexes for hot query paths
-- These compound indexes cover the exact column combinations used in the
-- most-queried endpoints, eliminating sequential scans on large tables.

-- Payments — consolidated endpoint filters by branch + month + year together
CREATE INDEX IF NOT EXISTS idx_payments_branch_month_year
    ON payments(branch_id, month, year);

-- Payments — payment status checks per student (used in student list lateral join)
CREATE INDEX IF NOT EXISTS idx_payments_student_id_status
    ON payments(student_id, status);

-- Students — branch + status is the most common filter combination
CREATE INDEX IF NOT EXISTS idx_students_branch_status
    ON students(branch_id, status);

-- Salaries — consolidated endpoint filters by branch + month + year together
CREATE INDEX IF NOT EXISTS idx_salaries_branch_month_year
    ON salaries(branch_id, month, year);

-- Expenses — filtered by branch + date range
CREATE INDEX IF NOT EXISTS idx_expenses_branch_date
    ON expenses(branch_id, date);
