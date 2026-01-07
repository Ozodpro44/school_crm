package db

const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
	id UUID PRIMARY KEY,
	email VARCHAR(255) UNIQUE NOT NULL,
	password VARCHAR(255) NOT NULL,
	role VARCHAR(50) NOT NULL,
	full_name VARCHAR(255) NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

const addUserBranchColumn = `
-- This migration is deprecated. Use branch_managers table instead.
SELECT 1;
`

const createBranchesTable = `
CREATE TABLE IF NOT EXISTS branches (
	id UUID PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	address TEXT NOT NULL,
	phone VARCHAR(20) NOT NULL,
	monthly_payment DECIMAL(10, 2) NOT NULL,
	currency VARCHAR(10) DEFAULT 'UZS',
	admin_id UUID,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

const addBranchAdminForeignKey = `
DO $$ 
BEGIN
	IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'branches_admin_id_fkey') THEN
		ALTER TABLE branches ADD CONSTRAINT branches_admin_id_fkey 
			FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;
	END IF;
END $$;
`



const addBranchMissingColumns = `
DO $$ 
BEGIN
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'currency') THEN
		ALTER TABLE branches ADD COLUMN currency VARCHAR(10) DEFAULT 'UZS';
	END IF;
END $$;
`

const createBranchManagersTable = `
CREATE TABLE IF NOT EXISTS branch_managers (
	id UUID PRIMARY KEY,
	branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
	manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(branch_id, manager_id)
);
`

const createStudentsTable = `
CREATE TABLE IF NOT EXISTS students (
	id UUID PRIMARY KEY,
	full_name VARCHAR(255) NOT NULL,
	class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
	phone VARCHAR(20),
	parent_phone VARCHAR(20),
	monthly_payment DECIMAL(10, 2) NOT NULL,
	status VARCHAR(50) NOT NULL DEFAULT 'active',
	branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
	enrollment_date TIMESTAMP,
	left_date TIMESTAMP,
	class_signed_date TIMESTAMP,
	class_confirmed BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

const createClassesTable = `
CREATE TABLE IF NOT EXISTS classes (
	id UUID PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
	branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

const createTeachersTable = `
CREATE TABLE IF NOT EXISTS teachers (
	id UUID PRIMARY KEY,
	full_name VARCHAR(255) NOT NULL,
	subjects TEXT[] DEFAULT '{}',
	monthly_salary DECIMAL(10, 2) NOT NULL,
	phone VARCHAR(20),
	email VARCHAR(255),
	branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
	joined_date TIMESTAMP,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

const createTeacherClassesTable = `
CREATE TABLE IF NOT EXISTS teacher_classes (
	id UUID PRIMARY KEY,
	teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
	class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(teacher_id, class_id)
);
`

const createPaymentsTable = `
CREATE TABLE IF NOT EXISTS payments (
	id UUID PRIMARY KEY,
	student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
	amount DECIMAL(10, 2) NOT NULL,
	month VARCHAR(50) NOT NULL,
	year INTEGER NOT NULL,
	payment_method VARCHAR(50) NOT NULL,
	status VARCHAR(50) NOT NULL,
	invoice_number VARCHAR(255) UNIQUE NOT NULL,
	notes TEXT,
	paid_date TIMESTAMP,
	branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

	created_by UUID REFERENCES users(id) ON DELETE SET NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

const createSalariesTable = `
CREATE TABLE IF NOT EXISTS salaries (
	id UUID PRIMARY KEY,
	teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
	amount DECIMAL(10, 2) NOT NULL,
	month VARCHAR(50) NOT NULL,
	year INTEGER NOT NULL,
	payment_method VARCHAR(50) NOT NULL,
	status VARCHAR(50) NOT NULL,
	notes TEXT,
	paid_date TIMESTAMP,
	branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

	created_by UUID REFERENCES users(id) ON DELETE SET NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

const createExpensesTable = `
CREATE TABLE IF NOT EXISTS expenses (
	id UUID PRIMARY KEY,
	title VARCHAR(255) NOT NULL,
	description TEXT,
	amount DECIMAL(10, 2) NOT NULL,
	category VARCHAR(100) NOT NULL,
	payment_method VARCHAR(50) NOT NULL,
	date TIMESTAMP NOT NULL,
	branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

	created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	notes TEXT,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

const createIncomesTable = `
CREATE TABLE IF NOT EXISTS incomes (
	id UUID PRIMARY KEY,
	source VARCHAR(255) NOT NULL,
	amount DECIMAL(10, 2) NOT NULL,
	date TIMESTAMP NOT NULL,
	description TEXT,
	branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

const dropSettingsTable = `
DROP TABLE IF EXISTS settings CASCADE;
`

const createSettingsTable = `
CREATE TABLE IF NOT EXISTS settings (
	id UUID PRIMARY KEY,
	branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
	default_monthly_payment DECIMAL(10, 2),
	default_teacher_salary DECIMAL(10, 2),
	currency VARCHAR(10) DEFAULT 'USD',
	language VARCHAR(20) DEFAULT 'en',
	school_name VARCHAR(255),
	school_logo VARCHAR(500),
	current_month VARCHAR(50),
	current_year INTEGER,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(branch_id)
);
`

const createPermissionsTable = `
CREATE TABLE IF NOT EXISTS permissions (
	id UUID PRIMARY KEY,
	user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
	can_view_students BOOLEAN DEFAULT FALSE,
	can_create_students BOOLEAN DEFAULT FALSE,
	can_edit_students BOOLEAN DEFAULT FALSE,
	can_delete_students BOOLEAN DEFAULT FALSE,
	can_view_teachers BOOLEAN DEFAULT FALSE,
	can_create_teachers BOOLEAN DEFAULT FALSE,
	can_edit_teachers BOOLEAN DEFAULT FALSE,
	can_delete_teachers BOOLEAN DEFAULT FALSE,
	can_view_classes BOOLEAN DEFAULT FALSE,
	can_create_classes BOOLEAN DEFAULT FALSE,
	can_edit_classes BOOLEAN DEFAULT FALSE,
	can_delete_classes BOOLEAN DEFAULT FALSE,
	can_view_payments BOOLEAN DEFAULT FALSE,
	can_create_payments BOOLEAN DEFAULT FALSE,
	can_edit_payments BOOLEAN DEFAULT FALSE,
	can_view_salaries BOOLEAN DEFAULT FALSE,
	can_create_salaries BOOLEAN DEFAULT FALSE,
	can_edit_salaries BOOLEAN DEFAULT FALSE,
	can_view_expenses BOOLEAN DEFAULT FALSE,
	can_create_expenses BOOLEAN DEFAULT FALSE,
	can_edit_expenses BOOLEAN DEFAULT FALSE,
	can_delete_expenses BOOLEAN DEFAULT FALSE,
	can_view_reports BOOLEAN DEFAULT FALSE,
	can_view_settings BOOLEAN DEFAULT FALSE,
	can_edit_settings BOOLEAN DEFAULT FALSE
);
`

const grantTablePermissions = `
SELECT 1;
`

const createFinancialMonthsTable = `
CREATE TABLE IF NOT EXISTS financial_months (
	id UUID PRIMARY KEY,
	branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
	year INTEGER NOT NULL,
	month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
	status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
	payment_amount DECIMAL(15, 2) DEFAULT 0,
	opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	closed_at TIMESTAMP,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(branch_id, year, month)
);
`

const addCurrentFinancialMonthToBranches = `
DO $$ 
BEGIN
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'current_financial_month_id') THEN
		ALTER TABLE branches ADD COLUMN current_financial_month_id UUID REFERENCES financial_months(id) ON DELETE SET NULL;
	END IF;
END $$;
`

const addFinancialMonthIdToPayments = `
DO $$ 
BEGIN
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'financial_month_id') THEN
		ALTER TABLE payments ADD COLUMN financial_month_id UUID REFERENCES financial_months(id) ON DELETE RESTRICT;
	END IF;
END $$;
`

const addFinancialMonthIdToSalaries = `
DO $$ 
BEGIN
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salaries' AND column_name = 'financial_month_id') THEN
		ALTER TABLE salaries ADD COLUMN financial_month_id UUID REFERENCES financial_months(id) ON DELETE RESTRICT;
	END IF;
END $$;
`

const addFinancialMonthIdToExpenses = `
DO $$ 
BEGIN
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'financial_month_id') THEN
		ALTER TABLE expenses ADD COLUMN financial_month_id UUID REFERENCES financial_months(id) ON DELETE RESTRICT;
	END IF;
END $$;
`

const populateFinancialMonths = `
INSERT INTO financial_months (id, branch_id, year, month, status, payment_amount, opened_at)
SELECT 
    gen_random_uuid(),
    b.id,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
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

UPDATE branches b
SET current_financial_month_id = fm.id, updated_at = CURRENT_TIMESTAMP
FROM financial_months fm
WHERE b.id = fm.branch_id
    AND b.current_financial_month_id IS NULL
    AND fm.year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    AND fm.month = EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
`

const removeCurrentMonthYearFromBranches = `
DO $$ 
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'current_month') THEN
		ALTER TABLE branches DROP COLUMN current_month;
	END IF;
	IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'current_year') THEN
		ALTER TABLE branches DROP COLUMN current_year;
	END IF;
END $$;
`

const addMissingPermissionColumns = `
DO $$ 
BEGIN
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'permissions' AND column_name = 'can_create_students') THEN
		ALTER TABLE permissions 
			ADD COLUMN can_create_students BOOLEAN DEFAULT FALSE,
			ADD COLUMN can_create_teachers BOOLEAN DEFAULT FALSE,
			ADD COLUMN can_create_classes BOOLEAN DEFAULT FALSE,
			ADD COLUMN can_create_payments BOOLEAN DEFAULT FALSE,
			ADD COLUMN can_create_salaries BOOLEAN DEFAULT FALSE,
			ADD COLUMN can_create_expenses BOOLEAN DEFAULT FALSE;
	END IF;
END $$;
`

const addUpdatedAtToPayments = `
DO $$ 
BEGIN
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'updated_at') THEN
		ALTER TABLE payments ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
	END IF;
END $$;
`

const addUpdatedAtToSalaries = `
DO $$ 
BEGIN
	IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'salaries' AND column_name = 'updated_at') THEN
		ALTER TABLE salaries ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
	END IF;
END $$;
`

const createIndexes = `
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_students_branch_id ON students(branch_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch_id ON payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_month_year ON payments(month, year);
CREATE INDEX IF NOT EXISTS idx_payments_financial_month_id ON payments(financial_month_id);
CREATE INDEX IF NOT EXISTS idx_salaries_teacher_id ON salaries(teacher_id);
CREATE INDEX IF NOT EXISTS idx_salaries_branch_id ON salaries(branch_id);
CREATE INDEX IF NOT EXISTS idx_salaries_month_year ON salaries(month, year);
CREATE INDEX IF NOT EXISTS idx_salaries_financial_month_id ON salaries(financial_month_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_financial_month_id ON expenses(financial_month_id);
CREATE INDEX IF NOT EXISTS idx_incomes_branch_id ON incomes(branch_id);
CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
CREATE INDEX IF NOT EXISTS idx_classes_branch_id ON classes(branch_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teachers_branch_id ON teachers(branch_id);
CREATE INDEX IF NOT EXISTS idx_settings_branch_id ON settings(branch_id);
CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_months_branch_id ON financial_months(branch_id);
CREATE INDEX IF NOT EXISTS idx_financial_months_status ON financial_months(status);
CREATE INDEX IF NOT EXISTS idx_financial_months_year_month ON financial_months(year, month);
`

const seedSampleData = `
-- Only seed if database is empty (no users exist)
INSERT INTO users (id, email, password, role, full_name, created_at, updated_at)
SELECT gen_random_uuid(), 'admin@schoolcrm.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36DXa9FO', 'admin', 'Admin User', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1);
`
