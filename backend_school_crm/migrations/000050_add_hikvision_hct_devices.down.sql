DROP INDEX IF EXISTS idx_hikvision_employees_hct_person;
ALTER TABLE hikvision_employees DROP COLUMN IF EXISTS hct_person_id;
DROP INDEX IF EXISTS idx_hikvision_devices_hct_serial;
ALTER TABLE hikvision_devices
    DROP COLUMN IF EXISTS hct_access_level_id,
    DROP COLUMN IF EXISTS hct_serial;
