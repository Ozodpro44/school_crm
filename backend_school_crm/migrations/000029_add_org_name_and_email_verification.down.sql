ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_user_id_unique;

ALTER TABLE users
    DROP COLUMN IF EXISTS organization_name,
    DROP COLUMN IF EXISTS email_verified,
    DROP COLUMN IF EXISTS email_verified_at;
