DROP FUNCTION IF EXISTS create_audit_log_partition(INT);
DROP FUNCTION IF EXISTS create_yearly_payment_partition(INT);

DROP TABLE IF EXISTS audit_logs_2026;
DROP TABLE IF EXISTS audit_logs_2025;
DROP TABLE IF EXISTS audit_logs_2024;
DROP TABLE IF EXISTS audit_logs_partitioned;

DROP TABLE IF EXISTS attendance_2026_h2;
DROP TABLE IF EXISTS attendance_2026_h1;
DROP TABLE IF EXISTS attendance_2025_h2;
DROP TABLE IF EXISTS attendance_2025_h1;
DROP TABLE IF EXISTS attendance_2024_h2;
DROP TABLE IF EXISTS attendance_2024_h1;
DROP TABLE IF EXISTS attendance_partitioned;

DROP TABLE IF EXISTS payments_2026;
DROP TABLE IF EXISTS payments_2025;
DROP TABLE IF EXISTS payments_2024;
DROP TABLE IF EXISTS payments_2023;
DROP TABLE IF EXISTS payments_partitioned;
