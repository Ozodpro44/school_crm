-- Drop indexes
DROP INDEX IF EXISTS idx_teachers_branch_id;
DROP INDEX IF EXISTS idx_classes_branch_id;
DROP INDEX IF EXISTS idx_incomes_branch_id;
DROP INDEX IF EXISTS idx_expenses_branch_id;
DROP INDEX IF EXISTS idx_salaries_month_year;
DROP INDEX IF EXISTS idx_salaries_branch_id;
DROP INDEX IF EXISTS idx_salaries_teacher_id;
DROP INDEX IF EXISTS idx_payments_month_year;
DROP INDEX IF EXISTS idx_payments_branch_id;
DROP INDEX IF EXISTS idx_payments_student_id;
DROP INDEX IF EXISTS idx_students_class_id;
DROP INDEX IF EXISTS idx_students_branch_id;
DROP INDEX IF EXISTS idx_users_email;

-- Drop tables
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS incomes;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS salaries;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS teacher_subjects;
DROP TABLE IF EXISTS teachers;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS branches;
