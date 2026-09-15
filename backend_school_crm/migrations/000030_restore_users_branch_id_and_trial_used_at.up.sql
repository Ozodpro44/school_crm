-- Found via live registration testing: UserService.Register, GetOwnerIDForUser,
-- and BelongsToBranch (internal/service/user_service.go) all read/write
-- users.branch_id, and AdminGrantTrial (subscription_service.go) writes
-- users.trial_used_at — but neither column exists on this database's `users`
-- table. branch_id has a migration (000008_add_branch_id_to_users) that
-- defines it and was apparently never applied here (its index is missing
-- too); trial_used_at was never defined in any migration at all. Every one
-- of those code paths currently fails at the SQL level ("column ... does
-- not exist") — reproduced live via the registration flow.
--
-- Restoring both, idempotently, rather than rewriting the Go call sites:
-- users.branch_id is one of three association paths BelongsToBranch/
-- GetOwnerIDForUser are explicitly documented to check (the other two,
-- branch_managers and branches.admin_id, are unaffected by this bug), so
-- the column is load-bearing application logic, not dead schema.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
