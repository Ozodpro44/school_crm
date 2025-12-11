-- PostgreSQL Migrations for School Management System
-- Run migrations in order

-- ============================================================================
-- Migration 001: Create Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Migration 002: Create Enums
-- ============================================================================

CREATE TYPE user_role AS ENUM (
    'admin',
    'branch_admin',
    'manager',
    'accountant',
    'teacher',
    'student',
    'parent'
);

CREATE TYPE payment_method AS ENUM (
    'card',
    'cash',
    'bank'
);

CREATE TYPE student_status AS ENUM (
    'active',
    'left',
    'suspended'
);

CREATE TYPE payment_status AS ENUM (
    'paid',
    'unpaid',
    'partial'
);

CREATE TYPE language AS ENUM (
    'uz-cyrl',
    'uz-latn',
    'en'
);

-- ============================================================================
-- Migration 003: Create Permissions Table
-- ============================================================================

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    can_view_students BOOLEAN DEFAULT false,
    can_edit_students BOOLEAN DEFAULT false,
    can_delete_students BOOLEAN DEFAULT false,
    can_view_teachers BOOLEAN DEFAULT false,
    can_edit_teachers BOOLEAN DEFAULT false,
    can_delete_teachers BOOLEAN DEFAULT false,
    can_view_classes BOOLEAN DEFAULT false,
    can_edit_classes BOOLEAN DEFAULT false,
    can_delete_classes BOOLEAN DEFAULT false,
    can_view_payments BOOLEAN DEFAULT false,
    can_edit_payments BOOLEAN DEFAULT false,
    can_view_salaries BOOLEAN DEFAULT false,
    can_edit_salaries BOOLEAN DEFAULT false,
    can_view_expenses BOOLEAN DEFAULT false,
    can_edit_expenses BOOLEAN DEFAULT false,
    can_delete_expenses BOOLEAN DEFAULT false,
    can_view_reports BOOLEAN DEFAULT false,
    can_view_settings BOOLEAN DEFAULT false,
    can_edit_settings BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Migration 004: Create Branches Table
-- ============================================================================

CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    monthly_payment DECIMAL(12, 2) DEFAULT 0,
    admin_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_branches_admin_id ON branches(admin_id);

-- ============================================================================
-- Migration 005: Create Users Table
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    permissions_id UUID REFERENCES permissions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_branch_id ON users(branch_id);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- Migration 006: Create Classes Table
-- ============================================================================

CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    teacher_id UUID,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_classes_branch_id ON classes(branch_id);
CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);

-- ============================================================================
-- Migration 007: Create Students Table
-- ============================================================================

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    phone VARCHAR(20),
    parent_phone VARCHAR(20),
    monthly_payment DECIMAL(12, 2) DEFAULT 0,
    status student_status DEFAULT 'active',
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    enrollment_date TIMESTAMP WITH TIME ZONE,
    left_date TIMESTAMP WITH TIME ZONE,
    class_signed_date TIMESTAMP WITH TIME ZONE,
    class_confirmed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_students_branch_id ON students(branch_id);
CREATE INDEX idx_students_status ON students(status);

-- ============================================================================
-- Migration 008: Create Teachers Table
-- ============================================================================

CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    monthly_salary DECIMAL(12, 2) DEFAULT 0,
    phone VARCHAR(20),
    email VARCHAR(255),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    joined_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_teachers_branch_id ON teachers(branch_id);
CREATE INDEX idx_teachers_email ON teachers(email);

-- ============================================================================
-- Migration 009: Create Teacher Subjects Junction Table
-- ============================================================================

CREATE TABLE teacher_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_teacher_subjects_teacher_id ON teacher_subjects(teacher_id);

-- ============================================================================
-- Migration 010: Create Teacher Classes Assignment Table
-- ============================================================================

CREATE TABLE teacher_class_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_teacher_class_assignments_teacher_id ON teacher_class_assignments(teacher_id);
CREATE INDEX idx_teacher_class_assignments_class_id ON teacher_class_assignments(class_id);
CREATE UNIQUE INDEX idx_teacher_class_assignments_unique ON teacher_class_assignments(teacher_id, class_id);

