-- Add branch_id column to users table
ALTER TABLE users ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Create index for branch_id
CREATE INDEX idx_users_branch_id ON users(branch_id);
