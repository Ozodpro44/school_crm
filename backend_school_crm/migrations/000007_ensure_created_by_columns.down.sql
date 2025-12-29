-- Rollback: Remove created_by columns if they exist
-- Note: This is a destructive migration, handle with care
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE payments DROP COLUMN IF EXISTS created_by;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'salaries' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE salaries DROP COLUMN IF EXISTS created_by;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE expenses DROP COLUMN IF EXISTS created_by;
    END IF;
END $$;
