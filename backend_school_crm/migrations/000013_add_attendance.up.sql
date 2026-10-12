-- attendance: daily per-student attendance records
CREATE TABLE IF NOT EXISTS attendance (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    status      VARCHAR(10) NOT NULL CHECK (status IN ('present', 'absent', 'late')),
    note        TEXT,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (class_id, student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_branch_date
    ON attendance (branch_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_class_date
    ON attendance (class_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_student
    ON attendance (student_id, date);
