-- Page-level access for the Attendance, Tasks (assignments) and Messaging
-- pages. Until now every branch member saw them; DEFAULT true keeps that for
-- existing rows, and admins can now switch them off per manager.
ALTER TABLE permissions
    ADD COLUMN IF NOT EXISTS can_view_attendance  BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS can_view_assignments BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS can_send_messages    BOOLEAN NOT NULL DEFAULT true;
