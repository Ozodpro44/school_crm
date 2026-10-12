-- Branches and classes previously had no active/inactive concept at all
-- (unlike students.status='left' and teachers.is_active, which already
-- existed). Needed so a plan downgrade can deactivate excess
-- most-recently-created branches/classes instead of deleting them.
ALTER TABLE branches
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE classes
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_branches_admin_active ON branches(admin_id, is_active);
CREATE INDEX IF NOT EXISTS idx_classes_branch_active ON classes(branch_id, is_active);
