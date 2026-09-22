-- Universal soft-delete for the 9 resources that have a delete action today
-- (branches, users, teachers, salaries, students, classes, assignments,
-- payments, expenses), backing a Trash/Restore feature: 7-day recovery
-- window for regular admins/managers, 30 days for developer/super_admin.
--
-- branches cascade-deletes into nearly every other table (classes,
-- students, teachers, payments, salaries, expenses, attendance, notes,
-- contact_log, schedule, message_log, assignments, financial_months,
-- subscriptions), and students cascade-deletes payments/attendance/
-- notes/contact_log/submissions — hard-deleting either today silently
-- destroys a school's financial/academic history. Soft-deleting instead
-- (deleted_at set, excluded from normal queries, still recoverable) is
-- what makes it safe to let a branch's own owner delete their branch at
-- all, which is the point of this migration.
ALTER TABLE branches    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
                         ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
                         ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE teachers    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
                         ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE salaries    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
                         ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE students    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
                         ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE classes     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
                         ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
                         ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payments    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
                         ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE expenses    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
                         ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Every "active" query on these tables will filter on deleted_at IS NULL;
-- index it so that filter stays cheap as trash accumulates.
CREATE INDEX IF NOT EXISTS idx_branches_deleted_at    ON branches(deleted_at)    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at       ON users(deleted_at)       WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teachers_deleted_at    ON teachers(deleted_at)    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_salaries_deleted_at    ON salaries(deleted_at)    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_deleted_at    ON students(deleted_at)    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_classes_deleted_at     ON classes(deleted_at)     WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_deleted_at ON assignments(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_deleted_at    ON payments(deleted_at)    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at    ON expenses(deleted_at)    WHERE deleted_at IS NOT NULL;
