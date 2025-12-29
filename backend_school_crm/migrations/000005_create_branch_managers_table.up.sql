-- Create branch_managers table
CREATE TABLE IF NOT EXISTS branch_managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, manager_id)
);

-- Create indexes for better performance
CREATE INDEX idx_branch_managers_branch_id ON branch_managers(branch_id);
CREATE INDEX idx_branch_managers_manager_id ON branch_managers(manager_id);
