-- Add settings JSONB column to developers table for per-developer dashboard preferences
ALTER TABLE developers ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
