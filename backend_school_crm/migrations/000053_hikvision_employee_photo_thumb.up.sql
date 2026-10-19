-- Small (<= 256px) JPEG copy of each employee's face photo, so the CRM can show
-- it without an object-storage bucket. The full-size photo only goes to the device.
ALTER TABLE hikvision_employees ADD COLUMN IF NOT EXISTS photo_thumb BYTEA;
