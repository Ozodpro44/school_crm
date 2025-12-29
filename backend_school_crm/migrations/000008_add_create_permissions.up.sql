-- Add create permissions to the permissions table
ALTER TABLE permissions 
ADD COLUMN IF NOT EXISTS can_create_students BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_create_teachers BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_create_classes BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_create_payments BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_create_salaries BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_create_expenses BOOLEAN DEFAULT false;
