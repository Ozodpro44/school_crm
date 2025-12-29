-- Remove create permissions from the permissions table (rollback)
ALTER TABLE permissions 
DROP COLUMN IF EXISTS can_create_students,
DROP COLUMN IF EXISTS can_create_teachers,
DROP COLUMN IF EXISTS can_create_classes,
DROP COLUMN IF EXISTS can_create_payments,
DROP COLUMN IF EXISTS can_create_salaries,
DROP COLUMN IF EXISTS can_create_expenses;
