-- Hik-Connect for Teams (HCT) cloud devices: the terminal registers with
-- Hikvision's cloud, and we reach it through the HCT OpenAPI (no inbound access
-- to the school network, works behind NAT). protocol = 'hct'.
ALTER TABLE hikvision_devices
    ADD COLUMN IF NOT EXISTS hct_serial          VARCHAR(64),
    ADD COLUMN IF NOT EXISTS hct_access_level_id VARCHAR(64);

-- A serial can belong to exactly one branch (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS idx_hikvision_devices_hct_serial
    ON hikvision_devices (upper(hct_serial)) WHERE hct_serial IS NOT NULL;

-- The platform-side person id, to attribute webhook events to an employee row.
ALTER TABLE hikvision_employees
    ADD COLUMN IF NOT EXISTS hct_person_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_hikvision_employees_hct_person
    ON hikvision_employees (device_id, hct_person_id) WHERE hct_person_id IS NOT NULL;
