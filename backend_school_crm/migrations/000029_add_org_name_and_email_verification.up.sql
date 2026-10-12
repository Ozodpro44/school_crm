-- Closes two related registration gaps found during a live audit:
--
-- 1. The "school name" collected at signup was only ever written into the
--    first branch's own `name` column — there was no field representing the
--    organization itself, so a school's brand identity vanished the moment
--    it opened a second branch with its own name (a receipt printed at
--    branch #2 showed only that branch's name, nowhere the parent brand).
--
-- 2. Registration granted a real, working account with zero email
--    ownership verification — anyone could type any email address and get
--    full access. email_verified lets auth_service gate full bootstrapping
--    (trial subscription, permissions) behind confirming the address.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Existing accounts predate this flag entirely — treat them as already
-- verified so nobody already using the product gets locked out retroactively.
UPDATE users SET email_verified = true, email_verified_at = created_at
WHERE email_verified = false;

-- permissions.user_id had no uniqueness guard despite being conceptually
-- one-row-per-user everywhere it's read (PermissionService.GetByUserID,
-- Upsert). Without it, an `ON CONFLICT (user_id)` upsert — the natural way
-- to make permissions-bootstrap idempotent — can't be expressed at all.
-- permissions has no timestamp column to order by, so any pre-existing
-- duplicates are collapsed to one arbitrary (max-id) survivor per user
-- before the constraint is added — which row wins doesn't matter here,
-- only that exactly one remains, so this can't fail on data that predates it.
DELETE FROM permissions p
USING permissions p2
WHERE p.user_id = p2.user_id AND p.id < p2.id;

ALTER TABLE permissions ADD CONSTRAINT permissions_user_id_unique UNIQUE (user_id);
