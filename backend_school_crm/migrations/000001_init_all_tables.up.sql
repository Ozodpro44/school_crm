-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create branches table before tables that reference it
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500),
    phone VARCHAR(20),
    monthly_payment DECIMAL(20, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'UZS',
    admin_id UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(20,2) NOT NULL,
    billing_period VARCHAR(50) NOT NULL DEFAULT 'monthly',
    max_branches INTEGER,
    max_students INTEGER,
    max_classes INTEGER,
    features JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    renewal_date TIMESTAMP,
    auto_renew BOOLEAN DEFAULT true,
    payment_method VARCHAR(50),
    stripe_subscription_id VARCHAR(255),
    notes TEXT,
    cancelled_at TIMESTAMP,
    cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create subscription_usage table
CREATE TABLE IF NOT EXISTS subscription_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    current_usage INTEGER NOT NULL DEFAULT 0,
    limit_value INTEGER,
    reset_date TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create subscription_payments table
CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    amount DECIMAL(20,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_date TIMESTAMP,
    invoice_number VARCHAR(100) UNIQUE,
    stripe_payment_id VARCHAR(255),
    payment_method VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create branch_managers table
CREATE TABLE IF NOT EXISTS branch_managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (branch_id, manager_id)
);

-- Create classes table
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    name VARCHAR(255) NOT NULL,
    teacher_id UUID,
    branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create students table
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    full_name VARCHAR(255) NOT NULL,
    class_id UUID NOT NULL REFERENCES classes (id) ON DELETE SET NULL,
    phone VARCHAR(20),
    parent_phone VARCHAR(20),
    monthly_payment DECIMAL(20, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    enrollment_date TIMESTAMP,
    left_date TIMESTAMP,
    class_signed_date TIMESTAMP,
    class_confirmed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create teachers table
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    full_name VARCHAR(255) NOT NULL,
    monthly_salary DECIMAL(20, 2) NOT NULL DEFAULT 0,
    phone VARCHAR(20),
    email VARCHAR(255),
    branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    joined_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add teacher_id foreign key to classes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_classes_teacher_id'
    ) THEN
        ALTER TABLE classes
        ADD CONSTRAINT fk_classes_teacher_id FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create teacher_subjects table
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL
);

-- Create financial_months table
CREATE TABLE IF NOT EXISTS financial_months (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (
        month >= 1
        AND month <= 12
    ),
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    payment_amount DECIMAL(20, 2) DEFAULT 0,
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (branch_id, year, month)
);

-- Add current_financial_month_id to branches
ALTER TABLE branches
ADD COLUMN IF NOT EXISTS current_financial_month_id UUID REFERENCES financial_months (id) ON DELETE SET NULL;

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
    amount DECIMAL(20, 2) NOT NULL,
    month VARCHAR(2) NOT NULL,
    year INTEGER NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    status VARCHAR(50) DEFAULT 'unpaid',
    invoice_number VARCHAR(100),
    notes TEXT,
    paid_date TIMESTAMP,
    branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    created_by UUID REFERENCES users (id) ON DELETE SET NULL,
    financial_month_id UUID REFERENCES financial_months (id) ON DELETE RESTRICT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create salaries table
