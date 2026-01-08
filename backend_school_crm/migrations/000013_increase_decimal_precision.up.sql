-- Increase DECIMAL precision from (15,2) to (20,2) to allow larger monetary values
ALTER TABLE branches ALTER COLUMN monthly_payment TYPE DECIMAL(20,2);
ALTER TABLE students ALTER COLUMN monthly_payment TYPE DECIMAL(20,2);
ALTER TABLE teachers ALTER COLUMN monthly_salary TYPE DECIMAL(20,2);
ALTER TABLE payments ALTER COLUMN amount TYPE DECIMAL(20,2);
ALTER TABLE salaries ALTER COLUMN amount TYPE DECIMAL(20,2);
ALTER TABLE expenses ALTER COLUMN amount TYPE DECIMAL(20,2);
ALTER TABLE incomes ALTER COLUMN amount TYPE DECIMAL(20,2);
