ALTER TABLE permissions
    DROP COLUMN IF EXISTS can_view_attendance,
    DROP COLUMN IF EXISTS can_view_assignments,
    DROP COLUMN IF EXISTS can_send_messages;
