ALTER TABLE permissions
    DROP COLUMN IF EXISTS can_delete_payments,
    DROP COLUMN IF EXISTS can_delete_salaries;
