-- Fix missing permissions for existing users
-- This script creates default permissions for all users who don't have them yet

BEGIN;

-- For managers and branch_admins: view/edit most, limited delete
INSERT INTO permissions (
  id, user_id, 
  can_view_students, can_edit_students, can_delete_students,
  can_view_teachers, can_edit_teachers, can_delete_teachers,
  can_view_classes, can_edit_classes, can_delete_classes,
  can_view_payments, can_edit_payments,
  can_view_salaries, can_edit_salaries,
  can_view_expenses, can_edit_expenses, can_delete_expenses,
  can_view_reports, can_finish_month, can_view_settings, can_edit_settings
)
SELECT 
  gen_random_uuid(), u.id,
  true, true, false,
  true, true, false,
  true, true, false,
  true, true,
  true, true,
  true, true, false,
  true, true, false, false
FROM users u
WHERE u.role IN ('manager', 'branch_admin')
AND NOT EXISTS (SELECT 1 FROM permissions WHERE user_id = u.id);

-- For accountants: view most, edit payments/salaries/expenses only
INSERT INTO permissions (
  id, user_id,
  can_view_students, can_edit_students, can_delete_students,
  can_view_teachers, can_edit_teachers, can_delete_teachers,
  can_view_classes, can_edit_classes, can_delete_classes,
  can_view_payments, can_edit_payments,
  can_view_salaries, can_edit_salaries,
  can_view_expenses, can_edit_expenses, can_delete_expenses,
  can_view_reports, can_finish_month, can_view_settings, can_edit_settings
)
SELECT
  gen_random_uuid(), u.id,
  true, false, false,
  true, false, false,
  true, false, false,
  true, true,
  true, true,
  true, true, false,
  true, false, false, false
FROM users u
WHERE u.role = 'accountant'
AND NOT EXISTS (SELECT 1 FROM permissions WHERE user_id = u.id);

-- For admins: full access
INSERT INTO permissions (
  id, user_id,
  can_view_students, can_edit_students, can_delete_students,
  can_view_teachers, can_edit_teachers, can_delete_teachers,
  can_view_classes, can_edit_classes, can_delete_classes,
  can_view_payments, can_edit_payments,
  can_view_salaries, can_edit_salaries,
  can_view_expenses, can_edit_expenses, can_delete_expenses,
  can_view_reports, can_finish_month, can_view_settings, can_edit_settings
)
SELECT
  gen_random_uuid(), u.id,
  true, true, true,
  true, true, true,
  true, true, true,
  true, true,
  true, true,
  true, true, true,
  true, true, true, true
FROM users u
WHERE u.role = 'admin'
AND NOT EXISTS (SELECT 1 FROM permissions WHERE user_id = u.id);

COMMIT;
