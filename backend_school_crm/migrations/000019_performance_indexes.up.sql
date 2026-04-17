-- P1.1: Add missing performance indexes
-- Using CONCURRENTLY to avoid locking tables in production

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_class_status
    ON students(class_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_branch_created
    ON students(branch_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_month_year_status
    ON payments(branch_id, year, month, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_student_month
    ON payments(student_id, year, month);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_class_date
    ON attendance(class_id, date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_student_month
    ON attendance(student_id, date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_branch_created
    ON audit_logs(branch_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_action
    ON audit_logs(user_id, action);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id, is_read) WHERE is_read = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_salaries_teacher_month
    ON salaries(teacher_id, year, month);
