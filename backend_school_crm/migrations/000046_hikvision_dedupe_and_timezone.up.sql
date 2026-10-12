-- recordFaceEvent used SELECT COUNT(*) then INSERT, which raced between the
-- push webhook and the poller. Enforce uniqueness in the database instead.

-- 1. Remove existing duplicate scans (keep the earliest row per scan).
DELETE FROM attendance_records a
USING attendance_records b
WHERE a.device_id = b.device_id
  AND a.employee_no = b.employee_no
  AND a.event_time = b.event_time
  AND (a.created_at, a.id) > (b.created_at, b.id);

-- 2. One row per (device, employee, event time).
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_records_scan
    ON attendance_records (device_id, employee_no, event_time);

-- 3. Optional IANA timezone of the terminal's clock (e.g. 'Asia/Tashkent').
--    NULL/empty = the clock is treated as UTC (historical behaviour).
ALTER TABLE hikvision_devices ADD COLUMN IF NOT EXISTS timezone VARCHAR(64);
