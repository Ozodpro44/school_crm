-- OTAP HTTPS PUSH devices: the terminal connects OUT to us (no inbound access
-- to the device), so a device is identified by its serial (DEVID in the URL)
-- and authenticated with a per-device credential we generate. ISAPI-managed
-- devices keep protocol='isapi' and are unaffected.

ALTER TABLE hikvision_devices
    ADD COLUMN IF NOT EXISTS protocol       VARCHAR(10) NOT NULL DEFAULT 'isapi',
    ADD COLUMN IF NOT EXISTS push_device_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS push_username  VARCHAR(64),
    ADD COLUMN IF NOT EXISTS push_password  VARCHAR(128),
    ADD COLUMN IF NOT EXISTS last_seen_at   TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hikvision_devices_push_device_id
    ON hikvision_devices (push_device_id) WHERE push_device_id IS NOT NULL;
