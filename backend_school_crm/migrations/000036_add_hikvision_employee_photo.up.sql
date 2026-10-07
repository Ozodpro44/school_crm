-- Stores the bucket object key for an employee's uploaded face photo, so the
-- CRM can display it independently of the device's own copy.

ALTER TABLE hikvision_employees ADD COLUMN IF NOT EXISTS photo_key VARCHAR(512);
