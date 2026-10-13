DROP INDEX IF EXISTS idx_hikvision_devices_push_device_id;
ALTER TABLE hikvision_devices
    DROP COLUMN IF EXISTS last_seen_at,
    DROP COLUMN IF EXISTS push_password,
    DROP COLUMN IF EXISTS push_username,
    DROP COLUMN IF EXISTS push_device_id,
    DROP COLUMN IF EXISTS protocol;
