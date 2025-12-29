-- Ensure created_by columns exist in payments, salaries, and expenses tables
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE payments ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'salaries' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE salaries ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE expenses ADD COLUMN created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
