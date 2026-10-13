-- permissions had can_delete_* only for students, teachers, classes and
-- expenses (000001), and user_service never read/wrote can_delete_classes.
-- Add the two missing delete flags so every delete in the UI can be granted
-- (and enforced server-side) per user. Default false = unchanged behaviour.
ALTER TABLE permissions
    ADD COLUMN IF NOT EXISTS can_delete_payments BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS can_delete_salaries BOOLEAN NOT NULL DEFAULT false;
