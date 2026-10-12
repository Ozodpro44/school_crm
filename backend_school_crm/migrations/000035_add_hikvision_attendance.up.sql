-- Hikvision face-recognition attendance integration

CREATE TABLE IF NOT EXISTS hikvision_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    username VARCHAR(64) NOT NULL DEFAULT 'admin',
    password VARCHAR(255) NOT NULL,
    webhook_token VARCHAR(64) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hikvision_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    device_id UUID NOT NULL REFERENCES hikvision_devices (id) ON DELETE CASCADE,
    employee_no VARCHAR(32) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    teacher_id UUID REFERENCES teachers (id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (device_id, employee_no)
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    device_id UUID NOT NULL REFERENCES hikvision_devices (id) ON DELETE CASCADE,
    employee_id UUID REFERENCES hikvision_employees (id) ON DELETE SET NULL,
    employee_no VARCHAR(32) NOT NULL,
    event_time TIMESTAMP NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    minor_event INTEGER,
    source VARCHAR(10) NOT NULL DEFAULT 'push',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hikvision_employees_device ON hikvision_employees (device_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_time ON attendance_records (employee_id, event_time);
CREATE INDEX IF NOT EXISTS idx_attendance_records_device_time ON attendance_records (device_id, event_time);
