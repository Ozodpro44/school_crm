-- expense_budgets: monthly spending limits per category per branch
CREATE TABLE IF NOT EXISTS expense_budgets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    category    VARCHAR(100) NOT NULL,
    month       VARCHAR(2)   NOT NULL,  -- "01" .. "12"
    year        INT          NOT NULL,
    amount      DECIMAL(20,2) NOT NULL CHECK (amount >= 0),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (branch_id, category, month, year)
);

CREATE INDEX IF NOT EXISTS idx_expense_budgets_branch_period
    ON expense_budgets (branch_id, year, month);
