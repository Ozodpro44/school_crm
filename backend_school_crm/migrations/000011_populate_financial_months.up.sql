-- Populate financial_months for all existing branches
-- Create a financial month for each branch for the current month
INSERT INTO financial_months (id, branch_id, year, month, status, payment_amount, opened_at)
SELECT 
    gen_random_uuid(),
    b.id,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as year,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER as month,
    'OPEN'::VARCHAR,
    b.monthly_payment,
    CURRENT_TIMESTAMP
FROM branches b
WHERE NOT EXISTS (
    SELECT 1 FROM financial_months fm
    WHERE fm.branch_id = b.id
        AND fm.year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
        AND fm.month = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
)
ON CONFLICT (branch_id, year, month) DO NOTHING;

-- Update branches to set their current_financial_month_id if not already set
UPDATE branches b
SET current_financial_month_id = fm.id, updated_at = CURRENT_TIMESTAMP
FROM financial_months fm
WHERE b.id = fm.branch_id
    AND b.current_financial_month_id IS NULL
    AND fm.year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    AND fm.month = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