-- ============================================================================
-- Migration 011: Create Payments Table
-- ============================================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    month VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    payment_method payment_method,
    status payment_status DEFAULT 'unpaid',
    invoice_number VARCHAR(100) NOT NULL,
    notes TEXT,
    paid_date TIMESTAMP WITH TIME ZONE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_branch_id ON payments(branch_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_month_year ON payments(month, year);
CREATE UNIQUE INDEX idx_payments_invoice_unique ON payments(invoice_number);

-- ============================================================================
-- Migration 012: Create Salaries Table
-- ============================================================================

CREATE TABLE salaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    month VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    payment_method payment_method,
    status payment_status DEFAULT 'unpaid',
    notes TEXT,
    paid_date TIMESTAMP WITH TIME ZONE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_salaries_teacher_id ON salaries(teacher_id);
CREATE INDEX idx_salaries_branch_id ON salaries(branch_id);
CREATE INDEX idx_salaries_status ON salaries(status);
CREATE INDEX idx_salaries_month_year ON salaries(month, year);

-- ============================================================================
-- Migration 013: Create Expenses Table
-- ============================================================================

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(12, 2) NOT NULL,
    category VARCHAR(255),
    payment_method payment_method,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);

-- ============================================================================
-- Migration 014: Create Incomes Table
-- ============================================================================

CREATE TABLE incomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    description TEXT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_incomes_branch_id ON incomes(branch_id);
CREATE INDEX idx_incomes_date ON incomes(date);

-- ============================================================================
-- Migration 015: Create Settings Table
-- ============================================================================

CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    default_monthly_payment DECIMAL(12, 2) DEFAULT 500000,
    default_teacher_salary DECIMAL(12, 2) DEFAULT 3000000,
    currency VARCHAR(10) DEFAULT 'UZS',
    language language DEFAULT 'uz-latn',
    school_name VARCHAR(255) NOT NULL DEFAULT 'Maktab Boshqaruv Tizimi',
    school_logo TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Migration 016: Add Teacher to Classes Foreign Key
-- ============================================================================

ALTER TABLE classes
ADD CONSTRAINT fk_classes_teacher_id
FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

-- ============================================================================
-- Migration 017: Create Audit Log Table
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- Migration 018: Create Sessions Table
-- ============================================================================

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================================
-- Migration 019: Create Trigger for Updated_at Columns
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON teachers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration 020: Create Views for Common Queries
-- ============================================================================

-- Student Payment Summary View
CREATE VIEW student_payment_summary AS
SELECT
    s.id,
    s.full_name,
    s.monthly_payment as required_payment,
    COUNT(p.id) as total_payments,
    SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END) as paid_amount,
    SUM(CASE WHEN p.status = 'unpaid' THEN p.amount ELSE 0 END) as unpaid_amount,
    SUM(CASE WHEN p.status = 'partial' THEN p.amount ELSE 0 END) as partial_amount,
    s.branch_id
FROM students s
LEFT JOIN payments p ON s.id = p.student_id
GROUP BY s.id, s.full_name, s.monthly_payment, s.branch_id;

-- Teacher Salary Summary View
CREATE VIEW teacher_salary_summary AS
SELECT
    t.id,
    t.full_name,
    t.monthly_salary,
    COUNT(s.id) as total_salaries,
    SUM(CASE WHEN s.status = 'paid' THEN s.amount ELSE 0 END) as paid_amount,
    SUM(CASE WHEN s.status = 'unpaid' THEN s.amount ELSE 0 END) as unpaid_amount,
    t.branch_id
FROM teachers t
LEFT JOIN salaries s ON t.id = s.teacher_id
GROUP BY t.id, t.full_name, t.monthly_salary, t.branch_id;

-- Class Students Count View
CREATE VIEW class_student_count AS
SELECT
    c.id,
    c.name,
    c.branch_id,
    COUNT(s.id) as student_count
FROM classes c
LEFT JOIN students s ON c.id = s.class_id AND s.status = 'active'
GROUP BY c.id, c.name, c.branch_id;

-- Branch Financial Summary View
CREATE VIEW branch_financial_summary AS
SELECT
    b.id,
    b.name,
    COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(e.amount), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) - 
    COALESCE(SUM(e.amount), 0) as net_profit
FROM branches b
LEFT JOIN payments p ON b.id = p.branch_id
LEFT JOIN expenses e ON b.id = e.branch_id
GROUP BY b.id, b.name;
