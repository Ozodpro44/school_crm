CREATE TABLE IF NOT EXISTS class_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6), -- 1=Mon … 6=Sat
    start_time VARCHAR(5) NOT NULL,  -- "09:00"
    end_time   VARCHAR(5) NOT NULL,  -- "10:30"
    room       VARCHAR(100) NOT NULL DEFAULT '',
    subject    VARCHAR(200) NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (class_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_class_schedule_class_id  ON class_schedule(class_id);
CREATE INDEX IF NOT EXISTS idx_class_schedule_branch_id ON class_schedule(branch_id);