CREATE TABLE IF NOT EXISTS salaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
    amount DECIMAL(20, 2) NOT NULL,
    month VARCHAR(2) NOT NULL,
    year INTEGER NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'bank',
    status VARCHAR(50) DEFAULT 'unpaid',
    notes TEXT,
    paid_date TIMESTAMP,
    branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    created_by UUID REFERENCES users (id) ON DELETE SET NULL,
    financial_month_id UUID REFERENCES financial_months (id) ON DELETE RESTRICT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(20, 2) NOT NULL,
    category VARCHAR(100),
    payment_method VARCHAR(50) DEFAULT 'cash',
    date TIMESTAMP NOT NULL,
    branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    financial_month_id UUID REFERENCES financial_months (id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create incomes table
CREATE TABLE IF NOT EXISTS incomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    source VARCHAR(255) NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    date TIMESTAMP NOT NULL,
    description TEXT,
    branch_id UUID NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    can_view_students BOOLEAN DEFAULT false,
    can_create_students BOOLEAN DEFAULT false,
    can_edit_students BOOLEAN DEFAULT false,
    can_delete_students BOOLEAN DEFAULT false,
    can_view_teachers BOOLEAN DEFAULT false,
    can_create_teachers BOOLEAN DEFAULT false,
    can_edit_teachers BOOLEAN DEFAULT false,
    can_delete_teachers BOOLEAN DEFAULT false,
    can_view_classes BOOLEAN DEFAULT false,
    can_create_classes BOOLEAN DEFAULT false,
    can_edit_classes BOOLEAN DEFAULT false,
    can_delete_classes BOOLEAN DEFAULT false,
    can_view_payments BOOLEAN DEFAULT false,
    can_create_payments BOOLEAN DEFAULT false,
    can_edit_payments BOOLEAN DEFAULT false,
    can_view_salaries BOOLEAN DEFAULT false,
    can_create_salaries BOOLEAN DEFAULT false,
    can_edit_salaries BOOLEAN DEFAULT false,
    can_view_expenses BOOLEAN DEFAULT false,
    can_create_expenses BOOLEAN DEFAULT false,
    can_edit_expenses BOOLEAN DEFAULT false,
    can_delete_expenses BOOLEAN DEFAULT false,
    can_view_reports BOOLEAN DEFAULT false,
    can_finish_month BOOLEAN DEFAULT false,
    can_view_settings BOOLEAN DEFAULT false,
    can_edit_settings BOOLEAN DEFAULT false,
    can_view_subscriptions BOOLEAN DEFAULT true,
    can_manage_subscriptions BOOLEAN DEFAULT false
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_branch_id ON subscriptions (branch_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_subscription_id ON subscription_usage (subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_id ON subscription_payments (subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments (status);

CREATE INDEX IF NOT EXISTS idx_students_branch_id ON students (branch_id);

CREATE INDEX IF NOT EXISTS idx_students_class_id ON students (class_id);

CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments (student_id);

CREATE INDEX IF NOT EXISTS idx_payments_branch_id ON payments (branch_id);

CREATE INDEX IF NOT EXISTS idx_payments_month_year ON payments (month, year);

CREATE INDEX IF NOT EXISTS idx_payments_financial_month_id ON payments (financial_month_id);

CREATE INDEX IF NOT EXISTS idx_salaries_teacher_id ON salaries (teacher_id);

CREATE INDEX IF NOT EXISTS idx_salaries_branch_id ON salaries (branch_id);

CREATE INDEX IF NOT EXISTS idx_salaries_month_year ON salaries (month, year);

CREATE INDEX IF NOT EXISTS idx_salaries_financial_month_id ON salaries (financial_month_id);

CREATE INDEX IF NOT EXISTS idx_expenses_branch_id ON expenses (branch_id);

CREATE INDEX IF NOT EXISTS idx_expenses_financial_month_id ON expenses (financial_month_id);

CREATE INDEX IF NOT EXISTS idx_incomes_branch_id ON incomes (branch_id);

CREATE INDEX IF NOT EXISTS idx_classes_branch_id ON classes (branch_id);

CREATE INDEX IF NOT EXISTS idx_teachers_branch_id ON teachers (branch_id);

CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON permissions (user_id);

CREATE INDEX IF NOT EXISTS idx_branch_managers_branch_id ON branch_managers (branch_id);

CREATE INDEX IF NOT EXISTS idx_branch_managers_manager_id ON branch_managers (manager_id);

CREATE INDEX IF NOT EXISTS idx_financial_months_branch_id ON financial_months (branch_id);

CREATE INDEX IF NOT EXISTS idx_financial_months_status ON financial_months (status);

CREATE INDEX IF NOT EXISTS idx_financial_months_year_month ON financial_months (year, month);

-- Populate financial_months for all existing branches
INSERT INTO
    financial_months (
        id,
        branch_id,
        year,
        month,
        status,
        payment_amount,
        opened_at
    )
SELECT
    gen_random_uuid (),
    b.id,
    EXTRACT(
        YEAR
        FROM CURRENT_DATE
    )::INTEGER as year,
    EXTRACT(
        MONTH
        FROM CURRENT_DATE
    )::INTEGER as month,
    'OPEN'::VARCHAR,
    b.monthly_payment,
    CURRENT_TIMESTAMP
FROM branches b
WHERE
    NOT EXISTS (
        SELECT 1
        FROM financial_months fm
        WHERE
            fm.branch_id = b.id
            AND fm.year = EXTRACT(
                YEAR
                FROM CURRENT_DATE
            )::INTEGER
            AND fm.month = EXTRACT(
                MONTH
                FROM CURRENT_DATE
            )::INTEGER
    )
ON CONFLICT (branch_id, year, month) DO NOTHING;

-- Update branches to set their current_financial_month_id if not already set
UPDATE branches b
SET
    current_financial_month_id = fm.id,
    updated_at = CURRENT_TIMESTAMP
FROM financial_months fm
WHERE
    b.id = fm.branch_id
    AND b.current_financial_month_id IS NULL
    AND fm.year = EXTRACT(
        YEAR
        FROM CURRENT_DATE
    )::INTEGER
    AND fm.month = EXTRACT(
        MONTH
        FROM CURRENT_DATE
    )::INTEGER;
